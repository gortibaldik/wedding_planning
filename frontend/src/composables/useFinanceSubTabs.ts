import { ref } from 'vue'

/** Sub-tabs of the finance tab, kept in the URL hash (like ManagedFilesEditor). */
export const FINANCE_SUB_TABS = ['trends', 'items', 'breakdown', 'import'] as const
export type FinanceSubTab = (typeof FINANCE_SUB_TABS)[number]

const getSubTabFromHash = (): FinanceSubTab => {
  const sub = window.location.hash.slice(1).split('/')[1]
  return (FINANCE_SUB_TABS as readonly string[]).includes(sub) ? (sub as FinanceSubTab) : 'trends'
}

// ---- Shared reactive state (module singleton, like the other composables) ----

const activeSubTab = ref<FinanceSubTab>(getSubTabFromHash())

const setSubTab = (sub: FinanceSubTab) => {
  activeSubTab.value = sub
  const tab = window.location.hash.slice(1).split('/')[0] || 'finance'
  window.location.hash = `${tab}/${sub}`
}

/** Hash listener; the owning component registers/removes it on mount/unmount. */
const onHashChange = () => (activeSubTab.value = getSubTabFromHash())

export function useFinanceSubTabs() {
  return {
    SUB_TABS: FINANCE_SUB_TABS,
    activeSubTab,
    setSubTab,
    onHashChange
  }
}
