import type { ProviderIdentity } from '../modules/branding/identity.js'

const PROVIDER_IDENTITY_STYLES: Record<ProviderIdentity, string> = {
  novara: 'bg-white/8 text-novara-light/70 border-white/10',
  upwork: 'bg-novara-orange/10 text-novara-orange border-novara-orange/25',
}

// Short form for a table cell — PROVIDER_IDENTITY_LABELS' "Novara Proposal" /
// "Upwork Proposal" (used in the New Proposal picker, where the word
// "Proposal" carries context) would read as redundant repeated next to a
// Proposal Name column that's already full of proposal names.
const PROVIDER_IDENTITY_SHORT_LABELS: Record<ProviderIdentity, string> = {
  novara: 'Novara',
  upwork: 'Upwork',
}

/** Dashboard-only — same visual pattern as SimpleStatusBadge, so which brand a proposal was created under (Novara vs Upwork/Jayson) is identifiable at a glance in the proposal list. */
export function ProviderIdentityBadge({ providerIdentity }: { providerIdentity: ProviderIdentity }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${PROVIDER_IDENTITY_STYLES[providerIdentity]}`}
    >
      {PROVIDER_IDENTITY_SHORT_LABELS[providerIdentity]}
    </span>
  )
}
