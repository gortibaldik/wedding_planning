<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useDocuments, type DocumentLink } from '@/composables/useDocuments'

const props = defineProps<{
  /** The link to render. Named `link` so it doesn't shadow the global `document`. */
  link: DocumentLink
  /** Position within the section, used to disable the move buttons at the ends. */
  index: number
  total: number
}>()

const {
  canEditDocuments,
  saving,
  updateDocument,
  deleteDocument,
  moveDocument,
  isPreviewed,
  togglePreview,
  embedUrl,
  linkHost
} = useDocuments()

const previewSrc = computed(() => embedUrl(props.link.url))

const editing = ref(false)
const form = reactive({ title: '', url: '', description: '' })

const formValid = computed(() => form.title.trim() !== '' && form.url.trim() !== '')

const startEdit = () => {
  Object.assign(form, {
    title: props.link.title,
    url: props.link.url,
    description: props.link.description
  })
  editing.value = true
}

const submitEdit = async () => {
  if (!formValid.value) return
  const ok = await updateDocument(props.link.id, {
    section_id: props.link.section_id,
    title: form.title.trim(),
    url: form.url.trim(),
    description: form.description.trim()
  })
  if (ok) editing.value = false
}

const remove = () => {
  if (window.confirm(`Delete "${props.link.title}"?`)) deleteDocument(props.link.id)
}
</script>

<template>
  <div class="doc__item">
    <form v-if="editing" class="doc__form" @submit.prevent="submitEdit">
      <div class="doc__form-row">
        <input v-model="form.title" placeholder="Title" />
        <input v-model="form.url" placeholder="https://docs.google.com/..." />
      </div>
      <div class="doc__form-row">
        <input v-model="form.description" placeholder="Note (optional)" />
      </div>
      <div class="doc__form-actions">
        <button type="button" class="doc__btn" @click="editing = false">Cancel</button>
        <button type="submit" class="doc__btn doc__btn--primary" :disabled="!formValid || saving">
          Save
        </button>
      </div>
    </form>

    <template v-else>
      <div class="doc__item-row">
        <div class="doc__item-main">
          <a class="doc__item-link" :href="link.url" target="_blank" rel="noopener noreferrer">
            {{ link.title }}
          </a>
          <p class="doc__item-meta">
            {{ link.description || linkHost(link.url) }}
          </p>
        </div>
        <div class="doc__actions">
          <button
            v-if="previewSrc"
            class="doc__toggle-btn"
            :title="isPreviewed(link.id) ? 'Hide preview' : 'Preview here'"
            @click="togglePreview(link.id)"
          >
            {{ isPreviewed(link.id) ? 'Hide' : 'Preview' }}
            <span class="doc__caret" :class="{ 'doc__caret--open': isPreviewed(link.id) }">▾</span>
          </button>
          <template v-if="canEditDocuments">
            <span class="doc__actions-divider"></span>
            <span class="doc__move-group">
              <button
                class="doc__icon-btn"
                title="Move up"
                :disabled="index === 0 || saving"
                @click="moveDocument(link.section_id, link.id, -1)"
              >
                ↑
              </button>
              <button
                class="doc__icon-btn"
                title="Move down"
                :disabled="index === total - 1 || saving"
                @click="moveDocument(link.section_id, link.id, 1)"
              >
                ↓
              </button>
            </span>
            <button class="doc__icon-btn" title="Edit" @click="startEdit">✎</button>
            <button
              class="doc__icon-btn doc__icon-btn--danger"
              title="Delete"
              :disabled="saving"
              @click="remove"
            >
              ✕
            </button>
          </template>
        </div>
      </div>

      <iframe
        v-if="previewSrc && isPreviewed(link.id)"
        class="doc__preview"
        :src="previewSrc"
        :title="link.title"
      ></iframe>
    </template>
  </div>
</template>
