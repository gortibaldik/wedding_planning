import { ref, computed } from 'vue'
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
  sections: I18nSection[]
  admin: I18nAdmin
}

interface I18nResponse {
  langs: string[]
  default_lang: string
  files: Record<string, I18nFile>
}

const langs = ref<string[]>([])
const defaultLang = ref<string>('')
const filesByLang = ref<Record<string, I18nFile>>({})
const savedSnapshotByLang = ref<Record<string, string>>({})
const selectedLang = ref<string>('')
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref<string>('')

const currentDoc = computed<I18nFile | undefined>(() => filesByLang.value[selectedLang.value])

const isDirty = computed(() => {
  if (!selectedLang.value) return false
  return (
    JSON.stringify(filesByLang.value[selectedLang.value]) !==
    savedSnapshotByLang.value[selectedLang.value]
  )
})

const snapshotCurrent = () => {
  savedSnapshotByLang.value[selectedLang.value] = JSON.stringify(
    filesByLang.value[selectedLang.value]
  )
}

export function useManagedFiles() {
  const loadAll = async () => {
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await authFetch('/managed-files/i18n')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: I18nResponse = await res.json()
      langs.value = data.langs
      defaultLang.value = data.default_lang
      filesByLang.value = { ...data.files }
      savedSnapshotByLang.value = Object.fromEntries(
        data.langs.map(l => [l, JSON.stringify(data.files[l] ?? ({} as I18nFile))])
      )
      if (!selectedLang.value && data.langs.length > 0) {
        selectedLang.value = data.default_lang || data.langs[0]
      }
    } catch (e) {
      errorMsg.value = 'Failed to load: ' + (e instanceof Error ? e.message : String(e))
    } finally {
      loading.value = false
    }
  }

  const revert = () => {
    const snap = savedSnapshotByLang.value[selectedLang.value]
    if (snap !== undefined) {
      filesByLang.value[selectedLang.value] = JSON.parse(snap)
    }
  }

  const save = async () => {
    if (!selectedLang.value || !isDirty.value) return
    saving.value = true
    errorMsg.value = ''
    try {
      const res = await authFetch(`/managed-files/i18n/${selectedLang.value}`, {
        method: 'PUT',
        body: JSON.stringify(filesByLang.value[selectedLang.value])
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail || `HTTP ${res.status}`)
      }
      snapshotCurrent()
    } catch (e) {
      errorMsg.value = 'Failed to save: ' + (e instanceof Error ? e.message : String(e))
    } finally {
      saving.value = false
    }
  }

  const moveInArray = (arrayPath: (string | number)[], from: number, to: number) => {
    let arr: I18nValue[] = filesByLang.value[selectedLang.value] as unknown as I18nValue[]
    for (const segment of arrayPath) {
      arr = (arr as unknown as I18nObject)[segment as string] as I18nValue[]
    }
    if (!Array.isArray(arr)) return
    if (to < 0 || to >= arr.length || from === to) return
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
  }

  const updateAtPath = (path: (string | number)[], newValue: I18nValue) => {
    if (path.length === 0) {
      filesByLang.value[selectedLang.value] = newValue as unknown as I18nFile
      return
    }
    let parent = filesByLang.value[selectedLang.value] as unknown as I18nObject | I18nValue[]
    for (let i = 0; i < path.length - 1; i++) {
      parent = (parent as I18nObject)[path[i] as string] as I18nObject | I18nValue[]
    }
    ;(parent as I18nObject)[path[path.length - 1] as string] = newValue
  }

  return {
    langs,
    defaultLang,
    selectedLang,
    currentDoc,
    loading,
    saving,
    errorMsg,
    isDirty,
    loadAll,
    revert,
    save,
    updateAtPath,
    moveInArray
  }
}
