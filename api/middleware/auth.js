import { getApiKey, getUsage, getCurrentMonth } from '../db/db.js'

export async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing API key. Use: Authorization: Bearer tf_xxx' })
  }

  const keyId = authHeader.slice(7).trim()
  const key = getApiKey(keyId)

  if (!key) {
    return reply.status(401).send({ error: 'Invalid API key' })
  }

  // Check usage limits
  const month = getCurrentMonth()
  const used = getUsage(keyId, month)

  if (used >= key.monthly_limit) {
    return reply.status(429).send({
      error: 'Monthly limit exceeded',
      tier: key.tier,
      limit: key.monthly_limit,
      used,
      reset: month + '-01',
      upgrade: 'https://tangentflow.com/pricing'
    })
  }

  // Attach to request for downstream use
  request.apiKey = key
  request.usage = { month, used, limit: key.monthly_limit }
}
