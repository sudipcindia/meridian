// Generic, document-agnostic PDF rendering engine — has zero knowledge of
// "proposals" or any other document type. Navigates headless Chromium to
// any URL, waits for that page's own readiness marker, and captures a PDF
// via the browser's native print-to-PDF (honouring any per-element @page
// CSS the target page has already set up itself). Reusable verbatim by
// future document types (Quotation, Invoice, Contract, Audit Report) — they
// only ever need their own print-ready URL; nothing here changes for them.
//
// Server-only (Node runtime) — never imported from client code. This file
// lives under api/_lib/ specifically because Vercel excludes
// underscore-prefixed paths under api/ from becoming routes.

import puppeteer from 'puppeteer-core'
import { PDFDocument } from 'pdf-lib'

// Vercel's serverless functions run on a Lambda-based runtime but never set
// AWS_EXECUTION_ENV / AWS_LAMBDA_JS_RUNTIME the way native AWS Lambda does.
// @sparticuz/chromium's isRunningInAwsLambda*() checks read exactly those
// two variables to decide whether to also extract the Amazon-Linux shared
// library tarball (al2023.tar.br, which contains libnss3.so and friends)
// alongside the chromium binary and point LD_LIBRARY_PATH at it. Without
// this, the binary extracts but its runtime deps never do, so launch fails
// with "error while loading shared libraries: libnss3.so: cannot open
// shared object file" — this was the actual cause of production PDF
// generation failing outright. Setting this before chromium's first import
// (a dynamic import below, so this line always runs first) makes the
// package take the Node 20 Lambda code path and self-heal.
// See https://github.com/Sparticuz/chromium/issues/285.
process.env.AWS_EXECUTION_ENV ??= 'AWS_Lambda_nodejs20.x'

export interface RenderToPdfOptions {
  url: string
  readySelector?: string
  timeoutMs?: number
  deviceScaleFactor?: number
  /** Extra HTTP headers attached to every request this page makes (including its own subsequent fetch() calls) — e.g. an internal shared secret so a print-ready view's own data-resolve endpoint can reject anyone who isn't this engine. Stays generic/document-agnostic here; the specific header value is the calling adapter's concern. */
  extraHeaders?: Record<string, string>
}

export interface GeneratedPdf {
  buffer: Buffer
  pageCount: number
}

const DEFAULT_READY_SELECTOR = '[data-pdf-ready="true"]'
const DEFAULT_TIMEOUT_MS = 45000
const DEFAULT_DEVICE_SCALE_FACTOR = 2

export async function renderUrlToPdf(options: RenderToPdfOptions): Promise<GeneratedPdf> {
  const {
    url,
    readySelector = DEFAULT_READY_SELECTOR,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    deviceScaleFactor = DEFAULT_DEVICE_SCALE_FACTOR,
    extraHeaders,
  } = options

  const chromium = (await import('@sparticuz/chromium')).default

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor },
    executablePath: await chromium.executablePath(),
    headless: true,
  })

  try {
    const page = await browser.newPage()
    // The headless page's own console errors/failed requests are otherwise
    // invisible from here — forwarding them is the only way to diagnose a
    // future print-ready timeout (e.g. the missing-secret/missing-bucket
    // failures this surfaced) from server logs alone.
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`[pdf-view console:error] ${msg.text()}`)
    })
    page.on('pageerror', (err) => console.error(`[pdf-view pageerror] ${err.message}`))
    page.on('requestfailed', (req) => console.error(`[pdf-view requestfailed] ${req.url()} ${req.failure()?.errorText}`))
    if (extraHeaders) await page.setExtraHTTPHeaders(extraHeaders)
    await page.goto(url, { waitUntil: 'networkidle0', timeout: timeoutMs })
    await page.waitForSelector(readySelector, { timeout: timeoutMs })

    const pdfBytes = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    })

    const buffer = Buffer.from(pdfBytes)
    const pageCount = await countPdfPages(buffer)
    return { buffer, pageCount }
  } finally {
    await browser.close()
  }
}

async function countPdfPages(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer)
  return doc.getPageCount()
}
