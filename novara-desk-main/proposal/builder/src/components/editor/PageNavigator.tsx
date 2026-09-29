import { computePageNumbers, ALL_TEMPLATE_PAGE_IDS, type TemplatePageId } from '../../masterTemplate/index.js'

interface PageNavigatorProps {
  pages: TemplatePageId[]
  currentPageId: TemplatePageId
  onSelectPage: (pageId: TemplatePageId) => void
  /** Real AI-chosen titles for whichever dynamicInsight0N pages this document actually has (see resolveDynamicInsightPages) — takes priority over PAGE_TITLES/the page-number fallback so a dynamic page reads by its real topic in the nav rail, not a generic "Page 12". */
  pageTitleOverrides?: Partial<Record<TemplatePageId, string>>
}

/** Only pages with a name distinct from their number need an entry — everything else falls back to "Page {number}", computed from this document's actual page order (never a hardcoded per-id string), so inserting/removing a page anywhere relabels everything after it automatically. */
const PAGE_TITLES: Partial<Record<TemplatePageId, string>> = {
  cover: 'Cover',
  insightsBusiness: 'Business Insights',
  insightsGrowth: 'Growth Insights',
}

/** Ordered page rail — pure presentational, no data fetching. */
export function PageNavigator({ pages, currentPageId, onSelectPage, pageTitleOverrides }: PageNavigatorProps) {
  // ALL_TEMPLATE_PAGE_IDS, not MASTER_TEMPLATE_PAGES — the latter is the
  // brand-new-document default and structurally excludes every
  // dynamicInsight0N slot, so filtering against it could never surface a
  // dynamic page here even once one was actually inserted into `pages`.
  const orderedPages = ALL_TEMPLATE_PAGE_IDS.filter((p) => pages.includes(p))
  const pageNumbers = computePageNumbers(pages)

  return (
    <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible shrink-0 lg:w-[140px]">
      {orderedPages.map((pageId) => (
        <button
          key={pageId}
          onClick={() => onSelectPage(pageId)}
          className={`text-left text-sm font-general-sans px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
            pageId === currentPageId
              ? 'bg-novara-teal/15 text-novara-teal font-medium'
              : 'text-novara-light/60 hover:bg-white/5 hover:text-novara-light'
          }`}
        >
          {pageTitleOverrides?.[pageId] ?? PAGE_TITLES[pageId] ?? `Page ${String(pageNumbers[pageId]).padStart(2, '0')}`}
        </button>
      ))}
    </nav>
  )
}
