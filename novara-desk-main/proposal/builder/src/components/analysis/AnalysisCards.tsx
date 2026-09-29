import { inputClass } from '../FormField.js'
import { ANALYSIS_CARDS, type TranscriptAnalysisFields } from '../../modules/analysis/index.js'

export const analysisCardClass = 'border border-novara-border rounded-xl p-5 bg-white/[0.02] flex flex-col gap-4'

interface AnalysisCardsProps {
  analysis: TranscriptAnalysisFields
  /** Omit both handlers to render the same cards read-only (Phase 02's saved-analysis view — the extracted fields were already reviewed/edited once, before saving). */
  onChangeText?: (key: keyof TranscriptAnalysisFields, value: string) => void
  onChangeList?: (key: keyof TranscriptAnalysisFields, rawValue: string) => void
}

/**
 * Renders the extracted-information cards driven by ANALYSIS_CARDS — shared
 * by the new-analysis page (Phase 01, editable) and the saved-analysis
 * detail page (Phase 02, read-only) so the two never drift apart.
 */
export function AnalysisCards({ analysis, onChangeText, onChangeList }: AnalysisCardsProps) {
  const readOnly = !onChangeText && !onChangeList

  return (
    <>
      {ANALYSIS_CARDS.map((card) => (
        <div key={card.title} className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">{card.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {card.fields.map((field) => {
              const value = analysis[field.key]
              const fullWidth = field.kind !== 'text'
              const displayValue = Array.isArray(value) ? value.join('\n') : value
              return (
                <div key={field.key} className={`flex flex-col gap-1.5 ${fullWidth ? 'sm:col-span-2' : ''}`}>
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">{field.label}</label>
                  {readOnly ? (
                    <p className="text-sm font-general-sans text-white/90 whitespace-pre-line min-h-[1.5em]">
                      {displayValue || <span className="text-novara-light/30">—</span>}
                    </p>
                  ) : field.kind === 'text' ? (
                    <input
                      className={inputClass}
                      value={value as string}
                      onChange={(e) => onChangeText?.(field.key, e.target.value)}
                    />
                  ) : field.kind === 'textarea' ? (
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={value as string}
                      onChange={(e) => onChangeText?.(field.key, e.target.value)}
                    />
                  ) : (
                    <textarea
                      rows={4}
                      className={inputClass}
                      value={(value as string[]).join('\n')}
                      placeholder="One per line"
                      onChange={(e) => onChangeList?.(field.key, e.target.value)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
