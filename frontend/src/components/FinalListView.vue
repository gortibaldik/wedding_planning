<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { InvitationList, useInvitationLists } from '@/composables/useInvitationLists'
import { RootData } from '@/composables/useStoredData'
import { useAuth } from '@/composables/useAuth'
import { useBaseGraph } from '@/composables/useBaseGraph'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'

const { initInvitationLists, getPersonName, getMultiPersonNodeName, getPersonNodeId } =
  useInvitationLists()
const { authFetch } = useAuth()
const { findRootNode } = useBaseGraph()

const finalList = ref<InvitationList | null>(null)
const loading = ref(false)
const notFound = ref(false)

const invitedIds = computed<string[]>(() => {
  if (!finalList.value) return []
  return finalList.value.entries.filter(e => e.invited).map(e => e.person_id)
})

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
        <div v-for="id in group.ids" :key="id" class="it__entry">
          <PersonInfoDisplay :person-id="id" :display-root-name="false" />
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
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}

.it__entry + .it__entry {
  border-top: 1px solid #f3f4f6;
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
}
</style>
