<script setup lang="ts">
import type { I18nFile, I18nValue } from '@/composables/useManagedFiles'

defineProps<{
  value: I18nFile
}>()

const emit = defineEmits<{
  (e: 'update', path: (string | number)[], val: I18nValue): void
  (e: 'move', arrayPath: (string | number)[], from: number, to: number): void
}>()

const onText = (path: (string | number)[], ev: Event) => {
  emit('update', path, (ev.target as HTMLInputElement | HTMLTextAreaElement).value)
}

const move = (arrayPath: (string | number)[], from: number, to: number) => {
  emit('move', arrayPath, from, to)
}
</script>

<template>
  <div class="mfne">
    <details class="mfne__group" open>
      <summary class="mfne__legend">Page</summary>
      <label class="mfne__field">
        <span class="mfne__label">Language code</span>
        <input class="mfne__input" :value="value.lang" @input="onText(['lang'], $event)" />
      </label>
      <label class="mfne__field">
        <span class="mfne__label">Page title</span>
        <input
          class="mfne__input"
          :value="value.page_title"
          @input="onText(['page_title'], $event)"
        />
      </label>
    </details>

    <details class="mfne__group" open>
      <summary class="mfne__legend">Couple</summary>
      <label class="mfne__field">
        <span class="mfne__label">Bride</span>
        <input class="mfne__input" :value="value.bride" @input="onText(['bride'], $event)" />
      </label>
      <label class="mfne__field">
        <span class="mfne__label">Connector</span>
        <input
          class="mfne__input"
          :value="value.connector"
          @input="onText(['connector'], $event)"
        />
      </label>
      <label class="mfne__field">
        <span class="mfne__label">Groom</span>
        <input class="mfne__input" :value="value.groom" @input="onText(['groom'], $event)" />
      </label>
    </details>

    <details class="mfne__group" open>
      <summary class="mfne__legend">Features</summary>
      <label class="mfne__field mfne__field--inline">
        <input
          type="checkbox"
          class="mfne__checkbox"
          :checked="value.enable_rickroll"
          @change="emit('update', ['enable_rickroll'], ($event.target as HTMLInputElement).checked)"
        />
        <span class="mfne__label">Enable rickroll</span>
      </label>
    </details>

    <details class="mfne__group" open>
      <summary class="mfne__legend">Wedding date</summary>
      <label class="mfne__field">
        <span class="mfne__label">Label</span>
        <input
          class="mfne__input"
          :value="value.wedding_date_label"
          @input="onText(['wedding_date_label'], $event)"
        />
      </label>
      <label class="mfne__field">
        <span class="mfne__label">Date</span>
        <input
          class="mfne__input"
          :value="value.wedding_date"
          @input="onText(['wedding_date'], $event)"
        />
      </label>
    </details>

    <details class="mfne__group" open>
      <summary class="mfne__legend">Sections</summary>
      <details v-for="(section, i) in value.sections" :key="i" class="mfne__subgroup" open>
        <summary class="mfne__sublegend">
          Section {{ i + 1 }}
          <span class="mfne__type-tag">{{ section.type }}</span>
          <span class="mfne__reorder" @click.stop>
            <button
              type="button"
              class="mfne__move-btn"
              :disabled="i === 0"
              title="Move up"
              @click="move(['sections'], i, i - 1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="mfne__move-btn"
              :disabled="i === value.sections.length - 1"
              title="Move down"
              @click="move(['sections'], i, i + 1)"
            >
              ↓
            </button>
          </span>
        </summary>
        <label class="mfne__field">
          <span class="mfne__label">Title</span>
          <input
            class="mfne__input"
            :value="section.title"
            @input="onText(['sections', i, 'title'], $event)"
          />
        </label>

        <template v-if="section.type === 'text'">
          <label class="mfne__field">
            <span class="mfne__label">Text</span>
            <textarea
              class="mfne__input"
              :value="section.text"
              rows="4"
              @input="onText(['sections', i, 'text'], $event)"
            />
          </label>
        </template>

        <template v-else-if="section.type === 'info-grid'">
          <div class="mfne__rows">
            <div v-for="(row, j) in section.rows" :key="j" class="mfne__row">
              <div class="mfne__row-header">
                <span class="mfne__row-title">Row {{ j + 1 }}</span>
                <span class="mfne__reorder">
                  <button
                    type="button"
                    class="mfne__move-btn"
                    :disabled="j === 0"
                    title="Move up"
                    @click="move(['sections', i, 'rows'], j, j - 1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="mfne__move-btn"
                    :disabled="j === section.rows.length - 1"
                    title="Move down"
                    @click="move(['sections', i, 'rows'], j, j + 1)"
                  >
                    ↓
                  </button>
                </span>
              </div>
              <label class="mfne__field">
                <span class="mfne__label">Label</span>
                <input
                  class="mfne__input"
                  :value="row.label"
                  @input="onText(['sections', i, 'rows', j, 'label'], $event)"
                />
              </label>
              <label class="mfne__field">
                <span class="mfne__label">Value</span>
                <input
                  class="mfne__input"
                  :value="row.value"
                  @input="onText(['sections', i, 'rows', j, 'value'], $event)"
                />
              </label>
            </div>
          </div>
        </template>
      </details>
    </details>

    <details class="mfne__group" open>
      <summary class="mfne__legend">Admin</summary>
      <label class="mfne__field">
        <span class="mfne__label">Title</span>
        <input
          class="mfne__input"
          :value="value.admin.title"
          @input="onText(['admin', 'title'], $event)"
        />
      </label>
      <label class="mfne__field">
        <span class="mfne__label">Login button</span>
        <input
          class="mfne__input"
          :value="value.admin.login_button"
          @input="onText(['admin', 'login_button'], $event)"
        />
      </label>
      <label class="mfne__field">
        <span class="mfne__label">Login prompt</span>
        <input
          class="mfne__input"
          :value="value.admin.login_prompt"
          @input="onText(['admin', 'login_prompt'], $event)"
        />
      </label>
    </details>
  </div>
