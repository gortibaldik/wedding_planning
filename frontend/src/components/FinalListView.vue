<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  useInvitationLists,
  FinalEntry,
  FinalInvitationListData
} from '@/composables/useInvitationLists'
import { RootData } from '@/composables/useStoredData'
import { useAuth } from '@/composables/useAuth'
import { useBaseGraph } from '@/composables/useBaseGraph'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'

const { initInvitationLists, getPersonName, getMultiPersonNodeName, getPersonNodeId } =
  useInvitationLists()
const { authFetch, storedUserInfo } = useAuth()
const { findRootNode } = useBaseGraph()

const finalList = ref<FinalInvitationListData | null>(null)
const loading = ref(false)
const saving = ref(false)
const notFound = ref(false)

const finalEntries = ref<Record<string, FinalEntry>>({})
const savedSnapshot = ref<string>('')

const isUniversalSetter = computed(() => {
  return storedUserInfo.value?.roles?.includes('universal-invitation-list-setter') ?? false
})

const invitedIds = computed<string[]>(() => {
  if (!finalList.value) return []
  return finalList.value.entries.filter(e => e.invited).map(e => e.person_id)
})

const makeDefault = (personId: string): FinalEntry => ({
  person_id: personId,
  invitation_given: false,
  rsvpd: 'NOT_ANSWERED',
  notes: ''
})

const buildFinalEntries = (): Record<string, FinalEntry> => {
  const existing: Record<string, FinalEntry> = {}
  if (finalList.value?.final_entries) {
    for (const entry of finalList.value.final_entries) {
      existing[entry.person_id] = entry
    }
  }
  const map: Record<string, FinalEntry> = {}
  for (const id of invitedIds.value) {
    map[id] = { ...makeDefault(id), ...(existing[id] ?? {}) }
  }
  return map
}

const serializeEntries = (entries: Record<string, FinalEntry>): string => {
  const keys = Object.keys(entries).sort()
  return JSON.stringify(keys.map(k => entries[k]))
}

const takeSnapshot = () => {
  savedSnapshot.value = serializeEntries(finalEntries.value)
}

const dirty = computed(() => serializeEntries(finalEntries.value) !== savedSnapshot.value)

interface RootInfo {
  name: string
  color: string
}

const getRootInfo = (personId: string): RootInfo => {
  const nodeId = getPersonNodeId(personId)
  if (!nodeId) return { name: '', color: '#9ca3af' }
  const root = findRootNode(nodeId)
  if (!root || !(root.data instanceof RootData)) return { name: '', color: '#9ca3af' }
  return { name: root.data.name, color: root.data.color }
}

interface RootGroup {
  name: string
  color: string
  ids: string[]
}

