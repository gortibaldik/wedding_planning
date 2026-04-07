<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
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

interface UpdateTableEvent {
  tableId: string
  updates: { name: string; seats: number }
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
  'update-table': [event: UpdateTableEvent]
  'update-table-position': [event: TablePositionUpdate]
}>()

const dragState = ref<DragState | null>(null)
const moveModeTableId = ref<string | null>(null)

const onToggleMove = (tableId: string): void => {
  moveModeTableId.value = moveModeTableId.value === tableId ? null : tableId
}

const onTablePointerDown = (e: PointerEvent, tableId: string): void => {
  if (!props.editable) return
  if (moveModeTableId.value !== tableId) return
  if (!(e.target as HTMLElement).closest('.table-header')) return
  e.preventDefault()
  const table = props.tables.find(t => t.id === tableId)
  if (!table) return

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
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// Zoom state
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_STEP = 0.03
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

// Drag-to-pan on desktop: when the user presses on empty canvas area,
// hold and drag to scroll the canvas (mirrors touch pan-x/pan-y).
interface PanState {
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
}
const panState = ref<PanState | null>(null)
const canvasRef = ref<HTMLElement | null>(null)

const onCanvasPointerDown = (e: PointerEvent): void => {
  if (e.pointerType !== 'mouse') return
  if (e.button !== 0) return
  // Don't start panning when pressing on a table (table drag handles itself)
  if ((e.target as HTMLElement).closest('.canvas-table')) return
  const canvas = canvasRef.value
  if (!canvas) return
  panState.value = {
    startX: e.clientX,
    startY: e.clientY,
    scrollLeft: canvas.scrollLeft,
    scrollTop: canvas.scrollTop
  }
  window.addEventListener('pointermove', onCanvasPanMove)
  window.addEventListener('pointerup', onCanvasPanUp)
}

const onCanvasPanMove = (e: PointerEvent): void => {
  if (!panState.value || !canvasRef.value) return
  canvasRef.value.scrollLeft = panState.value.scrollLeft - (e.clientX - panState.value.startX)
  canvasRef.value.scrollTop = panState.value.scrollTop - (e.clientY - panState.value.startY)
}

const onCanvasPanUp = (): void => {
  panState.value = null
  window.removeEventListener('pointermove', onCanvasPanMove)
  window.removeEventListener('pointerup', onCanvasPanUp)
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
const CANVAS_PADDING = 100

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

// Sticky bounds: frozen while a table is in move mode, so the canvas
// can expand (via the dragged transform spilling out) but never shrinks
// mid-move. Recomputed from live bounds the moment move mode ends.
const stickyBounds = ref({ ...bounds.value })

watch(
  [bounds, moveModeTableId],
  ([b, moveId]) => {
    if (moveId === null) {
      stickyBounds.value = { ...b }
    } else {
      const s = stickyBounds.value
      stickyBounds.value = {
        minX: Math.min(s.minX, b.minX),
        minY: Math.min(s.minY, b.minY),
        maxX: Math.max(s.maxX, b.maxX),
        maxY: Math.max(s.maxY, b.maxY)
      }
    }
  },
  { immediate: true }
)

// Offset applied to each table so the bounding box starts at CANVAS_PADDING
const renderOffset = computed(() => ({
  x: -stickyBounds.value.minX + CANVAS_PADDING,
  y: -stickyBounds.value.minY + CANVAS_PADDING
}))

const contentStyle = computed(() => {
  const width = stickyBounds.value.maxX - stickyBounds.value.minX + CANVAS_PADDING * 2
  const height = stickyBounds.value.maxY - stickyBounds.value.minY + CANVAS_PADDING * 2
  console.info('Applied width, height', width, height)
  return {
    transform: `scale(${zoom.value})`,
    transformOrigin: '0 0',
    width: `${width}px`,
    height: `${height}px`
  }
})
</script>

<template>
  <div
    ref="canvasRef"
    class="seating-canvas"
    :class="{ 'seating-canvas--panning': panState }"
    @pointerdown="onCanvasPointerDown"
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
          :move-mode="moveModeTableId === table.id"
          @assign-guest="emit('assign-guest', $event)"
          @unassign-guest="emit('unassign-guest', $event)"
          @remove-table="emit('remove-table', $event)"
          @update-table="emit('update-table', $event)"
          @toggle-move="onToggleMove(table.id)"
        />
      </div>
    </div>
    <div class="zoom-indicator">{{ zoomPercent }}%</div>
  </div>
</template>

<style scoped>
.seating-canvas {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: auto;
  scrollbar-gutter: stable both-edges;
  background: radial-gradient(circle, #e5e7eb 1px, transparent 1px);
  background-size: 20px 20px;
  min-height: 100%;
  touch-action: pan-x pan-y;
  cursor: grab;
}

.seating-canvas--panning {
  cursor: grabbing;
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
