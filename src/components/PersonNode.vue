<template>
  <div
    class="person-node"
    :style="{ '--node-color': data.color || '#3b82f6' }"
    @click="data.onEdit?.(id)"
  >
    <Handle type="target" :position="Position.Top" />

    <div class="person-node__content">
      <div class="person-node__name">{{ data.name }}</div>
      <div class="person-node__role">{{ data.role }}</div>
    </div>

    <div class="person-node__actions">
      <button
        class="action-btn action-btn--parent"
        @click.stop="data.onAddParent?.(id)"
        title="Add parent"
      >
        ↑
      </button>
      <button
        class="action-btn action-btn--child"
        @click.stop="data.onAddChild?.(id)"
        title="Add child"
      >
        ↓
      </button>
      <button
        class="action-btn action-btn--remove"
        @click.stop="data.onRemove?.(id)"
        title="Remove person"
      >
        ✕
      </button>
    </div>

    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  id: String,
  data: Object
})
</script>

<style scoped>
.person-node {
  padding: 16px;
  border-radius: 8px;
  border: 2px solid var(--node-color, #3b82f6);
  background: white;
  min-width: 150px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
}

.person-node::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--node-color, #3b82f6);
  opacity: 0.08;
  border-radius: 6px;
  pointer-events: none;
}

.person-node:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.person-node:hover::before {
  opacity: 0.12;
}

.person-node__content {
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}

.person-node__name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: #1f2937;
}

.person-node__role {
  font-size: 12px;
  color: #6b7280;
  text-transform: capitalize;
}

.person-node__actions {
  display: flex;
  gap: 4px;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.action-btn {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

.action-btn--parent:hover {
  background: #dbeafe;
  border-color: #3b82f6;
}

.action-btn--child:hover {
  background: #d1fae5;
  border-color: #10b981;
}

.action-btn--remove:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}
</style>
