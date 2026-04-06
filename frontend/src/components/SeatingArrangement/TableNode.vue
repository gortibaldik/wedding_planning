<script lang="ts" setup>
import { ref, computed, type CSSProperties } from 'vue'
import type { Table } from '@/composables/useSeatingData'
import { useTouchDragDrop } from '@/composables/useTouchDragDrop'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'

interface AssignGuestEvent {
  guestId: string
  tableId: string
  seatIndex: number
}

const props = defineProps<{
  table: Table
  editable: boolean
  guestDragActive: boolean
}>()
const emit = defineEmits<{
  'assign-guest': [event: AssignGuestEvent]
  'unassign-guest': [guestId: string]
  'remove-table': [tableId: string]
}>()

const { onTouchStart } = useTouchDragDrop()
const dragOverSeat = ref<number | null>(null)

interface Position {
  x: number
  y: number
}

const SEAT_WIDTH = 130
const SEAT_HEIGHT = 80
const SEAT_GAP = 16
const PADDING = 20

const seatPositions = computed<Position[]>(() => {
  const { shape, seats } = props.table
  const positions: Position[] = []

  if (shape === 'circular') {
    const radius = 90 + seats * 14
    const centerX = radius + SEAT_WIDTH / 2 + PADDING
    const centerY = radius + SEAT_HEIGHT / 2 + PADDING + 24
    for (let i = 0; i < seats; i++) {
      const angle = (2 * Math.PI * i) / seats - Math.PI / 2
      positions.push({
        x: centerX + radius * Math.cos(angle) - SEAT_WIDTH / 2,
        y: centerY + radius * Math.sin(angle) - SEAT_HEIGHT / 2
      })
    }
  } else {
    const topCount = Math.ceil(seats / 2)
    const bottomCount = seats - topCount
    const seatsRowWidth = Math.max(topCount, bottomCount) * (SEAT_WIDTH + SEAT_GAP) - SEAT_GAP
    const tableHeight = 80

    for (let i = 0; i < topCount; i++) {
      positions.push({
        x: PADDING + (i * (seatsRowWidth - SEAT_WIDTH)) / Math.max(topCount - 1, 1),
        y: PADDING + 28
      })
    }
    for (let i = 0; i < bottomCount; i++) {
      positions.push({
        x: PADDING + (i * (seatsRowWidth - SEAT_WIDTH)) / Math.max(bottomCount - 1, 1),
        y: PADDING + 28 + SEAT_HEIGHT + tableHeight + SEAT_GAP
      })
    }
  }

  return positions
})

const containerSize = computed<{ width: number; height: number }>(() => {
  const { shape, seats } = props.table
  if (shape === 'circular') {
    const radius = 90 + seats * 14
    const size = (radius + SEAT_WIDTH / 2 + PADDING) * 2 + PADDING
    return { width: size, height: size + 24 }
  } else {
    const topCount = Math.ceil(seats / 2)
    const bottomCount = seats - topCount
    const seatsRowWidth = Math.max(topCount, bottomCount) * (SEAT_WIDTH + SEAT_GAP) - SEAT_GAP
    const tableHeight = 80
    const totalHeight =
      PADDING * 2 + 28 + SEAT_HEIGHT + tableHeight + SEAT_GAP + SEAT_HEIGHT + PADDING
    return { width: seatsRowWidth + PADDING * 2, height: totalHeight }
  }
})

const tableHeaderStyle = computed<CSSProperties>(() => {
  const { shape, seats } = props.table
  if (shape === 'circular') {
    const radius = 90 + seats * 14
    const centerX = radius + SEAT_WIDTH / 2 + PADDING
    const centerY = radius + SEAT_HEIGHT / 2 + PADDING + 24
    return {
      position: 'absolute',
      left: `${centerX}px`,
      top: `${centerY}px`,
      transform: 'translate(-50%, -50%)'
    }
  } else {
    const topCount = Math.ceil(seats / 2)
    const bottomCount = seats - topCount
    const seatsRowWidth = Math.max(topCount, bottomCount) * (SEAT_WIDTH + SEAT_GAP) - SEAT_GAP
    const tableHeight = 80
    const tableCenterX = PADDING + seatsRowWidth / 2
    const tableCenterY = PADDING + 28 + SEAT_HEIGHT + SEAT_GAP / 2 + tableHeight / 2
    return {
      position: 'absolute',
      left: `${tableCenterX}px`,
      top: `${tableCenterY}px`,
      transform: 'translate(-50%, -50%)'
    }
  }
})

