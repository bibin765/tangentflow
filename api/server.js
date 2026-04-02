// Canvas polyfill must be first — before any TangentFlow imports
import './lib/setup.js'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { authMiddleware } from './middleware/auth.js'
import renderRoute from './routes/render.js'
import keysRoute from './routes/keys.js'
import webhooksRoute from './routes/webhooks.js'

const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  bodyLimit: 10 * 1024 * 1024, // 10MB max body (for images in schemas)
})

// ── CORS ──
await fastify.register(cors, {
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : true,
})

// ── Rate limiting (global fallback) ──
await fastify.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    const auth = request.headers.authorization
    if (auth) return auth.slice(7).trim()
    return request.ip
  },
})

// ── Health check (no auth) ──
fastify.get('/health', async () => ({ status: 'ok', service: 'tangentflow-api' }))

// ── API info (no auth) ──
fastify.get('/', async () => ({
  name: 'TangentFlow API',
  version: '1.0.0',
  docs: 'https://tangentflow.com/docs',
  endpoints: {
    'POST /v1/signup': 'Get a free API key (email required)',
    'POST /v1/render': 'Generate a PDF from JSON schema',
    'GET /v1/usage': 'Check your usage stats',
    'GET /v1/keys': 'List your API keys',
  },
}))

// ── Webhooks (no auth, verified by signature) ──
await fastify.register(webhooksRoute)

// ── Public routes (no auth) ──
fastify.register(async (publicApp) => {
  const { createApiKey } = await import('./db/db.js')

  publicApp.post('/v1/signup', async (request, reply) => {
    const { email } = request.body || {}
    if (!email || !email.includes('@')) {
      return reply.status(400).send({ error: 'Valid email required' })
    }
    const userId = email.toLowerCase().trim()
    const key = createApiKey(userId, email, 'free')
    return reply.status(201).send({
      apiKey: key.id,
      tier: key.tier,
      monthlyLimit: key.monthlyLimit,
      message: 'Your API key is ready. Include it as: Authorization: Bearer ' + key.id,
    })
  })
})

// ── Authenticated routes ──
fastify.register(async (authedApp) => {
  authedApp.addHook('preHandler', authMiddleware)
  await authedApp.register(renderRoute)
  await authedApp.register(keysRoute)
})

// ── Start ──
try {
  await fastify.listen({ port: PORT, host: HOST })
  fastify.log.info(`TangentFlow API running on http://${HOST}:${PORT}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
