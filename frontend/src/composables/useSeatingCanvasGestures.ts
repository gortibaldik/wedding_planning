import { ref, computed, watch, nextTick, onUnmounted, type Ref } from 'vue'
import type { Table } from '@/composables/useSeatingData'
import { useTouchDragDrop } from '@/composables/useTouchDragDrop'

/**
 * Every gesture that drives the seating canvas itself: zooming (wheel and
 * pinch), panning, and dragging a table around. Guest drag-and-drop is a
 * different concern and lives in `useTouchDragDrop`, which the sidebar shares.
 */

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_STEP = 0.03

/**
 * The scene spans from the origin to the far edge of the outermost table, plus
 * padding. The two paddings differ: nothing can ever cross the origin, so the
 * leading gap is cosmetic, while the trailing gap has to cover the outermost
 * table's own width/height (maxX/maxY are its top-left corner) and leave room
 * to drag further out.
 */
const LEADING_PADDING = 50
const TRAILING_PADDING = 400

interface TableDragState {
  tableId: string
  startX: number
  startY: number
  origX: number
  origY: number
}

interface PanState {
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
}

interface PointerGestureHandlers {
  /** Called for every move of the pointer that started the gesture. */
  onMove: (e: PointerEvent) => void
  /** Called once when the gesture ends, however it ends. */
  onEnd: () => void
}

/**
 * Track one pointer from press to release, for gestures that follow the pointer
 * outside the element they started on.
 *
 * Listening for `pointerup` on the window is not enough to notice the release:
 * a mouse let go outside the browser window delivers no `pointerup` to the
 * page, and neither does a pointer the browser takes away from us (a native
 * drag starting, a system gesture, the tab losing focus). Each of those leaves
 * the gesture running and the canvas glued to the pointer. So the pointer is
 * captured on `captureTarget` — which routes its later events back to us even
 * outside the window — and `pointercancel` / `lostpointercapture` / `blur` end
 * the gesture in the cases where the release itself never arrives.
 *
 * Only the pointer that started the gesture drives it; a second finger or
 * pointer is ignored until the first one is done.
 */
