<script setup>
import { computed } from 'vue'
import { useStoredData } from '@/composables/useStoredData'
import { useSidebarState } from '@/composables/useSidebarState'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'

const { people } = useStoredData()

const { sidebarCollapsed, toggleSidebar } = useSidebarState()

const guestIds = computed(() => {
  return Object.entries(people.value)
    .filter(([, person]) => person.invited)
    .map(([id]) => id)
})
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
          {{ guestIds.length }}
        </div>
      </div>
      <div class="guest-sidebar__list">
        <div v-if="guestIds.length === 0" class="guest-sidebar__empty">No guests invited yet</div>
        <PersonInfoDisplay v-for="guestId in guestIds" :key="guestId" :person-id="guestId" />
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

.guest-sidebar__empty {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  padding: 40px 20px;
}
</style>
