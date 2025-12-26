<script setup>
import GenealogyTree from './components/GenealogyTree.vue'
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Wedding Planning - Family Tree</h1>
      <p class="instructions">
        Click on any person to edit their details.
        Use the ↑ button to add parents, ↓ button to add children.
        Use the zoom controls to navigate the tree.
      </p>
    </header>
    <GenealogyTree />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f9fafb;
}

.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: white;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  font-size: 24px;
  color: #1f2937;
  margin-bottom: 8px;
}

.app-header .instructions {
  font-size: 14px;
  color: #6b7280;
}
</style>
