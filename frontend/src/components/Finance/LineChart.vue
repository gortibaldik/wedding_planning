<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SeriesPoint } from '@/composables/useFinance'

/** One named line. All series in a chart are expected to share the same x labels. */
export interface ChartSeries {
  name: string
  color: string
  points: SeriesPoint[]
}

const props = withDefaults(
  defineProps<{
    /** One entry for a single line, or several entries to overlay named lines. */
    series: ChartSeries[]
    formatValue?: (value: number) => string
  }>(),
  {
    formatValue: (value: number) => String(value)
  }
)

// A fixed viewBox keeps the SVG math simple; the chart scales responsively via CSS.
const WIDTH = 640
const HEIGHT = 260
const PADDING = { top: 16, right: 16, bottom: 40, left: 56 }

const isSingle = computed(() => props.series.length === 1)
const hasData = computed(() => props.series.some(s => s.points.length))

const plot = computed(() => {
  const innerW = WIDTH - PADDING.left - PADDING.right
  const innerH = HEIGHT - PADDING.top - PADDING.bottom
  const series = props.series
  const labels = series[0]?.points.map(p => p.label) ?? []
  const count = labels.length

  const allValues = series.flatMap(s => s.points.map(p => p.value))
  const maxValue = Math.max(1, ...allValues)

  const x = (i: number) => PADDING.left + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW)
  const y = (value: number) => PADDING.top + innerH - (value / maxValue) * innerH

  const lines = series.map(s => {
    const coords = s.points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.value) }))
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ')
    const areaPath = coords.length
      ? `${linePath} L ${coords[coords.length - 1].cx} ${PADDING.top + innerH} ` +
        `L ${coords[0].cx} ${PADDING.top + innerH} Z`
      : ''
    return { name: s.name, color: s.color, coords, linePath, areaPath }
  })

  // 4 horizontal grid lines / y-axis ticks
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const value = (maxValue / 4) * i
    return { value, y: y(value) }
  })

  return { labels, count, lines, ticks, baseY: PADDING.top + innerH, x }
})

// --- interactive tooltip ---------------------------------------------------
// The SVG keeps its native 640x260 aspect ratio (width:100%, height:auto), so the
// rendered box maps 1:1 to the viewBox: mouse -> viewBox and coords -> % via ratios.
const containerRef = ref<HTMLElement | null>(null)
const hoverIndex = ref<number | null>(null)

const updateHover = (clientX: number) => {
  const el = containerRef.value
  if (!el || !plot.value.count) return
  const rect = el.getBoundingClientRect()
  const vbX = ((clientX - rect.left) / rect.width) * WIDTH
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < plot.value.count; i++) {
    const dist = Math.abs(plot.value.x(i) - vbX)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  hoverIndex.value = best
}

const onMove = (e: MouseEvent) => updateHover(e.clientX)
const onTouch = (e: TouchEvent) => {
  if (e.touches.length) updateHover(e.touches[0].clientX)
}
const onLeave = () => {
  hoverIndex.value = null
}

/** The x-position and per-series values at the hovered index. */
const hovered = computed(() => {
  const i = hoverIndex.value
  if (i === null || i >= plot.value.count) return null
  const cx = plot.value.x(i)
  const rows = plot.value.lines
    .map(l => ({ name: l.name, color: l.color, coord: l.coords[i] }))
    .filter(r => r.coord)
  if (!rows.length) return null
  const label = rows[0].coord.label
  const topCy = Math.min(...rows.map(r => r.coord.cy))
  return { cx, label, rows, topCy }
})

const tooltipStyle = computed(() => {
  if (!hovered.value) return {}
  return {
    left: `${(hovered.value.cx / WIDTH) * 100}%`,
    top: `${(hovered.value.topCy / HEIGHT) * 100}%`
  }
})
</script>

<template>
  <div
    v-if="hasData"
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

      <!-- one path (+ area fill when there is a single line) per series -->
      <template v-for="line in plot.lines" :key="line.name">
        <path
          v-if="isSingle && line.areaPath"
          :d="line.areaPath"
          :fill="line.color"
          fill-opacity="0.12"
        />
        <path :d="line.linePath" fill="none" :stroke="line.color" stroke-width="2.5" />
      </template>

      <!-- hover guide line -->
      <line
        v-if="hovered"
        class="line-chart__guide"
        :x1="hovered.cx"
        :y1="PADDING.top"
        :x2="hovered.cx"
        :y2="plot.baseY"
      />

      <!-- data points + highlighted hover points -->
      <g v-for="line in plot.lines" :key="`pts-${line.name}`" class="line-chart__points">
        <circle
          v-for="c in line.coords"
          :key="c.label"
          :cx="c.cx"
          :cy="c.cy"
          r="3"
          :fill="line.color"
        />
      </g>
      <g v-if="hovered" class="line-chart__hover">
        <circle
          v-for="row in hovered.rows"
          :key="`h-${row.name}`"
          :cx="row.coord.cx"
          :cy="row.coord.cy"
          r="5.5"
          :fill="row.color"
        />
      </g>

      <g class="line-chart__xlabels">
        <text
          v-for="(label, i) in plot.labels"
          :key="label"
          :x="plot.x(i)"
          :y="plot.baseY + 20"
          text-anchor="middle"
        >
          {{ label }}
        </text>
      </g>
    </svg>

    <div v-if="hovered" class="line-chart__tooltip" :style="tooltipStyle">
      <span class="line-chart__tooltip-label">{{ hovered.label }}</span>
      <div v-for="row in hovered.rows" :key="`tt-${row.name}`" class="line-chart__tooltip-row">
        <span
          v-if="row.name"
          class="line-chart__tooltip-swatch"
          :style="{ background: row.color }"
        />
        <span v-if="row.name" class="line-chart__tooltip-name">{{ row.name }}</span>
        <span class="line-chart__tooltip-value">{{ formatValue(row.coord.value) }}</span>
      </div>
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

.line-chart__guide {
  stroke: #9ca3af;
  stroke-width: 1;
  stroke-dasharray: 4 4;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 2;
}

.line-chart__tooltip-label {
  display: block;
  color: #9ca3af;
  font-size: 11px;
  margin-bottom: 3px;
}

.line-chart__tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.line-chart__tooltip-swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex-shrink: 0;
}

.line-chart__tooltip-name {
  color: #d1d5db;
  margin-right: 8px;
}

.line-chart__tooltip-value {
  font-weight: 600;
  margin-left: auto;
}

.line-chart__empty {
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
  padding: 24px 0;
}
</style>
