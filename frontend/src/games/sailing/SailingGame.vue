<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Boat, Controls, Wind } from './types'
import { createBoat, liftDragSpeedModel, randomWind, updateBoat } from './physics'
import { drawScene } from './render'
import { distanceSailed, Viewport } from './world'
import TouchControls from './TouchControls.vue'
import { useImmersive } from './useImmersive'

/** Logical drawing size. The backing store is this times the device pixel
 *  ratio, so going fullscreen does not just upscale a 640x400 image. */
const CANVAS_W = 640
const CANVAS_H = 400

/** Longest simulation step, so a backgrounded tab does not teleport the boat. */
const MAX_DT = 0.05

/** Active speed model — swap algorithms by pointing this at another one. */
const speedModel = liftDragSpeedModel

const wrap = ref<HTMLDivElement | null>(null)
const stage = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

const started = ref(false)
const showForces = ref(false)
const windLabel = ref('')
const speedText = ref('0.0')
const trimText = ref(45)
const distText = ref(0)
const warning = ref('')

/**
 * Whether to show the on-screen pads. A coarse pointer means a finger, which
 * also means there is no keyboard to steer with — the keyboard handlers stay
 * bound regardless, so a tablet with both attached can use either.
 */
const coarsePointer = ref(false)
let pointerQuery: MediaQueryList | null = null

const { immersive, portrait, enter, exit, toggle } = useImmersive(wrap)

// Simulation state. Deliberately not reactive: it is rewritten every frame, and
// only the HUD values above need to reach the template.
let boat: Boat
let wind: Wind
let view: Viewport
let ctx: CanvasRenderingContext2D | null = null
let controls: Controls = { turnLeft: false, turnRight: false, sailUp: false, sailDown: false }
let waveT = 0
let lastT = 0
let rafId = 0

/** Single entry point for both the keyboard and the on-screen pads. */
function setControl(control: keyof Controls, held: boolean): void {
  controls[control] = held
}

function releaseAllControls(): void {
  controls = { turnLeft: false, turnRight: false, sailUp: false, sailDown: false }
}

function onPointerKindChange(e: MediaQueryListEvent): void {
  coarsePointer.value = e.matches
}

function reset(): void {
  wind = randomWind()
  boat = createBoat(wind, speedModel)
  view.follow(boat)
  started.value = false
  windLabel.value = 'od ' + wind.from
  warning.value = ''
  releaseAllControls()
}

/**
 * Must stay synchronously reachable from the click/keydown handler: the
 * Fullscreen API only honours a request made during a user gesture.
 */
function startGame(): void {
  if (started.value) return
  started.value = true
  lastT = performance.now()
  // Only phones and tablets get it automatically; on a desktop the game is
  // already playable in the page, so fullscreen stays a deliberate choice.
  if (coarsePointer.value) void enter()
}

function updateHud(): void {
  trimText.value = Math.round(Math.abs(boat.sail))
  speedText.value = Math.max(0, boat.speed).toFixed(1)
  distText.value = distanceSailed(boat)
  if (!started.value) return
  if (!boat.sailFull) {
    warning.value = '⚠️ Plachta plápolá – jsi proti větru, křižuj (cik-cak)!'
  } else if (!boat.driving) {
    warning.value = '⚠️ Přehoď plachtu na druhou stranu (mezerník)!'
  } else {
    warning.value = ''
  }
}

function frame(now: number): void {
  const dt = started.value ? Math.min(MAX_DT, (now - lastT) / 1000) : 0
  lastT = now
  waveT += dt

  if (started.value) {
    updateBoat(boat, wind, controls, dt, speedModel)
    view.follow(boat)
  }
  updateHud()
  if (ctx) drawScene(ctx, view, { boat, wind, waveT, showForces: showForces.value })

  rafId = requestAnimationFrame(frame)
}

const CONTROL_KEYS: Record<string, keyof Controls> = {
  ArrowLeft: 'turnLeft',
  ArrowRight: 'turnRight',
  ArrowUp: 'sailUp',
  ArrowDown: 'sailDown'
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    startGame()
    return
  }
  const control = CONTROL_KEYS[e.key]
  if (control) {
    setControl(control, true)
    e.preventDefault()
  }
}

function onKeyUp(e: KeyboardEvent): void {
  const control = CONTROL_KEYS[e.key]
  if (control) setControl(control, false)
}

/**
 * Sizes the canvas to the stage, always preserving the 8:5 aspect the world is
 * drawn for. In the page only the width is constrained; in immersive mode the
 * height is too, so the letterboxing has to be worked out from both.
 */