const buildRootGroups = (ids: Iterable<string>): RootGroup[] => {
  const groups = new Map<string, RootGroup>()
  for (const id of ids) {
    const { name, color } = getRootInfo(id)
    const key = name || '__unknown__'
    if (!groups.has(key)) {
      groups.set(key, { name: name || 'Unknown', color, ids: [] })
    }
    groups.get(key)!.ids.push(id)
  }
  for (const group of groups.values()) {
    group.ids.sort((a, b) => {
      const nodeCmp = (getMultiPersonNodeName(a) ?? '').localeCompare(
        getMultiPersonNodeName(b) ?? ''
      )
      if (nodeCmp !== 0) return nodeCmp
      return getPersonName(a).localeCompare(getPersonName(b))
    })
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const groupedByRoot = computed<RootGroup[]>(() => buildRootGroups(invitedIds.value))

const fetchFinalList = async () => {
  loading.value = true
  try {
    const res = await authFetch('/invitation-lists/get-final')
    if (res.ok) {
      finalList.value = await res.json()
      notFound.value = false
      finalEntries.value = buildFinalEntries()
      takeSnapshot()
    } else if (res.status === 404) {
      finalList.value = null
      notFound.value = true
    }
  } catch (e) {
    console.warn('Failed to fetch final list:', e)
  } finally {
    loading.value = false
  }
}

const handleRevert = () => {
  finalEntries.value = buildFinalEntries()
}

const handleSave = async () => {
  saving.value = true
  try {
    const res = await authFetch('/invitation-lists/set-final-entries', {
      method: 'POST',
      body: JSON.stringify({ final_entries: Object.values(finalEntries.value) })
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
  await fetchFinalList()
})
</script>

<template>
  <div class="it">
    <div v-if="loading" class="it__loading">Loading...</div>

    <div v-if="notFound && !loading" class="it__empty-state">No final list has been set.</div>

    <template v-if="finalList && !loading">
      <div v-if="isUniversalSetter" class="it__controls">
        <button
          class="it__save-btn"
          :class="{ 'it__save-btn--disabled': !dirty || saving }"
          :disabled="!dirty || saving"
          @click="handleSave"
        >
          {{ saving ? 'Saving...' : 'Save Changes' }}
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

      <div class="it__section">
        <h3 class="it__section-title">
          {{ finalList.metadata.name }}
          <span class="it__owner-name">({{ finalList.metadata.owner_name }})</span>
          <span class="it__final-badge">FINAL</span>
          - {{ invitedIds.length }} invited
        </h3>
      </div>
      <div v-if="groupedByRoot.length === 0" class="it__empty">No one invited yet.</div>
      <div v-for="group in groupedByRoot" :key="group.name" class="it__section">
        <h4 class="it__root-title" :style="{ borderLeftColor: group.color }">
          {{ group.name }} ({{ group.ids.length }})
        </h4>
        <div class="it__entry it__entry--header">
          <div class="it__col-person">Guest</div>
          <div class="it__col-center">Invitation sent</div>
          <div class="it__col-center">RSVP</div>
          <div class="it__col-notes">Notes</div>
        </div>
        <div v-for="id in group.ids" :key="id" class="it__entry">
          <div class="it__col-person" data-label="Guest">
            <PersonInfoDisplay :person-id="id" :display-root-name="false" />
          </div>
          <div class="it__col-center" data-label="Invitation sent">
            <input
              v-if="finalEntries[id]"
              v-model="finalEntries[id].invitation_given"
              type="checkbox"
              class="it__checkbox"
              :disabled="!isUniversalSetter"
            />
          </div>
          <div class="it__col-center" data-label="RSVP">
            <select
              v-if="finalEntries[id]"
              v-model="finalEntries[id].rsvpd"
              class="it__rsvp-select"
              :class="`it__rsvp-select--${finalEntries[id].rsvpd.toLowerCase()}`"
              :disabled="!isUniversalSetter"
            >
              <option value="NOT_ANSWERED">—</option>
              <option value="WILL_COME">Coming</option>
              <option value="WONT_COME">Not coming</option>
            </select>
          </div>
          <div class="it__col-notes" data-label="Notes">
            <input
              v-if="finalEntries[id]"
              v-model="finalEntries[id].notes"
              type="text"
              class="it__notes-input"
              :disabled="!isUniversalSetter"
              placeholder="Notes..."
            />
          </div>
        </div>
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

.it__controls {
  display: flex;
  gap: 8px;
  background: white;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
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
  transition: background 0.15s;
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

.it__owner-name {
  color: #9ca3af;
  font-weight: 400;
}

.it__final-badge {
  background: #8b5cf6;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.it__root-title {
  margin: 0;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  background: #f9fafb;
  border-left: 4px solid;
  border-bottom: 1px solid #e5e7eb;
}

.it__empty {
  padding: 16px;
  color: #9ca3af;
  font-size: 13px;
  font-style: italic;
}

.it__entry {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 130px 150px minmax(0, 2fr);
  align-items: center;
  gap: 12px;
  padding: 4px 12px;
  user-select: none;
}

.it__entry + .it__entry {
  border-top: 1px solid #f3f4f6;
}

.it__entry--header {
  background: #f9fafb;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #e5e7eb;
  padding-top: 8px;
  padding-bottom: 8px;
}

.it__col-person {
  min-width: 0;
}

.it__col-center {
  display: flex;
  justify-content: center;
}

.it__col-notes {
  min-width: 0;
}

.it__checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #3b82f6;
  flex-shrink: 0;
}

.it__checkbox:disabled {
  cursor: default;
}

.it__rsvp-select {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  color: #1f2937;
  cursor: pointer;
}

.it__rsvp-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.it__rsvp-select:disabled {
  background: #f3f4f6;
  cursor: default;
}

.it__rsvp-select--will_come {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #047857;
}

.it__rsvp-select--wont_come {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.it__notes-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  color: #1f2937;
}

.it__notes-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.it__notes-input:disabled {
  background: #f3f4f6;
  cursor: default;
}

.it__entry :deep(.person__item) {
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

@media (max-width: 768px) {
  .it {
    padding: 12px;
  }

  .it__entry {
    grid-template-columns: 1fr;
    gap: 0;
    padding: 10px 12px;
  }

  .it__entry--header {
    display: none;
  }

  .it__col-person {
    padding-bottom: 8px;
    margin-bottom: 6px;
    border-bottom: 1px solid #f3f4f6;
  }

  .it__col-center,
  .it__col-notes {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 5px 0;
    border-bottom: 1px solid #f9fafb;
  }

  .it__col-center[data-label]::before,
  .it__col-notes[data-label]::before {
    content: attr(data-label);
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    flex-shrink: 0;
    margin-right: 12px;
  }

  .it__notes-input {
    text-align: right;
  }

  .it__entry:not(.it__entry--header):nth-child(odd) {
    background: #ffffff;
  }

  .it__entry:not(.it__entry--header):nth-child(even) {
    background: #f0fbff;
  }
}
</style>
