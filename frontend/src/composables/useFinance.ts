import { computed, ref } from 'vue'
import { useAuth } from './useAuth'

const { authFetch } = useAuth()

/** One purchased item, mirroring `backend/routers/finance.py::FinanceItem`. */
export interface FinanceItem {
  id: string
  name: string
  price: number
  category: string
  /** ISO date string, e.g. "2026-07-06". */
  date: string
  /** The person who purchased the item. */
  buyer: string
}

/** Payload for creating an item (no id yet). */
export type FinanceItemInput = Omit<FinanceItem, 'id'>

/** A row returned by the SQL-like `/finance/grouped` endpoint. */
interface GroupedResult {
  keys: Record<string, string | number>
  total_price: number
  count: number
}

/** A single (label, value) datapoint consumed by the chart components. */
export interface SeriesPoint {
  label: string
  value: number
}

/** A named, colored monthly series for one category (multi-series line chart). */
export interface CategorySeries {
  name: string
  color: string
  points: SeriesPoint[]
}

/** Categorical palette used to color per-category lines, assigned by sorted order. */
const CATEGORY_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#a855f7'
]

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

// ---- Shared reactive state (module singletons, like the other composables) ----

const categories = ref<string[]>([])

// List view
const listItems = ref<FinanceItem[]>([])
const filterYear = ref<number | null>(null)
const filterCategory = ref<string | null>(null)

// Time-series charts
const monthlySeries = ref<SeriesPoint[]>([])
const yearlySeries = ref<SeriesPoint[]>([])
// Monthly totals split per category, aligned to a shared set of month labels.
const monthlyByCategory = ref<CategorySeries[]>([])

// Per-month breakdown (bar + pie)
const now = new Date()
const breakdownYear = ref<number>(now.getFullYear())
const breakdownMonth = ref<number>(now.getMonth() + 1)
const monthBreakdown = ref<SeriesPoint[]>([])

const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')

/** Years that actually have data, derived from the yearly series (for filters). */
const availableYears = computed(() =>
  yearlySeries.value.map(p => Number(p.label)).sort((a, b) => b - a)
)

const buildQuery = (
  params: Record<string, string | number | null | undefined | (string | number)[]>
): string => {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) value.forEach(v => sp.append(key, String(v)))
    else sp.append(key, String(value))
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

const getJson = async <T>(path: string): Promise<T> => {
  const res = await authFetch(`/finance${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/** Sum item prices by their `name`, biggest first — used for the month breakdown. */
const aggregateByName = (items: FinanceItem[]): SeriesPoint[] => {
  const totals = new Map<string, number>()
  for (const item of items) {
    totals.set(item.name, (totals.get(item.name) ?? 0) + item.price)
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export function useFinance() {
  const withErrorHandling = async (action: () => Promise<void>) => {
    loading.value = true
    errorMsg.value = ''
    try {
      await action()
    } catch (e) {
      errorMsg.value = 'Failed to load: ' + (e instanceof Error ? e.message : String(e))
    } finally {
      loading.value = false
    }
  }

  const loadCategories = () =>
    withErrorHandling(async () => {
      categories.value = await getJson<string[]>('/categories')
    })

  const loadListItems = () =>
    withErrorHandling(async () => {
      const query = buildQuery({
        year: filterYear.value,
        category: filterCategory.value
      })
      listItems.value = await getJson<FinanceItem[]>(`/get${query}`)
    })

  /** Monthly totals across the whole history, as a chronological time series. */
  const loadMonthlySeries = () =>
    withErrorHandling(async () => {
      const rows = await getJson<GroupedResult[]>('/grouped?group_by=year&group_by=month')
      monthlySeries.value = rows
        .map(row => {
          const year = Number(row.keys.year)
          const month = Number(row.keys.month)
          return {
            sortKey: year * 100 + month,
            label: `${MONTH_NAMES[month - 1]} ${year}`,
            value: row.total_price
          }
        })
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(({ label, value }) => ({ label, value }))
    })

  /** Monthly totals split by category, aligned to one shared month axis. */
  const loadMonthlyByCategory = () =>
    withErrorHandling(async () => {
      const rows = await getJson<GroupedResult[]>(
        '/grouped?group_by=year&group_by=month&group_by=category'
      )

      // Collect the chronological set of (year, month) buckets -> x labels.
      const buckets = new Map<number, string>()
      for (const row of rows) {
        const year = Number(row.keys.year)
        const month = Number(row.keys.month)
        buckets.set(year * 100 + month, `${MONTH_NAMES[month - 1]} ${year}`)
      }
      const sortedKeys = [...buckets.keys()].sort((a, b) => a - b)
      const labels = sortedKeys.map(k => buckets.get(k)!)
      const indexOfKey = new Map(sortedKeys.map((k, i) => [k, i]))

      // Fill each category's values against the shared axis (0 where absent).
      const byCat = new Map<string, number[]>()
      for (const row of rows) {
        const category = String(row.keys.category)
        const idx = indexOfKey.get(Number(row.keys.year) * 100 + Number(row.keys.month))!
        if (!byCat.has(category)) byCat.set(category, new Array(labels.length).fill(0))
        byCat.get(category)![idx] += row.total_price
      }

      monthlyByCategory.value = [...byCat.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, values], i) => ({
          name,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          points: values.map((value, j) => ({ label: labels[j], value }))
        }))
    })

  /** Yearly totals, as a time series. Also drives `availableYears`. */
  const loadYearlySeries = () =>
    withErrorHandling(async () => {
      const rows = await getJson<GroupedResult[]>('/grouped?group_by=year')
      yearlySeries.value = rows
        .map(row => ({ label: String(row.keys.year), value: row.total_price }))
        .sort((a, b) => Number(a.label) - Number(b.label))
    })

  /** Items of the selected month, aggregated by good, for the bar + pie charts. */
  const loadMonthBreakdown = () =>
    withErrorHandling(async () => {
      const query = buildQuery({ year: breakdownYear.value, month: breakdownMonth.value })
      const items = await getJson<FinanceItem[]>(`/get${query}`)
      monthBreakdown.value = aggregateByName(items)
    })

  const refreshAll = async () => {
    await Promise.all([
      loadCategories(),
      loadListItems(),
      loadMonthlySeries(),
      loadMonthlyByCategory(),
      loadYearlySeries(),
      loadMonthBreakdown()
    ])
  }

  const addItem = async (input: FinanceItemInput): Promise<boolean> => {
    saving.value = true
    errorMsg.value = ''
    try {
      const res = await authFetch('/finance/set', {
        method: 'POST',
        body: JSON.stringify(input)
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail || `HTTP ${res.status}`)
      }
      await refreshAll()
      return true
    } catch (e) {
      errorMsg.value = 'Failed to save: ' + (e instanceof Error ? e.message : String(e))
      return false
    } finally {
      saving.value = false
    }
  }

  const deleteItem = async (id: string) => {
    errorMsg.value = ''
    try {
      const res = await authFetch(`/finance/set/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await refreshAll()
    } catch (e) {
      errorMsg.value = 'Failed to delete: ' + (e instanceof Error ? e.message : String(e))
    }
  }

  const formatMoney = (value: number): string =>
    value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return {
    // state
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
    // actions
    loadCategories,
    loadListItems,
    loadMonthlySeries,
    loadMonthlyByCategory,
    loadYearlySeries,
    loadMonthBreakdown,
    refreshAll,
    addItem,
    deleteItem,
    // helpers
    formatMoney,
    MONTH_NAMES
  }
}
