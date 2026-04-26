import { ref, computed } from 'vue'

const TOKEN_KEY = 'auth_token'

export interface UserInfo {
  /**
   * Subject of the logged in user -> usually their email
   */
  sub: string

  /**
   * Full name of the logged in user
   */
  name: string

  /**
   * The attributed roles.
   */
  roles: string[]
}

const getUserInfo = (token: string): UserInfo | null => {
  console.info('TRYING TO PARSE TOKEN', token)
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      sub: payload.sub || '',
      name: payload.name || '',
      roles: payload.roles || []
    }
  } catch {
    console.error('ERROR PARSING TOKEN', token)
    return null
  }
}

const storedToken = ref<null | string>(null)
const storedUserInfo = computed(() => getUserInfo(storedToken.value))
const isLoggedIn = computed(() => {
  console.info('storedUserInfo.value', storedUserInfo.value)
  return storedUserInfo.value !== null
})

const isUniversalInvitationListSetter = computed(() => {
  return storedUserInfo.value?.roles?.includes('universal-invitation-list-setter') ?? false
})

export function useAuth() {
  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (storedToken.value) {
      headers['Authorization'] = `Bearer ${storedToken.value}`
    } else {
      console.info('There is no stored token!')
    }
    return headers
  }

  async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = buildHeaders()
    const res = await fetch(input, { ...init, headers: { ...headers, ...init?.headers } })
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      storedToken.value = null
    }
    return res
  }
  const checkAuth = (): boolean => {
    if (import.meta.env.VITE_SKIP_AUTH === 'true') {
      return true
    }

    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')

    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken)
      window.history.replaceState({}, '', '/app')
      storedToken.value = urlToken
      console.info('Loaded stored token from url!', storedToken.value)
      return
    }

    storedToken.value = localStorage.getItem(TOKEN_KEY)
    console.info('Loaded stored token from local storage!', storedToken.value)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    storedToken.value = null
  }

  return {
    checkAuth,
    logout,
    isLoggedIn,
    storedUserInfo,
    buildHeaders,
    authFetch,
    isUniversalInvitationListSetter
  }
}
