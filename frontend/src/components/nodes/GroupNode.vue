<script setup>
import NodeBase from './NodeBase.vue'

defineProps({
  id: String,
  data: Object
})
</script>

<template>
  <NodeBase :id="id" :data="data">
    <div class="person-node__header">
      <div class="person-node__name">{{ data.name }}</div>
      <div class="person-node__role">{{ data.type }}</div>
    </div>

    <!-- Button for groups with children -->
    <div v-if="data.hasChildren" class="person-node__checkboxes">
      <button class="person-node__subtree-btn" @click.stop="data.onToggleSubtreeInvited?.(id)">
        Invite the whole subtree
      </button>
    </div>
  </NodeBase>
</template>

<style scoped>
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
