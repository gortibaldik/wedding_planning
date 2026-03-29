<script setup lang="ts">
import { computed, ref, nextTick, inject, type Ref } from 'vue'
import { PersonData, useStoredData } from '@/composables/useStoredData'
import { useInvitationLists } from '@/composables/useInvitationLists'
import NodeBase from './NodeBase.vue'
import { useAuth } from '@/composables/useAuth'

const props = defineProps({
  id: String,
  data: Object
})

const readOnly = inject<Ref<boolean>>('readOnly', ref(false))
const { nodes } = useStoredData()
const { togglePersonInvite, isPersonInvited } = useInvitationLists()
const { getUserInfo } = useAuth()
const userInfo = getUserInfo()

const isInvited = computed(() => {
  return isPersonInvited(props.id)
})

const node = computed(() => {
  const found = nodes.value.find(n => n.id == props.id)
  if (!found) {
    throw new TypeError('Should never happen - not found')
  }
  if (!(found.data instanceof PersonData)) {
    console.warn(found.data)
    throw new TypeError(`Should never happen - invalid type: ${typeof found.data}`)
  }
  return found as { id: string; type: string; position: { x: number; y: number }; data: PersonData }
})

const onToggleInvited = () => {
  togglePersonInvite(node.value.id)
}

const showEditModal = ref(false)
const editNameInput = ref(null)
const editNameValue = ref('')

const handleEdit = () => {
  if (readOnly.value) return
  showEditModal.value = true
  editNameValue.value = node.value.data.name
  nextTick(() => {
    editNameInput.value?.focus()
  })
}

const closeEditModal = () => {
  showEditModal.value = false
  editNameValue.value = node.value.data.name
}

const saveEdit = () => {
  console.info(`node: ${node.value}`)
  node.value.data.name = editNameValue.value
  closeEditModal()
}
</script>

<template>
  <NodeBase :id="id" :data="data" @click="handleEdit">
    <div class="person-node__header">
      <div class="person-node__name">{{ node.data.name }}</div>
      <div class="person-node__role">{{ node.type }}</div>
    </div>

    <!-- Checkboxes below role -->
    <div class="person-node__checkboxes">
      <label class="person-node__checkbox-row" @click.stop>
        <input
          type="checkbox"
          :checked="isInvited"
          class="person-node__checkbox"
          @change="onToggleInvited"
        />
        <span class="person-node__checkbox-label">Invited?</span>
      </label>
    </div>

    <Teleport to="body">
      <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
        <div class="modal" @click.stop>
          <h3>Edit Person</h3>
          <form @submit.prevent="saveEdit">
            <div class="form-group">
              <label>Name:</label>
              <input
                ref="editNameInput"
                v-model="editNameValue"
                type="text"
                :placeholder="editNameValue"
                required
              />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save</button>
              <button type="button" class="btn btn-secondary" @click="closeEditModal">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </NodeBase>
</template>

<style scoped>
@import '@/assets/styles/modal.css';

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

.person-node__checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--node-color, #3b82f6);
}
</style>
