<script setup>
import { ref, computed, watch } from 'vue'
import GenealogyTree from './components/GenealogyTree.vue'
import TableSeating from './components/TableSeating.vue'
import InvitationListDropdown from './components/InvitationListDropdown.vue'
import TableSeatingSidebar from './components/TableSeatingSidebar.vue'
import GenealogyTreeSidebar from './components/GenealogyTreeSidebar.vue'
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

const { sidebarCollapsed } = useSidebarState()
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

const draggedGuest = ref(null)

const handleDragStart = guest => {
  draggedGuest.value = guest
}

const handleDragEnd = () => {
  draggedGuest.value = null
}

const handleAssignToTable = (guestId, tableId) => {
  assignGuestToTable(guestId, tableId)
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

      <TableSeatingSidebar
        v-if="activeTab === 'table-seating'"
        :guests="unassignedGuests"
        :tables="tables"
        :get-group-name="getGroupName"
        @drag-start="handleDragStart"
        @drag-end="handleDragEnd"
        @assign-to-table="handleAssignToTable"
      />
      <GenealogyTreeSidebar
        v-if="activeTab === 'family-tree'"
        :guests="invitedGuests"
        :get-group-name="getGroupName"
        :get-table-assignment="getTableAssignment"
      />
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
</style>
