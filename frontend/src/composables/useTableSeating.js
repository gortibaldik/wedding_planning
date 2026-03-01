import { computed } from 'vue'
import { useInvitationLists } from './useInvitationLists'

export function useTableSeating() {
  const { activeInvitationList, availableInvitationLists, tablesPerList, initializedData } =
    useInvitationLists()

  // Computed property to get tables for the active invitation list
  const tables = computed({
    get: () => {
      if (!tablesPerList.value[activeInvitationList.value]) {
        // Initialize with default tables if this list doesn't have any yet
        tablesPerList.value[activeInvitationList.value] = [
          {
            id: `table-${Date.now()}-1`,
            name: 'Table 1',
            capacity: 8,
            guestIds: []
          }
        ]
      }
      return tablesPerList.value[activeInvitationList.value]
    },
    set: value => {
      tablesPerList.value[activeInvitationList.value] = value
    }
  })

  const addTable = () => {
    const currentTables = tables.value
    const tableNumber = currentTables.length + 1
    const newTable = {
      id: `table-${Date.now()}`,
      name: `Table ${tableNumber}`,
      capacity: 10,
      guestIds: []
    }
    tables.value = [...currentTables, newTable]
  }

  const removeTable = tableId => {
    tables.value = tables.value.filter(t => t.id !== tableId)
  }

  const updateTableName = (tableId, newName) => {
    const table = tables.value.find(t => t.id === tableId)
    if (table) {
      table.name = newName
    }
  }

  const updateTableCapacity = (tableId, newCapacity) => {
    const table = tables.value.find(t => t.id === tableId)
    if (table) {
      table.capacity = parseInt(newCapacity) || 8
    }
  }

  const assignGuestToTable = (guestId, tableId) => {
    // Remove guest from any existing table
    tables.value.forEach(table => {
      table.guestIds = table.guestIds.filter(id => id !== guestId)
    })

    // Add guest to new table
    const table = tables.value.find(t => t.id === tableId)
    if (table) {
      table.guestIds = [...table.guestIds, guestId]
    }
  }

  const removeGuestFromTable = (guestId, tableId) => {
    const table = tables.value.find(t => t.id === tableId)
    if (table) {
      table.guestIds = table.guestIds.filter(id => id !== guestId)
    }
  }

  const getAssignedGuestIds = computed(() => {
    const assigned = new Set()
    tables.value.forEach(table => {
      table.guestIds.forEach(id => assigned.add(id))
    })
    return assigned
  })

  const clearAll = () => {
    tables.value = []
  }

  // Populate existing invitation lists with empty table arrays if they don't have any
  const populateListWithTables = listName => {
    if (!tablesPerList.value[listName]) {
      tablesPerList.value[listName] = []
    }
  }

  return {
    tables,
    tablesPerList, // Expose for export/import
    addTable,
    removeTable,
    updateTableName,
    updateTableCapacity,
    assignGuestToTable,
    removeGuestFromTable,
    getAssignedGuestIds,
    clearAll,
    populateListWithTables
  }
}
