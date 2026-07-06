<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SeriesPoint } from '@/composables/useFinance'

const props = withDefaults(
  defineProps<{
    points: SeriesPoint[]
    color?: string
    formatValue?: (value: number) => string
  }>(),
  {
    color: '#3b82f6',
    formatValue: (value: number) => String(value)
  }
)

// A fixed viewBox keeps the SVG math simple; the chart scales responsively via CSS.
const WIDTH = 640
const HEIGHT = 260
const PADDING = { top: 16, right: 16, bottom: 40, left: 56 }

const plot = computed(() => {
  const innerW = WIDTH - PADDING.left - PADDING.right
  const innerH = HEIGHT - PADDING.top - PADDING.bottom
  const values = props.points.map(p => p.value)
  const maxValue = Math.max(1, ...values)
  const count = props.points.length

  const x = (i: number) => PADDING.left + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW)
  const y = (value: number) => PADDING.top + innerH - (value / maxValue) * innerH

  const coords = props.points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.value) }))
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ')
  const areaPath = coords.length
    ? `${linePath} L ${coords[coords.length - 1].cx} ${PADDING.top + innerH} ` +
      `L ${coords[0].cx} ${PADDING.top + innerH} Z`
    : ''

  // 4 horizontal grid lines / y-axis ticks
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const value = (maxValue / 4) * i
    return { value, y: y(value) }
  })

  return { coords, linePath, areaPath, ticks, baseY: PADDING.top + innerH }
})

// --- interactive tooltip ---------------------------------------------------
// Because the SVG keeps its native 640x260 aspect ratio (width:100%, height:auto),
// the rendered box maps 1:1 to the viewBox, so we can convert mouse position to
// viewBox units — and point coords back to % — with simple ratios.
const containerRef = ref<HTMLElement | null>(null)
const hoverIndex = ref<number | null>(null)

const updateHover = (clientX: number) => {
  const el = containerRef.value
  if (!el || !props.points.length) return
  const rect = el.getBoundingClientRect()
  const vbX = ((clientX - rect.left) / rect.width) * WIDTH
  let best = 0
  let bestDist = Infinity
  plot.value.coords.forEach((c, i) => {
    const dist = Math.abs(c.cx - vbX)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  hoverIndex.value = best
}

const onMove = (e: MouseEvent) => updateHover(e.clientX)
const onTouch = (e: TouchEvent) => {
  if (e.touches.length) updateHover(e.touches[0].clientX)
}
const onLeave = () => {
  hoverIndex.value = null
}

const hovered = computed(() =>
  hoverIndex.value === null ? null : (plot.value.coords[hoverIndex.value] ?? null)
)

const tooltipStyle = computed(() => {
  if (!hovered.value) return {}
  return {
    left: `${(hovered.value.cx / WIDTH) * 100}%`,
    top: `${(hovered.value.cy / HEIGHT) * 100}%`
  }
})
</script>

<template>
  <div
    v-if="points.length"
    ref="containerRef"
    class="line-chart__wrap"
    @mousemove="onMove"
    @mouseleave="onLeave"
    @touchstart.passive="onTouch"
    @touchmove.passive="onTouch"
    @touchend="onLeave"
  >
    <svg
      class="line-chart"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      <!-- grid + y ticks -->
      <g class="line-chart__grid">
        <template v-for="tick in plot.ticks" :key="tick.value">
          <line :x1="PADDING.left" :y1="tick.y" :x2="WIDTH - PADDING.right" :y2="tick.y" />
          <text :x="PADDING.left - 8" :y="tick.y + 4" text-anchor="end">
            {{ formatValue(tick.value) }}
          </text>
        </template>
      </g>

      <path v-if="plot.areaPath" :d="plot.areaPath" :fill="color" fill-opacity="0.12" />
      <path :d="plot.linePath" fill="none" :stroke="color" stroke-width="2.5" />

      <!-- hover guide line + highlighted point -->
      <g v-if="hovered" class="line-chart__hover">
        <line :x1="hovered.cx" :y1="PADDING.top" :x2="hovered.cx" :y2="plot.baseY" />
        <circle :cx="hovered.cx" :cy="hovered.cy" r="6" :fill="color" />
        <circle :cx="hovered.cx" :cy="hovered.cy" r="9" :stroke="color" />
      </g>

      <g class="line-chart__points">
        <circle
          v-for="c in plot.coords"
          :key="c.label"
          :cx="c.cx"
          :cy="c.cy"
          r="3.5"
          :fill="color"
        />
      </g>

      <g class="line-chart__xlabels">
        <text
          v-for="c in plot.coords"
          :key="c.label"
          :x="c.cx"
          :y="plot.baseY + 20"
          text-anchor="middle"
        >
          {{ c.label }}
        </text>
      </g>
    </svg>

    <div v-if="hovered" class="line-chart__tooltip" :style="tooltipStyle">
      <span class="line-chart__tooltip-label">{{ hovered.label }}</span>
      <span class="line-chart__tooltip-value">{{ formatValue(hovered.value) }}</span>
    </div>
  </div>
  <p v-else class="line-chart__empty">No data yet.</p>
</template>

<style scoped>
.line-chart__wrap {
  position: relative;
  width: 100%;
}

.line-chart {
  width: 100%;
  height: auto;
  display: block;
}

.line-chart__grid line {
  stroke: #e5e7eb;
  stroke-width: 1;
}

.line-chart__grid text,
.line-chart__xlabels text {
  font-size: 11px;
  fill: #6b7280;
}

.line-chart__hover line {
  stroke: #9ca3af;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.line-chart__hover circle[stroke] {
  fill: none;
  stroke-width: 2;
  opacity: 0.35;
}

.line-chart__tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 12px));
  pointer-events: none;
  background: #1f2937;
  color: #f9fafb;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.3;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  gap: 1px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 2;
}

.line-chart__tooltip-label {
  color: #9ca3af;
  font-size: 11px;
}

.line-chart__tooltip-value {
  font-weight: 600;
}

.line-chart__empty {
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
  padding: 24px 0;
}
</style>
