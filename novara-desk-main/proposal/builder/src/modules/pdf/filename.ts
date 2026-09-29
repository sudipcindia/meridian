/**
 * Configurable PDF filename generation — a pure template-substitution
 * utility, independent of the rendering engine, so future document types
 * (Quotation, Invoice, Contract) can supply their own template without
 * touching this function.
 */
export const DEFAULT_FILENAME_TEMPLATE = '{clientName}_Proposal_{year}.pdf'

export interface FilenameContext {
  clientName: string
  companyName?: string
  proposalName?: string
  year: number
}

function sanitize(value: string): string {
  return value.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '')
}

export function buildFilename(template: string, context: FilenameContext): string {
  return template
    .replace('{clientName}', sanitize(context.clientName) || 'Client')
    .replace('{companyName}', sanitize(context.companyName ?? ''))
    .replace('{proposalName}', sanitize(context.proposalName ?? ''))
    .replace('{year}', String(context.year))
}
