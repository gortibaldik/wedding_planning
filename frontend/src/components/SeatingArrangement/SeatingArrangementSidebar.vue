<script lang="ts" setup>
import { useSeatingData } from '@/composables/useSeatingData'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'

const { unseatedGuests, unassignGuest, isSeatingOwner } = useSeatingData()

const onGuestDragStart = (e: DragEvent, guestId: string): void => {
  e.dataTransfer!.setData('text/guest-id', guestId)
  e.dataTransfer!.effectAllowed = 'move'
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
  <div class="seating-sidebar" @drop="onSidebarDrop" @dragover="onSidebarDragOver">
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
