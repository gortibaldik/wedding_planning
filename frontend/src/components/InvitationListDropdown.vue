<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  activeInvitationList: {
    type: String,
    required: true
  },
  availableInvitationLists: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['select', 'add', 'remove'])

const isDropdownOpen = ref(false)

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

const handleSelectInvitationList = listName => {
  emit('select', listName)
  isDropdownOpen.value = false
}

const handleAddNewList = () => {
  const listName = prompt('Enter the name for the new invitation list:')
  if (!listName) return

  emit('add', listName)
  isDropdownOpen.value = false
}

const handleRemoveList = (listName, event) => {
  // Stop event propagation to prevent dropdown from toggling
  event?.stopPropagation()

  if (
    !confirm(
      `Are you sure you want to remove the invitation list "${listName}"? This action cannot be undone.`
    )
  ) {
    return
  }

  emit('remove', listName)
}

// Close dropdown when clicking outside
const handleClickOutside = event => {
  const dropdown = event.target.closest('.custom-dropdown')
  if (!dropdown && isDropdownOpen.value) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="invitation-list-dropdown">
    <label>Invitation List:</label>
    <div class="custom-dropdown">
      <div class="dropdown-selected" @click="toggleDropdown">
        {{ activeInvitationList }}
        <span class="dropdown-arrow">▼</span>
      </div>
      <div v-if="isDropdownOpen" class="dropdown-options">
        <div
          v-for="listName in availableInvitationLists"
          :key="listName"
          class="dropdown-option"
          @click="handleSelectInvitationList(listName)"
        >
          <span class="option-name">{{ listName }}</span>
          <button
            v-if="listName !== 'final_decision'"
            class="option-delete-btn"
            @click="handleRemoveList(listName, $event)"
            title="Remove this list"
          >
            ×
          </button>
        </div>
        <div class="dropdown-option add-new-option" @click="handleAddNewList">
          <span class="option-name">+ Add new list...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invitation-list-dropdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 8px 0;
}

.invitation-list-dropdown label {
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
}

.custom-dropdown {
  position: relative;
  min-width: 200px;
}

.dropdown-selected {
  padding: 6px 32px 6px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  color: #1f2937;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}

.dropdown-selected:hover {
  border-color: #3b82f6;
}

.dropdown-arrow {
  position: absolute;
  right: 12px;
  font-size: 10px;
  color: #6b7280;
  transition: transform 0.2s;
}

.dropdown-options {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-option {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f3f4f6;
}

.dropdown-option:last-child {
  border-bottom: none;
}

.dropdown-option:hover {
  background: #f9fafb;
}

.option-name {
  font-size: 14px;
  color: #1f2937;
  flex: 1;
}

.option-delete-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #ef4444;
  background: white;
  color: #ef4444;
  border-radius: 4px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  margin-left: 8px;
}

.option-delete-btn:hover {
  background: #ef4444;
  color: white;
  transform: scale(1.1);
}

.add-new-option {
  border-top: 2px solid #e5e7eb;
  background: #f9fafb;
}

.add-new-option:hover {
  background: #f3f4f6;
}

.add-new-option .option-name {
  color: #10b981;
  font-weight: 500;
}
</style>
