import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import { MultiPersonData, useStoredData, PersonInfo, rebuildPeople } from './useStoredData'

const { authFetch, storedUserInfo } = useAuth()

export interface ListMetadata {
  id: string
  name: string
  owner_sub: string
  owner_name: string
}

export interface InvitationEntry {
  person_id: string
  invited: boolean
}

export interface InvitationList {
  metadata: ListMetadata
  entries: InvitationEntry[]
}

type RSVPStatus = 'NOT_ANSWERED' | 'WILL_COME' | 'WONT_COME'

export type AccommodationPayment = 'WE_PAID' | 'WE_RESERVED' | 'THEY_RESERVED_AND_PAID'

/** Default payment used when a hotel is first assigned to a guest. */
export const DEFAULT_ACCOMMODATION_PAYMENT: AccommodationPayment = 'THEY_RESERVED_AND_PAID'

export interface HotelEntry {
  id: string
  name: string
  google_maps_link: string
}

export interface AccommodationEntry {
  hotel_id: string
  payment: AccommodationPayment
  /** Whether the guest reimbursed us. Only meaningful when payment is WE_RESERVED. */
  paid_back: boolean
}

export interface FinalEntry {
  person_id: string
  invitation_given: boolean
  rsvpd: RSVPStatus
  notes: string
  accommodation: AccommodationEntry | null
}

export interface FinalInvitationListData extends InvitationList {
  final_entries: FinalEntry[]
}

const isFinalListData = (list: InvitationList): list is FinalInvitationListData =>
  'final_entries' in list

const allLists = ref<ListMetadata[]>([])
const selectedListId = ref<string | null>(null)
const selectedList = ref<InvitationList | null>(null)
const loading = ref<boolean>(false)
/** Snapshot of invited person IDs at last fetch/save, used for dirty detection. */
const savedInvitedSnapshot = ref<string>('')
let initialized = false

const finalList = ref<FinalInvitationListData | null>(null)
const finalLoading = ref<boolean>(false)
const finalSaving = ref<boolean>(false)
const finalNotFound = ref<boolean>(false)
const finalEntries = ref<Record<string, FinalEntry>>({})
/** Hotels shared across guests, referenced by AccommodationEntry.hotel_id. */
const finalHotels = ref<HotelEntry[]>([])
/** Snapshot of final entries at last fetch/save, used for dirty detection. */
const savedFinalSnapshot = ref<string>('')
/** Whether the most recently selected (fetched) list is the final list. */
const isSelectedListFinal = ref<boolean>(false)

const usersLists = computed(() =>
  allLists.value.filter(l => l.owner_sub === storedUserInfo.value.sub)
)

