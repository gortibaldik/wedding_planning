<script setup>
import { ref } from 'vue'
import { useGenealogyData } from '../composables/useGenealogyData'
import { useTableSeating } from '../composables/useTableSeating'

const props = defineProps({
  draggedGuestFromSidebar: {
    type: Object,
    default: null
  }
})

const { nodes, edges } = useGenealogyData()
const {
  tables,
  addTable,
  removeTable,
  updateTableName,
  updateTableCapacity,
  assignGuestToTable,
  removeGuestFromTable
} = useTableSeating()

// Helper function to find the group (root) name for a guest
const getGroupName = (guestId) => {
  const visited = new Set()
  let currentId = guestId

  // Traverse up to find the root
  while (!visited.has(currentId)) {
    visited.add(currentId)
    const parentEdge = edges.value.find(e => e.target === currentId)
    if (!parentEdge) {
      // Found the root
      const rootNode = nodes.value.find(n => n.id === currentId)
      return rootNode ? rootNode.data.name : 'Unknown'
    }
    currentId = parentEdge.source
  }

  return 'Unknown'
}

const draggedGuest = ref(null)
const draggedFromTable = ref(null)

const handleDragStart = (guest, fromTableId = null) => {
  draggedGuest.value = guest
  draggedFromTable.value = fromTableId
}

const handleDragOver = (event) => {
  event.preventDefault()
}

const handleDropOnTable = (tableId) => {
  // Check if dragging from sidebar or from another table
  const guestToDrop = props.draggedGuestFromSidebar || draggedGuest.value

  if (!guestToDrop) return

  assignGuestToTable(guestToDrop.id, tableId)
  draggedGuest.value = null
  draggedFromTable.value = null
}

const handleRemoveFromTable = (guestId, tableId) => {
  removeGuestFromTable(guestId, tableId)
}

const getGuestsByTableId = (tableId) => {
  const table = tables.value.find(t => t.id === tableId)
  if (!table) return []

  return table.guestIds
    .map(id => nodes.value.find(n => n.id === id))
    .filter(Boolean)
}

const editingTableId = ref(null)
const editingTableName = ref('')

const startEditingTableName = (table) => {
  editingTableId.value = table.id
  editingTableName.value = table.name
}

const finishEditingTableName = (tableId) => {
  if (editingTableName.value.trim()) {
    updateTableName(tableId, editingTableName.value.trim())
  }
  editingTableId.value = null
  editingTableName.value = ''
}
</script>

<template>
  <div class="table-seating">
    <div class="tables-main">
      <div class="tables-header">
        <h2>Tables</h2>
        <button class="add-table-btn" @click="addTable">+ Add Table</button>
      </div>

      <div class="tables-grid">
        <div
          v-for="table in tables"
          :key="table.id"
          class="table-card"
          @dragover="handleDragOver"
          @drop="handleDropOnTable(table.id)"
        >
          <div class="table-header">
            <div class="table-title-section">
              <input
                v-if="editingTableId === table.id"
                v-model="editingTableName"
                @blur="finishEditingTableName(table.id)"
                @keyup.enter="finishEditingTableName(table.id)"
                class="table-name-input"
                autofocus
              />
              <h3
                v-else
                class="table-name"
                @dblclick="startEditingTableName(table)"
              >
                {{ table.name }}
              </h3>
              <div class="table-capacity">
                <input
                  type="number"
                  :value="table.capacity"
                  @change="updateTableCapacity(table.id, $event.target.value)"
                  class="capacity-input"
                  min="1"
                  max="20"
                />
                <span class="capacity-label">seats</span>
              </div>
            </div>
            <button
              class="remove-table-btn"
              @click="removeTable(table.id)"
              title="Remove table"
            >
              ✕
            </button>
          </div>

          <div class="table-guests">
            <div
              v-for="guest in getGuestsByTableId(table.id)"
              :key="guest.id"
              class="guest-item"
              :style="{ borderLeftColor: guest.data.color }"
              draggable="true"
              @dragstart="handleDragStart(guest, table.id)"
            >
              <div class="guest-info">
                <div class="guest-name">{{ guest.data.name }}</div>
                <div class="guest-group">{{ getGroupName(guest.id) }}</div>
              </div>
              <button
                class="remove-guest-btn"
                @click="handleRemoveFromTable(guest.id, table.id)"
                title="Remove from table"
              >
                ✕
              </button>
            </div>
            <div
              v-if="getGuestsByTableId(table.id).length === 0"
              class="empty-table"
            >
              Drop guests here
            </div>
          </div>

          <div class="table-footer">
            <span class="seats-info">
              {{ getGuestsByTableId(table.id).length }} / {{ table.capacity }} seats
            </span>
            <span
              v-if="getGuestsByTableId(table.id).length > table.capacity"
              class="over-capacity"
            >
              Over capacity!
            </span>
          </div>
        </div>
      </div>

      <div v-if="tables.length === 0" class="no-tables">
        <p>No tables yet. Click "Add Table" to get started.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-seating {
  display: flex;
  width: 100%;
  height: calc(100vh - 100px);
  background: #f9fafb;
}

.tables-main {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.tables-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.tables-header h2 {
  font-size: 24px;
  color: #1f2937;
  margin: 0;
}

.add-table-btn {
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.add-table-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.table-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.table-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #3b82f6;
}

.table-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f3f4f6;
}

.table-title-section {
  flex: 1;
}

.table-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
  cursor: pointer;
}

.table-name:hover {
  color: #3b82f6;
}

.table-name-input {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  padding: 4px 8px;
  margin-bottom: 8px;
  width: 100%;
}

.table-capacity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.capacity-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 14px;
}

.capacity-label {
  font-size: 12px;
  color: #6b7280;
}

.remove-table-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-table-btn:hover {
  background: #dc2626;
}

.table-guests {
  flex: 1;
  margin-bottom: 12px;
  min-height: 80px;
}

.guest-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-left: 4px solid;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  cursor: grab;
  transition: all 0.2s;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.guest-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.guest-item:active {
  cursor: grabbing;
}

.guest-info {
  flex: 1;
  min-width: 0;
}

.guest-name {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
  margin-bottom: 2px;
}

.guest-group {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 400;
}

.remove-guest-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  width: 20px;
  height: 20px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0;
  flex-shrink: 0;
  margin-top: 2px;
}

.guest-item:hover .remove-guest-btn {
  opacity: 1;
}

.remove-guest-btn:hover {
  background: #dc2626;
}

.empty-table {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  padding: 40px 20px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

.seats-info {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.over-capacity {
  color: #ef4444;
  font-size: 12px;
  font-weight: 600;
}

.no-tables {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
  font-size: 16px;
}
</style>
