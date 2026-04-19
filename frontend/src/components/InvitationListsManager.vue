<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { InvitationList, useInvitationLists } from '@/composables/useInvitationLists'
import { useStoredData } from '@/composables/useStoredData'
import { useAuth } from '@/composables/useAuth'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'

const { allLists, usersLists, initInvitationLists, getPersonName } = useInvitationLists()
const { people } = useStoredData()
const { authFetch, storedUserInfo } = useAuth()

const selectedListId = ref<string>('')
const selectedList = ref<InvitationList | null>(null)
const myInvitedIds = ref<Set<string>>(new Set())
const savedSnapshot = ref<string>('')
const loading = ref(false)
const saving = ref(false)

const dirty = computed(() => {
  return [...myInvitedIds.value].sort().join(',') !== savedSnapshot.value
})

const isOwner = computed(() => {
  if (!selectedList.value) return false
  return selectedList.value.metadata.owner_sub === storedUserInfo.value?.sub
})

const sortedInvitedIds = computed(() => {
  return [...myInvitedIds.value].sort((a, b) => getPersonName(a).localeCompare(getPersonName(b)))
})

const fetchFullList = async (listId: string): Promise<InvitationList> => {
  const res = await authFetch(`/invitation-lists/get/${listId}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

const takeSnapshot = () => {
  savedSnapshot.value = [...myInvitedIds.value].sort().join(',')
}

const updateHash = (listId: string) => {
  window.location.hash = `invitation-lists-manager/${listId}`
}

const getListIdFromHash = (): string => {
  const parts = window.location.hash.slice(1).split('/')
  return parts[0] === 'invitation-lists-manager' && parts[1] ? parts[1] : ''
}

const handleSelectList = async (listId: string) => {
  if (!listId) return
  selectedListId.value = listId
  updateHash(listId)
  loading.value = true
  try {
    const list = await fetchFullList(listId)
    selectedList.value = list
    myInvitedIds.value = new Set(list.entries.filter(e => e.invited).map(e => e.person_id))
    takeSnapshot()
  } catch (e) {
    console.warn('Failed to fetch list:', e)
  } finally {
    loading.value = false
  }
}

const toggleInvitation = (personId: string) => {
  const newSet = new Set(myInvitedIds.value)
  if (newSet.has(personId)) {
    newSet.delete(personId)
  } else {
    newSet.add(personId)
  }
  myInvitedIds.value = newSet
}

const handleRevert = () => {
  myInvitedIds.value = new Set(savedSnapshot.value ? savedSnapshot.value.split(',') : [])
}

const handleSave = async () => {
  if (!selectedListId.value || !selectedList.value) return
  saving.value = true
  try {
    const entries = [...myInvitedIds.value].map(id => ({ person_id: id, invited: true }))
    const res = await authFetch(`/invitation-lists/set/${selectedListId.value}`, {
      method: 'POST',
      body: JSON.stringify({ list_name: selectedList.value.metadata.name, entries })
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.detail || `HTTP ${res.status}`)
    }
    takeSnapshot()
  } catch (e) {
    alert('Failed to save: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await initInvitationLists()
  const hashListId = getListIdFromHash()
  const listToSelect =
    hashListId && allLists.value.some(l => l.id === hashListId)
      ? hashListId
      : usersLists.value.length > 0
        ? usersLists.value[0].id
        : ''
  if (listToSelect) {
    await handleSelectList(listToSelect)
  }
})
</script>

<template>
  <div class="it">
    <div class="it__controls">
      <div class="it__select-group">
        <label class="it__label">Invitation List</label>
        <select
          class="it__select"
          :value="selectedListId"
          @change="handleSelectList(($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>Select an invitation list...</option>
          <option v-for="list in allLists" :key="list.id" :value="list.id">
            {{ list.name }} ({{ list.owner_name }})
          </option>
        </select>
      </div>

      <div v-if="isOwner" class="it__btn-group">
        <button
          class="it__save-btn"
          :class="{ 'it__save-btn--disabled': !dirty || saving }"
          :disabled="!dirty || saving"
          @click="handleSave"
        >
          {{ saving ? 'Saving...' : `Save Changes to ${selectedList?.metadata.name ?? 'List'}` }}
        </button>
        <button
          class="it__revert-btn"
          :class="{ 'it__revert-btn--disabled': !dirty }"
          :disabled="!dirty"
          @click="handleRevert"
        >
          Revert Changes
        </button>
      </div>
    </div>

    <div v-if="loading" class="it__loading">Loading...</div>

    <div v-if="!selectedListId && !loading" class="it__empty-state">
      Select an invitation list to view.
    </div>

    <div v-if="selectedList && !loading" class="it__section">
      <h3 class="it__section-title">
        {{ selectedList.metadata.name }}
        ({{ myInvitedIds.size }} invited)
      </h3>
      <div v-if="sortedInvitedIds.length === 0" class="it__empty">No one invited yet.</div>
      <div v-for="id in sortedInvitedIds" :key="id" class="it__entry">
        <PersonInfoDisplay :person-id="id" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.it {
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

.it__controls {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
  background: white;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.it__select-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 180px;
}

.it__label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.it__select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #1f2937;
  cursor: pointer;
}

.it__select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.it__save-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: white;
  background: #3b82f6;
  transition:
    background 0.15s,
    opacity 0.15s;
  white-space: nowrap;
}

.it__save-btn:hover:not(:disabled) {
  background: #2563eb;
}

.it__save-btn--disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.it__btn-group {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.it__revert-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: #374151;
  background: #e5e7eb;
  transition: background 0.15s;
  white-space: nowrap;
}

.it__revert-btn:hover:not(:disabled) {
  background: #d1d5db;
}

.it__revert-btn--disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.it__loading {
  text-align: center;
  color: #6b7280;
  padding: 24px;
  font-size: 14px;
}

.it__empty-state {
  text-align: center;
  color: #9ca3af;
  padding: 48px 24px;
  font-size: 15px;
}

.it__section {
  background: white;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  flex-shrink: 0;
}

.it__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  border-bottom: 1px solid #f3f4f6;
}

.it__empty {
  padding: 16px;
  color: #9ca3af;
  font-size: 13px;
  font-style: italic;
}

.it__entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

.it__entry:hover {
  background: #f9fafb;
}

.it__entry + .it__entry {
  border-top: 1px solid #f3f4f6;
}

.it__checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #3b82f6;
  flex-shrink: 0;
}

.it__invited-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.it__invited-dot--yes {
  background: #10b981;
}

.it__invited-dot--no {
  background: #e5e7eb;
}

@media (max-width: 768px) {
  .it {
    padding: 12px;
  }

  .it__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .it__select-group {
    min-width: 0;
  }

  .it__btn-group {
    flex-direction: column;
  }

  .it__save-btn,
  .it__revert-btn {
    white-space: normal;
  }
}
</style>
