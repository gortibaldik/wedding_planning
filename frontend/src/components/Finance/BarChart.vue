<script setup lang="ts">
import { computed } from 'vue'
import type { SeriesPoint } from '@/composables/useFinance'

const props = withDefaults(
  defineProps<{
    bars: SeriesPoint[]
    color?: string
    formatValue?: (value: number) => string
  }>(),
  {
    color: '#6366f1',
    formatValue: (value: number) => String(value)
  }
)

const maxValue = computed(() => Math.max(1, ...props.bars.map(b => b.value)))
</script>

<template>
  <div v-if="bars.length" class="bar-chart">
    <div v-for="bar in bars" :key="bar.label" class="bar-chart__row">
      <span class="bar-chart__label" :title="bar.label">{{ bar.label }}</span>
      <div class="bar-chart__track">
        <div
          class="bar-chart__fill"
          :style="{ width: `${(bar.value / maxValue) * 100}%`, background: color }"
        ></div>
      </div>
      <span class="bar-chart__value">{{ formatValue(bar.value) }}</span>
    </div>
  </div>
  <p v-else class="bar-chart__empty">No data for this month.</p>
</template>

<style scoped>
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-chart__row {
  display: grid;
  grid-template-columns: 120px 1fr 90px;
  align-items: center;
  gap: 10px;
}

.bar-chart__label {
  font-size: 13px;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-chart__track {
  background: #f3f4f6;
  border-radius: 6px;
  height: 20px;
  overflow: hidden;
}

.bar-chart__fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
}

.bar-chart__value {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  text-align: right;
}

.bar-chart__empty {
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
  padding: 24px 0;
}
</style>
