<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useFinance, type FinanceItemInput } from '@/composables/useFinance'
import LineChart, { type ChartSeries } from './LineChart.vue'
import BarChart from './BarChart.vue'
import PieChart from './PieChart.vue'

const {
  categories,
  listItems,
  filterYear,
  filterCategory,
  monthlySeries,
  yearlySeries,
  monthlyByCategory,
  breakdownYear,
  breakdownMonth,
  monthBreakdown,
  availableYears,
  loading,
  saving,
  errorMsg,
  loadListItems,
  loadMonthBreakdown,
  refreshAll,
  addItem,
  deleteItem,
  formatMoney,
  MONTH_NAMES
} = useFinance()

// ---- Sub-tab navigation (kept in the URL hash, like ManagedFilesEditor) ----
const SUB_TABS = ['trends', 'items', 'breakdown'] as const
type SubTab = (typeof SUB_TABS)[number]

const getSubTabFromHash = (): SubTab => {
  const sub = window.location.hash.slice(1).split('/')[1]
  return (SUB_TABS as readonly string[]).includes(sub) ? (sub as SubTab) : 'trends'
}
const activeSubTab = ref<SubTab>(getSubTabFromHash())
const setSubTab = (sub: SubTab) => {
  activeSubTab.value = sub
  const tab = window.location.hash.slice(1).split('/')[0] || 'finance'
  window.location.hash = `${tab}/${sub}`
}
const onHashChange = () => (activeSubTab.value = getSubTabFromHash())

// ---- Add-item form (local display state) ----
const today = new Date().toISOString().slice(0, 10)
const emptyForm = (): FinanceItemInput => ({
  name: '',
  price: 0,
  category: '',
  date: today,
  buyer: ''
})
const form = reactive<FinanceItemInput>(emptyForm())
const showForm = ref(false)

const formValid = computed(
  () =>
    form.name.trim() !== '' &&
    form.category.trim() !== '' &&
    form.buyer.trim() !== '' &&
    form.date !== '' &&
    form.price > 0
)

const submitForm = async () => {
  if (!formValid.value) return
  const ok = await addItem({ ...form, price: Number(form.price) })
  if (ok) {
    Object.assign(form, emptyForm())
    showForm.value = false
  }
}

const monthLabel = computed(() => `${MONTH_NAMES[breakdownMonth.value - 1]} ${breakdownYear.value}`)

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

// Reload the affected slices when their filters change.
watch([filterYear, filterCategory], loadListItems)
watch([breakdownYear, breakdownMonth], loadMonthBreakdown)

onMounted(() => {
  refreshAll()
  window.addEventListener('hashchange', onHashChange)
})
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <div class="fin">
    <div class="fin__subtabs">
      <button
        v-for="tab in SUB_TABS"
        :key="tab"
        class="fin__subtab"
        :class="{ 'fin__subtab--active': activeSubTab === tab }"
        @click="setSubTab(tab)"
      >
        {{ tab === 'trends' ? 'Trends' : tab === 'items' ? 'Items' : 'Month breakdown' }}
      </button>
    </div>

    <p v-if="errorMsg" class="fin__error">{{ errorMsg }}</p>

    <!-- ============================= TRENDS ============================= -->
    <section v-show="activeSubTab === 'trends'" class="fin__panel">
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

    <!-- ============================= ITEMS ============================= -->
    <section v-show="activeSubTab === 'items'" class="fin__panel">
      <div class="fin__toolbar">
        <div class="fin__filters">
          <label>
            Year
            <select v-model="filterYear">
              <option :value="null">All</option>
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
            </select>
          </label>
          <label>
            Category
            <select v-model="filterCategory">
              <option :value="null">All</option>
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
        </div>
        <button class="fin__btn fin__btn--primary" @click="showForm = !showForm">
          {{ showForm ? 'Cancel' : '+ Add item' }}
        </button>
      </div>

      <form v-if="showForm" class="fin__form" @submit.prevent="submitForm">
        <input v-model="form.name" placeholder="Name" />
        <input v-model.number="form.price" type="number" step="0.01" min="0" placeholder="Price" />
        <input v-model="form.category" list="fin-categories" placeholder="Category" />
        <datalist id="fin-categories">
          <option v-for="c in categories" :key="c" :value="c" />
        </datalist>
        <input v-model="form.buyer" placeholder="Buyer" />
        <input v-model="form.date" type="date" />
        <button class="fin__btn fin__btn--primary" type="submit" :disabled="!formValid || saving">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </form>

      <table class="fin__table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Category</th>
            <th>Buyer</th>
            <th class="fin__num">Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in listItems" :key="item.id">
            <td>{{ item.date }}</td>
            <td>{{ item.name }}</td>
            <td>
              <span class="fin__chip">{{ item.category }}</span>
            </td>
            <td>{{ item.buyer }}</td>
            <td class="fin__num">{{ formatMoney(item.price) }}</td>
            <td>
              <button class="fin__delete" title="Delete" @click="deleteItem(item.id)">×</button>
            </td>
          </tr>
          <tr v-if="!listItems.length && !loading">
            <td colspan="6" class="fin__empty">No items match these filters.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ========================= MONTH BREAKDOWN ========================= -->
    <section v-show="activeSubTab === 'breakdown'" class="fin__panel">
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
  </div>
</template>

<style scoped>
.fin {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
  background: #f9fafb;
}

.fin__subtabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.fin__subtab {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.15s;
}

.fin__subtab--active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.fin__error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  margin-bottom: 12px;
}

.fin__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
}

.fin__card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 18px;
}

.fin__card-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

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

.fin__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.fin__filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.fin__filters label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.fin__filters select,
.fin__filters input,
.fin__form input {
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.fin__year-input {
  width: 90px;
}

.fin__form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
}

.fin__btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.fin__btn--primary {
  background: #3b82f6;
  color: white;
}

.fin__btn--primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.fin__table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  font-size: 14px;
}

.fin__table th,
.fin__table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

.fin__table th {
  background: #f9fafb;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6b7280;
}

.fin__num {
  text-align: right;
}

.fin__chip {
  background: #eef2ff;
  color: #4338ca;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
}

.fin__delete {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 6px;
}

.fin__delete:hover {
  color: #ef4444;
}

.fin__empty {
  text-align: center;
  color: #9ca3af;
  padding: 20px;
}
</style>
