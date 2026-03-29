import { ref, computed } from 'vue'
import { useAuth, buildHeaders } from './useAuth'
import { MultiPersonData, useStoredData, PersonInfo, rebuildPeople } from './useStoredData'

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

const allLists = ref<ListMetadata[]>([])
const selectedListId = ref<string | null>(null)
const selectedList = ref<InvitationList | null>(null)
const loading = ref(false)
/** Snapshot of invited person IDs at last fetch/save, used for dirty detection. */
const savedInvitedSnapshot = ref<string>('')
let initialized = false

export function useInvitationLists() {
  const { getToken, getUserInfo } = useAuth()
  const { people } = useStoredData()

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
    const token = getToken()
    const userInfo = getUserInfo()
    try {
      const res = await fetch('/invitation-lists/get-all-ids', {
        headers: buildHeaders(token)
      })
      if (res.ok) {
        allLists.value = await res.json()
        if (allLists.value.length == 0 || selectedListId.value) {
          return
        }
        const listsByUser = allLists.value.filter(l => l.owner_sub == userInfo.sub)
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

  const isAllMultiPersonInvited = (nodeData: MultiPersonData) => {
    return (
      nodeData.people.length > 0 && nodeData.people.every(p => people.value[p.id]?.invited === true)
    )
  }

  const toggleAllMultiPersonInvite = (nodeData: MultiPersonData) => {
    const prev = isAllMultiPersonInvited(nodeData)
    nodeData.people.forEach(p => {
      people.value[p.id].invited = !prev
    })
  }

  const isPersonInvited = (personId: string) => people.value[personId]?.invited

  const togglePersonInvite = (personId: string) => {
    people.value[personId].invited = !!!people.value[personId]?.invited
  }

  /** If there are no lists at all, create one from the current people state. */
  const ensureDefaultList = async () => {
    await fetchAllIds()
    const userInfo = getUserInfo()
    const listsByUser = allLists.value.filter(l => l.owner_sub == userInfo.sub)
    if (listsByUser.length > 0) return
    const listId = crypto.randomUUID()
    await saveList(listId, 'First Invitation List')
    selectedListId.value = listId
  }

  const fetchList = async (listId: string) => {
    const token = getToken()
    loading.value = true
    try {
      const res = await fetch(`/invitation-lists/get/${listId}`, {
        headers: buildHeaders(token)
      })
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

  const initInvitationLists = async () => {
    if (initialized) return
    initialized = true
    await ensureDefaultList()
    if (selectedListId.value) {
      await fetchList(selectedListId.value)
    }
  }

  const saveList = async (listId: string, listName: string) => {
    const token = getToken()
    const entries: InvitationEntry[] = Object.entries(people.value)
      .filter(([, person]) => person.invited)
      .map(([id]) => ({ person_id: id, invited: true }))

    try {
      const res = await fetch(`/invitation-lists/set/${listId}`, {
        method: 'POST',
        headers: buildHeaders(token),
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
    updatePersonName,
    togglePersonInvite,
    isPersonInvited
  }
}
