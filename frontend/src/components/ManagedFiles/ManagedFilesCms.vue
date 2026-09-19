<script setup lang="ts">
import { toRef } from 'vue'
import type { I18nWorkspace } from '@/composables/useManagedFiles'
import { useI18nEditor, useManagedFiles } from '@/composables/useManagedFiles'
import ManagedFilesNodeEditor from './ManagedFilesNodeEditor.vue'

const props = defineProps<{
  workspace: I18nWorkspace
}>()

const { loading, loadAll } = useManagedFiles()
const {
  selectedLang,
  currentDoc,
  isDirty,
  saving,
  revert,
  save,
  updateAtPath,
  moveInArray,
  insertInArray,
  removeFromArray
} = useI18nEditor(toRef(props, 'workspace'))
</script>

<template>
  <div class="mf__controls">
    <div class="mf__select-group">
      <label class="mf__label">Language file</label>
      <select v-model="selectedLang" class="mf__select" :disabled="loading">
        <option v-for="l in workspace.langs" :key="l" :value="l">
          {{ l }}{{ l === workspace.defaultLang ? ' (default)' : '' }}
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

  <div v-if="!loading" class="mf__editor">
    <ManagedFilesNodeEditor
      :value="currentDoc"
      @update="updateAtPath"
      @move="moveInArray"
      @insert="insertInArray"
      @remove="removeFromArray"
    />
  </div>
</template>

<style scoped>
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

.mf__editor {
  background: white;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 16px;
}
</style>
