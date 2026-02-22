<script setup>
import { ref, computed } from 'vue'
import { useSidebarState } from '../composables/useSidebarState'

const props = defineProps({
  guests: {
    type: Array,
    required: true
  },
  tables: {
    type: Array,
    required: true
  },
  getGroupName: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['dragStart', 'dragEnd', 'assignToTable'])

const { sidebarCollapsed, toggleSidebar } = useSidebarState()

const notFullTables = computed(() => props.tables.filter(t => t.guestIds.length < t.capacity))

// Table assignment dropdown state
const showTableDropdown = ref(null)
const dropdownPosition = ref({ top: 0, left: 0, width: 0 })

const toggleTableDropdown = (guestId, event) => {
  if (showTableDropdown.value === guestId) {
    showTableDropdown.value = null
    return
  }

  const button = event.target
  const rect = button.getBoundingClientRect()
  dropdownPosition.value = {
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width
  }

  showTableDropdown.value = guestId
}

const handleAssignToTable = (guestId, tableId) => {
  emit('assignToTable', guestId, tableId)
  showTableDropdown.value = null
}

const handleDragStart = guest => {
  emit('dragStart', guest)
}

const handleDragEnd = () => {
  emit('dragEnd')
}
</script>

<template>
  <div class="guest-sidebar" :class="{ 'guest-sidebar--collapsed': sidebarCollapsed }">
    <button
      class="guest-sidebar__toggle"
      :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggleSidebar"
    >
      {{ sidebarCollapsed ? '◀' : '▶' }}
    </button>
    <div class="guest-sidebar__content">
      <div class="guest-sidebar__header">
        <h3 class="guest-sidebar__title">Unassigned Guests</h3>
        <div class="guest-sidebar__counter">
          {{ guests.length }}
        </div>
      </div>
      <div class="guest-sidebar__list">
        <div v-if="guests.length === 0" class="guest-sidebar__empty">
          All guests assigned to tables
        </div>
        <div
          v-for="guest in guests"
          :key="guest.id"
          class="guest-sidebar__item guest-sidebar__item--draggable"
          :style="{ borderLeft: `4px solid ${guest.data.color}` }"
          draggable="true"
          @dragstart="handleDragStart(guest)"
          @dragend="handleDragEnd"
        >
          <div class="guest-sidebar__item-name">
            {{ guest.data.name }}
            <span v-if="guest.isMultiPerson" class="guest-sidebar__badge">
              {{ guest.groupName }}
            </span>
          </div>
          <div class="guest-sidebar__item-group">
            {{ getGroupName(guest.id) }}
          </div>
          <div class="guest-sidebar__item-table guest-sidebar__item-table--warning">
            Not seated yet
          </div>

          <div class="guest-sidebar__assign">
            <button
              class="assign-btn"
              @click.stop="toggleTableDropdown(guest.id, $event)"
              title="Assign to table"
            >
              Assign
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Teleported table dropdown -->
    <Teleport to="body">
      <div
        v-if="showTableDropdown"
        class="table-dropdown"
        :style="{
          position: 'fixed',
          top: dropdownPosition.top + 'px',
          left: dropdownPosition.left + 'px',
          width: dropdownPosition.width + 'px'
        }"
      >
        <div
          v-for="table in notFullTables"
          :key="table.id"
          class="table-dropdown__item"
          @click.stop="handleAssignToTable(showTableDropdown, table.id)"
        >
          {{ table.name }}
          <span class="table-dropdown__capacity">
            ({{ table.guestIds.length }}/{{ table.capacity }})
          </span>
        </div>
        <div v-if="notFullTables.length === 0" class="table-dropdown__empty">
          No tables available
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.guest-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: white;
  border-left: 1px solid #e5e7eb;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease;
  z-index: 10;
  display: flex;
}

.guest-sidebar--collapsed {
  transform: translateX(100%);
}

.guest-sidebar__toggle {
  position: absolute;
  left: -40px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 80px;
  background: white;
  border: 1px solid #e5e7eb;
  border-right: none;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.05);
  z-index: 11;
}

.guest-sidebar__toggle:hover {
  background: #f9fafb;
}

.guest-sidebar__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.guest-sidebar__header {
  padding: 20px;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.guest-sidebar__title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.guest-sidebar__counter {
  background: #3b82f6;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}

.guest-sidebar__list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.guest-sidebar__item {
  background: white;
  border: 1px solid #e5e7eb;
  border-left: 4px solid;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.guest-sidebar__item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateX(-4px);
}

.guest-sidebar__item-name {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
  margin-bottom: 2px;
}

.guest-sidebar__item-group {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 400;
  margin-bottom: 2px;
}

.guest-sidebar__item-table {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 400;
  font-style: italic;
}

.guest-sidebar__item-table--warning {
  color: #d97706;
  font-weight: 500;
}

.guest-sidebar__item--draggable {
  cursor: grab;
}

.guest-sidebar__item--draggable:active {
  cursor: grabbing;
}

.guest-sidebar__empty {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  padding: 40px 20px;
}

.guest-sidebar__badge {
  display: inline-block;
  padding: 2px 6px;
  margin-left: 6px;
  font-size: 9px;
  background: rgba(59, 130, 246, 0.2);
  color: #1e40af;
  border-radius: 3px;
  font-weight: 600;
}

.guest-sidebar__assign {
  margin-top: 8px;
}

.assign-btn {
  width: 100%;
  padding: 6px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.assign-btn:hover {
  background: #2563eb;
}

.table-dropdown {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 10000;
  max-height: 200px;
  overflow-y: auto;
}

.table-dropdown__item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-dropdown__item:last-child {
  border-bottom: none;
}

.table-dropdown__item:hover {
  background: #f9fafb;
}

.table-dropdown__capacity {
  font-size: 11px;
  color: #6b7280;
  margin-left: 8px;
}

.table-dropdown__empty {
  padding: 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
}
</style>
