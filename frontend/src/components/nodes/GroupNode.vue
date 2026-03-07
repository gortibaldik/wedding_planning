<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { RootData, useStoredData } from '@/composables/useStoredData'
import NodeBase from './NodeBase.vue'
import { useBaseGraph } from '@/composables/useBaseGraph'

const props = defineProps({
  id: String,
  data: Object
})

const { nodes } = useStoredData()
const { inviteSubTree } = useBaseGraph()

const node = computed(() => {
  console.info(`Searching for: id '${props.id}'`)
  const found = nodes.value.find(n => n.id == props.id)
  if (!found) {
    throw new TypeError('Should never happen - not found')
  }
  if (!(found.data instanceof RootData)) {
    console.warn(found.data)
    throw new TypeError(`Should never happen - invalid type: ${typeof found.data}`)
  }
  return found as { id: string; type: string; position: { x: number; y: number }; data: RootData }
})

const showEditModal = ref(false)
const editNameInput = ref(null)
const editNameValue = ref('')

const handleEdit = () => {
  showEditModal.value = true
  nextTick(() => {
    editNameInput.value?.focus()
  })
}

const closeEditModal = () => {
  showEditModal.value = false
  editNameValue.value = node.value.data.name
}

const saveEdit = () => {
  console.info(`node: ${node.value}`)
  node.value.data.name = editNameValue.value
  closeEditModal()
}
</script>

<template>
  <NodeBase :id="id" :data="data" @click="handleEdit">
    <div class="person-node__header">
      <div class="person-node__name">{{ node.data.name }}</div>
      <div class="person-node__role">{{ node.type }}</div>
    </div>

    <!-- Button for groups with children -->
    <div v-if="data.hasChildren" class="person-node__checkboxes">
      <button class="person-node__subtree-btn" @click.stop="inviteSubTree(node.id)">
        Invite the whole subtree
      </button>
    </div>

    <Teleport to="body">
      <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
        <div class="modal" @click.stop>
          <h3>Edit Person</h3>
          <form @submit.prevent="saveEdit">
            <div class="form-group">
              <label>Name:</label>
              <input
                ref="editNameInput"
                v-model="editNameValue"
                type="text"
                :placeholder="editNameValue"
                required
              />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save</button>
              <button type="button" class="btn btn-secondary" @click="closeEditModal">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </NodeBase>
</template>

<style scoped>
@import '@/assets/styles/modal.css';

.person-node__header {
  margin-bottom: 8px;
}

.person-node__name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: #1f2937;
}

.person-node__role {
  font-size: 12px;
  color: #6b7280;
  text-transform: capitalize;
  margin-bottom: 8px;
}

.person-node__checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.person-node__subtree-btn {
  width: 100%;
  padding: 6px 12px;
  background: #6898e4;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.person-node__subtree-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.person-node__subtree-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
