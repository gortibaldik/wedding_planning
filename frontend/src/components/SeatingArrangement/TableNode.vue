<script lang="ts" setup>
import { ref, computed, type CSSProperties } from 'vue'
import { useInvitationLists } from '@/composables/useInvitationLists'
import type { Table } from '@/composables/useSeatingData'

interface AssignGuestEvent {
  guestId: string
  tableId: string
  seatIndex: number
}

const props = defineProps<{
  table: Table
  editable: boolean
}>()
const emit = defineEmits<{
  'assign-guest': [event: AssignGuestEvent]
  'unassign-guest': [guestId: string]
  'remove-table': [tableId: string]
}>()

const { getPersonName } = useInvitationLists()

const dragOverSeat = ref<number | null>(null)

interface Position {
  x: number
  y: number
}

const seatPositions = computed<Position[]>(() => {
  const { shape, seats } = props.table
  const positions: Position[] = []

  if (shape === 'circular') {
    const radius = 60 + seats * 5
    const centerX = radius + 30
    const centerY = radius + 40
    for (let i = 0; i < seats; i++) {
      const angle = (2 * Math.PI * i) / seats - Math.PI / 2
      positions.push({
        x: centerX + radius * Math.cos(angle) - 20,
        y: centerY + radius * Math.sin(angle) - 14
      })
    }
  } else {
    const cols = Math.ceil(seats / 2)
    const tableWidth = Math.max(cols * 60, 120)
    const tableHeight = 80

    const topCount = Math.ceil(seats / 2)
    const bottomCount = seats - topCount

    for (let i = 0; i < topCount; i++) {
      positions.push({
        x: 20 + (i * (tableWidth - 40)) / Math.max(topCount - 1, 1),
        y: 30
      })
    }
    for (let i = 0; i < bottomCount; i++) {
      positions.push({
        x: 20 + (i * (tableWidth - 40)) / Math.max(bottomCount - 1, 1),
        y: tableHeight + 60
      })
    }
  }

  return positions
})

const containerSize = computed<{ width: number; height: number }>(() => {
  const { shape, seats } = props.table
  if (shape === 'circular') {
    const radius = 60 + seats * 5
    const size = (radius + 30) * 2 + 28
    return { width: size, height: size }
  } else {
    const cols = Math.ceil(seats / 2)
    const tableWidth = Math.max(cols * 60, 120)
    return { width: tableWidth + 40, height: 170 }
  }
})

const tableShapeStyle = computed<CSSProperties>(() => {
  const { shape, seats } = props.table
  if (shape === 'circular') {
    const radius = 60 + seats * 5
    const size = radius * 1.4
    const center = radius + 30
    return {
      position: 'absolute',
      left: `${center - size / 2}px`,
      top: `${center + 10 - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%'
    }
  } else {
    const cols = Math.ceil(seats / 2)
    const tableWidth = Math.max(cols * 60, 120)
    return {
      position: 'absolute',
      left: '0px',
      top: '55px',
      width: `${tableWidth + 40}px`,
      height: '80px',
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
    <div class="table-header">
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

    <div class="table-shape" :style="tableShapeStyle" />

    <div
      v-for="(pos, index) in seatPositions"
      :key="index"
      class="seat"
      :class="{
        'seat--occupied': table.guests[index],
        'seat--drag-over': dragOverSeat === index
      }"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      @dragover="onSeatDragOver($event, index)"
      @dragleave="onSeatDragLeave"
      @drop="onSeatDrop($event, index)"
    >
      <template v-if="table.guests[index]">
        <span
          class="seat__guest"
          :draggable="editable"
          @dragstart="editable && onGuestDragStart($event, table.guests[index]!)"
        >
          {{ getPersonName(table.guests[index]!) }}
        </span>
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
  padding: 4px 0;
  cursor: grab;
}

.table-header:active {
  cursor: grabbing;
}

.table-name {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
}

.table-remove {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}

.table-remove:hover {
  color: #ef4444;
}

.table-shape {
  background: #dbeafe;
  border: 2px solid #93c5fd;
}

.seat {
  position: absolute;
  width: 40px;
  height: 28px;
  border-radius: 14px;
  background: white;
  border: 2px solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all 0.15s;
  overflow: hidden;
}

.seat--occupied {
  background: #eff6ff;
  border-color: #3b82f6;
  width: auto;
  min-width: 40px;
  max-width: 100px;
  padding: 0 6px;
}

.seat--drag-over {
  border-color: #10b981;
  background: #d1fae5;
  transform: scale(1.1);
}

.seat__guest {
  font-size: 10px;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: grab;
}

.seat__guest:active {
  cursor: grabbing;
}

.seat__remove {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
}

.seat__remove:hover {
  color: #ef4444;
}

.seat__empty {
  color: #9ca3af;
  font-size: 10px;
}
</style>
