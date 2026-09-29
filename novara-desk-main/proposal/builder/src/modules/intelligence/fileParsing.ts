export type TranscriptFileKind = 'txt' | 'docx' | 'pdf' | 'notes'

/**
 * All parsing happens client-side, in the browser — the server-side
 * analysis route only ever receives plain text, regardless of which file
 * type it came from (or whether it was pasted directly). Keeps
 * api/ai/analyze-meeting.ts as simple as every other AI route in this app
 * (a single `transcript: string` input), and avoids introducing a second,
 * file-upload-shaped API contract just for this one screen.
 *
 * mammoth/pdfjs-dist are dynamically imported (not top-level) so they're
 * only ever downloaded by a browser that actually clicks "Upload DOCX"/
 * "Upload PDF" — without this, Vite bundles both into the app's main
 * chunk, nearly tripling its size for every page load, including staff
 * who never touch this screen.
 */
export async function extractTextFromFile(file: File, kind: TranscriptFileKind): Promise<string> {
  if (kind === 'docx') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
  }

  if (kind === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

    const arrayBuffer = await file.arrayBuffer()
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pageTexts: string[] = []
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pageTexts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return pageTexts.join('\n\n').trim()
  }

  // 'txt' and 'notes' — plain text files, read as-is.
  return (await file.text()).trim()
}
