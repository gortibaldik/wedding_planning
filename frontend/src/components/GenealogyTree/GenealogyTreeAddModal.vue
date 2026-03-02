<script setup>
import { useGenealogyData } from '@/composables/useGenealogyData'

const { addChildNode, addRootNode } = useGenealogyData()

const showAddModal = defineModel('showAddModal', { type: Boolean, default: false })
const addModalTitle = defineModel('addModalTitle', { type: String, default: '' })
const addModalType = defineModel('addModalType', { type: String, default: '' })
const addModalTargetId = defineModel('addModalTargetId', { type: String, default: null })
const addNameInput = defineModel('addNameInput', { type: null, default: null })
const addForm = defineModel('addForm', {
  type: { name: String, nodeType: String, nodeTypeOptions: [String] },
  default: () => ({ name: '', nodeType: 'person', nodeTypeOptions: [''] })
})

const closeAddModal = () => {
  showAddModal.value = false
  addModalType.value = ''
  addModalTargetId.value = null
  addForm.value = { name: '', nodeType: 'person', nodeTypeOptions: [] }
}

const addAction = () => {
  console.info(`add modal type: ${addModalType.value}`)
  if (addModalType.value === 'child') {
    console.info('addChildNode')
    addChildNode(addModalTargetId.value, addForm.value.name, addForm.value.nodeType)
    closeAddModal()
  } else if (addModalType.value === 'root') {
    addRootNode(addForm.value.name)
    closeAddModal()
  }
}
</script>

<template>
  <div v-if="showAddModal" class="modal-overlay" @click="closeAddModal">
    <div class="modal" @click.stop>
      <h3>{{ addModalTitle }}</h3>
      <form @submit.prevent="addAction">
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
</template>

<style scoped>
@import '@/assets/styles/modal.css';
</style>
