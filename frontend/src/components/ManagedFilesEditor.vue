<script setup lang="ts">
import { onMounted } from 'vue'
import { useManagedFiles } from '@/composables/useManagedFiles'
import ManagedFilesNodeEditor from './ManagedFilesNodeEditor.vue'

const {
  langs,
  defaultLang,
  selectedLang,
  currentDoc,
  loading,
  saving,
  errorMsg,
  isDirty,
  loadAll,
  revert,
  save,
  updateAtPath,
  moveInArray
} = useManagedFiles()

onMounted(loadAll)
</script>

<template>
  <div class="mf">
    <div class="mf__controls">
      <div class="mf__select-group">
        <label class="mf__label">Language file</label>
        <select v-model="selectedLang" class="mf__select" :disabled="loading">
          <option v-for="l in langs" :key="l" :value="l">
            {{ l }}{{ l === defaultLang ? ' (default)' : '' }}
          </option>
        </select>
      </div>

      <div class="mf__btn-group">
        <button
          class="mf__save-btn"
          :class="{ 'mf__save-btn--disabled': !isDirty || saving }"
          :disabled="!isDirty || saving"
          @click="save"
        >
          {{ saving ? 'Saving...' : `Save ${selectedLang}.json` }}
        </button>
        <button
          class="mf__revert-btn"
          :class="{ 'mf__revert-btn--disabled': !isDirty }"
          :disabled="!isDirty"
          @click="revert"
        >
          Revert
        </button>
        <button class="mf__reload-btn" :disabled="loading || saving" @click="loadAll">
          Reload
        </button>
      </div>
    </div>

    <div v-if="errorMsg" class="mf__error">{{ errorMsg }}</div>
    <div v-if="loading" class="mf__loading">Loading...</div>

    <div v-if="!loading && selectedLang && currentDoc" class="mf__editor">
      <ManagedFilesNodeEditor :value="currentDoc" @update="updateAtPath" @move="moveInArray" />
    </div>
  </div>
</template>

<style scoped>
.mf {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f9fafb;
}

.mf__controls {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
  background: white;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.mf__select-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 180px;
}

.mf__label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.mf__select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #1f2937;
  cursor: pointer;
}

.mf__select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.mf__btn-group {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.mf__save-btn,
.mf__revert-btn,
.mf__reload-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.mf__save-btn {
  color: white;
  background: #3b82f6;
}

.mf__save-btn:hover:not(:disabled) {
  background: #2563eb;
}

.mf__save-btn--disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.mf__revert-btn {
  color: #374151;
  background: #e5e7eb;
}

.mf__revert-btn:hover:not(:disabled) {
  background: #d1d5db;
}

.mf__revert-btn--disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.mf__reload-btn {
  color: #374151;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.mf__reload-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.mf__loading {
  text-align: center;
  color: #6b7280;
  padding: 24px;
  font-size: 14px;
}

.mf__error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
}

.mf__editor {
  background: white;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 16px;
}

@media (max-width: 768px) {
  .mf {
    padding: 12px;
  }
}
</style>
