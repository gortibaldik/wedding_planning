import { useAuth } from './useAuth'

const { buildHeaders } = useAuth()

export function useBackendStorage(endpoint: string) {
  const saveToBackendStorage = async (data: { [key: string]: any }) => {
    try {
      const res = await fetch(`${endpoint}/set`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        console.warn(`Failed to save to '${endpoint}' -> ${res.status}`)
      }
    } catch (e) {
      console.warn(`Could not save (${endpoint}) -> ${e}`)
    }
  }

  const loadFromBackendStorage = async () => {
    try {
      const res = await fetch(`${endpoint}/get`, {
        headers: buildHeaders()
      })
      if (res.ok) {
        console.info('GOT', res)
        const data = await res.json()
        if (data) {
          console.info('RETRIEVED', data)
          return data
        }
        console.warn(`No data returned from ${endpoint}/get`)
      }
    } catch (e) {
      console.warn(`Caught error ${e} when calling '${endpoint}/get'`)
    }
  }

  const fetchStatus = async (): Promise<string> => {
    try {
      const res = await fetch(`${endpoint}/get-status`, {
        headers: buildHeaders()
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn(`Failed to fetch status (${endpoint}) -> ${e}`)
    }
    return 'read'
  }

  const toggleStatus = async (): Promise<string> => {
    try {
      const res = await fetch(`${endpoint}/change-status`, {
        method: 'POST',
        headers: buildHeaders()
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn(`Failed to toggle status (${endpoint}) -> ${e}`)
    }
    return 'read'
  }

  return { saveToBackendStorage, loadFromBackendStorage, fetchStatus, toggleStatus }
}
