import { ref, computed, type Ref } from 'vue'
import { useAuth } from './useAuth'

const { authFetch } = useAuth()

/**
 * Permissive recursive types used by the generic node editor, which walks an
 * arbitrary JSON tree. The concrete `I18nFile` shape below documents the
 * fields that are *always* expected by `landing.html`.
 */
export type I18nLeaf = string | number | boolean
export type I18nValue = I18nLeaf | I18nObject | I18nValue[]
export interface I18nObject {
  [key: string]: I18nValue
}

export interface I18nAdmin {
  title: string
  login_button: string
  login_prompt: string
}

export interface I18nInfoGridRow {
  label: string
  value: string
}

export interface I18nInfoGridSection {
  type: 'info-grid'
  title: string
  rows: I18nInfoGridRow[]
}

export interface I18nTextSection {
  type: 'text'
  title: string
  text: string
}

export type I18nSection = I18nInfoGridSection | I18nTextSection

/** Anything the CMS editor can insert into an array of the doc. */
export type I18nArrayItem = I18nValue | I18nSection | I18nInfoGridRow

export const SECTION_TYPES: readonly I18nSection['type'][] = ['text', 'info-grid']

/** Blank row, as appended by the CMS editor. */
export const newInfoGridRow = (): I18nInfoGridRow => ({ label: '', value: '' })

/** Blank section of the given type, as appended by the CMS editor. */
export const newSection = (type: I18nSection['type']): I18nSection =>
  type === 'text'
    ? { type: 'text', title: '', text: '' }
    : { type: 'info-grid', title: '', rows: [newInfoGridRow()] }

/**
 * Concrete shape of one language's i18n JSON file, mirroring the placeholders
 * used in `backend/routers/index/templates/landing.html`.
 */
export interface I18nFile {
  lang: string
  page_title: string
  bride: string
  groom: string
  connector: string
  wedding_date_label: string
  wedding_date: string
  enable_rickroll: boolean
  enable_games: boolean
  games_title: string
  games_description: string
  sections: I18nSection[]
  admin: I18nAdmin
}

interface I18nResponse {
  langs: string[]
  default_lang: string
  files: Record<string, I18nFile>
}

/**
 * Everything the CMS editor works on, available only once `loadAll` has
 * succeeded. `selectedLang` is always a key of `files`, so the selected
 * document always exists.
 */
export interface I18nWorkspace {
  langs: string[]
  defaultLang: string
  files: Record<string, I18nFile>
  savedSnapshots: Record<string, string>
  selectedLang: string
}

/** `null` until the first successful `loadAll`. */
const workspace = ref<I18nWorkspace | null>(null)
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref<string>('')

const downloading = ref(false)
const previewing = ref(false)
const dbErrorMsg = ref<string>('')
const dumpPreview = ref<string>('')

/**
 * Editing operations on a loaded workspace. Callers get hold of a workspace
 * only after `workspace` is non-null, so nothing here deals with a missing
 * document.
 */
