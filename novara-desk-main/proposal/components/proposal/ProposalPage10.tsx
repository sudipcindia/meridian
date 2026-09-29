import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { PageNumber } from './ProposalLogo'
import tickIcon from '../../src/assets/p08/tick-icon.svg'

// ─── Tokens ───────────────────────────────────────────────────────────────────

const FONT_CLASH = 'Clash Display, sans-serif'
const FONT_GS    = 'General Sans, sans-serif'
const WHITE      = '#FFFFFF'
const ORANGE     = '#FF5B04'

// ─── Gap scale (clamp values from Figma) ──────────────────────────────────────

const G100 = 'clamp(48px, 5.208vw, 100px)'
const G60  = 'clamp(28px, 3.125vw, 60px)'
const G30  = 'clamp(14px, 1.563vw, 30px)'
const G27  = 'clamp(13px, 1.406vw, 27px)'
const G24  = 'clamp(12px, 1.25vw, 24px)'
const G20  = 'clamp(10px, 1.042vw, 20px)'
const G16  = 'clamp(8px, 0.833vw, 16px)'
const G12  = 'clamp(6px, 0.610vw, 11.7px)'

// ─── Shared text style ────────────────────────────────────────────────────────

const bodyBase: React.CSSProperties = {
  fontFamily: FONT_GS,
  fontWeight: 300,
  fontSize: 'clamp(13px, 1.25vw, 24px)',
  lineHeight: 1.5,
  color: WHITE,
  margin: 0,
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: FONT_CLASH,
      fontWeight: 500,
      fontSize: 'clamp(24px, 2.604vw, 50px)',
      lineHeight: 1.5,
      color: WHITE,
      margin: 0,
      letterSpacing: '-0.5px',
    }}>
      {children}
    </h3>
  )
}

function TickItem({ children, align = 'center' }: { children: React.ReactNode; align?: string }) {
  return (
    <div style={{ display: 'flex', gap: 'clamp(8px, 0.781vw, 15px)', alignItems: align }}>
      <img
        src={tickIcon}
        alt=""
        aria-hidden
        draggable={false}
        style={{ width: 'clamp(22px, 2.188vw, 42px)', height: 'clamp(22px, 2.188vw, 42px)', flexShrink: 0, display: 'block' }}
      />
      <p style={bodyBase}>{children}</p>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 'clamp(20px, 1.875vw, 36px)', display: 'flex', flexDirection: 'column', gap: G30 }}>
      {items.map(item => (
        <li key={item} style={{ ...bodyBase, listStyleType: 'disc' }}>{item}</li>
      ))}
    </ul>
  )
}

// Section wrapper: numbered heading + body content
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: G12 }}>
      <SectionHead>{title}</SectionHead>
      <div style={{ display: 'flex', flexDirection: 'column', gap: G24 }}>
        {children}
      </div>
    </div>
  )
}

// Tick list: flex-col gap-30 group of TickItems
function TickList({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: G30 }}>
      {children}
    </div>
  )
}

// Nested block: tick header + indented sub-content (gap-27)
function NestedBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: G27 }}>
      <TickItem>{label}</TickItem>
      {children}
    </div>
  )
}

// ─── Page 10 — Service Agreement (scrollable document) ────────────────────────
// Frame: 1920×4824px — uses normal document flow, NOT aspectRatio wrapper.
// ProposalBackground fills the container via absolute inset-0.

interface ProposalPage10Props {
  pageNumber?: number
  /** Who this proposal represents as the provider/brand — the Upwork use case presents the agreement as coming from Jayson Kandiah personally rather than from Novara Consult as a company. Plain inline union (not imported from the app's branding module) to avoid coupling this template-component tree to the Builder app's own module layout. Defaults to 'novara' so every existing render is unchanged. */
  providerIdentity?: 'novara' | 'upwork'
}

