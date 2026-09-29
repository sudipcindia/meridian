import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.js'
import { ProtectedRoute } from './components/ProtectedRoute.js'
import { AppShell } from './layout/AppShell.js'
import { Login } from './pages/Login.js'
import { Dashboard } from './pages/Dashboard.js'
import { ProposalDetail } from './pages/ProposalDetail.js'
import { ProposalEditorPage } from './pages/ProposalEditorPage.js'
import { ProposalReviewPage } from './pages/ProposalReviewPage.js'
import { ProposalSendPage } from './pages/ProposalSendPage.js'
import { ProposalActivityPage } from './pages/ProposalActivityPage.js'
import { ProposalIntelligencePage } from './pages/ProposalIntelligencePage.js'
import { ProposalQuestionsPage } from './pages/ProposalQuestionsPage.js'
import { ProposalBlueprintPage } from './pages/ProposalBlueprintPage.js'
import { ProposalPopulatePage } from './pages/ProposalPopulatePage.js'
import { ProposalContentPage } from './pages/ProposalContentPage.js'
import { ProposalImpactPage } from './pages/ProposalImpactPage.js'
import { ProposalPreviewPage } from './pages/ProposalPreviewPage.js'
import { ProposalStudioPage } from './pages/ProposalStudioPage.js'
import { AiLearningPage } from './pages/AiLearningPage.js'
import { ProposalPdfView } from './pages/ProposalPdfView.js'
import { ProposalAuditReportView } from './pages/ProposalAuditReportView.js'
import { ClientProposalView } from './pages/ClientProposalView.js'
import { ProposalAiAnalysis } from './pages/ProposalAiAnalysis.js'
import { ProposalAnalysisDetail } from './pages/ProposalAnalysisDetail.js'
import { NotFound } from './pages/NotFound.js'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Print-ready route for the PDF engine's headless browser only —
              deliberately outside AppShell/auth so no sidebar/topbar chrome
              ever renders into the generated PDF, and Chromium (which can
              never complete a login flow) can still reach it. */}
          <Route path="/proposals/:id/pdf-view" element={<ProposalPdfView />} />

          {/* Print-ready route for the audit-report PDF engine's headless
              browser only — same reasoning as pdf-view above (no session
              possible, no chrome should ever appear in the output). */}
          <Route path="/proposals/:id/audit-report-view" element={<ProposalAuditReportView />} />

          {/* Public, unauthenticated client link (emailed, opaque token) —
              deliberately outside AppShell/auth so no staff chrome or nav is
              ever visible; the client never logs in and never sees anything
              but this one proposal. */}
          <Route path="/p/:token" element={<ClientProposalView />} />

          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            {/* The Dashboard simplification folded Proposals/Drafts/Archived
                into one searchable/filterable list at "/" — these redirect
                any old bookmarks/links rather than 404ing. */}
            <Route path="/proposals" element={<Navigate to="/" replace />} />
            <Route path="/proposals/drafts" element={<Navigate to="/" replace />} />
            <Route path="/proposals/archived" element={<Navigate to="/" replace />} />
            <Route path="/proposals/:id" element={<ProposalDetail />} />
            <Route path="/proposals/:id/intelligence" element={<ProposalIntelligencePage />} />
            <Route path="/proposals/:id/questions" element={<ProposalQuestionsPage />} />
            <Route path="/proposals/:id/blueprint" element={<ProposalBlueprintPage />} />
            <Route path="/proposals/:id/content" element={<ProposalContentPage />} />
            <Route path="/proposals/:id/impact" element={<ProposalImpactPage />} />
            <Route path="/proposals/:id/preview" element={<ProposalPreviewPage />} />
            <Route path="/proposals/:id/studio" element={<ProposalStudioPage />} />
            <Route path="/proposals/:id/populate" element={<ProposalPopulatePage />} />
            <Route path="/proposals/:id/edit" element={<ProposalEditorPage />} />
            <Route path="/proposals/:id/review" element={<ProposalReviewPage />} />
            <Route path="/proposals/:id/send" element={<ProposalSendPage />} />
            <Route path="/proposals/:id/activity" element={<ProposalActivityPage />} />
            <Route path="/ai-learning" element={<AiLearningPage />} />
            <Route path="/ai-analysis" element={<ProposalAiAnalysis />} />
            <Route path="/ai-analysis/:id" element={<ProposalAnalysisDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
