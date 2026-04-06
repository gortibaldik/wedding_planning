<script lang="ts" setup>
import { ref } from 'vue'
import { useSeatingData } from '@/composables/useSeatingData'
import { useInvitationLists } from '@/composables/useInvitationLists'
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
  seatingUnsync,
  initSeatingData
} = useSeatingData()

const { allLists, selectedListId, fetchList, initInvitationLists } = useInvitationLists()

await initInvitationLists()
await initSeatingData()

const onListChange = async (event: Event): Promise<void> => {
  const listId = (event.target as HTMLSelectElement).value
  if (listId) {
    selectedListId.value = listId
    await fetchList(listId)
  }
}

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
      <div class="toolbar-left">
        <label class="list-selector">
          <span class="list-selector__label">Invitation List:</span>
          <select class="list-selector__select" :value="selectedListId" @change="onListChange">
            <option v-for="list in allLists" :key="list.id" :value="list.id">
              {{ list.name }} ({{ list.owner_name }})
            </option>
          </select>
        </label>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" @click="handleOpenAddModal">+ Add Table</button>
        <button
          class="btn"
          :class="seatingUnsync ? 'btn-save--unsync' : 'btn-save'"
          @click="saveSeatingToBackend"
        >
          Save
        </button>
      </div>
    </div>
    <div class="seating-arrangement__body">
      <SeatingCanvas
        :tables="tables"
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.toolbar-left {
  display: flex;
  align-items: center;
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
}

.list-selector__select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
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

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-save {
  background: #e5e7eb;
  color: #374151;
}

.btn-save:hover {
  background: #d1d5db;
}

.btn-save--unsync {
  background: #f59e0b;
  color: white;
}

.btn-save--unsync:hover {
  background: #d97706;
}
</style>
