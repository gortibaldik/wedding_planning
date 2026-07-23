<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  name: string
  ownerName: string
  filteredCount: number
  totalCount: number
  countLabel: string
  filtersActive: boolean
}>()

const filtersOpen = ref(false)
</script>

<template>
  <div class="it__section">
    <h3 class="it__section-title" @click="filtersOpen = !filtersOpen">
      {{ name }}
      <span class="it__owner-name">({{ ownerName }})</span>
      <span class="it__final-badge">FINAL</span>
      - {{ filteredCount
      }}<template v-if="filteredCount !== totalCount">/{{ totalCount }}</template>
      {{ countLabel }}
      <span class="it__filter-toggle" :class="{ 'it__filter-toggle--active': filtersActive }">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span v-if="filtersActive" class="it__filter-dot" />
      </span>
      <svg
        class="it__chevron"
        :class="{ 'it__chevron--open': filtersOpen }"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </h3>
    <div v-if="filtersOpen" class="it__filters">
      <slot name="filters" />
    </div>
  </div>
</template>