export function useInvitationLists() {
  const { people, nodes } = useStoredData()

  const currentInvitedSnapshot = () => {
    return Object.entries(people.value)
      .filter(([, p]) => p.invited)
      .map(([id]) => id)
      .sort()
      .join(',')
  }

  const takeSnapshot = () => {
    savedInvitedSnapshot.value = currentInvitedSnapshot()
  }

  const invitationsDirty = computed(() => {
    return currentInvitedSnapshot() !== savedInvitedSnapshot.value
  })

  /**
   * Fetch all the ids of the invitation lists.
   *
   * If the currently selected invitation list id is not set, then set it to the
   * first invitation list of this owner
   */
  const fetchAllIds = async () => {
    try {
      const res = await authFetch('/invitation-lists/get-all-ids')
      if (res.ok) {
        allLists.value = await res.json()
        if (allLists.value.length == 0 || selectedListId.value) {
          return
        }
        const listsByUser = allLists.value.filter(l => l.owner_sub == storedUserInfo.value.sub)
        if (listsByUser.length > 0) {
          selectedListId.value = listsByUser[listsByUser.length - 1].id
        } else {
          selectedListId.value = allLists.value[allLists.value.length - 1].id
        }
      }
    } catch (e) {
      console.warn('Failed to fetch invitation list ids:', e)
    }
  }

  const deletePerson = (personId: string) => {
    delete people.value[personId]
  }

  const createPerson = (personId: string, info: PersonInfo) => {
    people.value[personId] = info
  }

  const updatePersonName = (personId: string, newName: string) => {
    people.value[personId].name = newName
  }

  const getPersonName = (personId: string) => people.value[personId]?.name ?? personId

  const getPersonNodeId = (personId: string) => people.value[personId]?.nodeId

  /**
   * Get name of the encompassing MultiPersonNode for the person stored in it.
   */
  const getMultiPersonNodeName = (personId: string) => {
    const nodeId = getPersonNodeId(personId)
    if (!nodeId) return ''
    const node = nodes.value.find(n => n.id === nodeId)
    return node.data instanceof MultiPersonData ? node.data.name : ''
  }

  const isAllMultiPersonInvited = (nodeData: MultiPersonData) => {
    return (
      nodeData.people.length > 0 && nodeData.people.every(p => people.value[p.id]?.invited === true)
    )
  }

  const toggleAllMultiPersonInvite = (
    nodeData: MultiPersonData,
    desiredValue: boolean | null = null
  ) => {
    if (desiredValue === null) {
      const prev = isAllMultiPersonInvited(nodeData)
      desiredValue = !prev
    }
    nodeData.people.forEach(p => {
      people.value[p.id].invited = desiredValue
    })
  }

  const isPersonInvited = (personId: string) => people.value[personId]?.invited

  /**
   * Whether the user can click on invite toggle.
   *
   * In case that the user cannot invite anybody, the invite toggle
   * should be turned off.
   */
  const canUserInvite = () => {
    const result = selectedList.value !== null && selectedList.value.metadata !== null
    if (result) {
      return storedUserInfo.value.sub === selectedList.value.metadata.owner_sub
    } else {
      return false
    }
  }

  const togglePersonInvite = (personId: string, desiredValue: boolean | null = null) => {
    if (!canUserInvite()) {
      return // if the person is not the owner, ignore
    }
    if (desiredValue === null) {
      const prev = !!people.value[personId]?.invited
      desiredValue = !prev
    }
    people.value[personId].invited = desiredValue
  }

  /** If there are no lists at all, create one from the current people state. */
  const ensureDefaultList = async () => {
    await fetchAllIds()
    const listsByUser = allLists.value.filter(l => l.owner_sub == storedUserInfo.value.sub)
    if (listsByUser.length > 0) return
    const listId = crypto.randomUUID()
    await saveList(listId, 'First Invitation List')
    selectedListId.value = listId
  }

  /**
   * Fetch a single list without applying it to the graph.
   *
   * If the backend marks the list as final, the final list state is
   * populated from the response, saving a separate get-final call.
   */
  const fetchListById = async (listId: string): Promise<InvitationList> => {
    const res = await authFetch(`/invitation-lists/get/${listId}`)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const list: InvitationList = await res.json()
    isSelectedListFinal.value = isFinalListData(list)
    if (isFinalListData(list)) {
      applyFinalList(list)
    } else if (finalList.value?.metadata.id === list.metadata.id) {
      // The list is no longer final on the backend
      finalList.value = null
      finalNotFound.value = true
    }
    return list
  }

  const fetchList = async (listId: string) => {
    loading.value = true
    try {
      selectedList.value = await fetchListById(listId)
      applyInvitations()
    } catch (e) {
      console.warn('Failed to fetch invitation list:', e)
    } finally {
      loading.value = false
    }
  }

  const applyInvitations = () => {
    if (!selectedList.value) return

    // Reset all invitations
    for (const id of Object.keys(people.value)) {
      people.value[id].invited = false
    }

    // Apply from loaded list
    for (const entry of selectedList.value.entries) {
      if (people.value[entry.person_id]) {
        people.value[entry.person_id].invited = entry.invited
      }
    }

    rebuildPeople()
    takeSnapshot()
  }

  const initInvitationLists = async (force: boolean = false) => {
    if (!force && initialized) return
    initialized = true
    if (force) {
      selectedListId.value = null
    }
    await ensureDefaultList()
    if (selectedListId.value) {
      await fetchList(selectedListId.value)
    }
  }

  const saveList = async (listId: string, listName: string) => {
    const entries: InvitationEntry[] = Object.entries(people.value)
      .filter(([, person]) => person.invited)
      .map(([id]) => ({ person_id: id, invited: true }))

    try {
      const res = await authFetch(`/invitation-lists/set/${listId}`, {
        method: 'POST',
        body: JSON.stringify({ list_name: listName, entries })
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail || `HTTP ${res.status}`)
      }
      // Refresh the lists
      await fetchAllIds()
      await fetchList(listId)
    } catch (e) {
      console.warn('Failed to save invitation list:', e)
      throw e
    }
  }

  const finalInvitedIds = computed<string[]>(() => {
    if (!finalList.value) return []
    return finalList.value.entries.filter(e => e.invited).map(e => e.person_id)
  })

  const makeDefaultFinalEntry = (personId: string): FinalEntry => ({
    person_id: personId,
    invitation_given: false,
    rsvpd: 'NOT_ANSWERED',
    notes: '',
    accommodation: null
  })

  const buildFinalEntries = (): Record<string, FinalEntry> => {
    const existing: Record<string, FinalEntry> = {}
    if (finalList.value?.final_entries) {
      for (const entry of finalList.value.final_entries) {
        existing[entry.person_id] = entry
      }
    }
    const map: Record<string, FinalEntry> = {}
    for (const id of finalInvitedIds.value) {
      const merged: FinalEntry = { ...makeDefaultFinalEntry(id), ...(existing[id] ?? {}) }
      // Clone the nested accommodation so edits don't mutate the fetched baseline
      // that revert rebuilds from.
      merged.accommodation = merged.accommodation ? { ...merged.accommodation } : null
      map[id] = merged
    }
    return map
  }

  const serializeFinalEntries = (entries: Record<string, FinalEntry>): string => {
    const keys = Object.keys(entries).sort()
    return JSON.stringify(keys.map(k => entries[k]))
  }

  const takeFinalSnapshot = () => {
    savedFinalSnapshot.value = serializeFinalEntries(finalEntries.value)
  }

  const finalEntriesDirty = computed(
    () => serializeFinalEntries(finalEntries.value) !== savedFinalSnapshot.value
  )

  const applyFinalList = (list: FinalInvitationListData) => {
    finalList.value = list
    finalNotFound.value = false
    finalEntries.value = buildFinalEntries()
    takeFinalSnapshot()
  }

  const fetchFinalList = async () => {
    finalLoading.value = true
    try {
      const res = await authFetch('/invitation-lists/get-final')
      if (res.ok) {
        applyFinalList(await res.json())
      } else if (res.status === 404) {
        finalList.value = null
        finalNotFound.value = true
      }
    } catch (e) {
      console.warn('Failed to fetch final list:', e)
    } finally {
      finalLoading.value = false
    }
  }

  const setFinalList = async (listId: string) => {
    const res = await authFetch(`/invitation-lists/set-final/${listId}`, { method: 'POST' })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.detail || `HTTP ${res.status}`)
    }
    // Refetch so the final list state is populated from the backend
    await fetchListById(listId)
  }

  const unsetFinalList = async () => {
    const res = await authFetch('/invitation-lists/unset-final', { method: 'POST' })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.detail || `HTTP ${res.status}`)
    }
    finalList.value = null
    finalNotFound.value = true
    isSelectedListFinal.value = false
  }

  const revertFinalEntries = () => {
    finalEntries.value = buildFinalEntries()
  }

  const saveFinalEntries = async () => {
    finalSaving.value = true
    try {
      const res = await authFetch('/invitation-lists/set-final-entries', {
        method: 'POST',
        body: JSON.stringify({ final_entries: Object.values(finalEntries.value) })
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail || `HTTP ${res.status}`)
      }
      takeFinalSnapshot()
    } finally {
      finalSaving.value = false
    }
  }

  /** Fetch the shared hotel list, referenced by accommodation entries. */
  const fetchHotels = async () => {
    try {
      const res = await authFetch('/invitation-lists/hotels')
      if (res.ok) {
        finalHotels.value = await res.json()
      }
    } catch (e) {
      console.warn('Failed to fetch hotels:', e)
    }
  }

  const getHotelById = (hotelId: string): HotelEntry | undefined =>
    finalHotels.value.find(h => h.id === hotelId)

  /**
   * Create and persist a new hotel, returning its generated id.
   *
   * Hotels are persisted immediately (independently of the final entries Save)
   * so that a hotel always exists on the backend before any entry references it.
   */
  const createHotel = async (name: string, googleMapsLink: string): Promise<string> => {
    const hotel: HotelEntry = {
      id: crypto.randomUUID(),
      name,
      google_maps_link: googleMapsLink
    }
    const res = await authFetch('/invitation-lists/hotels', {
      method: 'POST',
      body: JSON.stringify(hotel)
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.detail || `HTTP ${res.status}`)
    }
    finalHotels.value.push(hotel)
    return hotel.id
  }

  /**
   * Update an existing hotel's name/link, persisting immediately.
   *
   * Uses the same upsert endpoint as {@link createHotel}; the hotel is matched
   * by its id, so accommodation entries referencing it keep pointing at the
   * updated hotel.
   */
  const updateHotel = async (
    hotelId: string,
    name: string,
    googleMapsLink: string
  ): Promise<void> => {
    const hotel: HotelEntry = { id: hotelId, name, google_maps_link: googleMapsLink }
    const res = await authFetch('/invitation-lists/hotels', {
      method: 'POST',
      body: JSON.stringify(hotel)
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.detail || `HTTP ${res.status}`)
    }
    const idx = finalHotels.value.findIndex(h => h.id === hotelId)
    if (idx !== -1) {
      finalHotels.value[idx] = hotel
    } else {
      finalHotels.value.push(hotel)
    }
  }

  /**
   * Assign a hotel to a guest, creating the AccommodationEntry if needed.
   *
   * An empty hotelId clears the accommodation back to null.
   */
  const assignHotel = (personId: string, hotelId: string) => {
    const entry = finalEntries.value[personId]
    if (!entry) return
    if (!hotelId) {
      entry.accommodation = null
      return
    }
    if (entry.accommodation) {
      entry.accommodation.hotel_id = hotelId
    } else {
      entry.accommodation = {
        hotel_id: hotelId,
        payment: DEFAULT_ACCOMMODATION_PAYMENT,
        paid_back: false
      }
    }
  }

  return {
    allLists,
    usersLists,
    selectedListId,
    selectedList,
    loading,
    fetchAllIds,
    fetchList,
    fetchListById,
    applyInvitations,
    saveList,
    ensureDefaultList,
    initInvitationLists,
    invitationsDirty,
    toggleAllMultiPersonInvite,
    isAllMultiPersonInvited,
    deletePerson,
    createPerson,
    getPersonName,
    getMultiPersonNodeName,
    getPersonNodeId,
    updatePersonName,
    togglePersonInvite,
    isPersonInvited,
    canUserInvite,
    finalList,
    finalLoading,
    finalSaving,
    finalNotFound,
    finalEntries,
    finalHotels,
    finalInvitedIds,
    finalEntriesDirty,
    isSelectedListFinal,
    fetchFinalList,
    fetchHotels,
    createHotel,
    updateHotel,
    getHotelById,
    assignHotel,
    setFinalList,
    unsetFinalList,
    revertFinalEntries,
    saveFinalEntries
  }
}
