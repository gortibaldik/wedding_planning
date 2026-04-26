<script setup>
import { watch, onMounted } from 'vue'
import { useAuth } from './composables/useAuth.ts'
import AuthenticatedApp from './components/AuthenticatedApp.vue'

const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true'

const { checkAuth, isLoggedIn } = useAuth()

const redirectIfUnauthenticated = val => {
  console.info('IS LOGGED IN?', val)
  if (!val && !skipAuth) {
    window.location.href = '/'
  }
}

onMounted(() => {
  checkAuth()
  redirectIfUnauthenticated(isLoggedIn.value)
})

watch(isLoggedIn, redirectIfUnauthenticated)
</script>

<template>
  <Suspense v-if="isLoggedIn || skipAuth">
    <AuthenticatedApp />
  </Suspense>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f9fafb;
}
</style>
