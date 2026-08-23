import { computed, ref } from 'vue'
import { useAuth } from './useAuth'
import { useLocalStorage } from './useLocalStorage'

const { authFetch, storedUserInfo } = useAuth()

/** A link to an external document, mirroring `backend/routers/documents.py::Document`. */
export interface DocumentLink {
  id: string
  section_id: string
  title: string
  url: string
  description: string
  order: number
}

/** A collapsible group of documents, mirroring `documents.py::SectionWithDocuments`. */
export interface DocumentSection {
  id: string
  title: string
  description: string
  order: number
  documents: DocumentLink[]
}

/** Payload for creating/updating a section (the backend owns `id` and `order`). */
export type SectionInput = Pick<DocumentSection, 'title' | 'description'>

/** Payload for creating/updating a document link. */
export type DocumentInput = Pick<DocumentLink, 'section_id' | 'title' | 'url' | 'description'>

const EXPANDED_STORAGE_KEY = 'documents_expanded_sections'
const { saveToLocalStorage, loadFromLocalStorage } = useLocalStorage(EXPANDED_STORAGE_KEY)

// ---- Shared reactive state (module singletons, like the other composables) ----

const sections = ref<DocumentSection[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')

/**
 * Which sections are expanded, per browser. Kept as a map so a section added
 * later defaults to expanded rather than inheriting someone else's state.
 */
const expandedSections = ref<Record<string, boolean>>(loadFromLocalStorage() ?? {})

/** Which documents show their inline preview iframe (not persisted). */
const previewedDocuments = ref<Record<string, boolean>>({})

const canViewDocuments = computed(
  () => storedUserInfo.value?.roles?.includes('documents-viewer') ?? false
)

const canEditDocuments = computed(
  () => storedUserInfo.value?.roles?.includes('documents-editor') ?? false
)

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await authFetch(`/documents${path}`, init)
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/**
 * The URL that renders a Google document read-only inside an iframe, or `null`
 * when the link is not something Google can embed (a plain website, say).
 */
export const embedUrl = (url: string): string | null => {
  const match =
    /^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/?#]+)/.exec(url)
  if (match) {
    // Slides answer on /embed, the other two on /preview.
    return `https://docs.google.com/${match[1]}/d/${match[2]}/${
      match[1] === 'presentation' ? 'embed' : 'preview'
    }`
  }
  const driveMatch = /^https:\/\/drive\.google\.com\/file\/d\/([^/?#]+)/.exec(url)
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
  }
  return null
}

/** Host of a link, e.g. "docs.google.com" — shown as a hint next to the title. */
export const linkHost = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** Move the element with `id` one step towards the start/end of `ids`. */
const withMoved = (ids: string[], id: string, direction: -1 | 1): string[] | null => {
  const from = ids.indexOf(id)
  const to = from + direction
  if (from === -1 || to < 0 || to >= ids.length) return null
  const reordered = [...ids]
  reordered.splice(to, 0, ...reordered.splice(from, 1))
  return reordered
}

export function useDocuments() {
  const withErrorHandling = async <T>(
    action: () => Promise<T>,
    failureMessage: string,
    busy = saving
  ): Promise<T | null> => {
    busy.value = true
    errorMsg.value = ''
    try {
      return await action()
    } catch (e) {
      errorMsg.value = `${failureMessage}: ` + (e instanceof Error ? e.message : String(e))
      return null
    } finally {
      busy.value = false
    }
  }

  const loadSections = () =>
    withErrorHandling(
      async () => {
        sections.value = await request<DocumentSection[]>('/')
      },
      'Failed to load documents',
      loading
    )

  /** Every mutation ends by re-reading the tree, so orders stay authoritative. */
  const mutate = (path: string, init: RequestInit, failureMessage: string) =>
    withErrorHandling(async () => {
      await request(path, init)
      sections.value = await request<DocumentSection[]>('/')
      return true
    }, failureMessage)

  const addSection = (input: SectionInput) =>
    mutate('/sections', { method: 'POST', body: JSON.stringify(input) }, 'Failed to add section')

  const updateSection = (id: string, input: SectionInput) =>
    mutate(
      `/sections/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      'Failed to save section'
    )

  const deleteSection = (id: string) =>
    mutate(`/sections/${id}`, { method: 'DELETE' }, 'Failed to delete section')

  const addDocument = (input: DocumentInput) =>
    mutate('/items', { method: 'POST', body: JSON.stringify(input) }, 'Failed to add document')

  const updateDocument = (id: string, input: DocumentInput) =>
    mutate(
      `/items/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      'Failed to save document'
    )

  const deleteDocument = (id: string) =>
    mutate(`/items/${id}`, { method: 'DELETE' }, 'Failed to delete document')

  const moveSection = (id: string, direction: -1 | 1) => {
    const ids = withMoved(
      sections.value.map(section => section.id),
      id,
      direction
    )
    if (!ids) return Promise.resolve(null)
    return mutate(
      '/sections/reorder',
      { method: 'POST', body: JSON.stringify({ ids }) },
      'Failed to reorder sections'
    )
  }

  const moveDocument = (sectionId: string, id: string, direction: -1 | 1) => {
    const section = sections.value.find(s => s.id === sectionId)
    if (!section) return Promise.resolve(null)
    const ids = withMoved(
      section.documents.map(document => document.id),
      id,
      direction
    )
    if (!ids) return Promise.resolve(null)
    return mutate(
      '/items/reorder',
      { method: 'POST', body: JSON.stringify({ ids }) },
      'Failed to reorder documents'
    )
  }

  const isExpanded = (sectionId: string): boolean => expandedSections.value[sectionId] !== false

  const toggleSection = (sectionId: string) => {
    expandedSections.value = {
      ...expandedSections.value,
      [sectionId]: !isExpanded(sectionId)
    }
    saveToLocalStorage(expandedSections.value)
  }

  const isPreviewed = (documentId: string): boolean => previewedDocuments.value[documentId] === true

  const togglePreview = (documentId: string) => {
    previewedDocuments.value = {
      ...previewedDocuments.value,
      [documentId]: !isPreviewed(documentId)
    }
  }

  return {
    sections,
    loading,
    saving,
    errorMsg,
    canViewDocuments,
    canEditDocuments,
    loadSections,
    addSection,
    updateSection,
    deleteSection,
    moveSection,
    addDocument,
    updateDocument,
    deleteDocument,
    moveDocument,
    isExpanded,
    toggleSection,
    isPreviewed,
    togglePreview,
    embedUrl,
    linkHost
  }
}
