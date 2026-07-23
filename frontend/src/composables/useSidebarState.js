import { ref } from 'vue'

const sidebarCollapsed = ref(true)

export function useSidebarState() {
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    sidebarCollapsed,
    toggleSidebar
  }
}
