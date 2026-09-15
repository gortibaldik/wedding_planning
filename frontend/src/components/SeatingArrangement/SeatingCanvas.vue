<script lang="ts" setup>
import { ref, toRef } from 'vue'
import TableNode from './TableNode.vue'
import type { Table } from '@/composables/useSeatingData'
import { useSeatingCanvasGestures } from '@/composables/useSeatingCanvasGestures'

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

const canvasRef = ref<HTMLElement | null>(null)

const {
  zoomPercent,
  moveModeTableId,
  toggleMove,
  panning,
  renderOffset,
  contentStyle,
  canvasBoundsStyle,
  onWheel,
  onTablePointerDown,
  onCanvasPointerDown,
  onTouchStart,
  onTouchMove,
  onTouchEnd
} = useSeatingCanvasGestures({
  canvasRef,
  tables: toRef(props, 'tables'),
  editable: toRef(props, 'editable'),
  onTablePositionChange: (tableId, position) => emit('update-table-position', { tableId, position })
})

// Highlights the drop targets while a guest is dragged over the canvas.
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
</script>

<template>
  <div
    ref="canvasRef"
    class="seating-canvas"
    :class="{ 'seating-canvas--panning': panning }"
    @pointerdown="onCanvasPointerDown"
    @dragover="onCanvasDragOver"
    @dragenter="onCanvasDragEnter"
    @dragleave="onCanvasDragLeave"
    @drop="onCanvasDrop"
    @wheel.prevent="onWheel"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <div class="canvas-content" :style="contentStyle">
      <div v-if="tables.length === 0" class="canvas-empty">Click "Add Table" to get started</div>
      <div class="canvas-origin" :style="canvasBoundsStyle" aria-hidden="true" />
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
          @toggle-move="toggleMove(table.id)"
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

.canvas-origin {
  position: absolute;
  right: 0;
  bottom: 0;
  border-left: 2px dashed #9ca3af;
  border-top: 2px dashed #9ca3af;
  pointer-events: none;
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
