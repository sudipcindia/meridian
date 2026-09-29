import { useState } from 'react'
import { SignatureCapture, type SignatureValue } from './SignatureCapture.js'
import { submitAcceptance } from '../../lib/clientProposal.js'
import { captureDeviceContext } from '../../lib/deviceContext.js'
import { getProviderName, type ProviderIdentity } from '../../modules/branding/identity.js'

interface AcceptanceFormProps {
  token: string
  proposalName: string
  /** Prefills the Company field from the proposal's own metadata — still freely editable. */
  companyName?: string
  /** Who this proposal represents as the provider/brand — must match api/client/accept.ts's server-side consent text exactly (the server never trusts a client-supplied value, but the wording itself must agree). Defaults to 'novara'. */
  providerIdentity?: ProviderIdentity
  onAccepted: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Permissive international format: optional leading +, 7-15 digits — accepts however the
// visitor formats it (spaces/dashes/parens stripped before testing), not a rigid E.164 parser.
const PHONE_DIGITS_PATTERN = /^\+?\d{7,15}$/

/**
 * Rendered inside the Accept-the-Proposal modal (see ClientProposalView.tsx):
 * signer details, draw/type signature, confirmation checkbox, submit — then
 * its own internal success state, so nothing unmounts/navigates away and no
 * in-progress signature is ever lost. Acceptance date and IP/user agent are
 * captured server-side (api/client/accept.ts) — never trusted from the
 * client — so nothing here sends a timestamp.
 */
export function AcceptanceForm({ token, proposalName, companyName, providerIdentity = 'novara', onAccepted }: AcceptanceFormProps) {
  const providerName = getProviderName(providerIdentity)
  const [signature, setSignature] = useState<SignatureValue | null>(null)
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState(companyName ?? '')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Per-field, set on blur — a submit-time "touched" flag can never fire here, since the
  // submit button stays disabled (by spec) until every field is already valid.
  const [nameTouched, setNameTouched] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)

  const emailValid = EMAIL_PATTERN.test(email.trim())
  const phoneValid = PHONE_DIGITS_PATTERN.test(phone.replace(/[\s()-]/g, ''))

  const canSubmit =
    Boolean(signature) && fullName.trim().length > 0 && emailValid && phoneValid && agreed && !submitting

  async function handleSubmit() {
    if (!canSubmit || !signature) return
    setSubmitting(true)
    setError(null)
    try {
      const deviceContext = captureDeviceContext()
      await submitAcceptance({
        token,
        signerName: fullName.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        method: signature.method,
        signatureDataUrl: signature.dataUrl,
        signatureText: signature.text,
        consent: agreed,
        screenResolution: deviceContext.screenResolution,
        viewportSize: deviceContext.viewportSize,
        preferredLanguage: deviceContext.preferredLanguage,
        browserTimezone: deviceContext.browserTimezone,
      })
      setSubmitted(true)
      onAccepted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit acceptance')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-6">
        <p className="font-clash-display text-xl md:text-2xl text-white mb-2">Proposal Accepted Successfully</p>
        <p className="text-[13px] font-general-sans text-novara-light/60">
          Thank you. {providerIdentity === 'upwork' ? 'Jayson' : 'A member of Novara Consult'} will contact you shortly.
        </p>
      </div>
    )
  }

  const fieldClass =
    'w-full rounded-lg border border-novara-border bg-white px-4 py-3 text-novara-dark outline-none focus:border-novara-teal font-general-sans'
  const errorFieldClass = 'border-red-400 focus:border-red-400'

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] font-general-sans text-novara-light/60">{proposalName}</p>

      {error && (
        <div className="text-[13px] font-general-sans text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-general-sans text-novara-light/60">Full Name *</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder="Full name"
          className={`${fieldClass} ${nameTouched && !fullName.trim() ? errorFieldClass : ''}`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-general-sans text-novara-light/60">Company</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company name"
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-general-sans text-novara-light/60">Email Address *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          placeholder="you@company.com"
          className={`${fieldClass} ${emailTouched && !emailValid ? errorFieldClass : ''}`}
        />
        {emailTouched && !emailValid && (
          <p className="text-[11px] font-general-sans text-red-400">Enter a valid email address.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-general-sans text-novara-light/60">Phone Number *</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setPhoneTouched(true)}
          placeholder="+44 7700 900000"
          className={`${fieldClass} ${phoneTouched && !phoneValid ? errorFieldClass : ''}`}
        />
        {phoneTouched && !phoneValid && (
          <p className="text-[11px] font-general-sans text-red-400">Enter a valid international phone number.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-general-sans text-novara-light/60">Electronic Signature *</label>
        <SignatureCapture onChange={setSignature} />
      </div>

      <label className="flex items-start gap-2.5 text-[13px] font-general-sans text-novara-light/70 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-novara-teal shrink-0"
        />
        I have read and agree to the {providerName} Service Agreement and confirm my authority to accept this
        proposal on behalf of the named company.
      </label>

      <p className="text-[11px] font-general-sans text-novara-light/40">
        The acceptance date will be recorded automatically upon submission.
      </p>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full md:w-auto self-start px-6 py-3 rounded-lg bg-novara-teal text-novara-dark font-medium font-general-sans disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        {submitting ? 'Submitting…' : 'Accept & Sign Proposal'}
      </button>
    </div>
  )
}
