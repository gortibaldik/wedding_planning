<script setup>
import GenealogyTree from './components/GenealogyTree.vue'
import { useGenealogyData } from './composables/useGenealogyData'
import { useSidebarState } from './composables/useSidebarState'

const { nodes, edges } = useGenealogyData()
const { sidebarCollapsed } = useSidebarState()

const handleExport = () => {
  const data = {
    nodes: nodes.value,
    edges: edges.value
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `genealogy-tree-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const handleImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'

  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)

        if (!data.nodes || !data.edges) {
          alert('Invalid file format. The file must contain "nodes" and "edges" properties.')
          return
        }

        if (confirm('Import this file? This will replace your current genealogy tree.')) {
          nodes.value = data.nodes
          edges.value = data.edges
        }
      } catch (error) {
        alert('Error reading file: ' + error.message)
      }
    }
    reader.readAsText(file)
  }

  input.click()
}
</script>

<template>
  <div class="app">
    <header class="app-header" :style="{ width: sidebarCollapsed ? '100%' : 'calc(100% - 300px)' }">
      <div class="header-content">
        <div class="header-spacer"></div>
        <div class="header-center">
          <h1>Wedding Planning - Family Tree</h1>
          <p class="instructions">
            Click on any person to edit their details.
            Use the ↑ button to add parents, ↓ button to add children.
            Use the zoom controls to navigate the tree.
          </p>
        </div>
        <div class="header-buttons">
          <button class="square-btn export-btn" @click="handleExport" title="Export tree to JSON file">⬇</button>
          <button class="square-btn import-btn" @click="handleImport" title="Import tree from JSON file">⬆</button>
        </div>
      </div>
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
  transition: width 0.3s ease;
}

.header-content {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
}

.header-spacer {
  width: 100%;
}

.header-center {
  text-align: center;
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

.header-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.square-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 8px;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.export-btn {
  background: #3b82f6;
  color: white;
}

.export-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.import-btn {
  background: #10b981;
  color: white;
}

.import-btn:hover {
  background: #059669;
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
  transform: translateY(-2px);
}

.square-btn:active {
  transform: translateY(0);
}
</style>
