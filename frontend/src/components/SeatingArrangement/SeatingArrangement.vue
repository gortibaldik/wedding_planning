<script lang="ts" setup>
import { ref } from 'vue'
import { useSeatingData } from '@/composables/useSeatingData'
import { useInvitationLists } from '@/composables/useInvitationLists'
import { useTouchDragDrop } from '@/composables/useTouchDragDrop'
import type { AddTablePayload } from './AddTableModal.vue'
import SeatingCanvas from './SeatingCanvas.vue'
import SeatingArrangementSidebar from './SeatingArrangementSidebar.vue'
import AddTableModal from './AddTableModal.vue'

const {
  tables,
  addTable,
  removeTable,
  assignGuest,
  unassignGuest,
  updateTablePosition,
  saveSeatingToBackend,
  isSeatingOwner,
  seatingUnsync,
  seatingsForList,
  selectedSeatingId,
  currentMetadata,
  fetchSeatingsForList,
  loadSeating,
  createNewSeating,
  initSeatingData
} = useSeatingData()

const { allLists, selectedListId, fetchList, initInvitationLists } = useInvitationLists()

const { registerCallbacks } = useTouchDragDrop()
registerCallbacks(
  (guestId, tableId, seatIndex) => assignGuest(guestId, tableId, seatIndex),
  guestId => unassignGuest(guestId)
)

await initInvitationLists()
await initSeatingData()

// Load seatings for the initially selected invitation list
if (selectedListId.value) {
  await fetchSeatingsForList(selectedListId.value)
  if (seatingsForList.value.length > 0) {
    await loadSeating(seatingsForList.value[0].id)
  }
}

const onListChange = async (event: Event): Promise<void> => {
  const listId = (event.target as HTMLSelectElement).value
  if (listId) {
    selectedListId.value = listId
    await fetchList(listId)
    await fetchSeatingsForList(listId)
    if (seatingsForList.value.length > 0) {
      await loadSeating(seatingsForList.value[0].id)
    } else {
      selectedSeatingId.value = null
      currentMetadata.value = null
      tables.value = []
    }
  }
}

const onSeatingChange = async (event: Event): Promise<void> => {
  const seatingId = (event.target as HTMLSelectElement).value
  if (seatingId === '__new__') {
    handleNewSeating()
  } else if (seatingId) {
    await loadSeating(seatingId)
  }
}

const newSeatingName = ref('')
const showNewSeatingInput = ref(false)

const handleNewSeating = (): void => {
  showNewSeatingInput.value = true
  newSeatingName.value = ''
}

const confirmNewSeating = (): void => {
  if (!newSeatingName.value.trim() || !selectedListId.value) return
  createNewSeating(selectedListId.value, newSeatingName.value.trim())
  showNewSeatingInput.value = false
  newSeatingName.value = ''
}

const cancelNewSeating = (): void => {
  showNewSeatingInput.value = false
  // Restore previous selection
  if (seatingsForList.value.length > 0 && selectedSeatingId.value) {
    // already selected, no action needed
  } else {
    selectedSeatingId.value = null
  }
}

const toolbarCollapsed = ref(false)
const showAddModal = ref(false)
const addModalRef = ref<InstanceType<typeof AddTableModal> | null>(null)

const handleOpenAddModal = (): void => {
  showAddModal.value = true
  addModalRef.value?.focusInput()
}

const handleAddTable = (payload: AddTablePayload): void => {
  addTable(payload.name, payload.shape, payload.seats)
}

const handleAssignGuest = (event: {
  guestId: string
  tableId: string
  seatIndex: number
}): void => {
  assignGuest(event.guestId, event.tableId, event.seatIndex)
}

const handleUpdateTablePosition = (event: {
  tableId: string
  position: { x: number; y: number }
}): void => {
  updateTablePosition(event.tableId, event.position)
}
</script>

