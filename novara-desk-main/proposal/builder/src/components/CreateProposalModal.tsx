import { useState } from 'react'
import { Modal } from './Modal.js'
import { FormField, inputClass } from './FormField.js'
import { PROPOSAL_TYPE_OPTIONS, type NewProposalInput } from '../types/proposal.js'
import { PROVIDER_IDENTITY_OPTIONS, PROVIDER_IDENTITY_LABELS, type ProviderIdentity } from '../modules/branding/identity.js'

/** How the proposal is populated immediately after creation — a pure UI/routing decision, never persisted on the Proposal record itself. */
export type ProposalCreationMethod = 'meetingTranscript' | 'manual'

interface CreateProposalModalProps {
  onClose: () => void
  onCreate: (input: NewProposalInput, method: ProposalCreationMethod) => Promise<void>
}

/** Proposal Type is no longer a form field — every proposal now gets this same sensible default (matching the value already used elsewhere for AI-created proposals) rather than asking the user to pick one up front. */
const DEFAULT_PROPOSAL_TYPE = PROPOSAL_TYPE_OPTIONS[0]
const DEFAULT_PREPARED_BY = 'Jayson Kandiah'

const DEFAULT_PROVIDER_IDENTITY: ProviderIdentity = 'novara'

const EMPTY_MANUAL_FORM: NewProposalInput = {
  clientName: '',
  clientFirstName: '',
  companyName: '',
  clientEmail: '',
  proposalName: '',
  proposalType: DEFAULT_PROPOSAL_TYPE,
  preparedBy: DEFAULT_PREPARED_BY,
  notes: '',
  providerIdentity: DEFAULT_PROVIDER_IDENTITY,
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * A rep starting from a meeting transcript doesn't know the client's name,
 * company, or email yet — that's the whole point of the AI Transcript flow.
 * This placeholder lets the proposal record exist (every downstream page is
 * keyed by an existing proposal id) with blank client fields; AI extraction
 * and Smart Questions fill them in for real before the proposal is ever
 * generated (see modules/intelligence/autoGenerate.ts).
 */
function buildPlaceholderInput(providerIdentity: ProviderIdentity): NewProposalInput {
  const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return {
    clientName: '',
    clientFirstName: '',
    companyName: '',
    clientEmail: '',
    proposalName: `New Proposal — ${dateLabel}`,
    proposalType: DEFAULT_PROPOSAL_TYPE,
    preparedBy: DEFAULT_PREPARED_BY,
    notes: '',
    providerIdentity,
  }
}

export function CreateProposalModal({ onClose, onCreate }: CreateProposalModalProps) {
  const [providerIdentity, setProviderIdentity] = useState<ProviderIdentity>(DEFAULT_PROVIDER_IDENTITY)
  const [method, setMethod] = useState<ProposalCreationMethod>('meetingTranscript')
  const [manualForm, setManualForm] = useState<NewProposalInput>(EMPTY_MANUAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    method === 'meetingTranscript' ||
    (manualForm.proposalName.trim().length > 0 &&
      manualForm.clientName.trim().length > 0 &&
      EMAIL_PATTERN.test(manualForm.clientEmail.trim()))

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const input =
        method === 'manual' ? { ...manualForm, providerIdentity } : buildPlaceholderInput(providerIdentity)
      await onCreate(input, method)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="New Proposal"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="text-sm font-general-sans font-medium text-novara-light/70 hover:text-white px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            {submitting ? 'Creating…' : 'Create Proposal'}
          </button>
        </>
      }
    >
      {error && (
        <p className="text-[13px] font-general-sans text-red-400 mb-4 bg-red-400/10 border border-red-400/25 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="mb-4">
        <span className="block text-[13px] font-general-sans font-medium text-novara-light/70 mb-2">
          Proposal Type
        </span>
        <div className="flex flex-col gap-2">
          {PROVIDER_IDENTITY_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2.5 text-sm font-general-sans text-white cursor-pointer"
            >
              <input
                type="radio"
                name="providerIdentity"
                checked={providerIdentity === option}
                onChange={() => setProviderIdentity(option)}
                className="accent-novara-orange"
              />
              {PROVIDER_IDENTITY_LABELS[option]}
            </label>
          ))}
        </div>
      </div>

      <div className={method === 'manual' ? 'mb-2' : ''}>
        <span className="block text-[13px] font-general-sans font-medium text-novara-light/70 mb-2">
          Proposal Creation Method
        </span>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 text-sm font-general-sans text-white cursor-pointer">
            <input
              type="radio"
              name="creationMethod"
              checked={method === 'meetingTranscript'}
              onChange={() => setMethod('meetingTranscript')}
              className="accent-novara-orange"
            />
            Meeting Transcript
          </label>
          <label className="flex items-center gap-2.5 text-sm font-general-sans text-white cursor-pointer">
            <input
              type="radio"
              name="creationMethod"
              checked={method === 'manual'}
              onChange={() => setMethod('manual')}
              className="accent-novara-orange"
            />
            Manual Builder
          </label>
        </div>
      </div>

      {method === 'manual' && (
        <>
          <FormField label="Proposal Name" htmlFor="proposalName">
            <input
              id="proposalName"
              className={inputClass}
              placeholder="e.g. RevOps Proposal — Acme Ltd"
              value={manualForm.proposalName}
              onChange={(e) => setManualForm({ ...manualForm, proposalName: e.target.value })}
            />
          </FormField>

          <FormField label="Client Name" htmlFor="clientName">
            <input
              id="clientName"
              className={inputClass}
              placeholder="e.g. John Smith"
              value={manualForm.clientName}
              onChange={(e) => setManualForm({ ...manualForm, clientName: e.target.value })}
            />
          </FormField>

          <FormField label="Client First Name" htmlFor="clientFirstName">
            <input
              id="clientFirstName"
              className={inputClass}
              placeholder="e.g. John"
              value={manualForm.clientFirstName}
              onChange={(e) => setManualForm({ ...manualForm, clientFirstName: e.target.value })}
            />
          </FormField>

          <FormField label="Company Name" htmlFor="companyName">
            <input
              id="companyName"
              className={inputClass}
              placeholder="e.g. Acme Ltd"
              value={manualForm.companyName}
              onChange={(e) => setManualForm({ ...manualForm, companyName: e.target.value })}
            />
          </FormField>

          <FormField label="Client Email" htmlFor="clientEmail">
            <input
              id="clientEmail"
              type="email"
              className={inputClass}
              placeholder="e.g. john@acme.com"
              value={manualForm.clientEmail}
              onChange={(e) => setManualForm({ ...manualForm, clientEmail: e.target.value })}
            />
          </FormField>

          <FormField label="Prepared By" htmlFor="preparedBy">
            <input
              id="preparedBy"
              className={inputClass}
              value={manualForm.preparedBy}
              onChange={(e) => setManualForm({ ...manualForm, preparedBy: e.target.value })}
            />
          </FormField>
        </>
      )}
    </Modal>
  )
}
