<script setup>
const login = () => {
  window.location.href = '/auth/google'
}
</script>

<template>
  <div class="login-screen">
    <div class="login-content">
      <h1 class="wedding-title">Svadba Eugenie a Františka</h1>
      <h2 class="wedding-date">10.10.2026</h2>
      <button class="login-btn" @click="login">Prihlásiť sa</button>
    </div>
  </div>
</template>

<style scoped>
.login-screen {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
}

.login-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.wedding-title {
  font-size: 36px;
  color: #1f2937;
  font-weight: 600;
  text-align: center;
}

.wedding-date {
  font-size: 24px;
  color: #6b7280;
  font-weight: 400;
  text-align: center;
}

.login-btn {
  margin-top: 24px;
  padding: 12px 32px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.login-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.login-btn:active {
  transform: translateY(0);
}
</style>
