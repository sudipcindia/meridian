import type { ReactNode } from 'react'
import { ArrowUp, ArrowDown, Copy, Trash2, Plus } from 'lucide-react'

interface CollectionPanelProps<T> {
  title: string
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  onAdd: () => void
  onRemove: (index: number) => void
  onDuplicate: (index: number) => void
  onReorder: (index: number, direction: -1 | 1) => void
  addLabel?: string
  readOnly?: boolean
  /** Optional footnote shown below the list (e.g. "Click a chip on the canvas to edit its text — use these controls to add, remove, reorder, or duplicate."). */
  hint?: string
  /** Optional stable prefix for row/action data-testid attributes (e.g. "pricing-card") — mainly so automated tests can target one nesting level unambiguously when panels are nested (a card's own controls vs. its feature list's controls share the same button titles). */
  testId?: string
}

/**
 * Generic add/remove/reorder/duplicate chrome for any Builder-editable
 * repeatable collection (pricing cards, FAQs, testimonials, service blocks,
 * case studies, timelines, feature lists, comparison tables, etc.) —
 * introduced for Page 08's pricing cards and their nested feature lists,
 * meant to be reused as-is for Pages 09-11 rather than reimplemented per
 * page. The caller owns the collection's storage/shape entirely (typically
 * one JSON-stringified array in an existing contentOverride key, via
 * modules/variables/collections.ts) and supplies `renderItem` for whatever
 * per-item fields that particular collection needs — this component only
 * renders the structural controls around each row.
 */
export function CollectionPanel<T>({
  title,
  items,
  renderItem,
  onAdd,
  onRemove,
  onDuplicate,
  onReorder,
  addLabel = 'Add',
  readOnly = false,
  hint,
  testId,
}: CollectionPanelProps<T>) {
  return (
    <div className="flex flex-col gap-2 border border-novara-border rounded-xl p-4 bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-general-sans font-medium text-novara-light/70">
          {title} ({items.length})
        </p>
        {!readOnly && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-[12px] font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
          >
            <Plus size={13} /> {addLabel}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2" data-testid={testId ? `${testId}-row-${i}` : undefined}>
            <div className="flex-1 min-w-0">{renderItem(item, i)}</div>
            {!readOnly && (
              <div className="flex items-center gap-1 shrink-0 pt-1">
                <button onClick={() => onReorder(i, -1)} disabled={i === 0} title="Move up" data-testid={testId ? `${testId}-up-${i}` : undefined} className="p-1 rounded text-novara-light/50 hover:text-white disabled:opacity-20 transition-colors">
                  <ArrowUp size={13} />
                </button>
                <button onClick={() => onReorder(i, 1)} disabled={i === items.length - 1} title="Move down" data-testid={testId ? `${testId}-down-${i}` : undefined} className="p-1 rounded text-novara-light/50 hover:text-white disabled:opacity-20 transition-colors">
                  <ArrowDown size={13} />
                </button>
                <button onClick={() => onDuplicate(i)} title="Duplicate" data-testid={testId ? `${testId}-duplicate-${i}` : undefined} className="p-1 rounded text-novara-light/50 hover:text-white transition-colors">
                  <Copy size={13} />
                </button>
                <button onClick={() => onRemove(i)} title="Remove" data-testid={testId ? `${testId}-remove-${i}` : undefined} className="p-1 rounded text-novara-light/50 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {hint && <p className="text-[11px] font-general-sans text-novara-light/40">{hint}</p>}
    </div>
  )
}
