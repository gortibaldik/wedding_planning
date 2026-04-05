<script setup lang="ts">
import { useGenealogyData } from '@/composables/useGenealogyData'
import { inject, ref, computed } from 'vue'
import { useStoredData } from '@/composables/useStoredData'
import { useBaseGraph } from '@/composables/useBaseGraph'
import { Handle, Position } from '@vue-flow/core'
import { useInvitationLists } from '@/composables/useInvitationLists'

const readOnly = inject('readOnly', ref(false))

const props = defineProps({
  id: String,
  data: Object
})

const { nodes, edges } = useStoredData()
const { canUserInvite } = useInvitationLists()
const { hasChildren } = useBaseGraph()
const { removeNodeAndPeople, inviteSubTree } = useGenealogyData()
const showInviteSubtreeButton = computed(() => canUserInvite())

const handleRemove = () => {
  const node = nodes.value.find(n => n.id === props.id)
  if (!node) return

  // Count descendants
  const findDescendantCount = id => {
    const childEdges = edges.value.filter(e => e.source === id)
    let count = childEdges.length

    childEdges.forEach(edge => {
      count += findDescendantCount(edge.target)
    })

    return count
  }

  const descendantCount = findDescendantCount(props.id)

  let confirmMessage = `Are you sure you want to remove this ${node.type}?`
  if (descendantCount > 0) {
    confirmMessage += ` This will also remove ${descendantCount} descendant${descendantCount > 1 ? 's' : ''}.`
  }

  if (confirm(confirmMessage)) {
    removeNodeAndPeople(node)
  }
}
</script>

<template>
  <div class="person-node" :style="{ '--node-color': data.color || '#3b82f6' }">
    <Handle type="target" :position="Position.Top" />

    <div class="person-node__content">
      <slot />
    </div>

    <button
      v-if="showInviteSubtreeButton && hasChildren(props.id)"
      class="person-node__subtree-btn"
      @click.stop="inviteSubTree(props.id)"
    >
      Invite the whole subtree
    </button>

    <div v-if="!readOnly" class="person-node__actions">
      <button
        class="action-btn action-btn--child"
        title="Add child node"
        @click.stop="data.onAddChild?.(id)"
      >
        ↓
      </button>
      <button class="action-btn action-btn--remove" title="Remove node" @click.stop="handleRemove">
        ✕
      </button>
    </div>

    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.person-node {
  padding: 16px;
  border-radius: 8px;
  border: 2px solid var(--node-color, #3b82f6);
  background: white;
  min-width: 150px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
}

.person-node::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--node-color, #3b82f6);
  opacity: 0.08;
  border-radius: 6px;
  pointer-events: none;
}

.person-node:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.person-node:hover::before {
  opacity: 0.12;
}

.person-node__content {
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}

.person-node__actions {
  display: flex;
  gap: 4px;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.action-btn {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

.action-btn--parent:hover {
  background: #dbeafe;
  border-color: #3b82f6;
}

.action-btn--child:hover {
  background: #d1fae5;
  border-color: #10b981;
}

.action-btn--remove:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.person-node__subtree-btn {
  width: 100%;
  padding: 6px 12px;
  background: #6898e4;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5em;
}

.person-node__subtree-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.person-node__subtree-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