<template>
  <div class="seating-arrangement">
    <div class="seating-arrangement__toolbar">
      <div class="toolbar-toggle-row">
        <button class="toolbar-toggle" @click="toolbarCollapsed = !toolbarCollapsed">
          {{ toolbarCollapsed ? '&#9660;' : '&#9650;' }} Controls
        </button>
        <div v-if="toolbarCollapsed" class="toolbar-summary">
          {{ currentMetadata?.name || 'No seating selected' }}
          <button
            v-if="isSeatingOwner && currentMetadata"
            class="btn btn-small"
            :class="seatingUnsync ? 'btn-save--unsync' : 'btn-save'"
            @click="saveSeatingToBackend"
          >
            Save
          </button>
        </div>
      </div>
      <template v-if="!toolbarCollapsed">
        <div class="toolbar-content">
          <div class="toolbar-left">
            <label class="list-selector">
              <span class="list-selector__label">Invitation List:</span>
              <select class="list-selector__select" :value="selectedListId" @change="onListChange">
                <option v-for="list in allLists" :key="list.id" :value="list.id">
                  {{ list.name }} ({{ list.owner_name }})
                </option>
              </select>
            </label>
            <label class="list-selector seating-selector">
              <span class="list-selector__label">Seating:</span>
              <template v-if="showNewSeatingInput">
                <input
                  v-model="newSeatingName"
                  class="list-selector__select"
                  type="text"
                  placeholder="Seating name..."
                  @keyup.enter="confirmNewSeating"
                  @keyup.escape="cancelNewSeating"
                />
                <button class="btn btn-small btn-primary" @click="confirmNewSeating">Create</button>
                <button class="btn btn-small btn-cancel" @click="cancelNewSeating">Cancel</button>
              </template>
              <select
                v-else
                class="list-selector__select"
                :value="selectedSeatingId"
                @change="onSeatingChange"
              >
                <option v-if="!selectedSeatingId" value="" disabled>Select a seating...</option>
                <option v-for="s in seatingsForList" :key="s.id" :value="s.id">
                  {{ s.name }} ({{ s.owner_name }})
                </option>
                <option value="__new__">+ New seating arrangement</option>
              </select>
            </label>
          </div>
          <div class="toolbar-right">
            <button
              class="btn btn-primary"
              :disabled="!currentMetadata || !isSeatingOwner"
              @click="handleOpenAddModal"
            >
              + Add Table
            </button>
            <button
              class="btn"
              :class="seatingUnsync ? 'btn-save--unsync' : 'btn-save'"
              :disabled="!currentMetadata || !isSeatingOwner"
              @click="saveSeatingToBackend"
            >
              Save
            </button>
          </div>
        </div>
      </template>
    </div>
    <div class="seating-arrangement__body">
      <SeatingCanvas
        :tables="tables"
        :editable="isSeatingOwner"
        @assign-guest="handleAssignGuest"
        @unassign-guest="unassignGuest"
        @remove-table="removeTable"
        @update-table-position="handleUpdateTablePosition"
      />
      <SeatingArrangementSidebar />
    </div>
    <AddTableModal
      ref="addModalRef"
      :show="showAddModal"
      @close="showAddModal = false"
      @add="handleAddTable"
    />
  </div>
</template>

<style scoped>
.seating-arrangement {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.seating-arrangement__toolbar {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 8px 16px;
}

.toolbar-toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  padding: 4px 0;
  white-space: nowrap;
}

.toolbar-toggle:hover {
  color: #374151;
}

.toolbar-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.toolbar-content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
}

.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.list-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-selector__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.list-selector__select {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  color: #374151;
  background: white;
  cursor: pointer;
  min-width: 0;
}

.list-selector__select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.seating-selector {
  border-left: 1px solid #e5e7eb;
  padding-left: 16px;
}

@media (max-width: 600px) {
  .seating-arrangement__toolbar {
    padding: 8px 12px;
  }

  .list-selector {
    flex: 1 1 100%;
  }

  .list-selector__select {
    flex: 1;
    max-width: 100%;
  }

  .seating-selector {
    border-left: none;
    padding-left: 0;
  }

  .toolbar-right {
    flex: 1 1 100%;
  }

  .toolbar-right .btn {
    flex: 1;
  }
}

.seating-arrangement__body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-small {
  padding: 4px 10px;
  font-size: 13px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-cancel {
  background: #e5e7eb;
  color: #374151;
}

.btn-cancel:hover {
  background: #d1d5db;
}

.btn-save {
  background: #e5e7eb;
  color: #374151;
}

.btn-save:hover:not(:disabled) {
  background: #d1d5db;
}

.btn-save--unsync {
  background: #f59e0b;
  color: white;
}

.btn-save--unsync:hover:not(:disabled) {
  background: #d97706;
}
</style>
