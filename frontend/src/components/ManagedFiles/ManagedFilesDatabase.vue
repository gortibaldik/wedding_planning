<script setup lang="ts">
import { useManagedFiles } from '@/composables/useManagedFiles'

const { downloading, previewing, dbErrorMsg, dumpPreview, downloadRedisDump, previewRedisDump } =
  useManagedFiles()
</script>

<template>
  <div class="mf__controls">
    <div class="mf__select-group">
      <label class="mf__label">Redis backup</label>
      <p class="mf__hint">Download a full snapshot of all data currently stored in Redis.</p>
    </div>
    <div class="mf__btn-group">
      <button class="mf__reload-btn" :disabled="downloading || previewing" @click="previewRedisDump">
        {{ previewing ? 'Loading...' : 'Preview' }}
      </button>
      <button class="mf__save-btn" :disabled="downloading || previewing" @click="downloadRedisDump">
        {{ downloading ? 'Downloading...' : 'Download all data' }}
      </button>
    </div>
  </div>
  <div v-if="dbErrorMsg" class="mf__error">{{ dbErrorMsg }}</div>
  <pre v-if="dumpPreview" class="mf__dump">{{ dumpPreview }}</pre>
</template>

<style scoped>
.mf__hint {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.mf__dump {
  background: #1f2937;
  color: #e5e7eb;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 16px;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  white-space: pre;
  overflow: auto;
  max-height: 60vh;
}
</style>
