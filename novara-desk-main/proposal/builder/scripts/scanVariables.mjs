// Scans the frozen master template (proposal/components/proposal/*.tsx) for
// (1) the bracket-style placeholders already used in the approved design,
// generating src/modules/variables/manifest.generated.ts, and (2) generic
// editable text blocks for the Proposal Editor, generating
// src/modules/variables/contentBlocks.generated.ts.
//
// This script only ever READS the master template — it never writes to
// proposal/components/proposal/**. Run via `npm run scan:variables`
// (also wired into predev/prebuild so neither manifest can go stale).
//
// Why a real parser instead of a regex over raw file text: the template
// also contains plain code that happens to use square brackets — e.g.
// `TAG_SLOTS[i]` (array indexing), `(typeof CARDS)[number]` (an indexed
// access type), and `}, [isDesktopTablet])` (an effect dependency array).
// Those are a different AST node kind entirely (MemberExpression /
// TSIndexedAccessType / ArrayLiteralExpression) from real placeholder text
// (JsxText / StringLiteral / template literal spans), so only walking the
// latter node kinds makes false positives structurally impossible — no
// heuristic needed, and no placeholder list is ever hardcoded here.

import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = path.resolve(__dirname, '../../components/proposal')
const PLACEHOLDER_OUTPUT_FILE = path.resolve(__dirname, '../src/modules/variables/manifest.generated.ts')
const CONTENT_BLOCKS_OUTPUT_FILE = path.resolve(__dirname, '../src/modules/variables/contentBlocks.generated.ts')

const PLACEHOLDER_PATTERN = /\[([A-Za-z][A-Za-z ]+)\]/g
const SOLE_PLACEHOLDER_PATTERN = /^\[[A-Za-z][A-Za-z ]+\]$/
const CONTENT_TAG_NAMES = new Set(['p', 'h1', 'h2', 'h3', 'span'])

// TypeScript's JsxText.text preserves raw source characters — an HTML entity
// written literally in JSX (e.g. `Bristol &amp; South West`) stays as
// "&amp;" in the AST, but the JSX-to-JS compiler DOES decode it, so the
// actual browser DOM text node ends up as "Bristol & South West". Without
// decoding here, contentBlocks.generated.ts's originalText would never
// exact-match the real rendered text, so domPatch.ts's untagged-text lookup
// (modules/editor/domPatch.ts) could never find that node at all — any
// override for such a block would silently never apply, no error, ever.
const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }
function decodeHtmlEntities(text) {
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => HTML_ENTITIES[m])
}

// ─── Read every .tsx file in the master template folder (read-only) ────────

const fileNames = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.tsx'))

/** @type {Map<string, { placeholders: { token: string, sample: string }[], contentBlocks: { text: string, variant: 'desktop'|'mobile'|'both' }[], imports: string[] }>} */
const perFile = new Map()

function isAriaHiddenAncestor(node) {
  let current = node.parent
  while (current) {
    if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) {
      for (const attr of current.attributes.properties) {
        if (
          ts.isJsxAttribute(attr) &&
          attr.name.getText() === 'aria-hidden' &&
          attr.initializer &&
          ((ts.isStringLiteral(attr.initializer) && attr.initializer.text === 'true') ||
            (ts.isJsxExpression(attr.initializer) && attr.initializer.expression?.getText() === 'true'))
        ) {
          return true
        }
      }
    }
    current = current.parent
  }
  return false
}

/** Walks up from a JSX element to the nearest named enclosing function (Desktop/Tablet vs Mobile render tree). */
function enclosingVariant(node) {
  let current = node.parent
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current)) &&
      current.name?.text
    ) {
      if (/^DesktopTablet/.test(current.name.text)) return 'desktop'
      if (/^Mobile/.test(current.name.text)) return 'mobile'
    }
    current = current.parent
  }
  return 'both'
}

