<script setup>
import { ref, computed } from 'vue'
import NodeBase from './NodeBase.vue'
import { useInvitationLists } from '../../composables/useInvitationLists.ts'
import { useGenealogyData } from '../../composables/useGenealogyData.ts'

const props = defineProps({
  id: String,
  data: Object
})

const { activeInvitationList } = useInvitationLists()
const { nodes } = useGenealogyData()

// Modal state
const showModal = ref(false)
const modalForm = ref({ groupName: '', people: [] })
const newPersonName = ref('')

// Create a local data object with overridden onEdit handler
const localData = computed(() => ({
  ...props.data,
  onEdit: () => openModal()
}))

const openModal = () => {
  const node = nodes.value.find(n => n.id === props.id)
  if (node && node.type === 'multi-person') {
    modalForm.value.groupName = node.data.name
    modalForm.value.people = [...node.data.people]
    showModal.value = true
  }
}

const closeModal = () => {
  showModal.value = false
  modalForm.value = { groupName: '', people: [] }
  newPersonName.value = ''
}

const handleAddPerson = () => {
  if (newPersonName.value.trim()) {
    modalForm.value.people.push({
      id: `temp-${Date.now()}`,
      name: newPersonName.value.trim()
    })
    newPersonName.value = ''
  }
}

const handleRemovePerson = personId => {
  modalForm.value.people = modalForm.value.people.filter(p => p.id !== personId)
}

const handleEditPerson = personId => {
  const person = modalForm.value.people.find(p => p.id === personId)
  if (person) {
    const newName = prompt('Edit person name:', person.name)
    if (newName && newName.trim()) {
      person.name = newName.trim()
    }
  }
}

const saveModal = () => {
  if (modalForm.value.groupName.trim()) {
    const node = nodes.value.find(n => n.id === props.id)
    if (node && node.type === 'multi-person') {
      // Update group name
      node.data.name = modalForm.value.groupName.trim()

      // Update people, preserving invited status where possible
      const updatedPeople = modalForm.value.people.map((formPerson, index) => {
        const existingPerson = node.data.people.find(p => p.name === formPerson.name)
        return {
          id: existingPerson?.id || `${node.id}-${Date.now()}-${index}`,
          name: formPerson.name,
          invited: existingPerson?.invited || {}
        }
      })
      node.data.people = updatedPeople
    }
    closeModal()
  }
}
</script>

<template>
  <div>
    <NodeBase :id="id" :data="localData">
      <div class="person-node__header">
        <div class="person-node__name">{{ localData.name }}</div>
        <div class="person-node__role">Multi-person ({{ localData.people.length }})</div>
      </div>

      <!-- Checkboxes below role -->
      <div v-if="localData.people.length > 0" class="person-node__checkboxes">
        <label class="person-node__checkbox-row" @click.stop>
          <input
            type="checkbox"
            :checked="localData.allInvited"
            :indeterminate.prop="localData.someInvited"
            class="person-node__checkbox-master"
            @change="localData.onToggleAllInvited?.(id)"
          />
          <span class="person-node__checkbox-label">Invite all?</span>
        </label>

        <button
          v-if="localData.hasChildren"
          class="person-node__subtree-btn"
          @click.stop="localData.onToggleSubtreeInvited?.(id)"
        >
          Invite the whole subtree
        </button>
      </div>

      <!-- Individual People List -->
      <div v-if="localData.people.length > 0" class="person-node__people-list">
        <div
          v-for="person in localData.people"
          :key="person.id"
          class="person-node__person-item"
          @click.stop
        >
          <span class="person-node__person-name">{{ person.name }}</span>
          <input
            type="checkbox"
            :checked="person.invited[activeInvitationList]"
            class="person-node__checkbox-small"
            @change="localData.onTogglePersonInvited?.(id, person.id)"
          />
        </div>
      </div>
      <div v-else class="person-node__empty-hint">Click to add people</div>
    </NodeBase>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal modal-wide">
          <h3>Edit Multi-Person Node</h3>

          <div class="form-group">
            <label for="group-name">Group Name:</label>
            <input
              id="group-name"
              v-model="modalForm.groupName"
              type="text"
              placeholder="e.g., 'Frederik and Veronika' or 'John's kids'"
              required
            />
          </div>

          <div class="form-group">
            <label>People in this group:</label>
          </div>

          <div class="multi-person-list">
            <div v-for="person in modalForm.people" :key="person.id" class="multi-person-item">
              <span>{{ person.name }}</span>
              <div class="person-actions">
                <button
                  type="button"
                  class="btn btn-edit-small"
                  @click="handleEditPerson(person.id)"
                  title="Edit name"
                >
                  ✎
                </button>
                <button
                  type="button"
                  class="btn btn-remove-small"
                  @click="handleRemovePerson(person.id)"
                  :disabled="modalForm.people.length <= 1"
                  title="Remove person"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div class="add-person-section">
            <input
              v-model="newPersonName"
              type="text"
              placeholder="Enter name (or '+1', 'Guest of John', etc.)"
              @keyup.enter="handleAddPerson"
            />
            <button type="button" class="btn btn-secondary" @click="handleAddPerson">
              + Add Person
            </button>
          </div>

          <div class="form-actions">
            <button
              type="button"
              class="btn btn-primary"
              @click="saveModal"
              :disabled="!modalForm.groupName.trim()"
            >
              Save
            </button>
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.person-node__header {
  margin-bottom: 8px;
}

.person-node__name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: #1f2937;
}

.person-node__role {
  font-size: 12px;
  color: #6b7280;
  text-transform: capitalize;
  margin-bottom: 8px;
}

.person-node__checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.person-node__checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.person-node__checkbox-row:hover {
  background: rgba(0, 0, 0, 0.03);
}

.person-node__checkbox-label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  user-select: none;
}

.person-node__checkbox-master {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--node-color, #3b82f6);
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

.person-node__people-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.person-node__person-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

.person-node__person-name {
  font-size: 12px;
  color: #374151;
  flex: 1;
}

.person-node__checkbox-small {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--node-color, #3b82f6);
}

.person-node__empty-hint {
  font-size: 11px;
  color: #9ca3af;
  font-style: italic;
  text-align: center;
  padding: 8px;
  margin-bottom: 8px;
}

/* Modal styles */
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
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-wide {
  min-width: 500px;
}

.modal h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #1f2937;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
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

.person-actions {
  display: flex;
  gap: 6px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-edit-small {
  padding: 4px 8px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.btn-edit-small:hover {
  background: #2563eb;
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
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
