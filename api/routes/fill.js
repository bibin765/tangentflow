import { PDFDocument } from 'pdf-lib'

export default async function fillRoute(fastify) {
  fastify.post('/v1/fill', async (request, reply) => {
    const { template, fields } = request.body || {}

    // template: base64-encoded PDF or URL to a PDF
    // fields: { fieldName: value, ... }

    if (!template || !fields) {
      return reply.status(400).send({
        error: 'Missing required fields',
        details: '"template" (base64 PDF or URL) and "fields" (object) are required',
        example: {
          template: 'base64_or_url',
          fields: { name: 'John Doe', date: '2026-04-07', amount: '$500' }
        }
      })
    }

    try {
      // Load the PDF template
      let pdfBytes
      if (template.startsWith('http://') || template.startsWith('https://')) {
        const response = await fetch(template)
        pdfBytes = await response.arrayBuffer()
      } else {
        // Assume base64
        pdfBytes = Buffer.from(template, 'base64')
      }

      const pdfDoc = await PDFDocument.load(pdfBytes)
      const form = pdfDoc.getForm()

      // Fill form fields
      const filledFields = []
      const skippedFields = []

      for (const [name, value] of Object.entries(fields)) {
        try {
          const field = form.getField(name)
          const fieldType = field.constructor.name

          if (fieldType === 'PDFTextField') {
            field.setText(String(value))
          } else if (fieldType === 'PDFCheckBox') {
            if (value === true || value === 'true' || value === '1') {
              field.check()
            } else {
              field.uncheck()
            }
          } else if (fieldType === 'PDFDropdown') {
            field.select(String(value))
          } else if (fieldType === 'PDFRadioGroup') {
            field.select(String(value))
          }
          filledFields.push(name)
        } catch (err) {
          skippedFields.push({ name, error: err.message })
        }
      }

      // Optionally flatten the form (make fields non-editable)
      if (request.body.flatten !== false) {
        form.flatten()
      }

      const resultBytes = await pdfDoc.save()

      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', 'inline; filename="filled.pdf"')
      reply.header('X-TangentFlow-Fields-Filled', filledFields.length)
      reply.header('X-TangentFlow-Fields-Skipped', skippedFields.length)

      return reply.send(Buffer.from(resultBytes))
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({
        error: 'Form filling failed',
        message: err.message,
      })
    }
  })

  // List form fields in a PDF (useful for discovering field names)
  fastify.post('/v1/fill/fields', async (request, reply) => {
    const { template } = request.body || {}

    if (!template) {
      return reply.status(400).send({ error: 'Missing "template" (base64 PDF or URL)' })
    }

    try {
      let pdfBytes
      if (template.startsWith('http://') || template.startsWith('https://')) {
        const response = await fetch(template)
        pdfBytes = await response.arrayBuffer()
      } else {
        pdfBytes = Buffer.from(template, 'base64')
      }

      const pdfDoc = await PDFDocument.load(pdfBytes)
      const form = pdfDoc.getForm()
      const fields = form.getFields().map(field => ({
        name: field.getName(),
        type: field.constructor.name.replace('PDF', '').replace('Field', ''),
        required: field.isRequired?.() || false,
      }))

      return reply.send({ fields, count: fields.length })
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to read form fields', message: err.message })
    }
  })
}
