<script lang="ts" setup>
import { ref, computed } from 'vue'
import TableNode from './TableNode.vue'
import type { Table } from '@/composables/useSeatingData'

interface TablePositionUpdate {
  tableId: string
  position: { x: number; y: number }
}

interface AssignGuestEvent {
  guestId: string
  tableId: string
  seatIndex: number
}

interface DragState {
  tableId: string
  startX: number
  startY: number
  origX: number
  origY: number
}

const props = defineProps<{
  tables: Table[]
  editable: boolean
}>()
const emit = defineEmits<{
  'assign-guest': [event: AssignGuestEvent]
  'unassign-guest': [guestId: string]
  'remove-table': [tableId: string]
  'update-table-position': [event: TablePositionUpdate]
}>()

const dragState = ref<DragState | null>(null)

const onTablePointerDown = (e: PointerEvent, tableId: string): void => {
  if (!props.editable) return
  if (!(e.target as HTMLElement).closest('.table-header')) return
  e.preventDefault()
  const table = props.tables.find(t => t.id === tableId)
  if (!table) return

  frozenOffset.value = { ...computedOffset.value }

  dragState.value = {
    tableId,
    startX: e.clientX,
    startY: e.clientY,
    origX: table.position.x,
    origY: table.position.y
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

const onPointerMove = (e: PointerEvent): void => {
  if (!dragState.value) return
  const dx = (e.clientX - dragState.value.startX) / zoom.value
  const dy = (e.clientY - dragState.value.startY) / zoom.value
  emit('update-table-position', {
    tableId: dragState.value.tableId,
    position: {
      x: dragState.value.origX + dx,
      y: dragState.value.origY + dy
    }
  })
}

const onPointerUp = (): void => {
  dragState.value = null
  frozenOffset.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// Zoom state
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1
const zoom = ref(1)

const onWheel = (e: WheelEvent): void => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value + delta))
}

const zoomPercent = computed(() => Math.round(zoom.value * 100))

// Pinch-to-zoom for mobile
let lastPinchDist: number | null = null

const onTouchStart = (e: TouchEvent): void => {
  if (e.touches.length === 2) {
    e.preventDefault()
    lastPinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    )
  }
}

const onTouchMove = (e: TouchEvent): void => {
  if (e.touches.length === 2 && lastPinchDist !== null) {
    e.preventDefault()
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    )
    const scale = dist / lastPinchDist
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * scale))
    lastPinchDist = dist
  }
}

const onTouchEnd = (e: TouchEvent): void => {
  if (e.touches.length < 2) {
    lastPinchDist = null
  }
}

const guestDragActive = ref(false)

const onCanvasDragEnter = (e: DragEvent): void => {
  if (e.dataTransfer?.types.includes('text/guest-id')) {
    guestDragActive.value = true
  }
}

const onCanvasDragLeave = (e: DragEvent): void => {
  // Only deactivate when leaving the canvas entirely
  const related = e.relatedTarget as Node | null
  const canvas = e.currentTarget as HTMLElement
  if (!related || !canvas.contains(related)) {
    guestDragActive.value = false
  }
}

const onCanvasDrop = (): void => {
  guestDragActive.value = false
}

const onCanvasDragOver = (e: DragEvent): void => {
  e.preventDefault()
}

// Dynamic canvas sizing: fit bounding rectangle of all tables + padding
const CANVAS_PADDING = 20

const bounds = computed(() => {
  if (props.tables.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const t of props.tables) {
    if (t.position.x < minX) minX = t.position.x
    if (t.position.y < minY) minY = t.position.y
    if (t.position.x > maxX) maxX = t.position.x
    if (t.position.y > maxY) maxY = t.position.y
  }
  return { minX, minY, maxX, maxY }
})

// Offset applied to each table so the bounding box starts at CANVAS_PADDING
// Frozen during drag to prevent all tables shifting as bounds change
const frozenOffset = ref<{ x: number; y: number } | null>(null)

const computedOffset = computed(() => ({
  x: -bounds.value.minX + CANVAS_PADDING,
  y: -bounds.value.minY + CANVAS_PADDING
}))

const renderOffset = computed(() => frozenOffset.value ?? computedOffset.value)

const contentStyle = computed(() => ({
  transform: `scale(${zoom.value})`,
  transformOrigin: '0 0'
}))
</script>

<template>
  <div
    class="seating-canvas"
    @dragover="onCanvasDragOver"
    @dragenter="onCanvasDragEnter"
    @dragleave="onCanvasDragLeave"
    @drop="onCanvasDrop"
    @wheel.prevent="onWheel"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div class="canvas-content" :style="contentStyle">
      <div v-if="tables.length === 0" class="canvas-empty">Click "Add Table" to get started</div>
      <div
        v-for="table in tables"
        :key="table.id"
        class="canvas-table"
        :style="{
          left: table.position.x + renderOffset.x + 'px',
          top: table.position.y + renderOffset.y + 'px'
        }"
        @pointerdown="onTablePointerDown($event, table.id)"
      >
        <TableNode
          :table="table"
          :editable="editable"
          :guest-drag-active="guestDragActive"
          @assign-guest="emit('assign-guest', $event)"
          @unassign-guest="emit('unassign-guest', $event)"
          @remove-table="emit('remove-table', $event)"
        />
      </div>
    </div>
    <div class="zoom-indicator">{{ zoomPercent }}%</div>
  </div>
</template>

<style scoped>
.seating-canvas {
  flex: 1;
  position: relative;
  overflow: auto;
  background: radial-gradient(circle, #e5e7eb 1px, transparent 1px);
  background-size: 20px 20px;
  min-height: 100%;
  touch-action: pan-x pan-y;
}

.canvas-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.canvas-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #9ca3af;
  font-size: 16px;
}

.canvas-table {
  position: absolute;
}

.zoom-indicator {
  position: sticky;
  bottom: 8px;
  left: 8px;
  display: inline-block;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  color: #6b7280;
  pointer-events: none;
  z-index: 10;
}
</style>
