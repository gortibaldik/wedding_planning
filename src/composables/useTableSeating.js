import { ref, watch, computed } from 'vue'
import { useLocalStorage } from './useLocalStorage'

const STORAGE_KEY = 'wedding-table-seating'

const tables = ref([])

export function useTableSeating() {
  const serializeData = () => {
    return {
      tables: tables.value
    }
  }

  const { loadFromLocalStorage, saveToLocalStorage } = useLocalStorage(STORAGE_KEY)

  const initializeData = () => {
    const savedData = loadFromLocalStorage()

    if (savedData && savedData.tables) {
      tables.value = savedData.tables
      return
    }

    // Initialize with a few default tables
    tables.value = [
      {
        id: `table-${Date.now()}-1`,
        name: 'Table 1',
        capacity: 8,
        guestIds: []
      },
      {
        id: `table-${Date.now()}-2`,
        name: 'Table 2',
        capacity: 8,
        guestIds: []
      }
    ]
  }

  const addTable = () => {
    const tableNumber = tables.value.length + 1
    const newTable = {
      id: `table-${Date.now()}`,
      name: `Table ${tableNumber}`,
      capacity: 8,
      guestIds: []
    }
    tables.value = [...tables.value, newTable]
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

  initializeData()

  watch(
    tables,
    () => {
      saveToLocalStorage(serializeData())
    },
    { deep: true }
  )

  return {
    tables,
    addTable,
    removeTable,
    updateTableName,
    updateTableCapacity,
    assignGuestToTable,
    removeGuestFromTable,
    getAssignedGuestIds,
    clearAll
  }
}
