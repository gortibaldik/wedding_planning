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

  return { checkAuth, getToken, logout }
}
