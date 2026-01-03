<script setup>
import { ref, computed, watch } from 'vue'
import GenealogyTree from './components/GenealogyTree.vue'
import TableSeating from './components/TableSeating.vue'
import InvitationListDropdown from './components/InvitationListDropdown.vue'
import { useGenealogyData } from './composables/useGenealogyData.ts'
import { useTableSeating } from './composables/useTableSeating'
import { useSidebarState } from './composables/useSidebarState'
import { useInvitationLists } from './composables/useInvitationLists.ts'

const activeTab = ref('family-tree')
const { nodes, edges, initializeNodesAndEdges, populateNodesWithNewList, removeListFromNodes } =
  useGenealogyData()
const {
  tables,
  tablesPerList,
  getAssignedGuestIds,
  removeGuestFromTable,
  assignGuestToTable,
  populateListWithTables
} = useTableSeating()

const notFullTables = computed(tables.value.filter(t => t.guestIds.length != t.capacity))
const { sidebarCollapsed, toggleSidebar } = useSidebarState()
const {
  activeInvitationList,
  availableInvitationLists,
  addInvitationList,
  removeInvitationList,
  setActiveInvitationList
} = useInvitationLists()

// Helper function to find the group (root) name for a guest
const getGroupName = guestId => {
  // First check if this is a person within a multi-person node
  const multiPersonNode = nodes.value.find(
    node => node.type === 'multi-person' && node.data.people.some(p => p.id === guestId)
  )

  if (multiPersonNode) {
    // Use the multi-person node ID to traverse up the tree
    return getGroupNameForNode(multiPersonNode.id)
  }

  // Otherwise, it's a regular person node
  return getGroupNameForNode(guestId)
}