export function ProposalPage10({ pageNumber = 10, providerIdentity = 'novara' }: ProposalPage10Props) {
  const pad = 'clamp(22px, 4.688vw, 90px)'
  const isUpwork = providerIdentity === 'upwork'
  const providerFullName = isUpwork ? 'Jayson Kandiah' : 'Novara Consult'
  const providerShortName = isUpwork ? 'Jayson' : 'Novara'
  // First-person pronouns for the Upwork case, so the Agreement reads as
  // coming from Jayson personally rather than a company's collective "we".
  const I = isUpwork ? 'I' : 'We'
  const i = isUpwork ? 'I' : 'we'
  const me = isUpwork ? 'me' : 'us'
  const My = isUpwork ? 'My' : 'Our'
  const my = isUpwork ? 'my' : 'our'
  const amNot = isUpwork ? 'am not' : 'are not'

  return (
    <div style={{ position: 'relative', width: '100%', background: '#0D1A1F' }}>
      <ProposalBackground />

      <motion.div
        style={{ position: 'relative', zIndex: 1, padding: `${pad} ${pad} ${G100}` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
      >
        {/* ── Top row: title / subtitle + badge ─────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: G24, marginBottom: G60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: G16 }}>
            <h2 style={{ fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(32px, 3.75vw, 72px)', lineHeight: 1.1, color: WHITE, margin: 0 }}>
              Service <span style={{ color: ORANGE }}>Agreement</span>
            </h2>
            <p style={{ ...bodyBase, fontSize: 'clamp(12px, 1.146vw, 22px)', opacity: 0.9 }}>
              The Final step before growth and execution
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <PageNumber pageNumber={pageNumber} width="clamp(36px, 4.271vw, 82px)" />
          </div>
        </div>

        {/* ── All sections ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: G60 }}>

          {/* Overview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: G20 }}>
            <p style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(16px, 1.563vw, 30px)', lineHeight: 1.5, color: ORANGE, margin: 0, letterSpacing: '-0.01em' }}>
              Overview
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <p style={bodyBase}>
                This Service Terms Agreement (&ldquo;Agreement&rdquo;) defines the working relationship between {providerFullName}
                {isUpwork
                  ? <>(&ldquo;{providerShortName}&rdquo;, &ldquo;I&rdquo;, &ldquo;me&rdquo;)</>
                  : <>(&ldquo;{providerShortName}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)</>} and the undersigned client (&ldquo;Client&rdquo;, &ldquo;you&rdquo;).
              </p>
              <p style={bodyBase}>
                {My} approach is simple: clarity, momentum, and growth &mdash; with fair terms that protect both parties.
              </p>
              <br />
              <p style={bodyBase}>
                This Agreement applies to all services outlined in the accompanying proposal or statement of work (&ldquo;Services&rdquo;).
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <Section title={`1. ${My} Growth-Led Approach`}>
            <p style={bodyBase}>{providerShortName} operates as a strategic growth partner, not a task-based supplier.</p>
            <TickList>
              <TickItem align="flex-start">
                {I} utilise modern, proven, and emerging solutions, techniques, and strategies across digital, growth, and operations.
              </TickItem>
              <NestedBlock label={`${My} work is reviewed${isUpwork ? '' : ' internally'} on an ongoing basis to ensure ${i} ${isUpwork ? 'am' : 'are'}:`}>
                <BulletList items={[
                  'Continuously improving performance',
                  'Adapting to platform changes and market shifts',
                  'Pushing beyond &ldquo;standard&rdquo; execution',
                ]} />
              </NestedBlock>
            </TickList>
            <p style={bodyBase}>
              Where better methods, tools, or approaches emerge, {i} may recommend adjustments to maximise impact.
            </p>
          </Section>

          {/* Section 2 */}
          <Section title="2. Scope of Services">
            <TickList>
              <TickItem>Services will be delivered in line with the agreed proposal and priorities.</TickItem>
              <TickItem>Work is planned and scheduled in advance to ensure quality and consistency.</TickItem>
              <TickItem>Requests outside of scope will be discussed and agreed before execution.</TickItem>
            </TickList>
            <p style={bodyBase}>{I} focus on progress, not busywork.</p>
          </Section>

          {/* Section 3 */}
          <Section title="3. Fees &amp; Payment">
            <p style={bodyBase}>Fees are invoiced and payable in accordance with the agreed schedule:</p>
            <TickList>
              <TickItem>Fees are outlined in the proposal and are payable in accordance with the invoice terms.</TickItem>
              <TickItem>Timely payment is essential, as {i} pre-plan work, resources, and delivery schedules.</TickItem>
              <NestedBlock label="Late payment may result in:">
                <BulletList items={[
                  'Paused work',
                  'Rescheduled delivery',
                  `Temporary removal from ${my} active workflow`,
                ]} />
              </NestedBlock>
            </TickList>
            <p style={bodyBase}>
              This is not punitive &mdash; it ensures fairness across all clients and allows {me} to maintain high standards.
            </p>
          </Section>

          {/* Section 4 */}
          <Section title="4. Flexible Engagement, Clear Notice">
            <p style={bodyBase}>{I} do not lock clients into long-term contracts. However:</p>
            <TickList>
              <TickItem>Either party may terminate the engagement with 30 days&apos; written notice.</TickItem>
              <NestedBlock label={`This notice period allows ${me} to:`}>
                <BulletList items={[
                  'Complete or stabilise active work',
                  'Decommission systems and access',
                  'Reallocate planned resources responsibly',
                ]} />
              </NestedBlock>
            </TickList>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <p style={bodyBase}>Fees remain payable during the notice period.</p>
              <p style={bodyBase}>Immediate termination may occur in cases of non-payment or unreasonable conduct.</p>
            </div>
          </Section>

          {/* Section 5 */}
          <Section title="5. Performance &amp; Expectations">
            <TickList>
              <TickItem>{providerShortName} commits to best-practice execution, innovation, and continuous optimisation.</TickItem>
              <TickItem>Results are influenced by external factors beyond {my} control (market conditions, budgets, competition, platforms).</TickItem>
              <TickItem>Where targets, KPIs, or performance indicators are agreed, these will be documented separately.</TickItem>
            </TickList>
            <p style={bodyBase}>{I} communicate openly, review performance regularly, and adapt strategy as required.</p>
          </Section>

          {/* Section 6 */}
          <Section title="6. Intellectual Property">
            <TickList>
              <TickItem>Upon full payment, ownership of agreed deliverables transfers to the Client.</TickItem>
              <NestedBlock label={isUpwork ? 'I retain ownership of:' : 'Novara retains ownership of:'}>
                <BulletList items={[
                  'Internal methodologies, frameworks, and processes',
                  'Non-client-specific assets and know-how',
                ]} />
              </NestedBlock>
            </TickList>
            <p style={bodyBase}>
              Unless requested otherwise in writing, {i} may reference work at a high level for portfolio or case study purposes.
            </p>
          </Section>

          {/* Section 7 */}
          <Section title="7. Confidentiality">
            <p style={bodyBase}>
              Both parties agree to treat all shared information as confidential and not disclose it without consent, unless legally required.
            </p>
          </Section>

          {/* Section 8 */}
          <Section title="8. Limitation of Liability">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <p style={bodyBase}>To deliver meaningful growth, {i} require collaboration.</p>
              <p style={bodyBase}>The Client agrees to:</p>
            </div>
            <TickList>
              <TickItem>Liability is limited to the value of fees paid for the relevant services.</TickItem>
              <TickItem>{I} {amNot} responsible for indirect or consequential losses.</TickItem>
              <TickItem>Third-party platforms, tools, or service interruptions are outside {my} control.</TickItem>
            </TickList>
          </Section>

          {/* Section 9 */}
          <Section title="9. Governing Law">
            <p style={bodyBase}>This Agreement is governed by the laws of England and Wales.</p>
          </Section>

          {/* Section 10 */}
          <Section title="10. Acceptance &amp; Signatures">
            <p style={bodyBase}>By signing below, both parties confirm their agreement to these terms.</p>
          </Section>

        </div>

        {/* ── Signature row ─────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: G100,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.363vw, 7px)' }}>
            <p style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(22px, 2.094vw, 40px)', lineHeight: 1.5, color: WHITE, margin: 0 }}>
              {isUpwork ? 'Jayson Kandiah' : 'Novara Consult'}
            </p>
            <p style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(17px, 1.611vw, 31px)', lineHeight: 1.5, color: WHITE, margin: 0 }}>
              {isUpwork ? 'Independent Consultant' : 'Jayson Kandiah'}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.363vw, 7px)' }}>
            <p data-editor-key="page10.companyName" style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(22px, 2.094vw, 40px)', lineHeight: 1.5, color: WHITE, margin: 0 }}>
              [Company Name]
            </p>
            <p data-editor-key="page10.clientName" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(17px, 1.611vw, 31px)', lineHeight: 1.5, color: WHITE, margin: 0 }}>
              [Client Name]
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
