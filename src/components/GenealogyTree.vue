<template>
  <div class="genealogy-tree">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :nodes-connectable="false"
      fit-view-on-init
      :default-zoom="0.8"
    >
      <Background />
      <Controls />
    </VueFlow>

    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal" @click.stop>
        <h3>Edit Person</h3>
        <form @submit.prevent="saveEdit">
          <div class="form-group">
            <label>Name:</label>
            <input v-model="editForm.name" type="text" required />
          </div>
          <div class="form-group">
            <label>Role:</label>
            <input v-model="editForm.role" type="text" placeholder="e.g., parent, sibling, friend" />
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
            <input v-model="addForm.name" type="text" required />
          </div>
          <div class="form-group">
            <label>Role:</label>
            <input v-model="addForm.role" type="text" placeholder="e.g., parent, sibling, friend" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Add</button>
            <button type="button" class="btn btn-secondary" @click="closeAddModal">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, markRaw } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/core/dist/style.css'

import PersonNode from './PersonNode.vue'
import { useGenealogyData } from '../composables/useGenealogyData'

const nodeTypes = {
  person: markRaw(PersonNode)
}

const genealogyData = useGenealogyData()
const { nodes: rawNodes, edges, addChild, addParent, removePerson, updatePerson } = genealogyData

const showEditModal = ref(false)
const editingNodeId = ref(null)
const editForm = ref({ name: '', role: '' })

const showAddModal = ref(false)
const addModalType = ref('')
const addModalTargetId = ref(null)
const addForm = ref({ name: '', role: '' })

const addModalTitle = ref('')


const handleEdit = (nodeId) => {
  const node = rawNodes.value.find(n => n.id === nodeId)
  if (node) {
    editingNodeId.value = nodeId
    editForm.value = {
      name: node.data.name,
      role: node.data.role
    }
    showEditModal.value = true
  }
}

const nodes = computed(() => {
  return rawNodes.value.map(node => ({
    ...node,
    data: {
      ...node.data,
      onAddChild: handleAddChild,
      onAddParent: handleAddParent,
      onRemove: handleRemove,
      onEdit: handleEdit
    }
  }))
})

const saveEdit = () => {
  if (editingNodeId.value) {
    updatePerson(editingNodeId.value, editForm.value)
    closeEditModal()
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  editingNodeId.value = null
  editForm.value = { name: '', role: '' }
}

const handleAddChild = (parentId) => {
  addModalType.value = 'child'
  addModalTargetId.value = parentId
  addModalTitle.value = 'Add Child'
  addForm.value = { name: '', role: 'guest' }
  showAddModal.value = true
}

const handleAddParent = (childId) => {
  addModalType.value = 'parent'
  addModalTargetId.value = childId
  addModalTitle.value = 'Add Parent'
  addForm.value = { name: '', role: 'parent' }
  showAddModal.value = true
}

const saveAdd = () => {
  if (addModalType.value === 'child') {
    addChild(addModalTargetId.value, addForm.value)
  } else if (addModalType.value === 'parent') {
    addParent(addModalTargetId.value, addForm.value)
  }
  closeAddModal()
}

const closeAddModal = () => {
  showAddModal.value = false
  addModalType.value = ''
  addModalTargetId.value = null
  addForm.value = { name: '', role: '' }
}

const handleRemove = (nodeId) => {
  if (confirm('Are you sure you want to remove this person?')) {
    removePerson(nodeId)
  }
}
</script>

<style scoped>
.genealogy-tree {
  width: 100%;
  height: 100vh;
  position: relative;
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

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus {
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
