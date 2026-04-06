<script lang="ts" setup>
import { ref } from 'vue'
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
  const dx = e.clientX - dragState.value.startX
  const dy = e.clientY - dragState.value.startY
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

const onCanvasDragOver = (e: DragEvent): void => {
  e.preventDefault()
}
</script>

<template>
  <div class="seating-canvas" @dragover="onCanvasDragOver">
    <div v-if="tables.length === 0" class="canvas-empty">Click "Add Table" to get started</div>
    <div
      v-for="table in tables"
      :key="table.id"
      class="canvas-table"
      :style="{ left: table.position.x + 'px', top: table.position.y + 'px' }"
      @pointerdown="onTablePointerDown($event, table.id)"
    >
      <TableNode
        :table="table"
        :editable="editable"
        @assign-guest="emit('assign-guest', $event)"
        @unassign-guest="emit('unassign-guest', $event)"
        @remove-table="emit('remove-table', $event)"
      />
    </div>
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
</style>
