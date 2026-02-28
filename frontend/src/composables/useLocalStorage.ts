export function useLocalStorage(storageKey: string) {
  function saveToLocalStorage(data: { [key: string]: any }) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save table seating data to localStorage:', error)
    }
  }

  function loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        return data
      }
    } catch (error) {
      console.error('Failed to load table seating data from localStorage:', error)
    }
    return null
  }

  return { saveToLocalStorage, loadFromLocalStorage }
}
