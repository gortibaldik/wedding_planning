<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useDocuments, type DocumentSection } from '@/composables/useDocuments'
import DocumentLinkRow from './DocumentLinkRow.vue'

const props = defineProps<{
  section: DocumentSection
  /** Position among the sections, used to disable the move buttons at the ends. */
  index: number
  total: number
}>()

const {
  canEditDocuments,
  saving,
  updateSection,
  deleteSection,
  moveSection,
  addDocument,
  isExpanded,
  toggleSection
} = useDocuments()

// ---- Renaming the section (local display state) ----
const editingSection = ref(false)
const sectionForm = reactive({ title: '', description: '' })
const sectionValid = computed(() => sectionForm.title.trim() !== '')

const startEditSection = () => {
  Object.assign(sectionForm, {
    title: props.section.title,
    description: props.section.description
  })
  editingSection.value = true
}

const submitSection = async () => {
  if (!sectionValid.value) return
  const ok = await updateSection(props.section.id, {
    title: sectionForm.title.trim(),
    description: sectionForm.description.trim()
  })
  if (ok) editingSection.value = false
}

const removeSection = () => {
  const count = props.section.documents.length
  const warning = count ? ` and its ${count} document(s)` : ''
  if (window.confirm(`Delete section "${props.section.title}"${warning}?`)) {
    deleteSection(props.section.id)
  }
}

// ---- Adding a document to this section ----
const showAddForm = ref(false)
const emptyForm = () => ({ title: '', url: '', description: '' })
const form = reactive(emptyForm())
const formValid = computed(() => form.title.trim() !== '' && form.url.trim() !== '')

const submitDocument = async () => {
  if (!formValid.value) return
  const ok = await addDocument({
    section_id: props.section.id,
    title: form.title.trim(),
    url: form.url.trim(),
    description: form.description.trim()
  })
  if (ok) {
    Object.assign(form, emptyForm())
    showAddForm.value = false
  }
}
</script>

<template>
  <div class="doc__card">
    <div class="doc__section-header">
      <form v-if="editingSection" class="doc__form" style="flex: 1" @submit.prevent="submitSection">
        <div class="doc__form-row">
          <input v-model="sectionForm.title" placeholder="Section title" />
          <input v-model="sectionForm.description" placeholder="Description (optional)" />
        </div>
        <div class="doc__form-actions">
          <button type="button" class="doc__btn" @click="editingSection = false">Cancel</button>
          <button
            type="submit"
            class="doc__btn doc__btn--primary"
            :disabled="!sectionValid || saving"
          >
            Save
          </button>
        </div>
      </form>

      <template v-else>
        <button class="doc__section-toggle" @click="toggleSection(section.id)">
          <span class="doc__chevron" :class="{ 'doc__chevron--open': isExpanded(section.id) }">
            ▶
          </span>
          <span class="doc__item-main">
            <span class="doc__section-title">{{ section.title }}</span>
            <p v-if="section.description" class="doc__section-description">
              {{ section.description }}
            </p>
          </span>
          <span class="doc__count">{{ section.documents.length }}</span>
        </button>
        <div v-if="canEditDocuments" class="doc__actions">
          <span class="doc__move-group">
            <button
              class="doc__icon-btn"
              title="Move section up"
              :disabled="index === 0 || saving"
              @click="moveSection(section.id, -1)"
            >
              ↑
            </button>
            <button
              class="doc__icon-btn"
              title="Move section down"
              :disabled="index === total - 1 || saving"
              @click="moveSection(section.id, 1)"
            >
              ↓
            </button>
          </span>
          <button class="doc__icon-btn" title="Rename section" @click="startEditSection">✎</button>
          <button
            class="doc__icon-btn doc__icon-btn--danger"
            title="Delete section"
            :disabled="saving"
            @click="removeSection"
          >
            ✕
          </button>
        </div>
      </template>
    </div>

    <div v-show="isExpanded(section.id)" class="doc__body">
      <p v-if="!section.documents.length" class="doc__empty">No documents here yet.</p>
      <DocumentLinkRow
        v-for="(link, i) in section.documents"
        :key="link.id"
        :link="link"
        :index="i"
        :total="section.documents.length"
      />

      <template v-if="canEditDocuments">
        <form v-if="showAddForm" class="doc__form" @submit.prevent="submitDocument">
          <div class="doc__form-row">
            <input v-model="form.title" placeholder="Title" />
            <input v-model="form.url" placeholder="https://docs.google.com/..." />
          </div>
          <div class="doc__form-row">
            <input v-model="form.description" placeholder="Note (optional)" />
          </div>
          <div class="doc__form-actions">
            <button type="button" class="doc__btn" @click="showAddForm = false">Cancel</button>
            <button
              type="submit"
              class="doc__btn doc__btn--primary"
              :disabled="!formValid || saving"
            >
              Add document
            </button>
          </div>
        </form>
        <button v-else class="doc__btn" @click="showAddForm = true">+ Add document</button>
      </template>
    </div>
  </div>
</template>