function createPointerGesture(
  captureTarget: Ref<HTMLElement | null>,
  handlers: PointerGestureHandlers
) {
  const pointerId = ref<number | null>(null)

  function onPointerMove(e: PointerEvent): void {
    if (e.pointerId !== pointerId.value) return
    handlers.onMove(e)
  }

  /** Begin tracking the pointer that raised `e`. */
  function start(e: PointerEvent): void {
    if (pointerId.value !== null) return
    pointerId.value = e.pointerId
    try {
      captureTarget.value?.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone; the listeners below still clean up.
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('lostpointercapture', end)
    window.addEventListener('blur', end)
  }

  /**
   * End the gesture and run `onEnd`. Called for us on release, and callable
   * directly to abort a gesture that turned out to be something else (a pinch)
   * or whose component is going away. A no-op when nothing is in flight.
   */
  function end(): void {
    const id = pointerId.value
    if (id === null) return
    pointerId.value = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    window.removeEventListener('lostpointercapture', end)
    window.removeEventListener('blur', end)
    try {
      if (captureTarget.value?.hasPointerCapture(id)) {
        captureTarget.value.releasePointerCapture(id)
      }
    } catch {
      // Capture was already released by the browser.
    }
    handlers.onEnd()
  }

  return { start, end }
}

export interface SeatingCanvasGesturesOptions {
  /** The scroll container; zooming and panning both drive its scroll position. */
  canvasRef: Ref<HTMLElement | null>
  tables: Ref<Table[]>
  editable: Ref<boolean>
  onTablePositionChange: (tableId: string, position: { x: number; y: number }) => void
}

export function useSeatingCanvasGestures(options: SeatingCanvasGesturesOptions) {
  const { canvasRef, tables, editable, onTablePositionChange } = options
  const { cancelDrag } = useTouchDragDrop()

  const zoom = ref(1)
  const zoomPercent = computed(() => Math.round(zoom.value * 100))

  /**
   * A table that is in the move mode.
   *
   * Only the table whose move button was pressed can be moved.
   */
  const moveModeTableId = ref<string | null>(null)

  const toggleMove = (tableId: string): void => {
    moveModeTableId.value = moveModeTableId.value === tableId ? null : tableId
  }

  /**
   * Zoom towards a viewport point instead of the content's top-left corner.
   *
   * The scene point sitting under (clientX, clientY) is computed before the
   * change and the scroll position is then set so that same point lands back
   * under the pointer — so the thing you are pointing at stays put while
   * everything else grows or shrinks around it.
   */
  const applyZoom = async (target: number, clientX: number, clientY: number): Promise<void> => {
    const canvas = canvasRef.value
    const prev = zoom.value
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target))
    if (!canvas || next === prev) return

    // Pointer offset within the canvas viewport, and the scene coordinate it
    // currently points at (scroll is in scaled px, the scene is unscaled).
    const rect = canvas.getBoundingClientRect()
    const pointerX = clientX - rect.left
    const pointerY = clientY - rect.top
    const sceneX = (canvas.scrollLeft + pointerX) / prev
    const sceneY = (canvas.scrollTop + pointerY) / prev

    zoom.value = next
    // Wait for the new scale to be laid out, or the scroll extent is still the
    // old one and the browser clamps the assignment below.
    await nextTick()
    canvas.scrollLeft = sceneX * next - pointerX
    canvas.scrollTop = sceneY * next - pointerY
  }

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    applyZoom(zoom.value + delta, e.clientX, e.clientY)
  }

  // Dragging a table: the whole table is the handle, but only while it is in
  // move mode.
  const tableDragState = ref<TableDragState | null>(null)

  const tableDrag = createPointerGesture(canvasRef, {
    onMove: (e: PointerEvent) => {
      const state = tableDragState.value
      if (!state) return
      onTablePositionChange(state.tableId, {
        x: state.origX + (e.clientX - state.startX) / zoom.value,
        y: state.origY + (e.clientY - state.startY) / zoom.value
      })
    },
    onEnd: () => {
      tableDragState.value = null
    }
  })

  const onTablePointerDown = (e: PointerEvent, tableId: string): void => {
    if (!editable.value) return
    if (pinching.value) return
    if (moveModeTableId.value !== tableId) return

    // The whole table is the drag handle; only interactive bits opt out.
    if ((e.target as HTMLElement).closest('button, .seat__guest')) return
    e.preventDefault()
    const table = tables.value.find(t => t.id === tableId)
    if (!table) return

    tableDragState.value = {
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      origX: table.position.x,
      origY: table.position.y
    }
    tableDrag.start(e)
  }

  // Drag-to-pan on desktop: pressing empty canvas area and dragging scrolls the
  // canvas (mirrors touch pan-x/pan-y).
  const panState = ref<PanState | null>(null)
  const panning = computed(() => panState.value !== null)

  const canvasPan = createPointerGesture(canvasRef, {
    onMove: (e: PointerEvent) => {
      const state = panState.value
      const canvas = canvasRef.value
      if (!state || !canvas) return
      canvas.scrollLeft = state.scrollLeft - (e.clientX - state.startX)
      canvas.scrollTop = state.scrollTop - (e.clientY - state.startY)
    },
    onEnd: () => {
      panState.value = null
    }
  })

  const onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return
    if (e.button !== 0) return
    // Don't start panning when pressing on a table (table drag handles itself)
    if ((e.target as HTMLElement).closest('.canvas-table')) return
    const canvas = canvasRef.value
    if (!canvas) return
    // Without this the press also starts a text selection, and a selection drag
    // that ends outside the window swallows the release.
    e.preventDefault()
    panState.value = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop
    }
    canvasPan.start(e)
  }

  // Pinch-to-zoom for mobile
  let lastPinchDist: number | null = null
  const pinching = ref(false)

  const onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length >= 2) {
      e.preventDefault()
      // A second finger means "zoom", not "drag". Anything the first finger had
      // already started is abandoned in place, so the pinch cannot reposition a
      // table or drop a guest into a seat.
      pinching.value = true
      tableDrag.end()
      canvasPan.end()
      cancelDrag()
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
      // Anchor the pinch on the midpoint between the two fingers.
      applyZoom(
        zoom.value * scale,
        (e.touches[0].clientX + e.touches[1].clientX) / 2,
        (e.touches[0].clientY + e.touches[1].clientY) / 2
      )
      lastPinchDist = dist
    }
  }

  const onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) {
      lastPinchDist = null
      pinching.value = false
    }
  }

  // A gesture that is still live when the canvas goes away would otherwise
  // leave its window listeners behind.
  onUnmounted(() => {
    tableDrag.end()
    canvasPan.end()
  })

  // The scene origin is pinned at (0,0) and table coordinates are clamped
  // non-negative upstream, so this offset is constant: moving one table can
  // never re-anchor the others.
  const renderOffset = { x: LEADING_PADDING, y: LEADING_PADDING }

  // Only the far edge is dynamic — it decides how far the canvas scrolls.
  const bounds = computed(() => {
    let maxX = 0,
      maxY = 0
    for (const t of tables.value) {
      if (t.position.x > maxX) maxX = t.position.x
      if (t.position.y > maxY) maxY = t.position.y
    }
    return { maxX, maxY }
  })

  // Sticky bounds: frozen while a table is in move mode, so the canvas can
  // expand as a table is dragged outward but never shrinks mid-move (which
  // would yank the scroll extent out from under the pointer). Recomputed from
  // live bounds the moment move mode ends.
  const stickyBounds = ref({ ...bounds.value })

  watch(
    [bounds, moveModeTableId],
    ([b, moveId]) => {
      if (moveId === null) {
        stickyBounds.value = { ...b }
      } else {
        const s = stickyBounds.value
        stickyBounds.value = {
          maxX: Math.max(s.maxX, b.maxX),
          maxY: Math.max(s.maxY, b.maxY)
        }
      }
    },
    { immediate: true }
  )

  const contentStyle = computed(() => ({
    transform: `scale(${zoom.value})`,
    transformOrigin: '0 0',
    width: `${stickyBounds.value.maxX + LEADING_PADDING + TRAILING_PADDING}px`,
    height: `${stickyBounds.value.maxY + LEADING_PADDING + TRAILING_PADDING}px`
  }))

  // Dotted guides along the x and y axes, marking how far left and up a table
  // can be dragged.
  const canvasBoundsStyle = computed(() => ({
    left: `${LEADING_PADDING}px`,
    top: `${LEADING_PADDING}px`
  }))

  return {
    zoom,
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
  }
}
