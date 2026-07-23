<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInvitationLists } from '@/composables/useInvitationLists'
import { useAuth } from '@/composables/useAuth'
import { useFinalListGrouping } from '@/composables/useFinalListGrouping'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'
import FinalListSection from '../FinalListSection.vue'

const { finalList, finalEntries, finalInvitedIds } = useInvitationLists()
const { isUniversalInvitationListSetter } = useAuth()
const { buildRootGroups } = useFinalListGrouping()

type InvitationFilter = 'all' | 'sent' | 'not_sent'
type RsvpFilter = 'all' | 'not_answered' | 'will_come' | 'wont_come'

const filterInvitation = ref<InvitationFilter>('all')
const filterRsvp = ref<RsvpFilter>('all')
const filtersActive = computed(() => filterInvitation.value !== 'all' || filterRsvp.value !== 'all')

const filteredIds = computed<string[]>(() =>
  finalInvitedIds.value.filter(id => {
    const entry = finalEntries.value[id]
    if (!entry) return true
    if (filterInvitation.value === 'sent' && !entry.invitation_given) return false
    if (filterInvitation.value === 'not_sent' && entry.invitation_given) return false
    if (filterRsvp.value === 'not_answered' && entry.rsvpd !== 'NOT_ANSWERED') return false
    if (filterRsvp.value === 'will_come' && entry.rsvpd !== 'WILL_COME') return false
    if (filterRsvp.value === 'wont_come' && entry.rsvpd !== 'WONT_COME') return false
    return true
  })
)

const groups = computed(() => buildRootGroups(filteredIds.value).filter(g => g.ids.length > 0))
</script>

<template>
  <FinalListSection
    :name="finalList?.metadata.name ?? ''"
    :owner-name="finalList?.metadata.owner_name ?? ''"
    :filtered-count="filteredIds.length"
    :total-count="finalInvitedIds.length"
    count-label="invited"
    :filters-active="filtersActive"
  >
    <template #filters>
      <div class="it__filter-group">
        <span class="it__filter-label">Invitation</span>
        <button
          v-for="opt in [
            ['all', 'All'],
            ['sent', 'Sent'],
            ['not_sent', 'Not sent']
          ] as const"
          :key="opt[0]"
          class="it__filter-btn"
          :class="{ 'it__filter-btn--active': filterInvitation === opt[0] }"
          @click.stop="filterInvitation = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>
      <div class="it__filter-group">
        <span class="it__filter-label">RSVP</span>
        <button
          v-for="opt in [
            ['all', 'All'],
            ['not_answered', 'Pending'],
            ['will_come', 'Coming'],
            ['wont_come', 'Not Coming']
          ] as const"
          :key="opt[0]"
          class="it__filter-btn"
          :class="{ 'it__filter-btn--active': filterRsvp === opt[0] }"
          @click.stop="filterRsvp = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>
    </template>
  </FinalListSection>

  <div v-if="groups.length === 0" class="it__empty">No one invited yet.</div>
  <div v-for="group in groups" :key="group.name" class="it__section">
    <h4 class="it__root-title" :style="{ borderLeftColor: group.color }">
      {{ group.name }} ({{ group.ids.length }})
    </h4>
    <div class="it__entry it__entry--header">
      <div class="it__col-person">Guest</div>
      <div class="it__col-center">Invitation sent</div>
      <div class="it__col-center">RSVP</div>
      <div class="it__col-notes">Notes</div>
    </div>
    <div v-for="id in group.ids" :key="id" class="it__entry">
      <div class="it__col-person" data-label="Guest">
        <PersonInfoDisplay :person-id="id" :display-root-name="false" :display-rsvp="false" />
      </div>
      <div class="it__col-center" data-label="Invitation sent">
        <input
          v-if="finalEntries[id]"
          v-model="finalEntries[id].invitation_given"
          type="checkbox"
          class="it__checkbox"
          :disabled="!isUniversalInvitationListSetter"
        />
      </div>
      <div class="it__col-center" data-label="RSVP">
        <select
          v-if="finalEntries[id]"
          v-model="finalEntries[id].rsvpd"
          class="it__rsvp-select"
          :class="`it__rsvp-select--${finalEntries[id].rsvpd.toLowerCase()}`"
          :disabled="!isUniversalInvitationListSetter"
        >
          <option value="NOT_ANSWERED">—</option>
          <option value="WILL_COME">Coming</option>
          <option value="WONT_COME">Not coming</option>
        </select>
      </div>
      <div class="it__col-notes" data-label="Notes">
        <input
          v-if="finalEntries[id]"
          v-model="finalEntries[id].notes"
          type="text"
          class="it__notes-input"
          :disabled="!isUniversalInvitationListSetter"
          placeholder="Notes..."
        />
      </div>
    </div>
  </div>
</template>
