<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useDocuments } from '@/composables/useDocuments'
import DocumentSectionCard from './DocumentSectionCard.vue'

const { sections, loading, saving, errorMsg, canEditDocuments, loadSections, addSection } =
  useDocuments()

// ---- Add-section form (local display state) ----
const showAddForm = ref(false)
const emptyForm = () => ({ title: '', description: '' })
const form = reactive(emptyForm())
const formValid = computed(() => form.title.trim() !== '')

const submitSection = async () => {
  if (!formValid.value) return
  const ok = await addSection({
    title: form.title.trim(),
    description: form.description.trim()
  })
  if (ok) {
    Object.assign(form, emptyForm())
    showAddForm.value = false
  }
}

onMounted(loadSections)
</script>

<template>
  <div class="doc">
    <div class="doc__panel">
      <p class="doc__intro">
        One place for every document. Keep the discussion where it belongs — comments and edits go
        <em>into</em> the documents themselves; here we only keep the links and a short description
        of what each one is for.
      </p>

      <div class="doc__toolbar">
        <p class="doc__empty" v-if="loading">Loading…</p>
        <span v-else></span>
        <button
          v-if="canEditDocuments && !showAddForm"
          class="doc__btn"
          @click="showAddForm = true"
        >
          + Add section
        </button>
      </div>

      <p v-if="errorMsg" class="doc__error">{{ errorMsg }}</p>

      <form v-if="showAddForm" class="doc__form" @submit.prevent="submitSection">
        <div class="doc__form-row">
          <input v-model="form.title" placeholder="Section title, e.g. Meetings" />
          <input v-model="form.description" placeholder="Description (optional)" />
        </div>
        <div class="doc__form-actions">
          <button type="button" class="doc__btn" @click="showAddForm = false">Cancel</button>
          <button type="submit" class="doc__btn doc__btn--primary" :disabled="!formValid || saving">
            Add section
          </button>
        </div>
      </form>

      <p v-if="!loading && !sections.length" class="doc__empty">
        No sections yet.
        <template v-if="canEditDocuments">Add one to start collecting documents.</template>
      </p>

      <DocumentSectionCard
        v-for="(section, i) in sections"
        :key="section.id"
        :section="section"
        :index="i"
        :total="sections.length"
      />
    </div>
  </div>
</template>

<!-- Shared, doc__-namespaced styles used by the child components. -->
<style src="./documents.css"></style>

<style scoped>
.doc {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
  background: #f9fafb;
}
</style>
