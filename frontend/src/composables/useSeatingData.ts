import { ref, computed, watch } from 'vue'
import { useStoredData } from './useStoredData'
import { useAuth } from './useAuth'

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

export interface SeatingMetadata {
  id: string
  name: string
  owner_sub: string
  owner_name: string
  invitation_list_id: string
}

export interface Seating {
  tables: Table[]
  metadata: SeatingMetadata
}

const tables = ref<Table[]>([])
const seatingUnsync = ref(false)
const loadedFromBE = ref<Seating | null>(null)
const seatingsForList = ref<SeatingMetadata[]>([])
const selectedSeatingId = ref<string | null>(null)
const currentMetadata = ref<SeatingMetadata | null>(null)

let initialized = false

export function useSeatingData() {
  const { people } = useStoredData()
  const { authFetch, storedUserInfo } = useAuth()

  const isSeatingOwner = computed(() => {
    if (!currentMetadata.value) return false
    return (
      currentMetadata.value.owner_sub === storedUserInfo.value?.sub ||
      currentMetadata.value.owner_sub === ''
    )
  })

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

  const updateTable = (tableId: string, updates: { name?: string; seats?: number }) => {
    const table = tables.value.find(t => t.id === tableId)
    if (!table) return
    if (updates.name !== undefined) {
      table.name = updates.name
    }
    if (updates.seats !== undefined && updates.seats !== table.seats) {
      const seatedCount = table.guests.filter(g => g).length
      if (updates.seats < seatedCount) return
      if (updates.seats > table.guests.length) {
        table.guests = [
          ...table.guests,
          ...new Array(updates.seats - table.guests.length).fill(null)
        ]
      } else {
        // Shrinking: preserve seat positions where possible; relocate any
        // seated guests that fall outside the new range into empty slots.
        const newGuests: (string | null)[] = table.guests.slice(0, updates.seats)
        for (let i = updates.seats; i < table.guests.length; i++) {
          const g = table.guests[i]
          if (!g) continue
          const emptyIdx = newGuests.indexOf(null)
          if (emptyIdx !== -1) newGuests[emptyIdx] = g
        }
        table.guests = newGuests
      }
      table.seats = updates.seats
    }
  }

  const updateTablePosition = (tableId: string, position: { x: number; y: number }) => {
    const table = tables.value.find(t => t.id === tableId)
    if (table) {
      table.position = position
    }
  }

  /** Fetch the list of seating arrangements for a given invitation list. */
  const fetchSeatingsForList = async (invitationListId: string): Promise<void> => {
    try {
      const res = await authFetch(
        `/seating-arrangement/get-seatings-for-invitation-list?invitation_list_id=${encodeURIComponent(invitationListId)}`
      )
      if (res.ok) {
        seatingsForList.value = await res.json()
      } else {
        seatingsForList.value = []
      }
    } catch (e) {
      console.warn('Failed to fetch seatings for list:', e)
      seatingsForList.value = []
    }
  }

  /** Load a specific seating arrangement by id. */
  const loadSeating = async (seatingId: string): Promise<void> => {
    try {
      const res = await authFetch(`/seating-arrangement/get?id=${encodeURIComponent(seatingId)}`)
      if (res.ok) {
        const seating: Seating = await res.json()
        loadedFromBE.value = seating
        tables.value = seating.tables
        currentMetadata.value = seating.metadata
        selectedSeatingId.value = seatingId
      }
    } catch (e) {
      console.warn('Failed to load seating:', e)
    }
  }

  /** Create a new empty seating arrangement for the given invitation list. */
  const createNewSeating = (invitationListId: string, name: string): void => {
    const id = crypto.randomUUID()
    currentMetadata.value = {
      id,
      name,
      owner_sub: '',
      owner_name: storedUserInfo.value.name,
      invitation_list_id: invitationListId
    }
    selectedSeatingId.value = id
    tables.value = []
    loadedFromBE.value = null
    seatingsForList.value.push(currentMetadata.value)
  }

  /** Save the current seating arrangement to the backend. */
  const saveSeatingToBackend = async (): Promise<void> => {
    if (!currentMetadata.value) return
    const seating: Seating = {
      tables: tables.value,
      metadata: currentMetadata.value
    }
    try {
      const res = await authFetch('/seating-arrangement/set', {
        method: 'POST',
        body: JSON.stringify(seating)
      })
      if (res.ok) {
        loadedFromBE.value = JSON.parse(JSON.stringify(seating))
        await fetchSeatingsForList(currentMetadata.value.invitation_list_id)
      } else {
        console.warn('Failed to save seating:', res.status)
      }
    } catch (e) {
      console.warn('Failed to save seating:', e)
    }
  }

  async function initSeatingData() {
    if (initialized) return
    initialized = true

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

  return {
    tables,
    unseatedGuests,
    assignedGuestIds,
    isSeatingOwner,
    seatingUnsync,
    seatingsForList,
    selectedSeatingId,
    currentMetadata,
    addTable,
    removeTable,
    assignGuest,
    unassignGuest,
    updateTable,
    updateTablePosition,
    fetchSeatingsForList,
    loadSeating,
    createNewSeating,
    saveSeatingToBackend,
    initSeatingData
  }
}
