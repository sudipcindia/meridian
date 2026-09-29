export {
  hasFieldConflict,
  hasSectionConflict,
  computeFinalValue,
  type PopulationTargetType,
  type PopulationField,
  type PopulationSection,
  type NotAvailableItem,
  type SectionDecision,
  type ConflictResolution,
} from './types.js'
export { buildPopulationSections, getNotAvailableItems, type PopulationProposalContext } from './mapping.js'
export {
  AUTO_GENERATE_PAGE_ORDER,
  AUTO_GENERATE_PAGE_LABELS,
  buildAutoGeneratePageOrder,
  getAutoGeneratePageLabel,
  type AutoGeneratePageId,
  type BaseAutoGeneratePageId,
} from './pageOrder.js'
