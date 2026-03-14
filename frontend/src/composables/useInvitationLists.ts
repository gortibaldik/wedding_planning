import { ref, computed } from 'vue'
import { useAuth, buildHeaders } from './useAuth'
import { useStoredData } from './useStoredData'

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
  const { getToken } = useAuth()
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

  const fetchAllIds = async () => {
    const token = getToken()
    try {
      const res = await fetch('/invitation-lists/get-all-ids', {
        headers: buildHeaders(token)
      })
      if (res.ok) {
        allLists.value = await res.json()
        if (allLists.value.length > 0 && !selectedListId.value) {
          selectedListId.value = allLists.value[allLists.value.length - 1].id
        }
      }
    } catch (e) {
      console.warn('Failed to fetch invitation list ids:', e)
    }
  }

  /** If there are no lists at all, create one from the current people state. */
  const ensureDefaultList = async () => {
    await fetchAllIds()
    if (allLists.value.length > 0) return
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
    invitationsDirty
  }
}