const tableShapeStyle = computed<CSSProperties>(() => {
  const { shape, seats } = props.table
  if (shape === 'circular') {
    const radius = 90 + seats * 14
    const size = radius * 1.3
    const centerX = radius + SEAT_WIDTH / 2 + PADDING
    const centerY = radius + SEAT_HEIGHT / 2 + PADDING + 24
    return {
      position: 'absolute',
      left: `${centerX - size / 2}px`,
      top: `${centerY - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%'
    }
  } else {
    const topCount = Math.ceil(seats / 2)
    const bottomCount = seats - topCount
    const seatsRowWidth = Math.max(topCount, bottomCount) * (SEAT_WIDTH + SEAT_GAP) - SEAT_GAP
    const tableHeight = 80
    return {
      position: 'absolute',
      left: `${PADDING}px`,
      top: `${PADDING + 28 + SEAT_HEIGHT + SEAT_GAP / 2}px`,
      width: `${seatsRowWidth}px`,
      height: `${tableHeight}px`,
      borderRadius: '8px'
    }
  }
})

const onSeatDragOver = (e: DragEvent, index: number): void => {
  if (!props.editable) return
  if (!props.table.guests[index]) {
    e.preventDefault()
    dragOverSeat.value = index
  }
}

const onSeatDragLeave = (): void => {
  dragOverSeat.value = null
}

const onSeatDrop = (e: DragEvent, index: number): void => {
  dragOverSeat.value = null
  const guestId = e.dataTransfer!.getData('text/guest-id')
  if (guestId) {
    emit('assign-guest', { guestId, tableId: props.table.id, seatIndex: index })
  }
}

const onGuestDragStart = (e: DragEvent, guestId: string): void => {
  e.dataTransfer!.setData('text/guest-id', guestId)
  e.dataTransfer!.effectAllowed = 'move'

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

const handleUnassign = (guestId: string): void => {
  emit('unassign-guest', guestId)
}
</script>

<template>
  <div
    class="table-node"
    :style="{ width: containerSize.width + 'px', height: containerSize.height + 'px' }"
  >
    <div class="table-shape" :style="tableShapeStyle" />

    <div class="table-header" :style="tableHeaderStyle">
      <span class="table-name">{{ table.name }}</span>
      <button
        v-if="editable"
        class="table-remove"
        title="Remove table"
        @click="emit('remove-table', table.id)"
      >
        &times;
      </button>
    </div>

    <div
      v-for="(pos, index) in seatPositions"
      :key="index"
      class="seat"
      :class="{
        'seat--occupied': table.guests[index],
        'seat--drag-over': dragOverSeat === index,
        'seat--drop-target': guestDragActive && !table.guests[index]
      }"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      :data-drop-seat="!table.guests[index] && editable ? `${table.id}:${index}` : undefined"
      @dragover="onSeatDragOver($event, index)"
      @dragleave="onSeatDragLeave"
      @drop="onSeatDrop($event, index)"
    >
      <template v-if="table.guests[index]">
        <div
          class="seat__guest"
          :draggable="editable"
          @dragstart="editable && onGuestDragStart($event, table.guests[index]!)"
          @touchstart="editable && onTouchStart($event, table.guests[index]!)"
        >
          <PersonInfoDisplay :person-id="table.guests[index]!" />
        </div>
        <button
          v-if="editable"
          class="seat__remove"
          title="Remove from seat"
          @click="handleUnassign(table.guests[index]!)"
        >
          &times;
        </button>
      </template>
      <span v-else class="seat__empty">{{ index + 1 }}</span>
    </div>
  </div>
</template>

<style scoped>
.table-node {
  position: relative;
  user-select: none;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: grab;
  z-index: 1;
  white-space: nowrap;
}

.table-header:active {
  cursor: grabbing;
}

.table-name {
  font-weight: 600;
  font-size: 15px;
  color: #1e3a5f;
}

.table-remove {
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  padding: 2px 6px;
  transition: all 0.15s;
}

.table-remove:hover {
  color: #ef4444;
  border-color: #fca5a5;
  background: #fef2f2;
}

.table-shape {
  background: #dbeafe;
  border: 2px solid #93c5fd;
}

.seat {
  position: absolute;
  width: 130px;
  min-height: 60px;
  max-height: 80px;
  border-radius: 8px;
  background: white;
  border: 2px solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  transition: all 0.15s;
  overflow: hidden;
}

.seat--occupied {
  border: none;
  background: transparent;
  padding: 0;
}

.seat--drop-target {
  border: 2px dashed #3b82f6;
  background: #eff6ff;
  animation: pulse-seat 1.2s ease-in-out infinite;
}

@keyframes pulse-seat {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(59, 130, 246, 0);
  }
}

.seat--drag-over {
  border-color: #10b981;
  background: #d1fae5;
  transform: scale(1.05);
}

.seat__guest {
  width: 100%;
  cursor: grab;
}

.seat__guest:active {
  cursor: grabbing;
}

.seat__guest :deep(.person__item) {
  padding: 6px 10px;
  margin-bottom: 0;
  border-radius: 8px;
}

.seat__guest :deep(.person__item-name) {
  font-size: 12px;
  margin-bottom: 1px;
}

.seat__guest :deep(.it__person-name) {
  font-size: 12px;
}

.seat__guest :deep(.it__person-group) {
  font-size: 10px;
}

.seat__guest :deep(.guest-sidebar__item-group) {
  font-size: 10px;
  margin-bottom: 0;
}

.seat__remove {
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.8);
  border: none;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  border-radius: 0 8px 0 4px;
  z-index: 1;
}

.seat__remove:hover {
  color: #ef4444;
  background: rgba(255, 255, 255, 0.95);
}

.seat__empty {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
}
</style>
