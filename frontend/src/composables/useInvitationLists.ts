import { ref, watch } from 'vue'
import { useLocalStorage } from './useLocalStorage.js'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'wedding-invitation-lists'

const availableInvitationLists = ref<string[]>()

// Currently active invitation list
const activeInvitationListId = ref<string | null>(null)

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

const { getToken } = useAuth()
const { saveToLocalStorage } = useLocalStorage(STORAGE_KEY)

const setActiveInvitationList = (listName: string) => {
  if (!availableInvitationLists.value.includes(listName)) {
    throw new Error('List does not exist')
  }
  activeInvitationListId.value = listName
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
  if (availableInvitationLists.value.length > 0) {
    activeInvitationListId.value = availableInvitationLists.value[0]
  }

  saveToLocalStorage({
    availableInvitationLists: availableInvitationLists.value,
    activeInvitationList: activeInvitationListId.value
  })
}

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

  return {
    availableInvitationLists,
    activeInvitationList: activeInvitationListId,
    addInvitationList,
    removeInvitationList,
    setActiveInvitationList,
    saveInvitationList
  }
}
