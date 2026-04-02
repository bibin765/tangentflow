import { createApiKey, getKeysByUser, getApiKey, deactivateKey } from '../db/db.js'

export default async function keysRoute(fastify) {
  // Sign up for a free API key (no auth required)
  fastify.post('/v1/signup', async (request, reply) => {
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

  // Get usage stats (authenticated)
  fastify.get('/v1/usage', async (request, reply) => {
    // Auth check is done by middleware on this route
    const { apiKey, usage } = request

    return reply.send({
      tier: apiKey.tier,
      month: usage.month,
      used: usage.used,
      limit: usage.limit,
      remaining: usage.limit - usage.used,
    })
  })

  // List keys for a user (authenticated via any of their keys)
  fastify.get('/v1/keys', async (request, reply) => {
    const keys = getKeysByUser(request.apiKey.user_id)
    return reply.send({ keys })
  })

  // Revoke a key (authenticated)
  fastify.delete('/v1/keys/:keyId', async (request, reply) => {
    const { keyId } = request.params
    const key = getApiKey(keyId)

    if (!key || key.user_id !== request.apiKey.user_id) {
      return reply.status(404).send({ error: 'Key not found' })
    }

    deactivateKey(keyId)
    return reply.send({ message: 'Key revoked', keyId })
  })
}
