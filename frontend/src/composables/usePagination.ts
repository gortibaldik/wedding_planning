import { computed, ref, watch, type Ref } from 'vue'

export const PAGE_SIZES = [10, 25, 50, 100]

/**
 * Client-side pagination over an already loaded list. Unlike the data
 * composables this holds per-component state (each caller gets its own page).
 */
export function usePagination<T>(items: Ref<T[]>, initialPageSize = 25) {
  const pageSize = ref(initialPageSize)
  const page = ref(1)

  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / pageSize.value)))

  const pagedItems = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return items.value.slice(start, start + pageSize.value)
  })

  // Keep the page in range when the list shrinks or the page size grows.
  watch(totalPages, total => {
    if (page.value > total) page.value = total
  })

  return { PAGE_SIZES, pageSize, page, totalPages, pagedItems }
}
