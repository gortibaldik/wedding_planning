<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useInvitationLists } from '@/composables/useInvitationLists'
import { useAuth } from '@/composables/useAuth'
import { useFinalListSubTabs, type FinalListSubTab } from '@/composables/useFinalListSubTabs'
import InvitationsTab from './tabs/InvitationsTab.vue'
import AccommodationTab from './tabs/AccommodationTab.vue'

const {
  initInvitationLists,
  finalList,
  finalLoading,
  finalSaving,
  finalNotFound,
  finalEntriesDirty,
  fetchFinalList,
  fetchHotels,
  revertFinalEntries,
  saveFinalEntries
} = useInvitationLists()
const { isUniversalInvitationListSetter } = useAuth()
const { SUB_TABS, activeSubTab, setSubTab, onHashChange } = useFinalListSubTabs()

const TAB_LABELS: Record<FinalListSubTab, string> = {
  invitations: 'Invitations',
  accommodation: 'Accommodation'
}

const handleRevert = () => {
  revertFinalEntries()
}

const handleSave = async () => {
  try {
    await saveFinalEntries()
  } catch (e) {
    alert('Failed to save: ' + (e instanceof Error ? e.message : String(e)))
  }
}

onMounted(async () => {
  window.addEventListener('hashchange', onHashChange)
  await initInvitationLists()
  await fetchFinalList()
  await fetchHotels()
})
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <div class="it">
    <div v-if="finalLoading" class="it__loading">Loading...</div>

    <div v-if="finalNotFound && !finalLoading" class="it__empty-state">
      No final list has been set.
    </div>

    <template v-if="finalList && !finalLoading">
      <div v-if="isUniversalInvitationListSetter" class="it__controls">
        <button
          class="it__save-btn"
          :class="{ 'it__save-btn--disabled': !finalEntriesDirty || finalSaving }"
          :disabled="!finalEntriesDirty || finalSaving"
          @click="handleSave"
        >
          {{ finalSaving ? 'Saving...' : 'Save Changes' }}
        </button>
        <button
          class="it__revert-btn"
          :class="{ 'it__revert-btn--disabled': !finalEntriesDirty }"
          :disabled="!finalEntriesDirty"
          @click="handleRevert"
        >
          Revert Changes
        </button>
      </div>

      <div class="it__tabs">
        <button
          v-for="tab in SUB_TABS"
          :key="tab"
          class="it__tab"
          :class="{ 'it__tab--active': activeSubTab === tab }"
          @click="setSubTab(tab)"
        >
          {{ TAB_LABELS[tab] }}
        </button>
      </div>

      <InvitationsTab v-if="activeSubTab === 'invitations'" />
      <AccommodationTab v-else-if="activeSubTab === 'accommodation'" />
    </template>
  </div>
</template>

<!-- Shared, it__-namespaced styles used by the sub-tab components. -->
<style src="./finalList.css"></style>
