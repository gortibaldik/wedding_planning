<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useFinance, type FinanceItem, type FinanceItemInput } from '@/composables/useFinance'
import { usePagination } from '@/composables/usePagination'
import FinancePager from '../FinancePager.vue'

const {
  categories,
  listItems,
  filterYear,
  filterCategory,
  availableYears,
  loading,
  saving,
  loadListItems,
  addItem,
  updateItem,
  deleteItem,
  formatMoney
} = useFinance()

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

// ---- Inline edit of an existing item ----
const editingId = ref<string | null>(null)
const editForm = reactive<FinanceItemInput>(emptyForm())

const editValid = computed(
  () =>
    editForm.name.trim() !== '' &&
    editForm.category.trim() !== '' &&
    editForm.buyer.trim() !== '' &&
    editForm.date !== '' &&
    editForm.price > 0
)

const startEdit = (item: FinanceItem) => {
  editingId.value = item.id
  Object.assign(editForm, {
    name: item.name,
    price: item.price,
    category: item.category,
    date: item.date,
    buyer: item.buyer
  })
}

const cancelEdit = () => {
  editingId.value = null
}

const saveEdit = async () => {
  if (!editingId.value || !editValid.value) return
  const ok = await updateItem(editingId.value, { ...editForm, price: Number(editForm.price) })
  if (ok) editingId.value = null
}

const { PAGE_SIZES, pageSize, page, totalPages, pagedItems } = usePagination(listItems)

// Reload the list when its filters change, and start over from the first page.
watch([filterYear, filterCategory], () => {
  page.value = 1
  loadListItems()
})
</script>

<template>
  <section class="fin__panel">
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
        <label>
          Per page
          <select v-model.number="pageSize">
            <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option>
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
      <input v-model="form.buyer" placeholder="Buyer" />
      <input v-model="form.date" type="date" />
      <button class="fin__btn fin__btn--primary" type="submit" :disabled="!formValid || saving">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </form>

    <FinancePager v-model="page" :total-pages="totalPages" />

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
        <tr v-for="item in pagedItems" :key="item.id">
          <template v-if="editingId === item.id">
            <td><input v-model="editForm.date" type="date" class="fin__cell-input" /></td>
            <td><input v-model="editForm.name" class="fin__cell-input" placeholder="Name" /></td>
            <td>
              <input
                v-model="editForm.category"
                list="fin-categories"
                class="fin__cell-input"
                placeholder="Category"
              />
            </td>
            <td>
              <input v-model="editForm.buyer" class="fin__cell-input" placeholder="Buyer" />
            </td>
            <td class="fin__num">
              <input
                v-model.number="editForm.price"
                type="number"
                step="0.01"
                min="0"
                class="fin__cell-input fin__cell-input--num"
              />
            </td>
            <td class="fin__row-actions">
              <button
                class="fin__icon-btn fin__icon-btn--save"
                title="Save"
                :disabled="!editValid || saving"
                @click="saveEdit"
              >
                ✓
              </button>
              <button class="fin__icon-btn" title="Cancel" @click="cancelEdit">×</button>
            </td>
          </template>
          <template v-else>
            <td>{{ item.date }}</td>
            <td>{{ item.name }}</td>
            <td>
              <span class="fin__chip">{{ item.category }}</span>
            </td>
            <td>{{ item.buyer }}</td>
            <td class="fin__num">{{ formatMoney(item.price) }}</td>
            <td class="fin__row-actions">
              <button class="fin__icon-btn" title="Edit" @click="startEdit(item)">✎</button>
              <button class="fin__delete" title="Delete" @click="deleteItem(item.id)">×</button>
            </td>
          </template>
        </tr>
        <tr v-if="!listItems.length && !loading">
          <td colspan="6" class="fin__empty">No items match these filters.</td>
        </tr>
      </tbody>
    </table>

    <FinancePager v-model="page" :total-pages="totalPages" />
  </section>
</template>

<style scoped>
.fin__form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
}

.fin__form input {
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.fin__chip {
  background: #eef2ff;
  color: #4338ca;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
}

.fin__row-actions {
  white-space: nowrap;
  text-align: right;
}

.fin__icon-btn {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 6px;
}

.fin__icon-btn:hover:not(:disabled) {
  color: #3b82f6;
}

.fin__icon-btn--save:hover:not(:disabled) {
  color: #10b981;
}

.fin__icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.fin__empty {
  text-align: center;
  color: #9ca3af;
  padding: 20px;
}
</style>
