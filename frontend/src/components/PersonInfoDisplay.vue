<script lang="ts" setup>
import { useBaseGraph } from '@/composables/useBaseGraph'
import { useInvitationLists } from '@/composables/useInvitationLists'
import { ChartNode, RootData } from '@/composables/useStoredData'
import { computed } from 'vue'

const props = defineProps({
  personId: { type: String, required: true }
})

const { getPersonName, getMultiPersonNodeName, getPersonNodeId } = useInvitationLists()
const { findRootNode } = useBaseGraph()
const personName = computed(() => getPersonName(props.personId))
const multiPersonName = computed(() => getMultiPersonNodeName(props.personId))
const rootNode = computed<ChartNode<RootData> | null>(() => {
  const nodeId = getPersonNodeId(props.personId)
  if (!nodeId) {
    return null
  }
  const node = findRootNode(nodeId)
  if (!node || !(node.data instanceof RootData)) {
    return null
  }
  return node as ChartNode<RootData>
})

const personColor = computed(() => {
  if (!rootNode.value) {
    return '#3b82f6'
  }
  return rootNode.value.data.color
})
const personRootName = computed(() => {
  if (!rootNode.value) {
    return ''
  }
  return rootNode.value.data.name
})
</script>
<template>
  <div class="person__item" :style="{ borderLeft: `4px solid ${personColor}` }">
    <span class="it__person-name">{{ personName }}</span>
    <span v-if="multiPersonName" class="it__person-group">({{ multiPersonName }})</span>
    <span v-if="personRootName" class="guest-sidebar__item-group">{{ personRootName }}</span>
  </div>
</template>
<style scoped>
.it__person-name {
  font-size: 14px;
  color: #374151;
}

.it__person-group {
  font-size: 12px;
  color: #9ca3af;
  margin-left: 4px;
}

.person__item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-left: 4px solid;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.person__item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateX(-4px);
}

.person__item-name {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.guest-sidebar__item-group {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 400;
  margin-left: 4px;
}
</style>
