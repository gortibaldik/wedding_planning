const TOKEN_KEY = 'auth_token'

export function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export function useAuth() {
  const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

  const checkAuth = (): boolean => {
    if (import.meta.env.VITE_SKIP_AUTH === 'true') {
      return true
    }

    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')

    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken)
      window.history.replaceState({}, '', '/')
      return true
    }

    return !!getToken()
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
  }

  const getRoles = (): string[] => {
    const token = getToken()
    if (!token) return []
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.roles || []
    } catch {
      return []
    }
  }

  return { checkAuth, getToken, getRoles, logout }
}
