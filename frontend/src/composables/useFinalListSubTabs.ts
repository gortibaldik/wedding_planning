import { ref } from 'vue'

/** Sub-tabs of the final list tab, kept in the URL hash (like the finance tab). */
export const FINAL_LIST_SUB_TABS = ['invitations', 'accommodation'] as const
export type FinalListSubTab = (typeof FINAL_LIST_SUB_TABS)[number]

const getSubTabFromHash = (): FinalListSubTab => {
  const sub = window.location.hash.slice(1).split('/')[1]
  return (FINAL_LIST_SUB_TABS as readonly string[]).includes(sub)
    ? (sub as FinalListSubTab)
    : 'invitations'
}

// ---- Shared reactive state (module singleton, like the other composables) ----

const activeSubTab = ref<FinalListSubTab>(getSubTabFromHash())

const setSubTab = (sub: FinalListSubTab) => {
  activeSubTab.value = sub
  const tab = window.location.hash.slice(1).split('/')[0] || 'final-list'
  window.location.hash = `${tab}/${sub}`
}

/** Hash listener; the owning component registers/removes it on mount/unmount. */
const onHashChange = () => (activeSubTab.value = getSubTabFromHash())

export function useFinalListSubTabs() {
  return {
    SUB_TABS: FINAL_LIST_SUB_TABS,
    activeSubTab,
    setSubTab,
    onHashChange
  }
}
