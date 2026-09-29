// Appends a new final page to a generated proposal PDF recording the
// client's acceptance — signer name, date, and the signature itself
// (drawn image or typed text). Deliberately appended as a NEW page rather
// than drawn over the frozen template's own last page, so the approved
// design is never visually altered by this stamp. Uses pdf-lib, already a
// dependency from Phase 06 (used there for mergePdfBuffers) — no new
// rendering engine, no new package.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface StampSignatureInput {
  pdfBytes: Buffer
  signerName: string
  acceptedAt: string
  method: 'drawn' | 'typed'
  signatureImageBytes?: Buffer
  signatureText?: string
}

const STAMP_PAGE_HEIGHT = 420
const DEFAULT_WIDTH = 595.28 // A4 width in points, used only if the source PDF has no pages

export async function stampSignature(input: StampSignatureInput): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(input.pdfBytes)
  const existingPages = pdfDoc.getPages()
  const referenceWidth = existingPages[existingPages.length - 1]?.getWidth() ?? DEFAULT_WIDTH
  const page = pdfDoc.addPage([referenceWidth, STAMP_PAGE_HEIGHT])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const marginX = 48
  let y = STAMP_PAGE_HEIGHT - 72

  page.drawText('Signed & Accepted', { x: marginX, y, size: 18, font: boldFont, color: rgb(0.05, 0.1, 0.12) })
  y -= 36

  const formattedDate = `${new Date(input.acceptedAt).toLocaleString('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  })} UK time`

  page.drawText(`Signer: ${input.signerName}`, { x: marginX, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) })
  y -= 20
  page.drawText(`Accepted: ${formattedDate}`, { x: marginX, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) })
  y -= 32

  if (input.method === 'drawn' && input.signatureImageBytes) {
    const image = await pdfDoc.embedPng(input.signatureImageBytes)
    const maxWidth = referenceWidth - marginX * 2
    const scale = Math.min(maxWidth / image.width, 1)
    const imgWidth = image.width * scale
    const imgHeight = image.height * scale
    page.drawImage(image, { x: marginX, y: y - imgHeight, width: imgWidth, height: imgHeight })
  } else if (input.signatureText) {
    page.drawText(input.signatureText, { x: marginX, y: y - 24, size: 26, font: boldFont, color: rgb(0.05, 0.1, 0.12) })
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
