<script setup>
import { ref, computed, markRaw, onMounted, nextTick, provide, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/core/dist/style.css'

import PersonNode from '@/components/nodes/PersonNode.vue'
import MultiPersonNode from '@/components/nodes/MultiPersonNode.vue'
import GroupNode from '@/components/nodes/GroupNode.vue'
import { useBaseGraph } from '@/composables/useBaseGraph'
import { MultiPersonData, PersonData, useStoredData } from '@/composables/useStoredData'
import { useBackendStorage } from '@/composables/useBackendStorage'
import { useAuth } from '@/composables/useAuth'
import GenealogyTreeAddModal from './GenealogyTreeAddModal.vue'
import GenealogyTreeEditMenu from './GenealogyTreeEditMenu.vue'

const nodeTypes = {
  person: markRaw(PersonNode),
  'multi-person': markRaw(MultiPersonNode),
  group: markRaw(GroupNode)
}

const {
  nodes: rawNodes,
  edges,
  people,
  clearAll,
  familyStructureUnsync,
  saveFamilyStructureToBackend,
  importGenealogyTree,
  exportGenealogyTree
} = useStoredData()
const { findAllDescendants } = useBaseGraph()

const { fetchStatus, toggleStatus } = useBackendStorage('family-structure')
const { getRoles } = useAuth()
const canChangeStatus = getRoles().includes('change-genealogy-tree-rw-status')

const status = ref('read')
fetchStatus().then(s => {
  status.value = s
})

const readOnly = ref(true)
provide('readOnly', readOnly)

watch(status, newStatus => {
  if (newStatus === 'read') {
    readOnly.value = true
  }
})

const showAddModal = ref(false)
const addModalTitle = ref('')
const addModalType = ref('')
const addModalTargetId = ref(null)
const addForm = ref({ name: '', nodeType: 'person', nodeTypeOptions: [] })
const addNameInput = ref(null)

const handleAddRoot = () => {
  addModalType.value = 'root'
  addModalTargetId.value = null
  addModalTitle.value = 'Add New Root'
  addForm.value = { name: '', nodeType: 'group', nodeTypeOptions: ['group'] }
  showAddModal.value = true
  nextTick(() => {
    addNameInput.value?.focus()
  })
}

const handleAddChild = parentId => {
  addModalType.value = 'child'
  addModalTargetId.value = parentId
  addModalTitle.value = 'Add Child'
  addForm.value = {
    name: '',
    nodeType: 'person',
    nodeTypeOptions: ['person', 'group', 'multi-person']
  }
  showAddModal.value = true
  nextTick(() => {
    addNameInput.value?.focus()
  })
}

const nodes = computed(() => {
  return rawNodes.value.map(node => {
    // Check if this node has children
    const hasChildren = edges.value.some(e => e.source === node.id)

    return {
      ...node,
      data: {
        ...node.data,
        onAddChild: handleAddChild,
        hasChildren
      }
    }
  })
})

const handleClearAll = () => {
  if (
    confirm('Are you sure you want to clear all nodes from the tree? This action cannot be undone.')
  ) {
    clearAll()
  }
}

const { fitView, updateNode } = useVueFlow()

// Track drag state
const dragState = ref({
  nodeId: null,
  startPosition: null,
  descendantStartPositions: new Map()
})

// Handle drag start
const onNodeDragStart = ({ node }) => {
  const descendants = findAllDescendants(node.id)
  const descendantPositions = new Map()

  // Store initial positions of all descendants
  descendants.forEach(descendantId => {
    const rawNode = rawNodes.value.find(n => n.id === descendantId)
    if (rawNode) {
      descendantPositions.set(descendantId, { ...rawNode.position })
    }
  })

  dragState.value = {
    nodeId: node.id,
    startPosition: { ...node.position },
    descendantStartPositions: descendantPositions
  }
}

// Handle node dragging to move children with parent
const onNodeDrag = ({ node }) => {
  if (!dragState.value.nodeId || dragState.value.nodeId !== node.id) {
    return
  }

  // Calculate the offset from the start position
  const offsetX = node.position.x - dragState.value.startPosition.x
  const offsetY = node.position.y - dragState.value.startPosition.y

  // Move all descendants by the same offset from their start positions
  dragState.value.descendantStartPositions.forEach((startPos, descendantId) => {
    updateNode(descendantId, {
      position: {
        x: startPos.x + offsetX,
        y: startPos.y + offsetY
      }
    })
  })
}

// Clean up drag state when drag stops
const onNodeDragStop = ({ node }) => {
  if (!dragState.value.nodeId) return

  // Calculate final offset
  const offsetX = node.position.x - dragState.value.startPosition.x
  const offsetY = node.position.y - dragState.value.startPosition.y

  // Update all positions in raw nodes for persistence and mark as manually positioned
  const rawNode = rawNodes.value.find(n => n.id === node.id)
  if (rawNode) {
    rawNode.position = { ...node.position }
    rawNode.data.manuallyPositioned = true
  }

  // Update descendants positions in rawNodes and mark as manually positioned
  dragState.value.descendantStartPositions.forEach((startPos, descendantId) => {
    const rawNode = rawNodes.value.find(n => n.id === descendantId)
    if (rawNode) {
      rawNode.position = {
        x: startPos.x + offsetX,
        y: startPos.y + offsetY
      }
      rawNode.data.manuallyPositioned = true
    }
  })

  // Clear drag state
  dragState.value = {
    nodeId: null,
    startPosition: null,
    descendantStartPositions: new Map()
  }
}
</script>

<template>
  <div class="genealogy-tree">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :nodes-connectable="false"
      :nodes-draggable="!readOnly"
      :selectable="true"
      :multi-selection-key-code="'Meta'"
      fit-view-on-init
      :default-zoom="0.8"
      @node-drag-start="onNodeDragStart"
      @node-drag="onNodeDrag"
      @node-drag-stop="onNodeDragStop"
    >
      <Background />
      <Controls />
    </VueFlow>

    <GenealogyTreeEditMenu
      :status="status"
      :read-only="readOnly"
      :can-change-status="canChangeStatus"
      :family-structure-unsync="familyStructureUnsync"
      @update:read-only="readOnly = $event"
      @toggle-status="
        toggleStatus().then(s => {
          status = s
        })
      "
      @add-root="handleAddRoot"
      @save="saveFamilyStructureToBackend"
      @import="importGenealogyTree"
      @export="exportGenealogyTree"
      @clear-all="handleClearAll"
    />

    <GenealogyTreeAddModal
      v-model:show-add-modal="showAddModal"
      v-model:add-modal-type="addModalType"
      v-model:add-modal-title="addModalTitle"
      v-model:add-name-input="addNameInput"
      v-model:add-form="addForm"
      v-model:add-modal-target-id="addModalTargetId"
    />
  </div>
</template>

<style scoped>
.genealogy-tree {
  width: 100%;
  height: 100vh;
  position: relative;
}

.genealogy-tree :deep(.vue-flow__node.selected .person-node) {
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.8);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 24px;
  border-radius: 8px;
  min-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal h3 {
  margin: 0 0 20px 0;
  color: #1f2937;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: #374151;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}
</style>
