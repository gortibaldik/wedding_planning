<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useManagedFiles } from '@/composables/useManagedFiles'
import { useAuth } from '@/composables/useAuth'
import ManagedFilesCms from './ManagedFilesCms.vue'
import ManagedFilesDatabase from './ManagedFilesDatabase.vue'

const { workspace, loading, errorMsg, loadAll } = useManagedFiles()

const { storedUserInfo } = useAuth()
const canDumpDatabase = computed(
  () => storedUserInfo.value?.roles?.includes('managed-files-dump') ?? false
)

const SUB_TABS = ['cms', 'database'] as const
type SubTab = (typeof SUB_TABS)[number]

// The active subtab lives in the URL hash's second segment (e.g.
// `#managed-files/database`) so a reload / shared link keeps the same subpage.
// The `database` subtab is only available to users with the dump role.
const getSubTabFromHash = (): SubTab => {
  const sub = window.location.hash.slice(1).split('/')[1]
  if (sub === 'database') return canDumpDatabase.value ? 'database' : 'cms'
  return (SUB_TABS as readonly string[]).includes(sub) ? (sub as SubTab) : 'cms'
}

const activeSubTab = ref<SubTab>(getSubTabFromHash())

const setSubTab = (sub: SubTab) => {
  activeSubTab.value = sub
  const tab = window.location.hash.slice(1).split('/')[0] || 'managed-files'
  window.location.hash = `${tab}/${sub}`
}

const onHashChange = () => {
  activeSubTab.value = getSubTabFromHash()
}

onMounted(() => {
  loadAll()
  window.addEventListener('hashchange', onHashChange)
})
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <div class="mf">
    <div class="mf__subtabs">
      <button
        class="mf__subtab"
        :class="{ 'mf__subtab--active': activeSubTab === 'cms' }"
        @click="setSubTab('cms')"
      >
        CMS (landing page)
      </button>
      <button
        v-if="canDumpDatabase"
        class="mf__subtab"
        :class="{ 'mf__subtab--active': activeSubTab === 'database' }"
        @click="setSubTab('database')"
      >
        Database management
      </button>
    </div>

    <ManagedFilesDatabase v-if="activeSubTab === 'database'" />

    <template v-else>
      <div v-if="errorMsg" class="mf__error">{{ errorMsg }}</div>
      <div v-if="loading" class="mf__loading">Loading...</div>
      <ManagedFilesCms v-if="workspace" :workspace="workspace" />
      <button v-else-if="!loading" class="mf__reload-btn mf__retry-btn" @click="loadAll">
        Retry
      </button>
    </template>
  </div>
</template>

<style src="./managedFiles.css"></style>

<style scoped>
.mf {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f9fafb;
}

.mf__subtabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e5e7eb;
}

.mf__subtab {
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.mf__subtab:hover {
  color: #374151;
}

.mf__subtab--active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.mf__loading {
  text-align: center;
  color: #6b7280;
  padding: 24px;
  font-size: 14px;
}

.mf__retry-btn {
  align-self: flex-start;
}

@media (max-width: 768px) {
  .mf {
    padding: 12px;
  }
}
</style>
