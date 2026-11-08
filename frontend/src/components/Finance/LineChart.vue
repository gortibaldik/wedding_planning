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
// Y-axis labels are right-aligned this far left of the plot area.
const TICK_GAP = 8
// Upper bound on the width of one character of an 11px axis label, in viewBox
// units (the SVG is drawn at its native size, so units ~ px). Deliberately
// generous: overestimating only adds a little whitespace, underestimating clips
// the leading digits off the SVG's left edge.
const TICK_CHAR_WIDTH = 7

const isSingle = computed(() => props.series.length === 1)
const hasData = computed(() => props.series.some(s => s.points.length))

const plot = computed(() => {
  const series = props.series
  const labels = series[0]?.points.map(p => p.label) ?? []
  const count = labels.length

  const allValues = series.flatMap(s => s.points.map(p => p.value))
  const maxValue = Math.max(1, ...allValues)

  // 4 horizontal grid lines / y-axis ticks
  const tickValues = Array.from({ length: 5 }, (_, i) => (maxValue / 4) * i)
  const tickLabels = tickValues.map(v => props.formatValue(v))

  // Widen the left margin to fit the longest y-axis label: a fixed margin
  // clipped six-digit amounts like "123,456.00" down to "23,456.00".
  const longestTick = Math.max(...tickLabels.map(l => l.length))
  const left = Math.max(PADDING.left, TICK_GAP + Math.ceil(longestTick * TICK_CHAR_WIDTH))

  const innerW = WIDTH - left - PADDING.right
  const innerH = HEIGHT - PADDING.top - PADDING.bottom

  const x = (i: number) => left + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW)
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

  const ticks = tickValues.map((value, i) => ({ value, label: tickLabels[i], y: y(value) }))

  return { labels, count, lines, ticks, left, baseY: PADDING.top + innerH, x }
})

// --- interactive tooltip ---------------------------------------------------
// The SVG keeps its native 640x260 aspect ratio (width:100%, height:auto), so the
// rendered box maps 1:1 to the viewBox: mouse -> viewBox and coords -> % via ratios.
const containerRef = ref<HTMLElement | null>(null)
const hoverIndex = ref<number | null>(null)
// Cursor position in viewBox units, used to pick the line under the cursor.
const hoverPoint = ref<{ x: number; y: number } | null>(null)

/** Height of a line at viewBox x, interpolated between its neighbouring points. */
const lineYAt = (coords: { cx: number; cy: number }[], vbX: number): number => {
  if (vbX <= coords[0].cx) return coords[0].cy
  for (let j = 0; j < coords.length - 1; j++) {
    const a = coords[j]
    const b = coords[j + 1]
    if (vbX <= b.cx) return a.cy + ((vbX - a.cx) / (b.cx - a.cx)) * (b.cy - a.cy)
  }
  return coords[coords.length - 1].cy
}

const updateHover = (clientX: number, clientY: number) => {
  const el = containerRef.value
  if (!el || !plot.value.count) return
  const rect = el.getBoundingClientRect()
  const vbX = ((clientX - rect.left) / rect.width) * WIDTH
  hoverPoint.value = { x: vbX, y: ((clientY - rect.top) / rect.height) * HEIGHT }
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

const onMove = (e: MouseEvent) => updateHover(e.clientX, e.clientY)
const onTouch = (e: TouchEvent) => {
  if (e.touches.length) updateHover(e.touches[0].clientX, e.touches[0].clientY)
}
const onLeave = () => {
  hoverIndex.value = null
  hoverPoint.value = null
}

/** Name of the line closest to the cursor; null when there is only one line. */
const activeLine = computed(() => {
  const point = hoverPoint.value
  if (!point || isSingle.value) return null
  let best: string | null = null
  let bestDist = Infinity
  for (const line of plot.value.lines) {
    if (!line.coords.length) continue
    const dist = Math.abs(lineYAt(line.coords, point.x) - point.y)
    if (dist < bestDist) {
      bestDist = dist
      best = line.name
    }
  }
  return best
})

/** The x-position and per-series values at the hovered index. */
const hovered = computed(() => {
  const i = hoverIndex.value
  if (i === null || i >= plot.value.count) return null
  const cx = plot.value.x(i)
  const rows = plot.value.lines
    .map(l => ({
      name: l.name,
      color: l.color,
      coord: l.coords[i],
      active: l.name === activeLine.value
    }))
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
          <line :x1="plot.left" :y1="tick.y" :x2="WIDTH - PADDING.right" :y2="tick.y" />
          <text :x="plot.left - TICK_GAP" :y="tick.y + 4" text-anchor="end">
            {{ tick.label }}
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
      <div
        v-for="row in hovered.rows"
        :key="`tt-${row.name}`"
        class="line-chart__tooltip-row"
        :class="{ 'line-chart__tooltip-row--active': row.active }"
      >
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
  /* Padding offset by negative margin, so the active highlight has room
     without shifting rows out of line with the label above. */
  padding: 1px 4px;
  margin: 0 -4px;
  border-radius: 4px;
}

/* The row for the line under the cursor. */
.line-chart__tooltip-row--active {
  background: rgba(255, 255, 255, 0.16);
}

.line-chart__tooltip-row--active .line-chart__tooltip-name {
  color: #f9fafb;
}

.line-chart__tooltip-row--active .line-chart__tooltip-value {
  font-weight: 700;
  color: #fff;
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
