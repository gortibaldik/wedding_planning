<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  id: String,
  data: Object
})
</script>

<template>
  <div
    class="person-node"
    :style="{ '--node-color': data.color || '#3b82f6' }"
    @click="data.onEdit?.(id)"
  >
    <Handle type="target" :position="Position.Top" />

    <div class="person-node__content">
      <!-- Single Person Display -->
      <div v-if="data.role === 'person'">
        <div class="person-node__header">
          <div class="person-node__name">{{ data.name }}</div>
          <div class="person-node__role">{{ data.role }}</div>
        </div>

        <!-- Checkboxes below role -->
        <div class="person-node__checkboxes">
          <label class="person-node__checkbox-row" @click.stop>
            <input
              type="checkbox"
              :checked="data.invited"
              class="person-node__checkbox"
              @change="data.onToggleInvited?.(id)"
            />
            <span class="person-node__checkbox-label">Invited?</span>
          </label>

          <label v-if="data.hasChildren" class="person-node__checkbox-row" @click.stop>
            <input
              type="checkbox"
              class="person-node__checkbox"
              @change="data.onToggleSubtreeInvited?.(id)"
            />
            <span class="person-node__checkbox-label">Invite whole subtree?</span>
          </label>
        </div>
      </div>

      <!-- Multi-Person Display -->
      <div v-else-if="data.role === 'multi-person'">
        <div class="person-node__header">
          <div class="person-node__name">{{ data.name }}</div>
          <div class="person-node__role">Multi-person ({{ data.people.length }})</div>
        </div>

        <!-- Checkboxes below role -->
        <div v-if="data.people.length > 0" class="person-node__checkboxes">
          <label class="person-node__checkbox-row" @click.stop>
            <input
              type="checkbox"
              :checked="data.allInvited"
              :indeterminate.prop="data.someInvited"
              class="person-node__checkbox-master"
              @change="data.onToggleAllInvited?.(id)"
            />
            <span class="person-node__checkbox-label">Invite all?</span>
          </label>

          <label v-if="data.hasChildren" class="person-node__checkbox-row" @click.stop>
            <input
              type="checkbox"
              class="person-node__checkbox"
              @change="data.onToggleSubtreeInvited?.(id)"
            />
            <span class="person-node__checkbox-label">Invite whole subtree?</span>
          </label>
        </div>

        <!-- Individual People List -->
        <div v-if="data.people.length > 0" class="person-node__people-list">
          <div
            v-for="person in data.people"
            :key="person.id"
            class="person-node__person-item"
            @click.stop
          >
            <span class="person-node__person-name">{{ person.name }}</span>
            <input
              type="checkbox"
              :checked="person.invited"
              class="person-node__checkbox-small"
              @change="data.onTogglePersonInvited?.(id, person.id)"
            />
          </div>
        </div>
        <div v-else class="person-node__empty-hint">Click to add people</div>
      </div>

      <!-- Group Display -->
      <div v-else>
        <div class="person-node__header">
          <div class="person-node__name">{{ data.name }}</div>
          <div class="person-node__role">{{ data.role }}</div>
        </div>

        <!-- Checkboxes below role for groups with children -->
        <div v-if="data.hasChildren" class="person-node__checkboxes">
          <label class="person-node__checkbox-row" @click.stop>
            <input
              type="checkbox"
              class="person-node__checkbox"
              @change="data.onToggleSubtreeInvited?.(id)"
            />
            <span class="person-node__checkbox-label">Invite whole subtree?</span>
          </label>
        </div>
      </div>
    </div>

    <div class="person-node__actions">
      <button
        class="action-btn action-btn--child"
        title="Add child"
        @click.stop="data.onAddChild?.(id)"
      >
        ↓
      </button>
      <button
        class="action-btn action-btn--remove"
        title="Remove person"
        @click.stop="data.onRemove?.(id)"
      >
        ✕
      </button>
    </div>

    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

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

.person-node__header {
  margin-bottom: 8px;
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
  margin-bottom: 8px;
}

.person-node__checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.person-node__checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.person-node__checkbox-row:hover {
  background: rgba(0, 0, 0, 0.03);
}

.person-node__checkbox-label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  user-select: none;
}

.person-node__checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--node-color, #3b82f6);
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

/* Multi-person node styles */
.person-node__people-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.person-node__person-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

.person-node__person-name {
  font-size: 12px;
  color: #374151;
  flex: 1;
}

.person-node__checkbox-small {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--node-color, #3b82f6);
}

.person-node__checkbox-master {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--node-color, #3b82f6);
}

.person-node__empty-hint {
  font-size: 11px;
  color: #9ca3af;
  font-style: italic;
  text-align: center;
  padding: 8px;
  margin-bottom: 8px;
}
</style>
