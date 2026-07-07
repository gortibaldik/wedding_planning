<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFinance } from '@/composables/useFinance'
import LineChart, { type ChartSeries } from '../LineChart.vue'

const { monthlySeries, yearlySeries, monthlyByCategory, formatMoney } = useFinance()

// ---- Monthly chart: single total, or split into per-category lines ----
const splitByCategory = ref(false)

// Which categories are visible when split. New categories appear selected; user
// toggles persist across refreshes (adding an item won't reset the selection).
const selectedCategories = ref<string[]>([])
const knownCategories = new Set<string>()

watch(
  monthlyByCategory,
  list => {
    const names = list.map(s => s.name)
    const sel = selectedCategories.value.filter(n => names.includes(n))
    for (const n of names) {
      if (!knownCategories.has(n)) {
        knownCategories.add(n)
        sel.push(n)
      }
    }
    selectedCategories.value = sel
  },
  { immediate: true }
)

const toggleCategory = (name: string) => {
  selectedCategories.value = selectedCategories.value.includes(name)
    ? selectedCategories.value.filter(n => n !== name)
    : [...selectedCategories.value, name]
}

const allSelected = computed(
  () => selectedCategories.value.length === monthlyByCategory.value.length
)

const toggleAllCategories = () => {
  selectedCategories.value = allSelected.value ? [] : monthlyByCategory.value.map(s => s.name)
}

const monthlyChart = computed<ChartSeries[]>(() =>
  splitByCategory.value
    ? monthlyByCategory.value.filter(s => selectedCategories.value.includes(s.name))
    : [{ name: 'Total', color: '#3b82f6', points: monthlySeries.value }]
)

const yearlyChart = computed<ChartSeries[]>(() => [
  { name: 'Total', color: '#10b981', points: yearlySeries.value }
])
</script>

<template>
  <section class="fin__panel">
    <div class="fin__card">
      <h3 class="fin__card-title">Spending per month</h3>
      <div class="fin__chart-menu">
        <label class="fin__check">
          <input v-model="splitByCategory" type="checkbox" />
          Split by categories
        </label>
      </div>
      <div v-if="splitByCategory && monthlyByCategory.length" class="fin__legend">
        <button class="fin__legend-item fin__legend-item--all" @click="toggleAllCategories">
          {{ allSelected ? 'Clear all' : 'Select all' }}
        </button>
        <button
          v-for="s in monthlyByCategory"
          :key="s.name"
          class="fin__legend-item"
          :class="{ 'fin__legend-item--off': !selectedCategories.includes(s.name) }"
          @click="toggleCategory(s.name)"
        >
          <span class="fin__legend-swatch" :style="{ background: s.color }" />
          {{ s.name }}
        </button>
      </div>
      <LineChart :series="monthlyChart" :format-value="formatMoney" />
    </div>
    <div class="fin__card">
      <h3 class="fin__card-title">Spending per year</h3>
      <LineChart :series="yearlyChart" :format-value="formatMoney" />
    </div>
  </section>
</template>

<style scoped>
.fin__chart-menu {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.fin__check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

.fin__check input {
  cursor: pointer;
}

.fin__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.fin__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: white;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: opacity 0.15s;
}

.fin__legend-item--off {
  opacity: 0.4;
}

.fin__legend-item--all {
  border-style: dashed;
  color: #6b7280;
}

.fin__legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
</style>
