<script setup lang="ts">
import type { Controls } from './types'

/**
 * On-screen replacement for the arrow keys.
 *
 * Emits the same press/release pairs the keyboard handlers do, so the game
 * loop never learns where a control came from. Pointer events (not touch
 * events) are used so this also works with a stylus or a mouse.
 */
const emit = defineEmits<{
  press: [control: keyof Controls]
  release: [control: keyof Controls]
}>()

interface Pad {
  control: keyof Controls
  glyph: string
  label: string
}

const RUDDER_PADS: Pad[] = [
  { control: 'turnLeft', glyph: '◀', label: 'kormidlo doleva' },
  { control: 'turnRight', glyph: '▶', label: 'kormidlo doprava' }
]

/**
 * The boom swings sideways, so the sail pads read left/right too — even though
 * the underlying controls are still the up/down ones the arrow keys drive.
 * Left decreases the signed trim, right increases it, matching a number line.
 */
const SAIL_PADS: Pad[] = [
  { control: 'sailDown', glyph: '◀', label: 'plachta doleva' },
  { control: 'sailUp', glyph: '▶', label: 'plachta doprava' }
]

/** Both pairs show the same arrows, so `kind` carries a colour accent to tell
 *  them apart without reading the caption. */
const PAD_GROUPS = [
  { name: 'kormidlo', kind: 'rudder', pads: RUDDER_PADS },
  { name: 'plachta', kind: 'sail', pads: SAIL_PADS }
]

/**
 * Capture the pointer on press: a finger that slides off the pad mid-hold
 * still delivers its pointerup here, so the control cannot get stuck on.
 * Each pad captures its own pointer id, which is what lets one thumb steer
 * while the other trims.
 */
function onDown(e: PointerEvent, control: keyof Controls): void {
  e.preventDefault()
  const pad = e.currentTarget as HTMLElement
  pad.setPointerCapture(e.pointerId)
  emit('press', control)
}

function onUp(e: PointerEvent, control: keyof Controls): void {
  const pad = e.currentTarget as HTMLElement
  if (pad.hasPointerCapture(e.pointerId)) pad.releasePointerCapture(e.pointerId)
  emit('release', control)
}
</script>

<template>
  <div class="touch-controls">
    <div v-for="group in PAD_GROUPS" :key="group.name" class="pad-group">
      <span class="pad-label">{{ group.name }}</span>
      <div class="pad-row">
        <button
          v-for="pad in group.pads"
          :key="pad.control"
          type="button"
          class="pad"
          :class="`pad--${group.kind}`"
          :aria-label="pad.label"
          @pointerdown="onDown($event, pad.control)"
          @pointerup="onUp($event, pad.control)"
          @pointercancel="onUp($event, pad.control)"
          @contextmenu.prevent
        >
          {{ pad.glyph }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.touch-controls {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  /* The pads are held, not tapped: stop the browser treating a hold-and-drag
     as a scroll, a double-tap as a zoom, or a long press as a selection. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.pad-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.pad-label {
  font-size: 0.75rem;
  color: #667;
  letter-spacing: 0.04em;
}
.pad-row {
  display: flex;
  gap: 10px;
}
.pad {
  /* 64px clears the ~48px minimum touch target with room for fat thumbs. */
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
  color: #234;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  touch-action: none;
}
.pad:active {
  box-shadow: none;
  transform: translateY(1px);
}
/* Same arrows on both pairs, so colour carries the difference. */
.pad--rudder {
  color: #1c4a63;
  border-color: rgba(28, 74, 99, 0.35);
}
.pad--rudder:active {
  background: #9fd0e6;
}
.pad--sail {
  color: #6d5210;
  border-color: rgba(140, 105, 20, 0.35);
}
.pad--sail:active {
  background: #e2c044;
}
@media (max-width: 380px) {
  .pad {
    width: 56px;
    height: 56px;
  }
}
</style>