export function useI18nEditor(ws: Readonly<Ref<I18nWorkspace>>) {
  const selectedLang = computed<string>({
    get: () => ws.value.selectedLang,
    set: lang => {
      ws.value.selectedLang = lang
    }
  })

  const currentDoc = computed<I18nFile>({
    get: () => ws.value.files[ws.value.selectedLang],
    set: doc => {
      ws.value.files[ws.value.selectedLang] = doc
    }
  })

  const isDirty = computed(
    () => JSON.stringify(currentDoc.value) !== ws.value.savedSnapshots[ws.value.selectedLang]
  )

  const revert = () => {
    currentDoc.value = JSON.parse(ws.value.savedSnapshots[ws.value.selectedLang])
  }

  const save = async () => {
    if (!isDirty.value) return
    const lang = ws.value.selectedLang
    const body = JSON.stringify(currentDoc.value)
    saving.value = true
    errorMsg.value = ''
    try {
      const res = await authFetch(`/managed-files/i18n/${lang}`, { method: 'PUT', body })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail || `HTTP ${res.status}`)
      }
      ws.value.savedSnapshots[lang] = body
    } catch (e) {
      errorMsg.value = 'Failed to save: ' + (e instanceof Error ? e.message : String(e))
    } finally {
      saving.value = false
    }
  }

  const resolveArray = (arrayPath: (string | number)[]): I18nValue[] | undefined => {
    let node: I18nValue | undefined = currentDoc.value as unknown as I18nObject
    for (const segment of arrayPath) {
      node = (node as I18nObject | undefined)?.[segment as string]
    }
    return Array.isArray(node) ? node : undefined
  }

  const moveInArray = (arrayPath: (string | number)[], from: number, to: number) => {
    const arr = resolveArray(arrayPath)
    if (!arr) return
    if (to < 0 || to >= arr.length || from === to) return
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
  }

  const insertInArray = (arrayPath: (string | number)[], index: number, item: I18nArrayItem) => {
    const arr = resolveArray(arrayPath)
    if (!arr) return
    arr.splice(Math.max(0, Math.min(index, arr.length)), 0, item as I18nValue)
  }

  const removeFromArray = (arrayPath: (string | number)[], index: number) => {
    const arr = resolveArray(arrayPath)
    if (!arr || index < 0 || index >= arr.length) return
    arr.splice(index, 1)
  }

  const updateAtPath = (path: (string | number)[], newValue: I18nValue) => {
    if (path.length === 0) {
      currentDoc.value = newValue as unknown as I18nFile
      return
    }
    let parent = currentDoc.value as unknown as I18nObject | I18nValue[]
    for (let i = 0; i < path.length - 1; i++) {
      parent = (parent as I18nObject)[path[i] as string] as I18nObject | I18nValue[]
    }
    ;(parent as I18nObject)[path[path.length - 1] as string] = newValue
  }

  return {
    selectedLang,
    currentDoc,
    isDirty,
    saving,
    revert,
    save,
    updateAtPath,
    moveInArray,
    insertInArray,
    removeFromArray
  }
}

export function useManagedFiles() {
  const loadAll = async () => {
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await authFetch('/managed-files/i18n')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: I18nResponse = await res.json()
      const previousLang = workspace.value?.selectedLang
      workspace.value = {
        langs: data.langs,
        defaultLang: data.default_lang,
        files: { ...data.files },
        savedSnapshots: Object.fromEntries(data.langs.map(l => [l, JSON.stringify(data.files[l])])),
        selectedLang:
          previousLang && data.langs.includes(previousLang)
            ? previousLang
            : data.default_lang || data.langs[0]
      }
    } catch (e) {
      errorMsg.value = 'Failed to load: ' + (e instanceof Error ? e.message : String(e))
    } finally {
      loading.value = false
    }
  }

  const fetchRedisDump = async (): Promise<unknown> => {
    const res = await authFetch('/managed-files/redis-dump')
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.detail || `HTTP ${res.status}`)
    }
    return res.json()
  }

  /**
   * Recursively expand any string that is itself serialized JSON into a real
   * object/array, so the preview renders nested data with proper indentation
   * instead of escaped single-line blobs.
   */
  const deepParse = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      const looksLikeJson =
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      if (looksLikeJson) {
        try {
          return deepParse(JSON.parse(trimmed))
        } catch {
          return value
        }
      }
      return value
    }
    if (Array.isArray(value)) return value.map(deepParse)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepParse(v)])
      )
    }
    return value
  }

  const formatDump = (data: unknown): string => JSON.stringify(deepParse(data), null, 2)

  const downloadRedisDump = async () => {
    downloading.value = true
    dbErrorMsg.value = ''
    try {
      const data = await fetchRedisDump()
      const blob = new Blob([formatDump(data)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `redis-dump-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      dbErrorMsg.value = 'Failed to download: ' + (e instanceof Error ? e.message : String(e))
    } finally {
      downloading.value = false
    }
  }

  const previewRedisDump = async () => {
    previewing.value = true
    dbErrorMsg.value = ''
    try {
      const data = await fetchRedisDump()
      dumpPreview.value = formatDump(data)
    } catch (e) {
      dbErrorMsg.value = 'Failed to load: ' + (e instanceof Error ? e.message : String(e))
    } finally {
      previewing.value = false
    }
  }

  return {
    workspace,
    loading,
    errorMsg,
    loadAll,
    downloading,
    previewing,
    dbErrorMsg,
    dumpPreview,
    downloadRedisDump,
    previewRedisDump
  }
}