const getGroupNameForNode = nodeId => {
  const visited = new Set()
  let currentId = nodeId

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

// Helper function to get the table assignment for a guest
const getTableAssignment = guestId => {
  const table = tables.value.find(t => t.guestIds.includes(guestId))
  return table ? table.name : null
}

const invitedGuests = computed(() => {
  const guests = []

  nodes.value.forEach(node => {
    if (node.type === 'person' && node.data.invited[activeInvitationList.value]) {
      // Regular person node
      guests.push({
        id: node.id,
        data: {
          name: node.data.name,
          color: node.data.color
        },
        nodeId: node.id,
        isMultiPerson: false
      })
    } else if (node.type === 'multi-person') {
      // Multi-person node - add each invited person
      node.data.people.forEach(person => {
        if (person.invited[activeInvitationList.value]) {
          guests.push({
            id: person.id, // Use person.id for seating
            data: {
              name: person.name,
              color: node.data.color
            },
            nodeId: node.id, // Track which node they belong to
            isMultiPerson: true,
            groupName: node.data.name // The multi-person node's group name
          })
        }
      })
    }
  })

  return guests
})

const unassignedGuests = computed(() => {
  return invitedGuests.value.filter(guest => !getAssignedGuestIds.value.has(guest.id))
})

const sidebarGuests = computed(() => {
  return activeTab.value === 'table-seating' ? unassignedGuests.value : invitedGuests.value
})

const sidebarTitle = computed(() => {
  return activeTab.value === 'table-seating' ? 'Unassigned Guests' : 'Invited Guests'
})

const draggedGuest = ref(null)

const handleDragStart = guest => {
  if (activeTab.value === 'table-seating') {
    draggedGuest.value = guest
  }
}

const handleDragEnd = () => {
  draggedGuest.value = null
}

// Table assignment dropdown state
const showTableDropdown = ref(null) // guestId for which dropdown is shown
const dropdownPosition = ref({ top: 0, left: 0, width: 0 })

const toggleTableDropdown = (guestId, event) => {
  if (showTableDropdown.value === guestId) {
    showTableDropdown.value = null
    return
  }

  // Calculate position based on button position
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
  assignGuestToTable(guestId, tableId)
  showTableDropdown.value = null
}

// Watch for changes to invited guests and remove uninvited guests from tables
// This includes when switching between invitation lists
watch(
  [nodes, tables, activeInvitationList],
  () => {
    // Get the set of currently invited guest IDs for the active list
    const invitedGuestIds = new Set(invitedGuests.value.map(g => g.id))

    // For each table, remove guests that are no longer invited in the active list
    tables.value.forEach(table => {
      const uninvitedGuests = table.guestIds.filter(guestId => !invitedGuestIds.has(guestId))

      uninvitedGuests.forEach(guestId => {
        removeGuestFromTable(guestId, table.id)
      })
    })
  },
  { deep: true }
)

const handleExport = () => {
  const data = {
    nodes: nodes.value,
    edges: edges.value,
    tablesPerList: tablesPerList.value, // Export all tables for all invitation lists
    invitationLists: {
      available: availableInvitationLists.value,
      active: activeInvitationList.value
    }
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `wedding-planning-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const handleImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'

  input.onchange = e => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target.result)

        if (!data.nodes || !data.edges) {
          alert('Invalid file format. The file must contain "nodes" and "edges" properties.')
          return
        }

        const confirmMessage =
          'Import this file? This will replace your current family tree, invitation lists, and table seating arrangements.'

        if (confirm(confirmMessage)) {
          initializeNodesAndEdges(data.nodes, data.edges)

          // Import tables per list
          if (data.tablesPerList) {
            tablesPerList.value = data.tablesPerList
          }

          // Import invitation lists
          if (data.invitationLists) {
            availableInvitationLists.value = data.invitationLists.available
            if (data.invitationLists.active) {
              activeInvitationList.value = data.invitationLists.active
            }
          } else {
            availableInvitationLists.value = ['final_decision']
            activeInvitationList.value = 'final_decision'
          }
        }
      } catch (error) {
        alert('Error reading file: ' + error.message)
      }
    }
    reader.readAsText(file)
  }

  input.click()
}

const handleSelectInvitationList = listName => {
  setActiveInvitationList(listName)
}

const handleAddInvitationList = listName => {
  try {
    addInvitationList(listName)
    // Populate all existing nodes with the new list (set to false)
    populateNodesWithNewList(listName)
    // Initialize empty tables for the new list
    populateListWithTables(listName)
    // Select the newly created list
    setActiveInvitationList(listName)
  } catch (error) {
    alert(error.message)
  }
}

const handleRemoveInvitationList = listName => {
  try {
    // Remove the list from the state
    removeInvitationList(listName)
    // Remove the list from all nodes
    removeListFromNodes(listName)
    // Remove the list from table seating
    delete tablesPerList.value[listName]
  } catch (error) {
    alert(error.message)
  }
}
</script>

<template>
  <div class="app">
    <header class="app-header" :style="{ width: sidebarCollapsed ? '100%' : 'calc(100% - 300px)' }">
      <div class="header-content">
        <div class="header-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'family-tree' }"
            @click="activeTab = 'family-tree'"
          >
            Family Tree
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'table-seating' }"
            @click="activeTab = 'table-seating'"
          >
            Table Seating
          </button>
        </div>
        <div class="header-center">
          <h1>Wedding Planning</h1>
          <p v-if="activeTab === 'family-tree'" class="instructions">
            Click on any person to edit their details. Use the ↑ button to add parents, ↓ button to
            add children. Use the zoom controls to navigate the tree.
          </p>
          <p v-else class="instructions">
            Organize your invited guests into round tables. Drag guests from the unassigned list to
            tables or between tables.
          </p>
        </div>
        <div class="header-buttons">
          <div class="buttons-row">
            <button
              class="square-btn export-btn"
              title="Export tree to JSON file"
              @click="handleExport"
            >
              ⬇
            </button>
            <button
              class="square-btn import-btn"
              title="Import tree from JSON file"
              @click="handleImport"
            >
              ⬆
            </button>
          </div>
          <InvitationListDropdown
            :active-invitation-list="activeInvitationList"
            :available-invitation-lists="availableInvitationLists"
            @select="handleSelectInvitationList"
            @add="handleAddInvitationList"
            @remove="handleRemoveInvitationList"
          />
        </div>
      </div>
    </header>
    <div class="main-content">
      <GenealogyTree v-if="activeTab === 'family-tree'" />
      <TableSeating
        v-if="activeTab === 'table-seating'"
        :dragged-guest-from-sidebar="draggedGuest"
      />

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
            <h3 class="guest-sidebar__title">
              {{ sidebarTitle }}
            </h3>
            <div class="guest-sidebar__counter">
              {{ sidebarGuests.length }}
            </div>
          </div>
          <div class="guest-sidebar__list">
            <div v-if="sidebarGuests.length === 0" class="guest-sidebar__empty">
              {{
                activeTab === 'table-seating'
                  ? 'All guests assigned to tables'
                  : 'No guests invited yet'
              }}
            </div>
            <div
              v-for="guest in sidebarGuests"
              :key="guest.id"
              class="guest-sidebar__item"
              :class="{ 'guest-sidebar__item--draggable': activeTab === 'table-seating' }"
              :style="{ borderLeft: `4px solid ${guest.data.color}` }"
              :draggable="activeTab === 'table-seating'"
              @dragstart="handleDragStart(guest)"
              @dragend="handleDragEnd"
            >
              <div class="guest-sidebar__item-name">
                {{ guest.data.name }}
                <span v-if="guest.isMultiPerson" class="guest-sidebar__badge">{{
                  guest.groupName
                }}</span>
              </div>
              <div class="guest-sidebar__item-group">
                {{ getGroupName(guest.id) }}
              </div>
              <div
                class="guest-sidebar__item-table"
                :class="{ 'guest-sidebar__item-table--warning': !getTableAssignment(guest.id) }"
              >
                {{
                  getTableAssignment(guest.id)
                    ? `Seated at ${getTableAssignment(guest.id)}`
                    : 'Not seated yet'
                }}
              </div>

              <!-- Assign to Table button (only for unassigned guests in table-seating tab) -->
              <div
                v-if="activeTab === 'table-seating' && !getTableAssignment(guest.id)"
                class="guest-sidebar__assign"
              >
                <button
                  class="assign-btn"
                  :ref="`assignBtn-${guest.id}`"
                  @click.stop="toggleTableDropdown(guest.id, $event)"
                  title="Assign to table"
                >
                  Assign
                </button>
              </div>
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
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f9fafb;
}

.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: white;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: width 0.3s ease;
}

.header-content {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 24px;
}

.header-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 8px 16px;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.tab-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.header-spacer {
  width: 100%;
}

.header-center {
  text-align: center;
}

.app-header h1 {
  font-size: 24px;
  color: #1f2937;
  margin-bottom: 8px;
}

.app-header .instructions {
  font-size: 14px;
  color: #6b7280;
}

.header-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
}

.buttons-row {
  display: flex;
  gap: 8px;
}

.square-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 8px;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.export-btn {
  background: #3b82f6;
  color: white;
}

.export-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.import-btn {
  background: #10b981;
  color: white;
}

.import-btn:hover {
  background: #059669;
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
  transform: translateY(-2px);
}

.square-btn:active {
  transform: translateY(0);
}

.main-content {
  flex: 1;
  position: relative;
  display: flex;
  overflow: hidden;
}

.guest-sidebar {
  position: absolute;
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
