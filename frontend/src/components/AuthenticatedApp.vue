<script setup>
console.info('RUNING SETUP FOR AuthenticatedApp')
import { ref, computed } from 'vue'
import GenealogyTree from './GenealogyTree/GenealogyTree.vue'
import GenealogyTreeSidebar from './GenealogyTree/GenealogyTreeSidebar.vue'
import InvitationComparisonTable from './InvitationComparisonTable.vue'
import InvitationListsManager from './InvitationListsManager.vue'
import FinalListView from './FinalListView.vue'
import SeatingArrangement from './SeatingArrangement/SeatingArrangement.vue'
import { useAuth } from '@/composables/useAuth.ts'
import { useStoredData } from '@/composables/useStoredData.ts'

const emit = defineEmits(['logout'])

const { logout } = useAuth()
const { initStoredData } = useStoredData()
const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true'

await initStoredData()

const handleLogout = () => {
  logout()
  emit('logout')
}

const tabs = [
  { id: 'family-tree', label: 'Family Tree' },
  { id: 'invited-table', label: 'Invitations Comparison' },
  { id: 'invitation-lists-manager', label: 'Invitation Lists Manager' },
  { id: 'final-list', label: 'Final List' },
  { id: 'seating', label: 'Seating Arrangement' }
]
const validTabs = tabs.map(t => t.id)

const getTabFromHash = () => {
  const hash = window.location.hash.slice(1)
  const tab = hash.split('/')[0]
  return validTabs.includes(tab) ? tab : 'family-tree'
}

const activeTab = ref(getTabFromHash())
const menuOpen = ref(false)

const activeLabel = computed(() => tabs.find(t => t.id === activeTab.value)?.label ?? '')

const setActiveTab = tab => {
  activeTab.value = tab
  window.location.hash = tab
  menuOpen.value = false
}

window.addEventListener('hashchange', () => {
  activeTab.value = getTabFromHash()
})
</script>

<template>
  <div class="app">
    <div class="top-bar">
      <button
        class="menu-toggle"
        :class="{ 'menu-toggle--open': menuOpen }"
        title="Menu"
        @click="menuOpen = !menuOpen"
      >
        <span class="menu-toggle__bar"></span>
        <span class="menu-toggle__bar"></span>
        <span class="menu-toggle__bar"></span>
      </button>
      <h2 class="top-bar__title">{{ activeLabel }}</h2>
    </div>

    <transition name="backdrop">
      <div v-if="menuOpen" class="backdrop" @click="menuOpen = false"></div>
    </transition>

    <transition name="drawer">
      <aside v-if="menuOpen" class="drawer">
        <div class="drawer__header">
          <h1>Wedding Planning</h1>
        </div>
        <nav class="drawer__nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="nav-btn"
            :class="{ active: activeTab === tab.id }"
            @click="setActiveTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>
        <div class="drawer__footer">
          <button v-if="!skipAuth" class="logout-btn" @click="handleLogout">Log out</button>
        </div>
      </aside>
    </transition>

    <div class="main-content">
      <div v-if="activeTab === 'family-tree'" class="tab-content">
        <GenealogyTree />
        <GenealogyTreeSidebar />
      </div>
      <InvitationComparisonTable v-if="activeTab === 'invited-table'" />
      <InvitationListsManager v-if="activeTab === 'invitation-lists-manager'" />
      <FinalListView v-if="activeTab === 'final-list'" />
      <Suspense>
        <SeatingArrangement v-if="activeTab === 'seating'" />
      </Suspense>
    </div>
  </div>
</template>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 8px 16px 8px 8px;
}

.top-bar__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
}

.menu-toggle {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  transition: background 0.15s;
  flex-shrink: 0;
}

.menu-toggle:hover {
  background: #f3f4f6;
}

.menu-toggle__bar {
  width: 20px;
  height: 2px;
  background: #1f2937;
  border-radius: 2px;
  transition: transform 0.2s;
}

.menu-toggle--open .menu-toggle__bar:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.menu-toggle--open .menu-toggle__bar:nth-child(2) {
  opacity: 0;
}

.menu-toggle--open .menu-toggle__bar:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 20;
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 260px;
  background: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.12);
  z-index: 25;
  display: flex;
  flex-direction: column;
}

.drawer__header {
  padding: 20px 16px 20px 64px;
  border-bottom: 1px solid #f3f4f6;
}

.drawer__header h1 {
  font-size: 18px;
  color: #1f2937;
  margin: 0;
}

.drawer__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
  overflow-y: auto;
}

.nav-btn {
  padding: 10px 14px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.nav-btn:hover {
  background: #f3f4f6;
}

.nav-btn.active {
  background: #3b82f6;
  color: white;
}

.drawer__footer {
  padding: 12px;
  border-top: 1px solid #f3f4f6;
}

.logout-btn {
  width: 100%;
  padding: 8px 16px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: #4b5563;
}

.main-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
  display: flex;
  overflow: hidden;
}

.tab-content {
  display: flex;
  width: 100%;
  height: 100%;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.22s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.2s ease;
}
</style>
