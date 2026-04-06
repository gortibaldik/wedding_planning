<script lang="ts" setup>
import { ref, nextTick } from 'vue'

export interface AddTablePayload {
  name: string
  shape: 'rectangular' | 'circular'
  seats: number
}

defineProps<{
  show: boolean
}>()
const emit = defineEmits<{
  close: []
  add: [payload: AddTablePayload]
}>()

const name = ref('')
const shape = ref<'rectangular' | 'circular'>('circular')
const seats = ref(8)
const nameInput = ref<HTMLInputElement | null>(null)

const close = (): void => {
  name.value = ''
  shape.value = 'circular'
  seats.value = 8
  emit('close')
}

const submit = (): void => {
  if (!name.value.trim()) return
  emit('add', {
    name: name.value.trim(),
    shape: shape.value,
    seats: seats.value
  })
  close()
}

defineExpose({ focusInput: () => nextTick(() => nameInput.value?.focus()) })
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="close">
    <div class="modal" @click.stop>
      <h3>Add Table</h3>
      <form @submit.prevent="submit">
        <div class="form-group">
          <label>Table Name:</label>
          <input ref="nameInput" v-model="name" type="text" placeholder="e.g. Table 1" required />
        </div>
        <div class="form-group">
          <label>Shape:</label>
          <select v-model="shape" required>
            <option value="ring">Circular</option>
            <option value="rectangular">Rectangular</option>
          </select>
        </div>
        <div class="form-group">
          <label>Number of Seats:</label>
          <input v-model.number="seats" type="number" min="2" max="20" required />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Add</button>
          <button type="button" class="btn btn-secondary" @click="close">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
@import '@/assets/styles/modal.css';
</style>
