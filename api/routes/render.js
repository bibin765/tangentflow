import { renderFromSchema } from '@upbrew/tangentflow'
import { renderToPDF } from '@upbrew/tangentflow/renderers/pdf-lib'
import * as pdfLib from 'pdf-lib'
import { incrementUsage, touchKey } from '../db/db.js'

export default async function renderRoute(fastify) {
  fastify.post('/v1/render', async (request, reply) => {
    const body = request.body

    // Validate input
    if (!body || !body.blocks || !Array.isArray(body.blocks)) {
      return reply.status(400).send({
        error: 'Invalid schema',
        details: 'Request body must include a "blocks" array',
        example: { blocks: [{ type: 'heading', text: 'Hello', level: 1 }] }
      })
    }

    try {
      const startTime = Date.now()

      // Render document using TangentFlow core
      const result = renderFromSchema({
        page: body.page,
        colors: body.colors,
        headerFooter: body.headerFooter,
        watermark: body.watermark,
        metadata: body.metadata,
        blocks: body.blocks,
      })

      // Generate PDF
      const pdfBytes = await renderToPDF(result, { pdfLib })

      // Track usage
      const newCount = incrementUsage(request.apiKey.id)
      touchKey(request.apiKey.id)

      const elapsed = Date.now() - startTime

      // Set response headers
      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', 'inline; filename="document.pdf"')
      reply.header('X-TangentFlow-Pages', result.pages.length)
      reply.header('X-TangentFlow-Time', `${elapsed}ms`)
      reply.header('X-TangentFlow-Usage', `${newCount}/${request.apiKey.monthly_limit}`)

      return reply.send(Buffer.from(pdfBytes))
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({
        error: 'PDF generation failed',
        message: err.message,
      })
    }
  })
}
