/**
 * AI Prompt Manager — shared instruction fragments reused verbatim across
 * multiple AI phases' system prompts. Extracted only where the exact text
 * was already byte-identical in 2+ prompt files (confirmed via a full
 * prompt-duplication audit before this file was created) — every
 * phase-specific instruction (tone, schema, HTML/CSS bans carrying
 * phase-specific extra clauses) is left exactly as it was, since merging
 * those would risk altering what each phase's prompt actually says. This
 * file is deduplication only — no prompt's generated output changes as a
 * result of it existing.
 */

/** Used verbatim by modules/intelligence/prompts.ts, modules/intelligence/questionPrompts.ts, and all three modules/analysis/prompts.ts builders. */
export const NOVARA_ANALYST_PERSONA = 'You are a business analyst working for Novara Consult, a UK growth consultancy.'

/** Used verbatim by modules/intelligence/prompts.ts and modules/analysis/prompts.ts's buildAnalysisSystemPrompt. */
export const NO_FABRICATION_RULE = 'Do not invent, assume, or fabricate anything.'

/** Used verbatim by modules/intelligence/prompts.ts and modules/analysis/prompts.ts's buildAnalysisSystemPrompt. */
export const NEVER_GUESS_OR_OMIT_KEY = 'never guess or fabricate a value, and never omit a key.'

/** Used verbatim by modules/intelligence/prompts.ts, modules/blueprint/prompts.ts, modules/salesContent/prompts.ts, and both the analysis/proposalData builders in modules/analysis/prompts.ts. */
export const JSON_OBJECT_RESPONSE_ONLY =
  'Respond with ONLY a single valid JSON object — no markdown code fences, no commentary, no explanation, no preamble, no surrounding text of any kind.'
