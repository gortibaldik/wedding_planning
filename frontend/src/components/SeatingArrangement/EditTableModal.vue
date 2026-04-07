<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue'
import type { Table } from '@/composables/useSeatingData'

export interface EditTablePayload {
  name: string
  seats: number
}

const props = defineProps<{
  show: boolean
  table: Table | null
}>()
const emit = defineEmits<{
  close: []
  save: [payload: EditTablePayload]
}>()

const name = ref('')
const seats = ref(1)
const nameInput = ref<HTMLInputElement | null>(null)

const minSeats = computed(() => {
  if (!props.table) return 1
  const seated = props.table.guests.filter(g => g).length
  return Math.max(1, seated)
})

watch(
  () => [props.show, props.table] as const,
  ([show, table]) => {
    if (show && table) {
      name.value = table.name
      seats.value = table.seats
      nextTick(() => nameInput.value?.focus())
    }
  },
  { immediate: true }
)

const close = (): void => {
  emit('close')
}

const submit = (): void => {
  if (!props.table) return
  const trimmed = name.value.trim()
  if (!trimmed) return
  if (seats.value < minSeats.value) return
  emit('save', { name: trimmed, seats: seats.value })
  close()
}
</script>

<template>
  <div v-if="show && table" class="modal-overlay" @click="close">
    <div class="modal" @click.stop>
      <h3>Edit Table</h3>
      <form @submit.prevent="submit">
        <div class="form-group">
          <label>Table Name:</label>
          <input ref="nameInput" v-model="name" type="text" required />
        </div>
        <div class="form-group">
          <label>Number of Seats:</label>
          <input v-model.number="seats" type="number" :min="minSeats" required />
          <small class="hint">Minimum: {{ minSeats }} (currently seated guests)</small>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          <button type="button" class="btn btn-secondary" @click="close">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
@import '@/assets/styles/modal.css';

.hint {
  display: block;
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}
</style>
