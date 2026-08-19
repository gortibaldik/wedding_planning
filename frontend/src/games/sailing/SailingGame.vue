<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Boat, Controls, Wind } from './types'
import { createBoat, liftDragSpeedModel, randomWind, updateBoat } from './physics'
import { drawScene } from './render'
import { distanceSailed, Viewport } from './world'

/** Internal canvas resolution; CSS scales it to the stage width. */
const CANVAS_W = 640
const CANVAS_H = 400

/** Longest simulation step, so a backgrounded tab does not teleport the boat. */
const MAX_DT = 0.05

/** Active speed model — swap algorithms by pointing this at another one. */
const speedModel = liftDragSpeedModel

const stage = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

const started = ref(false)
const showForces = ref(false)
const windLabel = ref('')
const speedText = ref('0.0')
const trimText = ref(45)
const distText = ref(0)
const warning = ref('')

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

function reset(): void {
  wind = randomWind()
  boat = createBoat(wind, speedModel)
  view.follow(boat)
  started.value = false
  windLabel.value = 'od ' + wind.from
  warning.value = ''
  controls = { turnLeft: false, turnRight: false, sailUp: false, sailDown: false }
}

function startGame(): void {
  if (started.value) return
  started.value = true
  lastT = performance.now()
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
    controls[control] = true
    e.preventDefault()
  }
}

function onKeyUp(e: KeyboardEvent): void {
  const control = CONTROL_KEYS[e.key]
  if (control) controls[control] = false
}

/** Responsive: keep the internal resolution, scale via CSS. */
function fit(): void {
  if (!stage.value || !canvas.value) return
  canvas.value.style.height = Math.round(stage.value.clientWidth * (CANVAS_H / CANVAS_W)) + 'px'
}

onMounted(() => {
  ctx = canvas.value?.getContext('2d') ?? null
  view = new Viewport(CANVAS_W, CANVAS_H)
  reset()
  fit()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', fit)
  rafId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', fit)
})
</script>

<template>
  <div class="sail-wrap">
    <div ref="stage" class="sail-stage">
      <canvas ref="canvas" class="sail-canvas" :width="CANVAS_W" :height="CANVAS_H"></canvas>
      <div v-if="!started" class="sail-overlay">
        <h3>Jachting</h3>
        <div class="keys">
          <div class="keyrow">
            <kbd>←</kbd><kbd>→</kbd><span>kormidlo &mdash; zatáčej loď</span>
          </div>
          <div class="keyrow">
            <kbd>↑</kbd><kbd>↓</kbd><span>plachta &mdash; přehoď z jedné strany na druhou</span>
          </div>
        </div>
        <div class="hint">
          Vyplouváš z přístavu vlevo na otevřené moře &ndash; žádný cíl, jen doplav co nejdál na
          východ. Natoč plachtu tak, aby tě vítr hnal. Když projedeš větrem (zatočíš na druhou
          stranu), přehoď i plachtu klávesami ↑/↓ přes střed na druhou stranu &ndash; jinak se
          obrátí naprázdno a loď se zastaví. Proti větru (od východu) musíš křižovat v cik-cak.
        </div>
        <button type="button" class="start-btn" @click="startGame">Vyplout (mezerník)</button>
      </div>
    </div>
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
</style>
