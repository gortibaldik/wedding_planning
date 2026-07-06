<script setup lang="ts">
import { computed } from 'vue'
import type { SeriesPoint } from '@/composables/useFinance'

const props = withDefaults(
  defineProps<{
    slices: SeriesPoint[]
    formatValue?: (value: number) => string
  }>(),
  {
    formatValue: (value: number) => String(value)
  }
)

const PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16'
]

const RADIUS = 100
const CENTER = 110

// Convert a fraction of the circle (0..1) into an SVG point on the circle.
const pointAt = (fraction: number) => {
  const angle = fraction * 2 * Math.PI - Math.PI / 2
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle)
  }
}

const total = computed(() => props.slices.reduce((sum, s) => sum + s.value, 0))

const arcs = computed(() => {
  if (total.value <= 0) return []
  let cursor = 0
  return props.slices.map((slice, i) => {
    const fraction = slice.value / total.value
    const start = pointAt(cursor)
    cursor += fraction
    const end = pointAt(cursor)
    const largeArc = fraction > 0.5 ? 1 : 0
    // A single full slice can't be drawn with an arc; use a full circle instead.
    const path =
      fraction >= 1
        ? `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS} Z`
        : `M ${CENTER} ${CENTER} L ${start.x} ${start.y} ` +
          `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
    return {
      ...slice,
      path,
      color: PALETTE[i % PALETTE.length],
      percent: fraction * 100
    }
  })
})
</script>

<template>
  <div v-if="arcs.length" class="pie-chart">
    <svg :viewBox="`0 0 ${CENTER * 2} ${CENTER * 2}`" class="pie-chart__svg" role="img">
      <path
        v-for="arc in arcs"
        :key="arc.label"
        :d="arc.path"
        :fill="arc.color"
        stroke="#fff"
        stroke-width="1.5"
      >
        <title>{{ arc.label }}: {{ formatValue(arc.value) }} ({{ arc.percent.toFixed(1) }}%)</title>
      </path>
    </svg>
    <ul class="pie-chart__legend">
      <li v-for="arc in arcs" :key="arc.label">
        <span class="pie-chart__swatch" :style="{ background: arc.color }"></span>
        <span class="pie-chart__legend-label" :title="arc.label">{{ arc.label }}</span>
        <span class="pie-chart__legend-value">
          {{ formatValue(arc.value) }} ({{ arc.percent.toFixed(0) }}%)
        </span>
      </li>
    </ul>
  </div>
  <p v-else class="pie-chart__empty">No data for this month.</p>
</template>

<style scoped>
.pie-chart {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.pie-chart__svg {
  width: 220px;
  height: 220px;
  flex-shrink: 0;
}

.pie-chart__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
  flex: 1;
}

.pie-chart__legend li {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.pie-chart__swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.pie-chart__legend-label {
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pie-chart__legend-value {
  color: #6b7280;
  font-weight: 600;
  white-space: nowrap;
}

.pie-chart__empty {
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
  padding: 24px 0;
}
</style>
