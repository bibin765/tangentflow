import { createApiKey, updateKeyTier, deactivateKey, upsertSubscription, getKeysByUser } from '../db/db.js'
import { createHmac } from 'crypto'

export default async function webhooksRoute(fastify) {
  fastify.post('/webhooks/dodo', {
    config: { rawBody: true }
  }, async (request, reply) => {
    const secret = process.env.DODO_WEBHOOK_SECRET

    // Verify webhook signature if secret is configured
    if (secret) {
      const signature = request.headers['x-dodo-signature'] || request.headers['webhook-signature'] || ''
      const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
      const expected = createHmac('sha256', secret).update(body).digest('hex')

      if (signature !== expected && signature !== `sha256=${expected}`) {
        fastify.log.warn('Webhook signature verification failed')
        return reply.status(401).send({ error: 'Invalid signature' })
      }
    }

    const event = request.body
    const eventType = event.type || event.event_type || ''

    fastify.log.info(`Dodo webhook: ${eventType}`)

    try {
      switch (eventType) {
        case 'subscription.active':
        case 'subscription.created': {
          const sub = event.data || event
          const userId = sub.customer_id || sub.customer?.email || sub.metadata?.user_id
          const tier = mapProductToTier(sub.product_id || sub.plan_id)

          if (!userId) {
            fastify.log.warn('Webhook missing customer ID')
            break
          }

          // Check if user already has a key
          const existingKeys = getKeysByUser(userId)
          let keyId

          if (existingKeys.length > 0) {
            keyId = existingKeys[0].id
            updateKeyTier(keyId, tier)
          } else {
            const key = createApiKey(userId, sub.customer?.email || userId, tier)
            keyId = key.id
          }

          upsertSubscription(sub.id || sub.subscription_id, userId, tier, 'active', keyId, sub)
          fastify.log.info(`Provisioned ${tier} key for ${userId}: ${keyId}`)
          break
        }

        case 'subscription.cancelled':
        case 'subscription.expired': {
          const sub = event.data || event
          const userId = sub.customer_id || sub.customer?.email || sub.metadata?.user_id
          if (userId) {
            const keys = getKeysByUser(userId)
            for (const key of keys) {
              updateKeyTier(key.id, 'free') // downgrade to free, don't deactivate
            }
            upsertSubscription(sub.id || sub.subscription_id, userId, 'free', 'cancelled', null, sub)
            fastify.log.info(`Downgraded ${userId} to free tier`)
          }
          break
        }

        case 'payment.failed': {
          const sub = event.data || event
          const userId = sub.customer_id || sub.customer?.email
          if (userId) {
            upsertSubscription(sub.subscription_id || sub.id, userId, 'free', 'past_due', null, sub)
            fastify.log.info(`Payment failed for ${userId}`)
          }
          break
        }

        default:
          fastify.log.info(`Unhandled webhook event: ${eventType}`)
      }
    } catch (err) {
      fastify.log.error(`Webhook processing error: ${err.message}`)
    }

    // Always return 200 to acknowledge receipt
    return reply.send({ received: true })
  })
}

function mapProductToTier(productId) {
  // Map Dodo product IDs to tiers — update these after creating products
  const mapping = {
    // Set these to your actual Dodo product IDs:
    // 'prod_starter_xxx': 'starter',
    // 'prod_growth_xxx': 'growth',
    // 'prod_scale_xxx': 'scale',
  }
  return mapping[productId] || 'starter'
}