function fit(): void {
  if (!stage.value || !canvas.value) return

  const availW = stage.value.clientWidth
  // Outside immersive mode the stage height follows the canvas, so using it
  // here would be circular — let the width alone decide.
  const availH = immersive.value ? stage.value.clientHeight : Infinity
  const scale = Math.min(availW / CANVAS_W, availH / CANVAS_H)

  const cssW = Math.max(1, Math.round(CANVAS_W * scale))
  const cssH = Math.max(1, Math.round(CANVAS_H * scale))
  canvas.value.style.width = cssW + 'px'
  canvas.value.style.height = cssH + 'px'

  // Render at device resolution, then scale the context so every draw call in
  // render.ts keeps working in logical CANVAS_W x CANVAS_H coordinates.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = Math.round(cssW * dpr)
  canvas.value.height = Math.round(cssH * dpr)
  // Resizing the backing store resets the context, so re-apply the transform.
  ctx?.setTransform(canvas.value.width / CANVAS_W, 0, 0, canvas.value.height / CANVAS_H, 0, 0)
}

// The layout changes before the browser has laid it out, so measure after.
watch(immersive, () => void nextTick(fit))

onMounted(() => {
  ctx = canvas.value?.getContext('2d') ?? null
  view = new Viewport(CANVAS_W, CANVAS_H)
  reset()
  fit()
  pointerQuery = window.matchMedia('(pointer: coarse)')
  coarsePointer.value = pointerQuery.matches
  pointerQuery.addEventListener('change', onPointerKindChange)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', fit)
  window.addEventListener('orientationchange', fit)
  window.addEventListener('blur', releaseAllControls)
  rafId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  pointerQuery?.removeEventListener('change', onPointerKindChange)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', fit)
  window.removeEventListener('orientationchange', fit)
  window.removeEventListener('blur', releaseAllControls)
})
</script>

<template>
  <div ref="wrap" class="sail-wrap" :class="{ 'is-immersive': immersive }">
    <div ref="stage" class="sail-stage">
      <!-- Size and resolution are set by fit(); binding them here would fight it. -->
      <canvas ref="canvas" class="sail-canvas"></canvas>

      <!-- Shown when the orientation lock was refused (desktop, iOS). -->
      <div v-if="immersive && portrait" class="rotate-hint">
        <span class="rotate-icon">📱</span>
        <p>Otoč telefon na šířku</p>
      </div>
      <div v-if="!started" class="sail-overlay" @click="startGame">
        <h3>Jachting</h3>
        <div class="keys">
          <div class="keyrow">
            <template v-if="coarsePointer"><kbd>◀</kbd><kbd>▶</kbd></template>
            <template v-else><kbd>←</kbd><kbd>→</kbd></template>
            <span>kormidlo &mdash; zatáčej loď</span>
          </div>
          <div class="keyrow">
            <template v-if="coarsePointer"
              ><kbd class="kbd-sail">◀</kbd><kbd class="kbd-sail">▶</kbd></template
            >
            <template v-else><kbd>↑</kbd><kbd>↓</kbd></template>
            <span>plachta &mdash; přehoď z jedné strany na druhou</span>
          </div>
        </div>
        <div class="hint">
          Vyplouváš z přístavu vlevo na otevřené moře &ndash; žádný cíl, jen doplav co nejdál na
          východ. Natoč plachtu tak, aby tě vítr hnal. Když projedeš větrem (zatočíš na druhou
          stranu), přehoď i plachtu {{ coarsePointer ? 'tlačítky ◀/▶' : 'klávesami ↑/↓' }} přes
          střed na druhou stranu &ndash; jinak se obrátí naprázdno a loď se zastaví. Proti větru (od
          východu) musíš křižovat v cik-cak.
        </div>
        <button type="button" class="start-btn" @click="startGame">
          {{ coarsePointer ? 'Vyplout' : 'Vyplout (mezerník)' }}
        </button>
      </div>
    </div>
    <button v-if="immersive" type="button" class="exit-immersive" title="Zavřít" @click="exit">
      ✕
    </button>
    <TouchControls
      v-if="coarsePointer"
      @press="setControl($event, true)"
      @release="setControl($event, false)"
    />
    <div class="sail-hud">
      <div class="stats">
        <span
          >Vítr: <b>{{ windLabel || '–' }}</b></span
        >
        <span
          >Rychlost: <b>{{ speedText }}</b> kn</span
        >
        <span
          >Plachta: <b>{{ trimText }}</b
          >°</span
        >
        <span
          >Vzdálenost: <b>{{ distText }}</b> m</span
        >
      </div>
      <label class="power-toggle">
        <input v-model="showForces" type="checkbox" />
        Síly
      </label>
      <span class="msg">{{ warning }}</span>
      <button type="button" class="new-game" @click="reset">Nová hra</button>
      <button
        type="button"
        class="fullscreen-toggle"
        :title="immersive ? 'Zpět do stránky' : 'Na celou obrazovku'"
        @click="toggle"
      >
        {{ immersive ? '⤡ Zmenšit' : '⛶ Celá obrazovka' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sail-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sail-stage {
  position: relative;
  width: 100%;
}
.sail-canvas {
  width: 100%;
  background: #bfe0ef;
  border-radius: 8px;
  display: block;
  touch-action: none;
}
.sail-overlay {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: rgba(20, 45, 65, 0.78);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 14px;
  padding: 24px;
}
.sail-overlay h3 {
  font-family: 'Great Vibes', cursive;
  font-size: 2.2rem;
  margin: 0;
}
.sail-overlay .keys {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.95rem;
}
.sail-overlay .keyrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.sail-overlay kbd {
  display: inline-block;
  min-width: 26px;
  padding: 3px 7px;
  border-radius: 5px;
  background: #fff;
  color: #234;
  font-weight: 700;
  font-family: inherit;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
  font-size: 0.9rem;
}
/* Matches the sail pads' accent, so the briefing maps onto the buttons. */
.sail-overlay .kbd-sail {
  background: #f4e3ad;
  color: #6d5210;
}
.sail-overlay .hint {
  opacity: 0.85;
  font-size: 0.85rem;
  max-width: 360px;
  line-height: 1.4;
}
.sail-overlay button {
  padding: 9px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: #e2c044;
  color: #234;
  font-weight: 700;
  font-size: 0.95rem;
}
.sail-overlay button:hover {
  background: #ecd06a;
}
.sail-hud {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  flex-wrap: wrap;
}
.sail-hud .stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  color: #444;
}
.sail-hud .stats b {
  color: #1a1a1a;
  font-variant-numeric: tabular-nums;
}
.sail-hud .msg {
  color: #b5651d;
  font-weight: 700;
  min-height: 1.2em;
}
.sail-hud button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #888;
  background: #fff;
  cursor: pointer;
}
.sail-hud button:hover {
  background: #f3f3f3;
}
.sail-hud .power-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  color: #444;
}

