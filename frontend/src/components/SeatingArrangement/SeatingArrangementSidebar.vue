<script lang="ts" setup>
import { ref } from 'vue'
import { useSeatingData } from '@/composables/useSeatingData'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'

const { unseatedGuests, unassignGuest, isSeatingOwner } = useSeatingData()

const collapsed = ref(false)

const onGuestDragStart = (e: DragEvent, guestId: string): void => {
  e.dataTransfer!.setData('text/guest-id', guestId)
  e.dataTransfer!.effectAllowed = 'move'

  // Create a smaller drag image
  const el = e.target as HTMLElement
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.transform = 'scale(0.6)'
  clone.style.transformOrigin = 'top left'
  clone.style.position = 'absolute'
  clone.style.top = '-9999px'
  document.body.appendChild(clone)
  e.dataTransfer!.setDragImage(clone, 0, 0)
  requestAnimationFrame(() => document.body.removeChild(clone))
}

const onSidebarDrop = (e: DragEvent): void => {
  if (!isSeatingOwner.value) return
  const guestId = e.dataTransfer!.getData('text/guest-id')
  if (guestId) {
    unassignGuest(guestId)
  }
}

const onSidebarDragOver = (e: DragEvent): void => {
  if (!isSeatingOwner.value) return
  e.preventDefault()
}
</script>

<template>
  <div
    class="seating-sidebar"
    :class="{ 'seating-sidebar--collapsed': collapsed }"
    @drop="onSidebarDrop"
    @dragover="onSidebarDragOver"
  >
    <button class="seating-sidebar__toggle" @click="collapsed = !collapsed">
      <span class="seating-sidebar__toggle-icon">{{ collapsed ? '&#9664;' : '&#9654;' }}</span>
      <template v-if="collapsed">
        <span class="seating-sidebar__toggle-label">Unseated</span>
        <span class="seating-sidebar__counter">{{ unseatedGuests.length }}</span>
      </template>
    </button>
    <template v-if="!collapsed">
      <div class="seating-sidebar__header">
        <h3 class="seating-sidebar__title">Unseated Guests</h3>
        <div class="seating-sidebar__counter">{{ unseatedGuests.length }}</div>
      </div>
      <div class="seating-sidebar__list">
        <div v-if="unseatedGuests.length === 0" class="seating-sidebar__empty">
          All guests are seated!
        </div>
        <div
          v-for="guestId in unseatedGuests"
          :key="guestId"
          :draggable="isSeatingOwner"
          @dragstart="isSeatingOwner && onGuestDragStart($event, guestId)"
        >
          <PersonInfoDisplay :person-id="guestId" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.seating-sidebar {
  width: 300px;
  background: white;
  border-left: 1px solid #e5e7eb;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s ease;
}

.seating-sidebar--collapsed {
  width: 48px;
}

.seating-sidebar__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: none;
  border: none;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  color: #6b7280;
  font-size: 12px;
}

.seating-sidebar__toggle:hover {
  background: #f9fafb;
}

.seating-sidebar__toggle-icon {
  flex-shrink: 0;
  font-size: 10px;
}

.seating-sidebar--collapsed .seating-sidebar__toggle {
  flex-direction: column;
  border-bottom: none;
  padding: 12px 4px;
}

.seating-sidebar__toggle-label {
  writing-mode: vertical-rl;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.seating-sidebar__header {
  padding: 20px;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.seating-sidebar__title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.seating-sidebar__counter {
  background: #3b82f6;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}

.seating-sidebar--collapsed .seating-sidebar__counter {
  padding: 2px 8px;
  font-size: 12px;
}

.seating-sidebar__list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.seating-sidebar__empty {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  padding: 40px 20px;
}
</style>
