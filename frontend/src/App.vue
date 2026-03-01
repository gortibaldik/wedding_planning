<script setup>
import { ref, onMounted } from 'vue'
import { useAuth } from './composables/useAuth.ts'
import LoginScreen from './components/LoginScreen.vue'
import AuthenticatedApp from './components/AuthenticatedApp.vue'

const { checkAuth } = useAuth()
const isAuthenticated = ref(false)

onMounted(() => {
  isAuthenticated.value = checkAuth()
})
</script>

<template>
  <LoginScreen v-if="!isAuthenticated" />
  <AuthenticatedApp v-else @logout="isAuthenticated = false" />
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
