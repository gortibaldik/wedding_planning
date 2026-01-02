<script setup>
import { ref, computed, markRaw, onMounted, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/core/dist/style.css'

import PersonNode from './PersonNode.vue'
import { useGenealogyData } from '../composables/useGenealogyData'
import { useSidebarState } from '../composables/useSidebarState'
import { useBaseGraph } from '../composables/useBaseGraph.ts'

const nodeTypes = {
  person: markRaw(PersonNode)
}

const genealogyData = useGenealogyData()
const {
  nodes: rawNodes,
  edges,
  toggleInvited,
  togglePersonInvited,
  toggleAllInvited,
  toggleSubtreeInvited,
  addPersonToNode,
  removePersonFromNode,
  addChildNode,
  addRootNode,
  removePersonNode,
  updatePersonNode,
  clearAll
} = genealogyData

const { fitView, updateNode } = useVueFlow()

onMounted(() => {
  setTimeout(() => {
    fitView({ padding: 0.2, duration: 200 })
  }, 100)
})

const showEditModal = ref(false)
const editingNodeId = ref(null)
const editForm = ref({ name: '' })
const editNameInput = ref(null)

const showAddModal = ref(false)
const addModalType = ref('')
const addModalTargetId = ref(null)
const addForm = ref({ name: '', nodeType: 'person', nodeTypeOptions: [] })
const addNameInput = ref(null)

const addModalTitle = ref('')

// Multi-person modal state
const showMultiPersonModal = ref(false)
const editingMultiPersonNodeId = ref(null)
const multiPersonForm = ref({ groupName: '', people: [] })
const newPersonName = ref('')

const handleEdit = nodeId => {
  const node = rawNodes.value.find(n => n.id === nodeId)
  if (node) {
    if (node.data.role === 'multi-person') {
      handleEditMultiPerson(nodeId)
    } else {
      editingNodeId.value = nodeId
      editForm.value = {
        name: node.data.name
      }
      showEditModal.value = true
      nextTick(() => {
        editNameInput.value?.focus()
      })
    }
  }
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
        onRemove: handleRemove,
        onEdit: handleEdit,
        onToggleInvited: toggleInvited,
        onTogglePersonInvited: togglePersonInvited,
        onToggleAllInvited: toggleAllInvited,
        onToggleSubtreeInvited: toggleSubtreeInvited,
        hasChildren
      }
    }
  })
})

const { sidebarCollapsed } = useSidebarState()

