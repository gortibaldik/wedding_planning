import { useAuth, buildHeaders } from './useAuth'

const { getToken } = useAuth()

export function useBackendStorage(endpoint: string) {
  const token = getToken()

  const saveToBackendStorage = async (data: { [key: string]: any }) => {
    try {
      const res = await fetch(`${endpoint}/set`, {
        method: 'POST',
        headers: buildHeaders(token),
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
        headers: buildHeaders(token)
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

  return { saveToBackendStorage, loadFromBackendStorage }
}
