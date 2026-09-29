export { PLACEHOLDER_REGISTRY, PLACEHOLDER_TOKENS, type PlaceholderToken, type VariableKey } from './placeholders.js'
export {
  applyVariables,
  extractPlaceholders,
  getDefaultVariables,
  resolveContentBlockText,
  type VariableMap,
  type VariableSeedSource,
  type ContentOverrideMap,
} from './engine.js'
export {
  TEMPLATE_VARIABLE_MANIFEST,
  getVariableManifestForPages,
  type TemplateVariableManifestEntry,
} from './manifest.js'
export {
  CONTENT_BLOCK_MANIFEST,
  getContentBlocksForPage,
  type ContentBlockManifestEntry,
} from './contentBlocks.js'
export { getCoverFieldEntries, type CoverFieldSource } from './coverFields.js'
export { getPage02FieldEntries } from './page02Fields.js'
export {
  getInsightsBusinessFieldEntries,
  DEFAULT_INSIGHTS_BUSINESS_CURRENT_POSITION,
  DEFAULT_INSIGHTS_BUSINESS_SWOT,
  normalizeCurrentPosition,
  parseCurrentPositionOverride,
  normalizeSwot,
  parseSwotOverride,
  type InsightsSwot,
} from './insightsBusinessFields.js'
export {
  getInsightsGrowthFieldEntries,
  DEFAULT_INSIGHTS_GROWTH_OPPORTUNITIES,
  normalizeGrowthOpportunities,
  parseGrowthOpportunitiesOverride,
} from './insightsGrowthFields.js'
export {
  getPage07FieldEntries,
  DEFAULT_PAGE07_KEYWORDS,
  parsePage07Keywords,
  DEFAULT_PAGE07_ENRICHMENT,
  normalizeEnrichment,
  parseEnrichmentOverride,
} from './page07Fields.js'
export {
  DEFAULT_DYNAMIC_INSIGHT_PAGE,
  normalizeDynamicInsightPage,
  parseDynamicInsightPageOverride,
  type DynamicInsightPageData,
} from './dynamicInsightFields.js'
export {
  parseCollection,
  serializeCollection,
  makeCollectionId,
  addCollectionItem,
  removeCollectionItem,
  duplicateCollectionItem,
  reorderCollectionItem,
  updateCollectionItem,
} from './collections.js'
export {
  getPage08FieldEntries,
  DEFAULT_PAGE08_CARDS,
  makeBlankPricingCard,
  normalizePricingCards,
  parsePriceString,
  composePriceString,
  CURRENCY_PRESETS,
  BILLING_TYPE_PRESETS,
  deriveInvestmentSplit,
  type PricingCardRecord,
  type ParsedPrice,
  type InvestmentSplitSegment,
} from './page08Fields.js'
export { getPage10FieldEntries, type Page10FieldSource } from './page10Fields.js'
export { getPage11FieldEntries } from './page11Fields.js'
