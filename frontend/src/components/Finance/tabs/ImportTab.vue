<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFinance } from '@/composables/useFinance'
import { useFinanceSubTabs } from '@/composables/useFinanceSubTabs'

const {
  importRows,
  importing,
  saving,
  importPreview,
  removeImportRow,
  clearImport,
  commitImport,
  formatMoney
} = useFinance()

const { setSubTab } = useFinanceSubTabs()

// ---- Revolut import ----
const fileInput = ref<HTMLInputElement | null>(null)

const onFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await importPreview(file)
  input.value = '' // allow re-selecting the same file
}

const importTotal = computed(() =>
  importRows.value.reduce((sum, row) => sum + Number(row.price || 0), 0)
)

// ---- Bulk selection & edit for the review table ----
const selectedKeys = ref<Set<number>>(new Set())

const isRowSelected = (key: number) => selectedKeys.value.has(key)

const toggleRow = (key: number) => {
  if (selectedKeys.value.has(key)) selectedKeys.value.delete(key)
  else selectedKeys.value.add(key)
}

// Selection only counts rows that still exist (rows may be removed).
const selectedCount = computed(
  () => importRows.value.filter(row => selectedKeys.value.has(row._key)).length
)

const allImportSelected = computed(
  () => importRows.value.length > 0 && selectedCount.value === importRows.value.length
)

const toggleAllImport = () => {
  selectedKeys.value = allImportSelected.value
    ? new Set()
    : new Set(importRows.value.map(row => row._key))
}

const bulkCategory = ref('')
const bulkBuyer = ref('')

const applyBulk = (field: 'category' | 'buyer', value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return
  for (const row of importRows.value) {
    if (selectedKeys.value.has(row._key)) row[field] = trimmed
  }
}

const removeRow = (key: number) => {
  removeImportRow(key)
  selectedKeys.value.delete(key)
}

const resetImport = () => {
  clearImport()
  selectedKeys.value = new Set()
  bulkCategory.value = ''
  bulkBuyer.value = ''
}

// Import the checked rows, or everything when nothing is checked.
const rowsToImport = computed(() =>
  selectedCount.value
    ? importRows.value.filter(row => selectedKeys.value.has(row._key))
    : importRows.value
)

const doCommitImport = async () => {
  const ok = await commitImport(rowsToImport.value)
  if (ok) {
    selectedKeys.value = new Set()
    // Leave any un-imported rows for further review; only leave when done.
    if (!importRows.value.length) setSubTab('items')
  }
}
</script>

<template>
  <section class="fin__panel">
    <div class="fin__card">
      <h3 class="fin__card-title">Import a Revolut statement</h3>
      <p class="fin__hint">
        Upload the Excel export from Revolut. Only outgoing payments (expenses) are picked up.
        Review and edit the rows below, then approve to add them.
      </p>
      <div class="fin__import-actions">
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx"
          class="fin__file"
          @change="onFileChange"
        />
        <button class="fin__btn" @click="fileInput?.click()" :disabled="importing">
          {{ importing ? 'Parsing…' : importRows.length ? 'Choose another file' : 'Choose file' }}
        </button>
      </div>
    </div>

    <div v-if="importRows.length" class="fin__import-review">
      <div class="fin__toolbar">
        <div class="fin__import-summary">
          {{ importRows.length }} expense{{ importRows.length === 1 ? '' : 's' }} — total
          {{ formatMoney(importTotal) }}
        </div>
        <div class="fin__import-buttons">
          <button class="fin__btn" @click="resetImport" :disabled="saving">Clear</button>
          <button
            class="fin__btn fin__btn--primary"
            @click="doCommitImport"
            :disabled="saving || !rowsToImport.length"
          >
            {{
              saving
                ? 'Importing…'
                : selectedCount
                  ? `Approve & import ${selectedCount} selected`
                  : `Approve & import ${importRows.length}`
            }}
          </button>
        </div>
      </div>

      <!-- Bulk-edit bar: set the same category / buyer on all selected rows. -->
      <div v-if="selectedCount" class="fin__bulk">
        <span class="fin__bulk-count">{{ selectedCount }} selected</span>
        <div class="fin__bulk-field">
          <input
            v-model="bulkCategory"
            list="fin-categories"
            class="fin__cell-input"
            placeholder="Category…"
            @keyup.enter="applyBulk('category', bulkCategory)"
          />
          <button
            class="fin__btn"
            :disabled="!bulkCategory.trim()"
            @click="applyBulk('category', bulkCategory)"
          >
            Set category
          </button>
        </div>
        <div class="fin__bulk-field">
          <input
            v-model="bulkBuyer"
            class="fin__cell-input"
            placeholder="Buyer…"
            @keyup.enter="applyBulk('buyer', bulkBuyer)"
          />
          <button
            class="fin__btn"
            :disabled="!bulkBuyer.trim()"
            @click="applyBulk('buyer', bulkBuyer)"
          >
            Set buyer
          </button>
        </div>
      </div>

      <table class="fin__table">
        <thead>
          <tr>
            <th class="fin__check-col">
              <input
                type="checkbox"
                :checked="allImportSelected"
                title="Select all"
                @change="toggleAllImport"
              />
            </th>
            <th>Date</th>
            <th>Name</th>
            <th>Category</th>
            <th>Buyer</th>
            <th class="fin__num">Price</th>
            <th class="fin__num">Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in importRows"
            :key="row._key"
            :class="{ 'fin__row--selected': isRowSelected(row._key) }"
          >
            <td class="fin__check-col">
              <input
                type="checkbox"
                :checked="isRowSelected(row._key)"
                @change="toggleRow(row._key)"
              />
            </td>
            <td><input v-model="row.date" type="date" class="fin__cell-input" /></td>
            <td><input v-model="row.name" class="fin__cell-input" placeholder="Name" /></td>
            <td>
              <input
                v-model="row.category"
                list="fin-categories"
                class="fin__cell-input"
                placeholder="Category"
              />
            </td>
            <td><input v-model="row.buyer" class="fin__cell-input" placeholder="Buyer" /></td>
            <td class="fin__num">
              <input
                v-model.number="row.price"
                type="number"
                step="0.01"
                min="0"
                class="fin__cell-input fin__cell-input--num"
              />
            </td>
            <td class="fin__num fin__source">
              {{ formatMoney(row.source_amount) }} {{ row.source_currency }}
            </td>
            <td>
              <button class="fin__delete" title="Remove" @click="removeRow(row._key)">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.fin__hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: #6b7280;
}

.fin__import-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.fin__file {
  display: none;
}

.fin__import-review {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fin__import-summary {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.fin__import-buttons {
  display: flex;
  gap: 8px;
}

.fin__source {
  color: #9ca3af;
  font-size: 12px;
  white-space: nowrap;
}

.fin__bulk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
}

.fin__bulk-count {
  font-size: 13px;
  font-weight: 600;
  color: #1d4ed8;
}

.fin__bulk-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fin__bulk-field .fin__cell-input {
  width: 160px;
}

.fin__bulk-field .fin__btn {
  padding: 6px 12px;
  font-size: 13px;
  white-space: nowrap;
}

.fin__check-col {
  width: 36px;
  text-align: center;
}

.fin__check-col input {
  cursor: pointer;
}

.fin__row--selected {
  background: #eff6ff;
}
</style>
