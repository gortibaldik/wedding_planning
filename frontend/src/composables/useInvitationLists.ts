import { ref, watch } from 'vue'
import { useLocalStorage } from './useLocalStorage.js'
import { useAuth } from './useAuth'

const INVITATION_LIST_STORAGE_KEY = 'wedding-invitation-lists'
const GENERAL_DATA_STORAGE_KEY = 'wedding-general-data'

const availableInvitationLists = ref<string[]>()

// Currently active invitation list
const activeInvitationListId = ref<string | null>(null)

const nodes = ref<any[]>([])
const edges = ref<any[]>([])
const tablesPerList = ref<Record<string, any[]>>({})

function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function getOwnerFromToken(token: string | null): string {
  if (!token) return ''
  try {
    return JSON.parse(atob(token.split('.')[1])).sub ?? ''
  } catch {
    return ''
  }
}

const { checkAuth, getToken } = useAuth()
const { saveToLocalStorage } = useLocalStorage(INVITATION_LIST_STORAGE_KEY)
const { saveToLocalStorage: saveDataToLocalStorage } = useLocalStorage(GENERAL_DATA_STORAGE_KEY)

const setActiveInvitationList = async (listName: string) => {
  if (!availableInvitationLists.value.includes(listName)) {
    throw new Error('List does not exist')
  }
  activeInvitationListId.value = listName
  try {
    const res = await fetch(
      `/invitation_lists/get-invitation-list/${encodeURIComponent(listName)}`,
      { headers: buildHeaders(getToken()) }
    )
    if (res.ok) {
      const invitationList = await res.json()
      const data = invitationList.data
      if (data) {
        nodes.value = data.nodes ?? []
        edges.value = data.edges ?? []
        tablesPerList.value[listName] = data.tables ?? []
      }
    }
  } catch (e) {
    console.warn('Could not fetch invitation list data:', e)
  }
}

const initializeInvitationLists = async () => {
  try {
    const res = await fetch('/invitation_lists/get-ids', { headers: buildHeaders(getToken()) })
    if (res.ok) {
      const data = await res.json()
      const backendIds: string[] = data.ids ?? []
      availableInvitationLists.value = backendIds
    }
  } catch (e) {
    console.warn('Could not sync invitation lists with backend:', e)
  }

  activeInvitationListId.value = null
  if (availableInvitationLists.value && availableInvitationLists.value.length > 0) {
    await setActiveInvitationList(availableInvitationLists.value[0])
  }

  saveToLocalStorage({
    availableInvitationLists: availableInvitationLists.value,
    activeInvitationList: activeInvitationListId.value
  })
}

const saveInvitationList = async (data: any) => {
  const token = getToken()
  try {
    const res = await fetch('/invitation_lists/add-invitation-list', {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({
        name: activeInvitationListId.value,
        owner: getOwnerFromToken(token),
        data
      })
    })
    if (!res.ok) console.warn('Failed to save invitation list to backend:', res.status)
  } catch (e) {
    console.warn('Could not save invitation list to backend:', e)
  }
}

checkAuth()
await initializeInvitationLists()

// Watch for changes and save to local storage
watch(
  [availableInvitationLists, activeInvitationListId],
  () => {
    saveToLocalStorage({
      availableInvitationLists: availableInvitationLists.value,
      activeInvitationList: activeInvitationListId.value
    })
  },
  { deep: true }
)

// Auto-save nodes/edges/tables to localStorage on every change
watch(
  [nodes, edges, tablesPerList],
  () => {
    saveDataToLocalStorage({
      nodes: nodes.value,
      edges: edges.value,
      tablesPerList: tablesPerList.value
    })
  },
  { deep: true }
)

// Auto-save active list to backend every 30 seconds
setInterval(async () => {
  if (activeInvitationListId.value) {
    await saveInvitationList({
      nodes: nodes.value,
      edges: edges.value,
      tables: tablesPerList.value[activeInvitationListId.value]
    })
  }
}, 30_000)

export function useInvitationLists() {
  const addInvitationList = async (listName: string, data: any = null) => {
    if (!listName.trim()) {
      throw new Error('List name cannot be empty')
    }
    if (availableInvitationLists.value.includes(listName)) {
      throw new Error('List name already exists')
    }
    availableInvitationLists.value.push(listName)

    try {
      const token = getToken()
      const owner = getOwnerFromToken(token)
      const res = await fetch('/invitation_lists/add-invitation-list', {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ name: listName, owner, data })
      })
      if (!res.ok) {
        console.warn('Failed to save invitation list to backend:', res.status)
      }
    } catch (e) {
      console.warn('Could not save invitation list to backend:', e)
    }
  }

  const removeInvitationList = async (listName: string) => {
    const index = availableInvitationLists.value.indexOf(listName)
    if (index > -1) {
      availableInvitationLists.value.splice(index, 1)
      if (activeInvitationListId.value === listName) {
        activeInvitationListId.value = null
      }
      console.info(
        `Removed invitation list at index ${index} -> remaining invitation lists: ${availableInvitationLists.value}`
      )
    } else {
      console.warn(`Couldn't find an invitation list with name: ${listName}`)
    }

    try {
      const res = await fetch(`/invitation_lists/remove-invitation-list/${listName}`, {
        headers: buildHeaders(getToken())
      })
      if (!res.ok) {
        console.warn('Failed to remove invitation list from backend:', res.status)
      }
    } catch (e) {
      console.warn('Could not remove invitation list from backend:', e)
    }
  }

  return {
    availableInvitationLists,
    activeInvitationList: activeInvitationListId,
    nodes,
    edges,
    tablesPerList,
    addInvitationList,
    removeInvitationList,
    setActiveInvitationList,
    saveInvitationList
  }
}
