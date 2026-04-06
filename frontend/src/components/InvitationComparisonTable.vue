<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { InvitationList, useInvitationLists } from '@/composables/useInvitationLists'
import { useStoredData } from '@/composables/useStoredData'
import { useAuth } from '@/composables/useAuth'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'

const { allLists, usersLists, initInvitationLists, getPersonName } = useInvitationLists()
const { people } = useStoredData()
const { authFetch, storedUserInfo } = useAuth()

const mainListId = ref<string>('')
const compareListId = ref<string>('')
const mainList = ref<InvitationList | null>(null)
const compareList = ref<InvitationList | null>(null)
const myInvitedIds = ref<Set<string>>(new Set())
const savedSnapshot = ref<string>('')
const loading = ref(false)
const saving = ref(false)

const comparableLists = computed(() => allLists.value.filter(l => l.id !== mainListId.value))

const dirty = computed(() => {
  return [...myInvitedIds.value].sort().join(',') !== savedSnapshot.value
})

const fetchFullList = async (listId: string): Promise<InvitationList> => {
  const res = await authFetch(`/invitation-lists/get/${listId}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

const isMainListOwner = computed(() => {
  if (!mainList.value) return false
  return mainList.value.metadata.owner_sub === storedUserInfo.value?.sub
})

/**
 * Take a snapshot of all the ids that are invited in the main invitation list.
 */
const takeMainListSnapshot = () => {
  savedSnapshot.value = [...myInvitedIds.value].sort().join(',')
}

const handleSelectMainList = async (listId: string) => {
  if (!listId) return
  mainListId.value = listId
  loading.value = true
  try {
    const list = await fetchFullList(listId)
    mainList.value = list
    myInvitedIds.value = new Set(list.entries.filter(e => e.invited).map(e => e.person_id))
    takeMainListSnapshot()
  } catch (e) {
    console.warn('Failed to fetch list:', e)
  } finally {
    loading.value = false
  }
}

const handleSelectCompareList = async (listId: string) => {
  // do not allow selecting the same list for compare
  if (!listId || listId === mainListId.value) return
  compareListId.value = listId
  loading.value = true
  try {
    compareList.value = await fetchFullList(listId)
  } catch (e) {
    console.warn('Failed to fetch list:', e)
  } finally {
    loading.value = false
  }
}

/**
 * Ids of all the invited people from the compare list.
 */
const compareInvitedIds = computed<Set<string>>(() => {
  if (!compareList.value) return new Set()
  return new Set(compareList.value.entries.filter(e => e.invited).map(e => e.person_id))
})

const onlyMainListInvitedIds = computed(() => {
  if (!compareList.value) return []
  return [...myInvitedIds.value]
    .filter(id => !compareInvitedIds.value.has(id))
    .sort((personId1, personId2) =>
      getPersonName(personId1).localeCompare(getPersonName(personId2))
    )
})

const onlyCompareListInvitedIds = computed(() => {
  if (!mainList.value) return []
  return [...compareInvitedIds.value]
    .filter(id => !myInvitedIds.value.has(id))
    .sort((personId1, personId2) =>
      getPersonName(personId1).localeCompare(getPersonName(personId2))
    )
})

const commonIds = computed(() => {
  if (!compareList.value) return []
  return [...myInvitedIds.value]
    .filter(personId => compareInvitedIds.value.has(personId))
    .sort((personId1, personId2) =>
      getPersonName(personId1).localeCompare(getPersonName(personId2))
    )
})

const notInvitedByAnybody = computed(() => {
  if (!mainList.value || !compareList.value) return []
  const allPeopleIds = Object.keys(people.value)
  return allPeopleIds
    .filter(id => !myInvitedIds.value.has(id) && !compareInvitedIds.value.has(id))
    .sort((personId1, personId2) =>
      getPersonName(personId1).localeCompare(getPersonName(personId2))
    )
})

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
  if (!mainListId.value || !mainList.value) return
  saving.value = true
  try {
    const entries = [...myInvitedIds.value].map(id => ({ person_id: id, invited: true }))
    const res = await authFetch(`/invitation-lists/set/${mainListId.value}`, {
      method: 'POST',
      body: JSON.stringify({ list_name: mainList.value.metadata.name, entries })
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.detail || `HTTP ${res.status}`)
    }
    takeMainListSnapshot()
  } catch (e) {
    alert('Failed to save: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await initInvitationLists()
  if (usersLists.value.length > 0) {
    await handleSelectMainList(usersLists.value[0].id)
  }
})
</script>

<template>
  <div class="it">
    <div class="it__controls">
      <div class="it__select-group">
        <label class="it__label">Main List</label>
        <select
          class="it__select"
          :value="mainListId"
          @change="handleSelectMainList(($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>Select main list for comparison...</option>
          <option v-for="list in allLists" :key="list.id" :value="list.id">
            {{ list.name }} ({{ list.owner_name }})
          </option>
        </select>
      </div>

      <div class="it__select-group">
        <label class="it__label">Compare with</label>
        <select
          class="it__select"
          :value="compareListId"
          @change="handleSelectCompareList(($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>Select list to compare...</option>
          <option v-for="list in comparableLists" :key="list.id" :value="list.id">
            {{ list.name }} ({{ list.owner_name }})
          </option>
        </select>
      </div>

      <div v-if="isMainListOwner" class="it__btn-group">
        <button
          class="it__save-btn"
          :class="{ 'it__save-btn--disabled': !dirty || saving }"
          :disabled="!dirty || saving"
          @click="handleSave"
        >
          {{ saving ? 'Saving...' : `Save Changes to ${mainList?.metadata.name ?? 'List'}` }}
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

    <div v-if="mainList && !compareListId && !loading" class="it__empty-state">
      Select a list to compare with.
    </div>

    <template v-if="mainList && compareList && !loading">
      <div class="it__section it__section--mine">
        <h3 class="it__section-title">
          <span class="it__section-dot it__section-dot--mine"></span>
          Only in {{ mainList.metadata.name }} ({{ onlyMainListInvitedIds.length }})
        </h3>
        <div v-if="onlyMainListInvitedIds.length === 0" class="it__empty">No unique entries</div>
        <label v-for="id in onlyMainListInvitedIds" :key="id" class="it__entry">
          <input
            v-if="isMainListOwner"
            type="checkbox"
            class="it__checkbox"
            :checked="myInvitedIds.has(id)"
            @change="toggleInvitation(id)"
          />
          <PersonInfoDisplay :person-id="id" />
        </label>
      </div>

      <div class="it__section it__section--theirs">
        <h3 class="it__section-title">
          <span class="it__section-dot it__section-dot--theirs"></span>
          Only in {{ compareList.metadata.name }} ({{ onlyCompareListInvitedIds.length }})
        </h3>
        <div v-if="onlyCompareListInvitedIds.length === 0" class="it__empty">No unique entries</div>
        <label v-for="id in onlyCompareListInvitedIds" :key="id" class="it__entry">
          <input
            v-if="isMainListOwner"
            type="checkbox"
            class="it__checkbox"
            :checked="myInvitedIds.has(id)"
            @change="toggleInvitation(id)"
          />
          <PersonInfoDisplay :person-id="id" />
        </label>
      </div>

      <div class="it__section it__section--common">
        <h3 class="it__section-title">
          <span class="it__section-dot it__section-dot--common"></span>
          Common ({{ commonIds.length }})
        </h3>
        <div v-if="commonIds.length === 0" class="it__empty">No common entries</div>
        <label v-for="id in commonIds" :key="id" class="it__entry">
          <input
            v-if="isMainListOwner"
            type="checkbox"
            class="it__checkbox"
            :checked="myInvitedIds.has(id)"
            @change="toggleInvitation(id)"
          />
          <PersonInfoDisplay :person-id="id" />
        </label>
      </div>

      <div class="it__section it__section--nobody">
        <h3 class="it__section-title">
          <span class="it__section-dot it__section-dot--nobody"></span>
          Not invited by anybody ({{ notInvitedByAnybody.length }})
        </h3>
        <div v-if="notInvitedByAnybody.length === 0" class="it__empty">
          Everyone is invited by at least one list
        </div>
        <label v-for="id in notInvitedByAnybody" :key="id" class="it__entry">
          <input
            v-if="isMainListOwner"
            type="checkbox"
            class="it__checkbox"
            :checked="myInvitedIds.has(id)"
            @change="toggleInvitation(id)"
          />
          <PersonInfoDisplay :person-id="id" />
        </label>
      </div>
    </template>
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

.it__section-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.it__section-dot--mine {
  background: #10b981;
}

.it__section-dot--theirs {
  background: #f59e0b;
}

.it__section-dot--common {
  background: #3b82f6;
}

.it__section-dot--nobody {
  background: #ef4444;
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
