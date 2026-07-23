<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ name: string; color: string; count: number }>()

const collapsed = ref(false)
</script>

<template>
  <div class="it__section" :class="{ 'it__section--collapsed': collapsed }">
    <h4 class="it__root-title" :style="{ borderLeftColor: color }" @click="collapsed = !collapsed">
      <span>{{ name }} ({{ count }})</span>
      <svg
        class="it__chevron"
        :class="{ 'it__chevron--collapsed': collapsed }"
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
    </h4>
    <slot />
  </div>
</template>
