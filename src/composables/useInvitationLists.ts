import { ref, watch } from 'vue'
import { useLocalStorage } from './useLocalStorage.js'

const STORAGE_KEY = 'wedding-invitation-lists'

// Available invitation lists (e.g., "final_decision", "Lucka's Opinion", etc.)
const availableInvitationLists = ref<string[]>(['final_decision'])

// Currently active invitation list
const activeInvitationListId = ref<string>('final_decision')

export function useInvitationLists() {
  const { saveToLocalStorage, loadFromLocalStorage } = useLocalStorage(STORAGE_KEY)

  // Initialize from local storage
  const initializeInvitationLists = () => {
    const savedData = loadFromLocalStorage()
    if (savedData) {
      if (savedData.availableInvitationLists && Array.isArray(savedData.availableInvitationLists)) {
        availableInvitationLists.value = savedData.availableInvitationLists
      }
      if (savedData.activeInvitationList && typeof savedData.activeInvitationList === 'string') {
        activeInvitationListId.value = savedData.activeInvitationList
      }
    }
  }

  // Add a new invitation list
  const addInvitationList = (listName: string) => {
    if (!listName.trim()) {
      throw new Error('List name cannot be empty')
    }
    if (availableInvitationLists.value.includes(listName)) {
      throw new Error('List name already exists')
    }
    availableInvitationLists.value.push(listName)
  }

  // Remove an invitation list
  const removeInvitationList = (listName: string) => {
    if (listName === 'final_decision') {
      throw new Error('Cannot remove the default "final_decision" list')
    }
    const index = availableInvitationLists.value.indexOf(listName)
    if (index > -1) {
      availableInvitationLists.value.splice(index, 1)
      // If we're removing the active list, switch to final_decision
      if (activeInvitationListId.value === listName) {
        activeInvitationListId.value = 'final_decision'
      }
    }
  }

  // Set the active invitation list
  const setActiveInvitationList = (listName: string) => {
    if (!availableInvitationLists.value.includes(listName)) {
      throw new Error('List does not exist')
    }
    activeInvitationListId.value = listName
  }

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

  initializeInvitationLists()

  return {
    availableInvitationLists,
    activeInvitationList: activeInvitationListId,
    addInvitationList,
    removeInvitationList,
    setActiveInvitationList
  }
}
