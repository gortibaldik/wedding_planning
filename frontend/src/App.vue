<script setup>
console.info('RUNING SETUP FOR APP')
import { ref, onMounted } from 'vue'
import { useAuth } from './composables/useAuth.ts'
import LandingPage from './components/LandingPage.vue'
import AuthenticatedApp from './components/AuthenticatedApp.vue'

const { checkAuth, isLoggedIn } = useAuth()

onMounted(() => {
  checkAuth()
})
</script>

<template>
  <LandingPage v-if="!isLoggedIn" />
  <Suspense v-else>
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
