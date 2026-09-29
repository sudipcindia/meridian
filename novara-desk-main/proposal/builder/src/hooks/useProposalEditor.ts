import { useCallback, useEffect, useRef, useState } from 'react'
import { getDocumentByProposalId, updateDocumentContent } from '../lib/documents.js'
import { recordDocumentVersion } from '../modules/versionHistory/index.js'
import { logActivity } from '../modules/activity/logActivity.js'
import type { ContentOverrideMap, VariableMap } from '../modules/variables/index.js'
import type { ProposalDocument } from '../types/document.js'

export interface EditorState {
  variables: VariableMap
  contentOverrides: ContentOverrideMap
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface HistoryState {
  past: EditorState[]
  present: EditorState
  future: EditorState[]
}

const MAX_HISTORY = 50
const AUTOSAVE_DEBOUNCE_MS = 800
const EDITED_BY_PLACEHOLDER = 'staff' // no staff-auth system exists yet (same gap as elsewhere in this codebase)

function statesEqual(a: EditorState, b: EditorState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export interface UseProposalEditorResult {
  document: ProposalDocument | null
  loading: boolean
  loadError: string | null
  state: EditorState
  setVariable: (key: string, value: string) => void
  setContentOverride: (blockKey: string, value: string) => void
  /** Call when an edit session starts (e.g. the inline popover opens) — captures the undo checkpoint. */
  beginEditSession: () => void
  /** Call when an edit session ends (e.g. the inline popover closes) — commits the checkpoint if anything changed. */
  commitEditSession: () => void
  saveStatus: SaveStatus
  saveError: string | null
  isDirty: boolean
  saveNow: () => Promise<void>
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/**
 * Owns a proposal's editable content state (variables + content overrides),
 * local undo/redo, and debounced autosave. The single save path
 * (`saveNow` → `updateDocumentContent`) is used identically by the
 * autosave debounce timer and by any manual Save button — there is exactly
 * one persistence code path, never two.
 */
export function useProposalEditor(proposalId: string, readOnly = false): UseProposalEditorResult {
  const [document, setDocument] = useState<ProposalDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: { variables: {}, contentOverrides: {} },
    future: [],
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const documentRef = useRef<ProposalDocument | null>(null)
  const presentRef = useRef<EditorState>(history.present)
  const lastSavedRef = useRef<EditorState | null>(null)
  const editSessionSnapshotRef = useRef<EditorState | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const pendingRerunRef = useRef(false)
  const readOnlyRef = useRef(readOnly)
  readOnlyRef.current = readOnly

  useEffect(() => {
    presentRef.current = history.present
  }, [history.present])

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDocumentByProposalId(proposalId)
      .then((doc) => {
        if (cancelled) return
        documentRef.current = doc
        setDocument(doc)
        const initial: EditorState = {
          variables: doc?.variables ?? {},
          contentOverrides: doc?.contentOverrides ?? {},
        }
        lastSavedRef.current = initial
        setHistory({ past: [], present: initial, future: [] })
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [proposalId])

  // ── Autosave scheduling ───────────────────────────────────────────────────
  const scheduleAutosave = useCallback(() => {
    if (readOnlyRef.current) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      void saveNow()
    }, AUTOSAVE_DEBOUNCE_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveNow is intentionally read via closure only at fire-time, not a reactive dependency here (matches this hook's existing ref-based stale-closure-avoidance pattern)
  }, [])

  // ── Save (shared by autosave and the manual Save button) ─────────────────
  const saveNow = useCallback(async () => {
    if (readOnlyRef.current) return
    const doc = documentRef.current
    if (!doc) return

    if (inFlightRef.current) {
      pendingRerunRef.current = true
      return
    }

    const toSave = presentRef.current
    if (lastSavedRef.current && statesEqual(lastSavedRef.current, toSave)) return

    inFlightRef.current = true
    setSaveStatus('saving')
    setSaveError(null)
    try {
      const updated = await updateDocumentContent(doc, toSave)
      documentRef.current = updated
      setDocument(updated)
      lastSavedRef.current = toSave
      setSaveStatus('saved')

      const changedVariableKeys = Object.keys(toSave.variables).length
      const changedBlockKeys = Object.keys(toSave.contentOverrides).length
      const summary = `Saved ${changedVariableKeys} variable(s) and ${changedBlockKeys} content override(s)`
      await recordDocumentVersion(updated, EDITED_BY_PLACEHOLDER, summary)
      void logActivity({ proposalId: updated.proposalId, action: 'content_updated', actor: EDITED_BY_PLACEHOLDER, detail: summary })
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      inFlightRef.current = false
      if (pendingRerunRef.current) {
        pendingRerunRef.current = false
        void saveNow()
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      // Best-effort final save on unmount; the unsaved-changes guard is the real backstop.
      if (lastSavedRef.current && !statesEqual(lastSavedRef.current, presentRef.current)) {
        void saveNow()
      }
    }
  }, [saveNow])

  // ── Live edits (update present immediately; debounce autosave; no history push per keystroke) ──
  function updatePresent(mutate: (state: EditorState) => EditorState) {
    setHistory((h) => ({ ...h, present: mutate(h.present) }))
    scheduleAutosave()
  }

  const setVariable = useCallback((key: string, value: string) => {
    updatePresent((s) => ({ ...s, variables: { ...s.variables, [key]: value } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setContentOverride = useCallback((blockKey: string, value: string) => {
    updatePresent((s) => ({ ...s, contentOverrides: { ...s.contentOverrides, [blockKey]: value } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Undo/redo commit boundaries ───────────────────────────────────────────
  const beginEditSession = useCallback(() => {
    editSessionSnapshotRef.current = presentRef.current
  }, [])

  const commitEditSession = useCallback(() => {
    const before = editSessionSnapshotRef.current
    editSessionSnapshotRef.current = null
    if (!before) return
    const after = presentRef.current
    if (statesEqual(before, after)) return
    setHistory((h) => ({ past: [...h.past.slice(-(MAX_HISTORY - 1)), before], present: after, future: [] }))
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h
      const previous = h.past[h.past.length - 1]
      scheduleAutosave()
      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      const next = h.future[0]
      scheduleAutosave()
      return { past: [...h.past, h.present], present: next, future: h.future.slice(1) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isDirty = lastSavedRef.current ? !statesEqual(lastSavedRef.current, history.present) : false

  return {
    document,
    loading,
    loadError,
    state: history.present,
    setVariable,
    setContentOverride,
    beginEditSession,
    commitEditSession,
    saveStatus,
    saveError,
    isDirty,
    saveNow,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