for (const fileName of fileNames) {
  const filePath = path.join(TEMPLATE_DIR, fileName)
  const text = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  const placeholders = []
  const contentBlocks = []
  const imports = []

  function recordPlaceholderMatches(raw) {
    const collapsed = raw.replace(/\s+/g, ' ').trim()
    if (!collapsed) return
    for (const match of collapsed.matchAll(PLACEHOLDER_PATTERN)) {
      const token = `[${match[1]}]`
      const start = Math.max(0, match.index - 60)
      const end = Math.min(collapsed.length, match.index + token.length + 60)
      const sample = (start > 0 ? '…' : '') + collapsed.slice(start, end).trim() + (end < collapsed.length ? '…' : '')
      placeholders.push({ token, sample })
    }
  }

  function tryRecordContentBlock(jsxElement) {
    const tagName = jsxElement.openingElement?.tagName?.getText()
    if (!tagName || !CONTENT_TAG_NAMES.has(tagName)) return
    if (jsxElement.children.length === 0) return
    if (!jsxElement.children.every((c) => ts.isJsxText(c))) return // only pure-text leaves — no embedded expressions
    if (isAriaHiddenAncestor(jsxElement)) return

    const collapsed = decodeHtmlEntities(jsxElement.children.map((c) => c.text).join(''))
      .replace(/\s+/g, ' ')
      .trim()
    if (!collapsed || SOLE_PLACEHOLDER_PATTERN.test(collapsed)) return // skip empty or placeholder-only blocks

    contentBlocks.push({ text: collapsed, variant: enclosingVariant(jsxElement) })
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      recordPlaceholderMatches(node.text)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      recordPlaceholderMatches(node.text)
    } else if (ts.isTemplateExpression(node)) {
      recordPlaceholderMatches(node.head.text)
      for (const span of node.templateSpans) recordPlaceholderMatches(span.literal.text)
    } else if (ts.isJsxElement(node)) {
      tryRecordContentBlock(node)
    } else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text
      if (spec.startsWith('.')) {
        const resolved = `${path.basename(spec, path.extname(spec))}.tsx`
        if (fileNames.includes(resolved)) imports.push(resolved)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  perFile.set(fileName, { placeholders, contentBlocks, imports })
}

// ─── Detect root (page) files by filename convention, mirroring MASTER_TEMPLATE_PAGES ──

function pageIdForFile(fileName) {
  if (fileName === 'ProposalCover.tsx') return 'cover'
  const m = fileName.match(/^ProposalPage(\d{2})\.tsx$/)
  return m ? `page${m[1]}` : null
}

const rootFiles = fileNames
  .map((f) => ({ file: f, pageId: pageIdForFile(f) }))
  .filter((r) => r.pageId !== null)
  .sort((a, b) => (a.pageId === 'cover' ? -1 : b.pageId === 'cover' ? 1 : a.pageId.localeCompare(b.pageId)))

// ─── For each root file, union its own findings with every locally-imported file's (transitively) ──

function collectFromImportGraph(rootFile, key) {
  const visited = new Set()
  const collected = []
  const stack = [rootFile]
  while (stack.length) {
    const current = stack.pop()
    if (visited.has(current)) continue
    visited.add(current)
    const entry = perFile.get(current)
    if (!entry) continue
    collected.push(...entry[key])
    for (const imported of entry.imports) stack.push(imported)
  }
  return collected
}

// ─── Aggregate placeholders globally: unique tokens, in page order, tracking every page each appears on ──

function toKey(phrase) {
  const words = phrase.trim().split(/\s+/)
  return words
    .map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
}

function toLabel(phrase) {
  return phrase
    .trim()
    .split(/\s+/)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** @type {Map<string, { token: string, key: string, label: string, pages: string[], sample: string }>} */
const manifestByToken = new Map()

for (const { file, pageId } of rootFiles) {
  for (const { token, sample } of collectFromImportGraph(file, 'placeholders')) {
    const phrase = token.slice(1, -1)
    let entry = manifestByToken.get(token)
    if (!entry) {
      entry = { token, key: toKey(phrase), label: toLabel(phrase), pages: [], sample }
      manifestByToken.set(token, entry)
    }
    if (!entry.pages.includes(pageId)) entry.pages.push(pageId)
  }
}

const manifest = [...manifestByToken.values()]

// ─── Aggregate content blocks per page: dedupe by (page, exact text), coalescing desktop/mobile duplicates ──

const contentBlockManifest = []

for (const { file, pageId } of rootFiles) {
  const byText = new Map()
  for (const { text, variant } of collectFromImportGraph(file, 'contentBlocks')) {
    let entry = byText.get(text)
    if (!entry) {
      entry = { text, variants: new Set() }
      byText.set(text, entry)
    }
    entry.variants.add(variant)
  }
  let index = 0
  for (const { text, variants } of byText.values()) {
    index += 1
    contentBlockManifest.push({
      key: `${pageId}.block${index}`,
      page: pageId,
      originalText: text,
      label: text.length > 48 ? `${text.slice(0, 45).trim()}…` : text,
      variants: [...variants],
    })
  }
}

// ─── Emit the generated TypeScript modules ──────────────────────────────────

const registryEntries = manifest.map((e) => `  ${JSON.stringify(e.token)}: ${JSON.stringify(e.key)},`).join('\n')

const manifestEntries = manifest
  .map(
    (e) =>
      `  { token: ${JSON.stringify(e.token)}, key: ${JSON.stringify(e.key)}, label: ${JSON.stringify(e.label)}, pages: ${JSON.stringify(e.pages)}, sample: ${JSON.stringify(e.sample)} },`
  )
  .join('\n')

const placeholderOutput = `// AUTO-GENERATED by scripts/scanVariables.mjs — do not hand-edit.
// Regenerate with: npm run scan:variables
// Source: proposal/components/proposal/*.tsx (read-only scan, never modified)

export const PLACEHOLDER_REGISTRY = {
${registryEntries}
} as const

export interface TemplateVariableManifestEntry {
  token: string
  key: string
  label: string
  pages: string[]
  sample: string
}

export const TEMPLATE_VARIABLE_MANIFEST: readonly TemplateVariableManifestEntry[] = [
${manifestEntries}
] as const
`

fs.writeFileSync(PLACEHOLDER_OUTPUT_FILE, placeholderOutput, 'utf8')

const contentBlockEntries = contentBlockManifest
  .map(
    (e) =>
      `  { key: ${JSON.stringify(e.key)}, page: ${JSON.stringify(e.page)}, originalText: ${JSON.stringify(e.originalText)}, label: ${JSON.stringify(e.label)}, variants: ${JSON.stringify(e.variants)} },`
  )
  .join('\n')

const contentBlocksOutput = `// AUTO-GENERATED by scripts/scanVariables.mjs — do not hand-edit.
// Regenerate with: npm run scan:variables
// Source: proposal/components/proposal/*.tsx (read-only scan, never modified)
//
// Generic editable text blocks (paragraphs/headings), distinct from the
// bracket-placeholder manifest — used by the Proposal Editor's live preview
// patching and click-to-edit popover. A block whose ENTIRE text is a single
// bracket placeholder is deliberately excluded here (already covered by
// manifest.generated.ts) to avoid two editable surfaces for the same span.

export interface ContentBlockManifestEntry {
  key: string
  page: string
  originalText: string
  label: string
  variants: string[]
}

export const CONTENT_BLOCK_MANIFEST: readonly ContentBlockManifestEntry[] = [
${contentBlockEntries}
] as const
`

fs.writeFileSync(CONTENT_BLOCKS_OUTPUT_FILE, contentBlocksOutput, 'utf8')

console.log(`Scanned ${fileNames.length} master template files.`)
console.log(`Found ${manifest.length} unique placeholder(s):`)
for (const e of manifest) {
  console.log(`  ${e.token}  ->  ${e.key}  (pages: ${e.pages.join(', ')})`)
}
console.log(`Found ${contentBlockManifest.length} editable content block(s) across ${rootFiles.length} pages.`)
