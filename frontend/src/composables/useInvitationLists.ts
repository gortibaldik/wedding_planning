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

export interface FinalEntry {
  person_id: string
  invitation_given: boolean
  rsvpd: RSVPStatus
  notes: string
}

export interface FinalInvitationListData extends InvitationList {
  final_entries: FinalEntry[]
}

const allLists = ref<ListMetadata[]>([])
const selectedListId = ref<string | null>(null)
const selectedList = ref<InvitationList | null>(null)
const loading = ref<boolean>(false)
/** Snapshot of invited person IDs at last fetch/save, used for dirty detection. */
const savedInvitedSnapshot = ref<string>('')
let initialized = false

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

  const fetchList = async (listId: string) => {
    loading.value = true
    try {
      const res = await authFetch(`/invitation-lists/get/${listId}`)
      if (res.ok) {
        selectedList.value = await res.json()
        applyInvitations()
      }
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

  return {
    allLists,
    usersLists,
    selectedListId,
    selectedList,
    loading,
    fetchAllIds,
    fetchList,
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
    canUserInvite
  }
}