/*
 * Phones: the canvas keeps its 16:10 aspect, so at ~340px wide it is only
 * ~210px tall — far too short for the briefing panel to sit on top of it.
 * Below this width the overlay leaves the canvas and stacks underneath,
 * where it can be as tall as it needs to be.
 */
@media (max-width: 560px) {
  .sail-overlay {
    position: static;
    margin-top: 10px;
    padding: 16px;
    gap: 10px;
    background: rgba(20, 45, 65, 0.92);
  }
  .sail-overlay h3 {
    font-size: 1.7rem;
  }
  .sail-overlay .keys {
    font-size: 0.85rem;
  }
  .sail-overlay .hint {
    font-size: 0.8rem;
  }
  .sail-hud {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  .sail-hud .stats {
    justify-content: center;
    gap: 12px;
  }
  .sail-hud button {
    padding: 10px 12px;
  }
}

/*
 * Immersive mode. Kept last so it overrides the narrow-screen rules above —
 * the overlay in particular goes back to covering the canvas here, since in
 * fullscreen there is plenty of height for it again.
 */
.sail-wrap.is-immersive {
  position: fixed;
  inset: 0;
  z-index: 999;
  gap: 0;
  background: #0d1f2d;
  /* Keep the pads and HUD clear of notches and home indicators. */
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}
.is-immersive .sail-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.is-immersive .sail-canvas {
  border-radius: 0;
}
.is-immersive .sail-overlay {
  position: absolute;
  inset: 0;
  margin-top: 0;
}
/* Float the pads over the canvas: in landscape the vertical space is what is
   scarce, so they must not take a row of their own. */
.is-immersive .touch-controls {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 0 14px 14px;
  /* The container spans the full width; only the pads themselves take input. */
  pointer-events: none;
}
.is-immersive .touch-controls :deep(.pad),
.is-immersive .touch-controls :deep(.pad-label) {
  pointer-events: auto;
}
.is-immersive .touch-controls :deep(.pad-label) {
  color: rgba(255, 255, 255, 0.75);
}
.is-immersive .touch-controls :deep(.pad) {
  background: rgba(255, 255, 255, 0.85);
}
.is-immersive .sail-hud {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  flex-direction: row;
  align-items: center;
  padding: 8px 52px 8px 14px;
  color: #eaf2f7;
  background: linear-gradient(rgba(13, 31, 45, 0.85), rgba(13, 31, 45, 0));
  text-align: left;
}
.is-immersive .sail-hud .stats,
.is-immersive .sail-hud .stats b,
.is-immersive .sail-hud .power-toggle {
  color: #eaf2f7;
}
.is-immersive .sail-hud .msg {
  color: #ffd66b;
}
.exit-immersive {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  color: #234;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}
.rotate-hint {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(13, 31, 45, 0.92);
  color: #fff;
  text-align: center;
}
.rotate-icon {
  font-size: 2.6rem;
  animation: rotate-nudge 1.6s ease-in-out infinite;
}
@keyframes rotate-nudge {
  0%,
  60%,
  100% {
    transform: rotate(0deg);
  }
  30% {
    transform: rotate(-90deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .rotate-icon {
    animation: none;
  }
}
.fullscreen-toggle {
  white-space: nowrap;
}
</style>
