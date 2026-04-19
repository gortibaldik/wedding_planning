<script setup>
console.info('RUNING SETUP FOR AuthenticatedApp')
import { ref, watch } from 'vue'
import GenealogyTree from './GenealogyTree/GenealogyTree.vue'
import GenealogyTreeSidebar from './GenealogyTree/GenealogyTreeSidebar.vue'
import InvitationComparisonTable from './InvitationComparisonTable.vue'
import InvitationListsManager from './InvitationListsManager.vue'
import SeatingArrangement from './SeatingArrangement/SeatingArrangement.vue'
import { useGenealogyData } from '@/composables/useGenealogyData.ts'
import { useSidebarState } from '@/composables/useSidebarState'
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

const validTabs = ['family-tree', 'invited-table', 'invitation-lists-manager', 'seating']

const getTabFromHash = () => {
  const hash = window.location.hash.slice(1) // remove '#'
  const tab = hash.split('/')[0]
  return validTabs.includes(tab) ? tab : 'family-tree'
}

const activeTab = ref(getTabFromHash())

const setActiveTab = tab => {
  activeTab.value = tab
  window.location.hash = tab
}

window.addEventListener('hashchange', () => {
  activeTab.value = getTabFromHash()
})

const { sidebarCollapsed } = useSidebarState()
</script>

<template>
  <div class="app">
    <header
      class="app-header"
      :style="{
        width: activeTab !== 'family-tree' || sidebarCollapsed ? '100%' : 'calc(100% - 300px)'
      }"
    >
      <div class="header-content">
        <div class="header-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'family-tree' }"
            @click="setActiveTab('family-tree')"
          >
            Family Tree
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'invited-table' }"
            @click="setActiveTab('invited-table')"
          >
            Invitations Comparison
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'invitation-lists-manager' }"
            @click="setActiveTab('invitation-lists-manager')"
          >
            Invitation Lists Manager
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'seating' }"
            @click="setActiveTab('seating')"
          >
            Seating Arrangement
          </button>
        </div>
        <div class="header-center">
          <h1>Wedding Planning</h1>
          <p v-if="activeTab === 'family-tree'" class="instructions">
            Click on any person to edit their details. Use the ↑ button to add parents, ↓ button to
            add children. Use the zoom controls to navigate the tree.
          </p>
          <p v-else-if="activeTab === 'invited-table'" class="instructions">
            Compare invitation lists across different users.
          </p>
          <p v-else class="instructions">
            Drag guests from the sidebar onto table seats. Drag table headers to reposition them.
          </p>
        </div>
        <div class="header-buttons">
          <div class="buttons-row">
            <button v-if="!skipAuth" class="logout-btn" title="Log out" @click="handleLogout">
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
    <div class="main-content">
      <div v-show="activeTab === 'family-tree'" class="tab-content">
        <GenealogyTree />
        <GenealogyTreeSidebar />
      </div>
      <InvitationComparisonTable v-if="activeTab === 'invited-table'" />
      <InvitationListsManager v-if="activeTab === 'invitation-lists-manager'" />
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
}

.app-header {
  background: white;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: width 0.3s ease;
}

.header-content {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 24px;
}

.header-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 8px 16px;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.tab-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.header-spacer {
  width: 100%;
}

.header-center {
  text-align: center;
}

.app-header h1 {
  font-size: 24px;
  color: #1f2937;
  margin-bottom: 8px;
}

.app-header .instructions {
  font-size: 14px;
  color: #6b7280;
}

.header-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
}

.buttons-row {
  display: flex;
  gap: 8px;
}

.square-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 8px;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.save-btn {
  background: #8b5cf6;
  color: white;
}

.save-btn:hover {
  background: #7c3aed;
  box-shadow: 0 4px 8px rgba(139, 92, 246, 0.3);
  transform: translateY(-2px);
}

.export-btn {
  background: #3b82f6;
  color: white;
}

.export-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.import-btn {
  background: #10b981;
  color: white;
}

.import-btn:hover {
  background: #059669;
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
  transform: translateY(-2px);
}

.logout-btn {
  padding: 8px 16px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logout-btn:hover {
  background: #4b5563;
  box-shadow: 0 4px 8px rgba(107, 114, 128, 0.3);
  transform: translateY(-2px);
}

.square-btn:active {
  transform: translateY(0);
}

.main-content {
  flex: 1;
  position: relative;
  display: flex;
  overflow: hidden;
}

.tab-content {
  display: flex;
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .app-header {
    padding: 8px 12px;
    width: 100% !important;
  }

  .header-content {
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .header-center {
    grid-column: 1 / -1;
    grid-row: 1;
    text-align: left;
  }

  .app-header h1 {
    font-size: 16px;
    margin-bottom: 0;
  }

  .app-header .instructions {
    display: none;
  }

  .header-tabs {
    grid-row: 2;
  }

  .tab-btn {
    padding: 6px 12px;
    font-size: 12px;
  }

  .header-buttons {
    grid-row: 2;
  }

  .square-btn {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }
}
</style>