</template>

<style scoped>
.mfne {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mfne__group {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafbfc;
}

.mfne__group[open] > *:not(summary) {
  margin-top: 10px;
}

.mfne__group > *:not(summary) + *:not(summary) {
  margin-top: 10px;
}

.mfne__legend {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.mfne__legend::-webkit-details-marker {
  display: none;
}

.mfne__legend::before {
  content: '▸';
  font-size: 12px;
  color: #6b7280;
  transition: transform 0.15s;
  display: inline-block;
}

.mfne__group[open] > .mfne__legend::before {
  transform: rotate(90deg);
}

.mfne__subgroup {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
}

.mfne__subgroup[open] > *:not(summary) {
  margin-top: 10px;
}

.mfne__subgroup > *:not(summary) + *:not(summary) {
  margin-top: 10px;
}

.mfne__sublegend {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.mfne__sublegend::-webkit-details-marker {
  display: none;
}

.mfne__sublegend::before {
  content: '▸';
  font-size: 11px;
  color: #6b7280;
  transition: transform 0.15s;
  display: inline-block;
}

.mfne__subgroup[open] > .mfne__sublegend::before {
  transform: rotate(90deg);
}

.mfne__type-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  background: #e0e7ff;
  color: #3730a3;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.mfne__field {
  display: grid;
  grid-template-columns: minmax(120px, 180px) 1fr;
  gap: 12px;
  align-items: start;
}

.mfne__label {
  font-size: 13px;
  color: #4b5563;
  font-weight: 500;
  padding-top: 8px;
}

.mfne__input {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #1f2937;
  font-family: inherit;
  resize: vertical;
}

.mfne__input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.mfne__field--inline {
  display: flex;
  align-items: center;
  gap: 10px;
  grid-template-columns: none;
}

.mfne__field--inline .mfne__label {
  padding-top: 0;
}

.mfne__checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.mfne__reorder {
  display: inline-flex;
  gap: 4px;
  margin-left: auto;
}

.mfne__move-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  color: #4b5563;
  transition: background 0.15s;
}

.mfne__move-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #1f2937;
}

.mfne__move-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.mfne__row-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mfne__row-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mfne__rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mfne__row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px dashed #e5e7eb;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .mfne__field {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .mfne__label {
    padding-top: 0;
  }
}
</style>
