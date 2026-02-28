<script setup>
import { useSidebarState } from '../composables/useSidebarState'

const props = defineProps({
  guests: {
    type: Array,
    required: true
  },
  getGroupName: {
    type: Function,
    required: true
  },
  getTableAssignment: {
    type: Function,
    required: true
  }
})

const { sidebarCollapsed, toggleSidebar } = useSidebarState()
</script>

<template>
  <div class="guest-sidebar" :class="{ 'guest-sidebar--collapsed': sidebarCollapsed }">
    <button
      class="guest-sidebar__toggle"
      :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggleSidebar"
    >
      {{ sidebarCollapsed ? '◀' : '▶' }}
    </button>
    <div class="guest-sidebar__content">
      <div class="guest-sidebar__header">
        <h3 class="guest-sidebar__title">Invited Guests</h3>
        <div class="guest-sidebar__counter">
          {{ guests.length }}
        </div>
      </div>
      <div class="guest-sidebar__list">
        <div v-if="guests.length === 0" class="guest-sidebar__empty">No guests invited yet</div>
        <div
          v-for="guest in guests"
          :key="guest.id"
          class="guest-sidebar__item"
          :style="{ borderLeft: `4px solid ${guest.data.color}` }"
        >
          <div class="guest-sidebar__item-name">
            {{ guest.data.name }}
            <span v-if="guest.isMultiPerson" class="guest-sidebar__badge">
              {{ guest.groupName }}
            </span>
          </div>
          <div class="guest-sidebar__item-group">
            {{ getGroupName(guest.id) }}
          </div>
          <div
            class="guest-sidebar__item-table"
            :class="{ 'guest-sidebar__item-table--warning': !getTableAssignment(guest.id) }"
          >
            {{
              getTableAssignment(guest.id)
                ? `Seated at ${getTableAssignment(guest.id)}`
                : 'Not seated yet'
            }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guest-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: white;
  border-left: 1px solid #e5e7eb;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease;
  z-index: 10;
  display: flex;
}

.guest-sidebar--collapsed {
  transform: translateX(100%);
}

.guest-sidebar__toggle {
  position: absolute;
  left: -40px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 80px;
  background: white;
  border: 1px solid #e5e7eb;
  border-right: none;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.05);
  z-index: 11;
}

.guest-sidebar__toggle:hover {
  background: #f9fafb;
}

.guest-sidebar__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.guest-sidebar__header {
  padding: 20px;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.guest-sidebar__title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.guest-sidebar__counter {
  background: #3b82f6;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}

.guest-sidebar__list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.guest-sidebar__item {
  background: white;
  border: 1px solid #e5e7eb;
  border-left: 4px solid;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.guest-sidebar__item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateX(-4px);
}

.guest-sidebar__item-name {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
  margin-bottom: 2px;
}

.guest-sidebar__item-group {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 400;
  margin-bottom: 2px;
}

.guest-sidebar__item-table {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 400;
  font-style: italic;
}

.guest-sidebar__item-table--warning {
  color: #d97706;
  font-weight: 500;
}

.guest-sidebar__empty {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  padding: 40px 20px;
}

.guest-sidebar__badge {
  display: inline-block;
  padding: 2px 6px;
  margin-left: 6px;
  font-size: 9px;
  background: rgba(59, 130, 246, 0.2);
  color: #1e40af;
  border-radius: 3px;
  font-weight: 600;
}
</style>
