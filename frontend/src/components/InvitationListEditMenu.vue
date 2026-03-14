<script setup>
import { ref, computed, onMounted } from 'vue'
import { useInvitationLists } from '@/composables/useInvitationLists'
import { useAuth } from '@/composables/useAuth'

const { getUserInfo } = useAuth()
const {
  allLists,
  selectedListId,
  selectedList,
  loading,
  fetchList,
  saveList,
  initInvitationLists,
  invitationsDirty
} = useInvitationLists()

const userInfo = getUserInfo()
const saving = ref(false)
const newListName = ref('')
const showNewListInput = ref(false)
const editingName = ref(false)
const editedName = ref('')

const nameChanged = computed(() => {
  if (!editingName.value || !selectedList.value) return false
  return editedName.value.trim() !== selectedList.value.metadata.name
})

const hasChanges = computed(() => {
  return invitationsDirty.value || nameChanged.value
})

const isOwner = () => {
  if (!selectedList.value) return false
  return selectedList.value.metadata.owner_sub === userInfo.sub
}

const ownerName = () => {
  if (!selectedList.value) return ''
  return selectedList.value.metadata.owner_name
}

const handleSelectList = async listId => {
  selectedListId.value = listId
  await fetchList(listId)
}

const startEditingName = () => {
  if (!selectedList.value) return
  editedName.value = selectedList.value.metadata.name
  editingName.value = true
}

const cancelEditingName = () => {
  editingName.value = false
  editedName.value = ''
}

const handleSaveInvitations = async () => {
  if (!selectedListId.value || !selectedList.value) return
  const name =
    editingName.value && editedName.value.trim()
      ? editedName.value.trim()
      : selectedList.value.metadata.name
  saving.value = true
  try {
    await saveList(selectedListId.value, name)
    editingName.value = false
    editedName.value = ''
  } catch (e) {
    alert('Failed to save: ' + e.message)
  } finally {
    saving.value = false
  }
}

const handleCreateNewList = async () => {
  if (!newListName.value.trim()) return
  const listId = crypto.randomUUID()
  saving.value = true
  try {
    await saveList(listId, newListName.value.trim())
    selectedListId.value = listId
    await fetchList(listId)
    newListName.value = ''
    showNewListInput.value = false
  } catch (e) {
    alert('Failed to create list: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  initInvitationLists()
})
</script>

<template>
  <div class="il-section">
    <div class="il-section__title">Invitation Lists</div>

    <div v-if="allLists.length > 0" class="il-section__select-group">
      <select
        class="il-section__select"
        :value="selectedListId"
        @change="handleSelectList($event.target.value)"
      >
        <option v-for="list in allLists" :key="list.id" :value="list.id">
          {{ list.name }} ({{ list.owner_name }})
        </option>
      </select>
    </div>
    <div v-else class="il-section__empty">No invitation lists yet</div>

    <div v-if="loading" class="il-section__loading">Loading...</div>

    <div v-if="selectedList && !isOwner()" class="il-section__owner-badge">
      Seeing invitations by {{ ownerName() }}
    </div>

    <template v-if="selectedList && isOwner()">
      <div v-if="!editingName" class="il-section__name-row">
        <span class="il-section__name-text">{{ selectedList.metadata.name }}</span>
        <button class="il-section__name-edit" title="Rename" @click="startEditingName">
          &#9998;
        </button>
      </div>
      <input
        v-else
        v-model="editedName"
        class="il-section__input"
        placeholder="List name"
        @keyup.enter="handleSaveInvitations"
        @keyup.escape="cancelEditingName"
      />

      <button
        class="il-section__btn il-section__btn--save"
        :class="{ 'il-section__btn--disabled': saving || !hasChanges }"
        :disabled="saving || !hasChanges"
        @click="handleSaveInvitations"
      >
        {{ saving ? 'Saving...' : 'Save Invitations' }}
      </button>
    </template>

    <div v-if="!showNewListInput">
      <button class="il-section__btn il-section__btn--add" @click="showNewListInput = true">
        + New List
      </button>
    </div>
    <div v-else class="il-section__new-list">
      <input
        v-model="newListName"
        class="il-section__input"
        placeholder="List name"
        @keyup.enter="handleCreateNewList"
      />
      <div class="il-section__new-list-actions">
        <button
          class="il-section__btn il-section__btn--save"
          :disabled="!newListName.trim() || saving"
          @click="handleCreateNewList"
        >
          Create
        </button>
        <button
          class="il-section__btn il-section__btn--secondary"
          @click="
            () => {
              showNewListInput = false
              newListName = ''
            }
          "
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.il-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid #e5e7eb;
  padding-top: 10px;
}

.il-section__title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  padding: 0 4px;
}

.il-section__select-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.il-section__select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  color: #1f2937;
  cursor: pointer;
}

.il-section__select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.il-section__btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s,
    opacity 0.15s;
  color: #1f2937;
  background: #f3f4f6;
}

.il-section__btn:hover {
  background: #e5e7eb;
}

.il-section__btn--save {
  color: white;
  background: #3b82f6;
}

.il-section__btn--save:hover:not(:disabled) {
  background: #2563eb;
}

.il-section__btn--add {
  color: white;
  background: #10b981;
}

.il-section__btn--add:hover {
  background: #059669;
}

.il-section__btn--secondary {
  background: #e5e7eb;
  color: #374151;
}

.il-section__btn--secondary:hover {
  background: #d1d5db;
}

.il-section__btn--disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.il-section__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
}

.il-section__name-text {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.il-section__name-edit {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #6b7280;
  padding: 2px 4px;
  border-radius: 4px;
  flex-shrink: 0;
}

.il-section__name-edit:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.il-section__owner-badge {
  padding: 8px 12px;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #92400e;
}

.il-section__empty {
  font-size: 13px;
  color: #9ca3af;
  padding: 8px 4px;
}

.il-section__loading {
  font-size: 12px;
  color: #6b7280;
  padding: 4px;
}

.il-section__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

.il-section__input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.il-section__new-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.il-section__new-list-actions {
  display: flex;
  gap: 6px;
}
</style>
