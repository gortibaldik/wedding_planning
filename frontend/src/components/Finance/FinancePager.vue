<script setup lang="ts">
const page = defineModel<number>({ required: true })
defineProps<{ totalPages: number }>()
</script>

<template>
  <div v-if="totalPages > 1" class="fin__pager">
    <button class="fin__pager-btn" :disabled="page === 1" @click="page--">‹ Prev</button>
    <span class="fin__pager-info">Page {{ page }} of {{ totalPages }}</span>
    <button class="fin__pager-btn" :disabled="page === totalPages" @click="page++">Next ›</button>
  </div>
</template>

<style scoped>
/* Deliberately styled apart from `fin__btn` (white/blue action buttons): a gray
   pill with flat buttons, so pagination reads as navigation, not table actions. */
.fin__pager {
  display: flex;
  align-items: center;
  gap: 10px;
  align-self: center;
  padding: 4px 6px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.fin__pager-btn {
  border: none;
  background: transparent;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 5px 12px;
  border-radius: 6px;
}

.fin__pager-btn:hover:not(:disabled) {
  background: white;
}

.fin__pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.fin__pager-info {
  font-size: 13px;
  font-weight: 500;
  color: #4b5563;
}
</style>
