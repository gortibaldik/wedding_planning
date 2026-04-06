import { ref } from 'vue'

/**
 * Shared touch drag-and-drop state for mobile devices.
 * Uses elementFromPoint + data attributes to find drop targets.
 *
 * Drop targets must have one of:
 *   data-drop-seat="<tableId>:<seatIndex>"  (empty seats)
 *   data-drop-sidebar                        (sidebar = unassign)
 *
 * Draggable elements need @touchstart="onTouchStart($event, guestId)"
 */

const draggedGuestId = ref<string | null>(null)
let dragClone: HTMLElement | null = null
let touchOffsetX = 0
let touchOffsetY = 0

type AssignCallback = (guestId: string, tableId: string, seatIndex: number) => void
type UnassignCallback = (guestId: string) => void

let onAssign: AssignCallback | null = null
let onUnassign: UnassignCallback | null = null

export function useTouchDragDrop() {
  function registerCallbacks(assign: AssignCallback, unassign: UnassignCallback) {
    onAssign = assign
    onUnassign = unassign
  }

  function onTouchStart(e: TouchEvent, guestId: string) {
    const touch = e.touches[0]
    const el = e.currentTarget as HTMLElement

    // Long-press is not needed — start immediately but prevent scroll
    draggedGuestId.value = guestId

    // Create floating clone
    const rect = el.getBoundingClientRect()
    touchOffsetX = touch.clientX - rect.left
    touchOffsetY = touch.clientY - rect.top

    dragClone = el.cloneNode(true) as HTMLElement
    dragClone.style.position = 'fixed'
    dragClone.style.left = `${rect.left}px`
    dragClone.style.top = `${rect.top}px`
    dragClone.style.width = `${rect.width}px`
    dragClone.style.pointerEvents = 'none'
    dragClone.style.zIndex = '10000'
    dragClone.style.opacity = '0.85'
    dragClone.style.transform = 'scale(0.9)'
    dragClone.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'
    dragClone.style.borderRadius = '8px'
    document.body.appendChild(dragClone)

    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchCancel)
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault() // prevent scrolling while dragging
    const touch = e.touches[0]
    if (dragClone) {
      dragClone.style.left = `${touch.clientX - touchOffsetX}px`
      dragClone.style.top = `${touch.clientY - touchOffsetY}px`
    }

    // Highlight drop target under finger
    updateDropTargetHighlight(touch.clientX, touch.clientY)
  }

  function onTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0]
    const guestId = draggedGuestId.value

    cleanup()

    if (!guestId) return

    // Find the drop target under the finger
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
    if (!target) return

    const seatEl = (target as HTMLElement).closest('[data-drop-seat]') as HTMLElement | null
    const sidebarEl = (target as HTMLElement).closest('[data-drop-sidebar]') as HTMLElement | null

    if (seatEl) {
      const [tableId, seatIndexStr] = seatEl.dataset.dropSeat!.split(':')
      const seatIndex = parseInt(seatIndexStr, 10)
      onAssign?.(guestId, tableId, seatIndex)
    } else if (sidebarEl) {
      onUnassign?.(guestId)
    }
  }

  function onTouchCancel() {
    cleanup()
  }

  function cleanup() {
    draggedGuestId.value = null
    if (dragClone) {
      dragClone.remove()
      dragClone = null
    }
    clearDropTargetHighlight()
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('touchcancel', onTouchCancel)
  }

  // Track currently highlighted drop target to toggle classes
  let currentHighlight: Element | null = null

  function updateDropTargetHighlight(x: number, y: number) {
    const target = document.elementFromPoint(x, y)
    if (!target) {
      clearDropTargetHighlight()
      return
    }

    const seatEl = (target as HTMLElement).closest('[data-drop-seat]')
    const sidebarEl = (target as HTMLElement).closest('[data-drop-sidebar]')
    const newHighlight = seatEl || sidebarEl || null

    if (newHighlight !== currentHighlight) {
      clearDropTargetHighlight()
      if (newHighlight) {
        newHighlight.classList.add('touch-drag-over')
        currentHighlight = newHighlight
      }
    }
  }

  function clearDropTargetHighlight() {
    if (currentHighlight) {
      currentHighlight.classList.remove('touch-drag-over')
      currentHighlight = null
    }
  }

  return {
    draggedGuestId,
    onTouchStart,
    registerCallbacks
  }
}