const saveEdit = () => {
  if (editingNodeId.value) {
    updatePersonNode(editingNodeId.value, editForm.value)
    closeEditModal()
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  editingNodeId.value = null
  editForm.value = { name: '' }
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

const saveAdd = () => {
  if (addModalType.value === 'child') {
    if (addForm.value.nodeType === 'multi-person') {
      // For multi-person, create with primary name and prompt to add more
      const nodeId = addChildNode(addModalTargetId.value, addForm.value.name, 'multi-person')
      closeAddModal()

      // Immediately open edit modal to add more people
      nextTick(() => {
        if (nodeId) {
          handleEditMultiPerson(nodeId)
        }
      })
    } else {
      addChildNode(addModalTargetId.value, addForm.value.name, addForm.value.nodeType)
      closeAddModal()
    }
  } else if (addModalType.value === 'root') {
    addRootNode(addForm.value.name)
    closeAddModal()
  }
}

const closeAddModal = () => {
  showAddModal.value = false
  addModalType.value = ''
  addModalTargetId.value = null
  addForm.value = { name: '', nodeType: 'person', nodeTypeOptions: [] }
}

const handleRemove = nodeId => {
  const node = rawNodes.value.find(n => n.id === nodeId)
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

  const descendantCount = findDescendantCount(nodeId)
  const itemType = node.data.role === 'Group' ? 'group' : 'person'

  let confirmMessage = `Are you sure you want to remove this ${itemType}?`
  if (descendantCount > 0) {
    confirmMessage += ` This will also remove ${descendantCount} descendant${descendantCount > 1 ? 's' : ''}.`
  }

  if (confirm(confirmMessage)) {
    removePersonNode(nodeId)
  }
}

const handleClearAll = () => {
  if (
    confirm('Are you sure you want to clear all nodes from the tree? This action cannot be undone.')
  ) {
    clearAll()
  }
}

// Multi-person modal handlers
const handleEditMultiPerson = nodeId => {
  const node = rawNodes.value.find(n => n.id === nodeId)
  if (node && node.data.role === 'multi-person') {
    editingMultiPersonNodeId.value = nodeId
    multiPersonForm.value.groupName = node.data.name
    multiPersonForm.value.people = [...node.data.people]
    showMultiPersonModal.value = true
  }
}

const handleAddPersonToForm = () => {
  if (newPersonName.value.trim()) {
    multiPersonForm.value.people.push({
      id: `temp-${Date.now()}`,
      name: newPersonName.value.trim()
    })
    newPersonName.value = ''
  }
}

const handleRemovePersonFromForm = personId => {
  multiPersonForm.value.people = multiPersonForm.value.people.filter(p => p.id !== personId)
}

const saveMultiPersonEdit = () => {
  if (editingMultiPersonNodeId.value && multiPersonForm.value.groupName.trim()) {
    const node = rawNodes.value.find(n => n.id === editingMultiPersonNodeId.value)
    if (node && node.data.role === 'multi-person') {
      // Update group name
      node.data.name = multiPersonForm.value.groupName.trim()

      // Update people, preserving invited status where possible
      const updatedPeople = multiPersonForm.value.people.map((formPerson, index) => {
        const existingPerson = node.data.people.find(p => p.name === formPerson.name)
        return {
          id: existingPerson?.id || `${node.id}-${Date.now()}-${index}`,
          name: formPerson.name,
          invited: existingPerson?.invited || false
        }
      })
      node.data.people = updatedPeople
    }
    closeMultiPersonModal()
  }
}

const closeMultiPersonModal = () => {
  showMultiPersonModal.value = false
  editingMultiPersonNodeId.value = null
  multiPersonForm.value.groupName = ''
  multiPersonForm.value.people = []
  newPersonName.value = ''
}

// Track drag state
const dragState = ref({
  nodeId: null,
  startPosition: null,
  descendantStartPositions: new Map()
})

// Find all descendants of a node
const findDescendants = nodeId => {
  const descendants = new Set()
  const toVisit = [nodeId]

  while (toVisit.length > 0) {
    const currentId = toVisit.pop()
    const childEdges = edges.value.filter(e => e.source === currentId)

    childEdges.forEach(edge => {
      if (!descendants.has(edge.target)) {
        descendants.add(edge.target)
        toVisit.push(edge.target)
      }
    })
  }

  return Array.from(descendants)
}

// Handle drag start
const onNodeDragStart = ({ node }) => {
  const descendants = findDescendants(node.id)
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
      :nodes-draggable="true"
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

    <button
      class="add-root-btn"
      :style="{ right: sidebarCollapsed ? '24px' : '324px' }"
      title="Add New Root"
      @click="handleAddRoot"
    >
      + Add Root
    </button>

    <button
      class="clear-btn"
      :style="{ right: sidebarCollapsed ? '24px' : '324px' }"
      title="Clear All Nodes"
      @click="handleClearAll"
    >
      Clear
    </button>

    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal" @click.stop>
        <h3>Edit Person</h3>
        <form @submit.prevent="saveEdit">
          <div class="form-group">
            <label>Name:</label>
            <input ref="editNameInput" v-model="editForm.name" type="text" required />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save</button>
            <button type="button" class="btn btn-secondary" @click="closeEditModal">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click="closeAddModal">
      <div class="modal" @click.stop>
        <h3>{{ addModalTitle }}</h3>
        <form @submit.prevent="saveAdd">
          <div class="form-group">
            <label>Name:</label>
            <input
              ref="addNameInput"
              v-model="addForm.name"
              type="text"
              :placeholder="
                addForm.nodeType === 'multi-person'
                  ? 'Group name (e.g., Frederik and Veronika)'
                  : 'Enter name'
              "
              required
            />
          </div>
          <div v-if="addForm.nodeTypeOptions.length > 1" class="form-group">
            <label>Node Type:</label>
            <select v-model="addForm.nodeType" required>
              <option v-for="option in addForm.nodeTypeOptions" :key="option" :value="option">
                {{ option.charAt(0).toUpperCase() + option.slice(1) }}
              </option>
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Add</button>
            <button type="button" class="btn btn-secondary" @click="closeAddModal">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Multi-Person Edit Modal -->
    <div v-if="showMultiPersonModal" class="modal-overlay" @click="closeMultiPersonModal">
      <div class="modal modal-wide" @click.stop>
        <h3>Edit Multi-Person Node</h3>

        <div class="form-group">
          <label>Group Name:</label>
          <input
            v-model="multiPersonForm.groupName"
            type="text"
            placeholder="e.g., 'Frederik and Veronika' or 'John's kids'"
            required
          />
        </div>

        <div class="form-group">
          <label>People in this group:</label>
        </div>

        <div class="multi-person-list">
          <div v-for="person in multiPersonForm.people" :key="person.id" class="multi-person-item">
            <span>{{ person.name }}</span>
            <button
              type="button"
              class="btn btn-remove-small"
              @click="handleRemovePersonFromForm(person.id)"
              :disabled="multiPersonForm.people.length <= 1"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="add-person-section">
          <input
            v-model="newPersonName"
            type="text"
            placeholder="Enter name (or '+1', 'Guest of John', etc.)"
            @keyup.enter="handleAddPersonToForm"
          />
          <button type="button" class="btn btn-secondary" @click="handleAddPersonToForm">
            + Add Person
          </button>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="btn btn-primary"
            @click="saveMultiPersonEdit"
            :disabled="!multiPersonForm.groupName.trim()"
          >
            Save
          </button>
          <button type="button" class="btn btn-secondary" @click="closeMultiPersonModal">
            Cancel
          </button>
        </div>
      </div>
    </div>
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

.add-root-btn {
  position: fixed;
  bottom: 24px;
  right: 324px;
  padding: 12px 24px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  transition: right 0.3s ease;
  z-index: 100;
}

.add-root-btn:hover {
  background: #059669;
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
  transform: translateY(-2px);
}

.add-root-btn:active {
  transform: translateY(0);
}

.clear-btn {
  position: fixed;
  bottom: 72px;
  right: 324px;
  padding: 12px 24px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  transition: right 0.3s ease;
  z-index: 100;
}

.clear-btn:hover {
  background: #dc2626;
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.5);
  transform: translateY(-2px);
}

.clear-btn:active {
  transform: translateY(0);
}

/* Multi-person modal styles */
.modal-wide {
  min-width: 500px;
}

.multi-person-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 8px;
}

.multi-person-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 4px;
  margin-bottom: 4px;
}

.multi-person-item:last-child {
  margin-bottom: 0;
}

.btn-remove-small {
  padding: 4px 8px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-remove-small:hover {
  background: #dc2626;
}

.btn-remove-small:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.add-person-section {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.add-person-section input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
}

.add-person-section input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style>
