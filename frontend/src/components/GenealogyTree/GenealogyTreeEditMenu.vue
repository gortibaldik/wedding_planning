<script setup>
import { ref, computed } from 'vue'
import { useSidebarState } from '@/composables/useSidebarState'
import { useAuth } from '@/composables/useAuth'
import InvitationListEditMenu from '@/components/InvitationListEditMenu.vue'

const props = defineProps({
  status: { type: String, required: true },
  readOnly: { type: Boolean, required: true },
  familyStructureUnsync: { type: Boolean, required: true }
})

const emit = defineEmits([
  'update:readOnly',
  'toggle-status',
  'add-root',
  'save',
  'import',
  'export',
  'clear-all'
])

const { sidebarCollapsed } = useSidebarState()
const toolbarOpen = ref(false)

const { storedUserInfo } = useAuth()
const canChangeStatus = computed(() =>
  storedUserInfo.value.roles.includes('change-genealogy-tree-rw-status')
)
</script>

<template>
  <div class="toolbar" :style="{ right: sidebarCollapsed ? '16px' : '316px' }">
    <!-- Expanded panel -->
    <transition name="toolbar-slide">
      <div v-if="toolbarOpen" class="toolbar__panel">
        <!-- Read-Only badge (when fully read-only with no ability to change) -->
        <div v-if="status !== 'read-write' && !canChangeStatus" class="toolbar__read-only-badge">
          Read-Only
        </div>

        <!-- Mode section -->
        <div v-if="status === 'read-write' || canChangeStatus" class="toolbar__section">
          <div class="toolbar__section-title">Mode</div>

          <label v-if="status === 'read-write'" class="toolbar__toggle">
            <input
              type="checkbox"
              :checked="readOnly"
              class="toolbar__toggle-input"
              @change="emit('update:readOnly', $event.target.checked)"
            />
            <span class="toolbar__toggle-track">
              <span class="toolbar__toggle-thumb" />
            </span>
            <span class="toolbar__toggle-label">Read-Only</span>
          </label>

          <button
            v-if="canChangeStatus"
            class="toolbar__btn toolbar__btn--status"
            :class="{ 'toolbar__btn--status-active': status === 'read-write' }"
            @click="emit('toggle-status')"
          >
            {{ status === 'read-write' ? 'Set Read-Only' : 'Set Read-Write' }}
          </button>
        </div>

        <!-- Edit actions (only when not read-only) -->
        <div v-if="!readOnly" class="toolbar__section">
          <div class="toolbar__section-title">Actions</div>

          <button class="toolbar__btn toolbar__btn--add" @click="emit('add-root')">
            + Add Root
          </button>

          <button
            class="toolbar__btn toolbar__btn--save"
            :class="{ 'toolbar__btn--disabled': !familyStructureUnsync }"
            :disabled="!familyStructureUnsync"
            @click="emit('save')"
          >
            Save
          </button>

          <button class="toolbar__btn toolbar__btn--import" @click="emit('import')">Import</button>

          <button class="toolbar__btn toolbar__btn--export" @click="emit('export')">Export</button>

          <button class="toolbar__btn toolbar__btn--clear" @click="emit('clear-all')">
            Clear All
          </button>
        </div>

        <!-- Invitation Lists section -->
        <InvitationListEditMenu />
      </div>
    </transition>

    <!-- FAB toggle button -->
    <button
      class="toolbar__fab"
      :class="{ 'toolbar__fab--open': toolbarOpen }"
      title="Tools"
      @click="toolbarOpen = !toolbarOpen"
    >
      <span class="toolbar__fab-icon" :class="{ 'toolbar__fab-icon--open': toolbarOpen }"
        >&#9881;</span
      >
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  position: fixed;
  bottom: 16px;
  right: 316px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  transition: right 0.3s ease;
}

.toolbar__fab {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: #1f2937;
  color: white;
  font-size: 22px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition:
    background 0.2s,
    transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar__fab:hover {
  background: #374151;
  transform: scale(1.05);
}

.toolbar__fab--open {
  background: #374151;
}

.toolbar__fab-icon {
  display: inline-block;
  transition: transform 0.3s ease;
}

.toolbar__fab-icon--open {
  transform: rotate(90deg);
}

.toolbar__panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 160px;
  max-height: 70vh;
  overflow-y: auto;
}

.toolbar__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toolbar__section + .toolbar__section {
  border-top: 1px solid #e5e7eb;
  padding-top: 10px;
}

.toolbar__read-only-badge {
  padding: 8px 14px;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  text-align: center;
}

.toolbar__section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  padding: 0 4px;
}

.toolbar__btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s,
    opacity 0.15s;
  color: #1f2937;
  background: #f3f4f6;
}

.toolbar__btn:hover {
  background: #e5e7eb;
}

.toolbar__btn--add {
  color: white;
  background: #10b981;
}

.toolbar__btn--add:hover {
  background: #059669;
}

.toolbar__btn--save {
  color: white;
  background: #3b82f6;
}

.toolbar__btn--save:hover:not(:disabled) {
  background: #2563eb;
}

.toolbar__btn--import {
  color: #6d28d9;
  background: #ede9fe;
}

.toolbar__btn--import:hover {
  background: #ddd6fe;
}

.toolbar__btn--export {
  color: #4338ca;
  background: #e0e7ff;
}

.toolbar__btn--export:hover {
  background: #c7d2fe;
}

.toolbar__btn--clear {
  color: #dc2626;
  background: #fef2f2;
}

.toolbar__btn--clear:hover {
  background: #fee2e2;
}

.toolbar__btn--status {
  color: white;
  background: #f59e0b;
}

.toolbar__btn--status:hover {
  background: #d97706;
}

.toolbar__btn--status-active {
  background: #10b981;
}

.toolbar__btn--status-active:hover {
  background: #059669;
}

.toolbar__btn--disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.toolbar__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  cursor: pointer;
  user-select: none;
}

.toolbar__toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.toolbar__toggle-track {
  position: relative;
  width: 36px;
  height: 20px;
  background: #d1d5db;
  border-radius: 10px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toolbar__toggle-input:checked + .toolbar__toggle-track {
  background: #3b82f6;
}

.toolbar__toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.toolbar__toggle-input:checked + .toolbar__toggle-track .toolbar__toggle-thumb {
  transform: translateX(16px);
}

.toolbar__toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  line-height: 1;
}

.toolbar-slide-enter-active,
.toolbar-slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toolbar-slide-enter-from,
.toolbar-slide-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}
</style>
