import { ref, computed, watch } from 'vue'
import { useStoredData } from './useStoredData'
import { useBackendStorage } from './useBackendStorage'
import { useLocalStorage } from './useLocalStorage'

export interface Table {
  id: string
  name: string
  shape: 'rectangular' | 'circular'
  seats: number

  /**
   * Position of the table
   */
  position: { x: number; y: number }

  /**
   * Ids of guests that sit at this table
   */
  guests: (string | null)[]
}

const tables = ref<Table[]>([])
const seatingUnsync = ref(false)
const loadedFromBE = ref<any>(null)

const { saveToLocalStorage, loadFromLocalStorage } = useLocalStorage('wedding-app::seating-data')

let initialized = false

export function useSeatingData() {
  const { people } = useStoredData()

  const assignedGuestIds = computed(() => {
    const ids = new Set<string>()
    for (const table of tables.value) {
      for (const guestId of table.guests) {
        if (guestId) ids.add(guestId)
      }
    }
    return ids
  })

  const unseatedGuests = computed(() => {
    return Object.entries(people.value)
      .filter(([id, person]) => person.invited && !assignedGuestIds.value.has(id))
      .map(([id]) => id)
  })

  const addTable = (name: string, shape: 'rectangular' | 'circular', seats: number) => {
    const id = `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    tables.value.push({
      id,
      name,
      shape,
      seats,
      position: { x: 100 + tables.value.length * 50, y: 100 + tables.value.length * 30 },
      guests: new Array(seats).fill(null)
    })
  }

  const removeTable = (tableId: string) => {
    tables.value = tables.value.filter(t => t.id !== tableId)
  }

  const assignGuest = (guestId: string, tableId: string, seatIndex: number) => {
    // Remove from any existing seat first
    unassignGuest(guestId)
    const table = tables.value.find(t => t.id === tableId)
    if (table && seatIndex >= 0 && seatIndex < table.guests.length) {
      table.guests[seatIndex] = guestId
    }
  }

  const unassignGuest = (guestId: string) => {
    for (const table of tables.value) {
      const idx = table.guests.indexOf(guestId)
      if (idx !== -1) {
        table.guests[idx] = null
      }
    }
  }

  const updateTablePosition = (tableId: string, position: { x: number; y: number }) => {
    const table = tables.value.find(t => t.id === tableId)
    if (table) {
      table.position = position
    }
  }

  async function initSeatingData() {
    if (initialized) return
    initialized = true

    const { loadFromBackendStorage } = useBackendStorage('seating-arrangement')
    const beData = await loadFromBackendStorage()
    loadedFromBE.value = beData

    let stored = beData
    if (!stored) {
      stored = loadFromLocalStorage()
    }

    if (stored && stored.tables) {
      tables.value = stored.tables
    }

    watch(
      tables,
      () => {
        saveToLocalStorage({ tables: tables.value })
      },
      { deep: true }
    )

    watch(
      [tables, loadedFromBE],
      () => {
        if (!loadedFromBE.value) {
          seatingUnsync.value = tables.value.length > 0
          return
        }
        const currentStr = JSON.stringify({ tables: tables.value })
        const loadedStr = JSON.stringify({ tables: loadedFromBE.value.tables })
        seatingUnsync.value = currentStr !== loadedStr
      },
      { deep: true }
    )
  }

  async function saveSeatingToBackend() {
    const { saveToBackendStorage, loadFromBackendStorage } =
      useBackendStorage('seating-arrangement')
    await saveToBackendStorage({ tables: tables.value })
    loadedFromBE.value = await loadFromBackendStorage()
  }

  return {
    tables,
    unseatedGuests,
    assignedGuestIds,
    seatingUnsync,
    addTable,
    removeTable,
    assignGuest,
    unassignGuest,
    updateTablePosition,
    initSeatingData,
    saveSeatingToBackend
  }
}
