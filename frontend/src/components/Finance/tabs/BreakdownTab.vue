<script setup lang="ts">
import { computed, watch } from 'vue'
import { useFinance } from '@/composables/useFinance'
import BarChart from '../BarChart.vue'
import PieChart from '../PieChart.vue'

const {
  breakdownYear,
  breakdownMonth,
  monthBreakdown,
  loadMonthBreakdown,
  formatMoney,
  MONTH_NAMES
} = useFinance()

const monthLabel = computed(() => `${MONTH_NAMES[breakdownMonth.value - 1]} ${breakdownYear.value}`)

// Reload the breakdown when its filters change.
watch([breakdownYear, breakdownMonth], loadMonthBreakdown)
</script>

<template>
  <section class="fin__panel">
    <div class="fin__filters">
      <label>
        Year
        <input v-model.number="breakdownYear" type="number" class="fin__year-input" />
      </label>
      <label>
        Month
        <select v-model.number="breakdownMonth">
          <option v-for="(name, i) in MONTH_NAMES" :key="name" :value="i + 1">{{ name }}</option>
        </select>
      </label>
    </div>

    <div class="fin__card">
      <h3 class="fin__card-title">Spending per good — {{ monthLabel }}</h3>
      <BarChart :bars="monthBreakdown" :format-value="formatMoney" />
    </div>
    <div class="fin__card">
      <h3 class="fin__card-title">Share per good — {{ monthLabel }}</h3>
      <PieChart :slices="monthBreakdown" :format-value="formatMoney" />
    </div>
  </section>
</template>

<style scoped>
.fin__year-input {
  width: 90px;
}
</style>
