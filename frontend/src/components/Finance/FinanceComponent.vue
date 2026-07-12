<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useFinance } from '@/composables/useFinance'
import { useFinanceSubTabs, type FinanceSubTab } from '@/composables/useFinanceSubTabs'
import TrendsTab from './tabs/TrendsTab.vue'
import ItemsTab from './tabs/ItemsTab.vue'
import BreakdownTab from './tabs/BreakdownTab.vue'
import ImportTab from './tabs/ImportTab.vue'

const { categories, errorMsg, refreshAll } = useFinance()
const { SUB_TABS, activeSubTab, setSubTab, onHashChange } = useFinanceSubTabs()

const TAB_LABELS: Record<FinanceSubTab, string> = {
  trends: 'Trends',
  items: 'Items',
  breakdown: 'Month breakdown',
  import: 'Import'
}

onMounted(() => {
  refreshAll()
  window.addEventListener('hashchange', onHashChange)
})
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <div class="fin">
    <div class="fin__subtabs">
      <button
        v-for="tab in SUB_TABS"
        :key="tab"
        class="fin__subtab"
        :class="{ 'fin__subtab--active': activeSubTab === tab }"
        @click="setSubTab(tab)"
      >
        {{ TAB_LABELS[tab] }}
      </button>
    </div>

    <p v-if="errorMsg" class="fin__error">{{ errorMsg }}</p>

    <!-- Shared by the Items and Import tabs (datalist ids are document-global). -->
    <datalist id="fin-categories">
      <option v-for="c in categories" :key="c" :value="c" />
    </datalist>

    <TrendsTab v-show="activeSubTab === 'trends'" />
    <ItemsTab v-show="activeSubTab === 'items'" />
    <BreakdownTab v-show="activeSubTab === 'breakdown'" />
    <ImportTab v-show="activeSubTab === 'import'" />
  </div>
</template>

<!-- Shared, fin__-namespaced styles used by the sub-tab components. -->
<style src="./finance.css"></style>

<style scoped>
.fin {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
  background: #f9fafb;
}

.fin__subtabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.fin__subtab {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.15s;
}

.fin__subtab--active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.fin__error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  margin-bottom: 12px;
}
</style>
