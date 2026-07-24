<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useInvitationLists, type AccommodationPayment } from '@/composables/useInvitationLists'
import { useAuth } from '@/composables/useAuth'
import { useFinalListGrouping } from '@/composables/useFinalListGrouping'
import PersonInfoDisplay from '@/components/PersonInfoDisplay.vue'
import FinalListSection from '../FinalListSection.vue'
import RootGroupSection from '../RootGroupSection.vue'

const {
  finalList,
  finalEntries,
  finalHotels,
  finalInvitedIds,
  createHotel,
  updateHotel,
  getHotelById,
  assignHotel
} = useInvitationLists()
const { isUniversalInvitationListSetter } = useAuth()
const { buildRootGroups } = useFinalListGrouping()

// --- Filters (only guests who are invited and coming are ever shown) ---
type PaymentFilter = 'all' | 'none' | 'we_reserved' | 'we_paid' | 'they'

const filterPayment = ref<PaymentFilter>('all')
const filterHotel = ref<string>('all')
const filtersActive = computed(() => filterPayment.value !== 'all' || filterHotel.value !== 'all')

const PAYMENT_FILTER_VALUE: Record<Exclude<PaymentFilter, 'all' | 'none'>, AccommodationPayment> = {
  we_reserved: 'WE_RESERVED',
  we_paid: 'WE_PAID',
  they: 'THEY_RESERVED_AND_PAID'
}

const comingIds = computed<string[]>(() =>
  finalInvitedIds.value.filter(id => finalEntries.value[id]?.rsvpd === 'WILL_COME')
)

const filteredIds = computed<string[]>(() =>
  comingIds.value.filter(id => {
    const acc = finalEntries.value[id]?.accommodation ?? null
    if (filterPayment.value === 'none') {
      if (acc) return false
    } else if (filterPayment.value !== 'all') {
      if (!acc || acc.payment !== PAYMENT_FILTER_VALUE[filterPayment.value]) return false
    }
    if (filterHotel.value !== 'all') {
      if (!acc || acc.hotel_id !== filterHotel.value) return false
    }
    return true
  })
)

const groups = computed(() => buildRootGroups(filteredIds.value).filter(g => g.ids.length > 0))

// --- Hotel picker & inline hotel creation ---
const hotelIdOf = (id: string): string => finalEntries.value[id]?.accommodation?.hotel_id ?? ''

const hotelLinkOf = (id: string): string => {
  const acc = finalEntries.value[id]?.accommodation
  if (!acc) return ''
  return getHotelById(acc.hotel_id)?.google_maps_link ?? ''
}

const onHotelChange = (id: string, hotelId: string) => {
  assignHotel(id, hotelId)
}

const newHotelRow = ref<string | null>(null)
const newHotelName = ref('')
const newHotelLink = ref('')
const creatingHotel = ref(false)

const startNewHotel = (id: string) => {
  newHotelRow.value = id
  newHotelName.value = ''
  newHotelLink.value = ''
}

const cancelNewHotel = () => {
  newHotelRow.value = null
}

const confirmNewHotel = async (id: string) => {
  const name = newHotelName.value.trim()
  if (!name) return
  creatingHotel.value = true
  try {
    const hotelId = await createHotel(name, newHotelLink.value.trim())
    assignHotel(id, hotelId)
    newHotelRow.value = null
  } catch (e) {
    alert('Failed to create hotel: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    creatingHotel.value = false
  }
}

// --- Hotel management (bottom section) ---
// Per-hotel editable drafts, keyed by hotel id. Kept in sync with the hotel
// set (not with individual values) so in-progress edits survive a save of a
// sibling hotel.
const hotelDrafts = ref<Record<string, { name: string; link: string }>>({})

// when finalHotels
watch(
  () => finalHotels.value.map(h => h.id).join(','), // the source
  () => {
    // the callback
    for (const h of finalHotels.value) {
      if (!hotelDrafts.value[h.id]) {
        hotelDrafts.value[h.id] = { name: h.name, link: h.google_maps_link }
      }
    }
    for (const id of Object.keys(hotelDrafts.value)) {
      if (!finalHotels.value.some(h => h.id === id)) delete hotelDrafts.value[id]
    }
  },
  { immediate: true }
)

const isHotelDirty = (id: string): boolean => {
  const hotel = getHotelById(id)
  const draft = hotelDrafts.value[id]
  if (!hotel || !draft) return false
  return draft.name.trim() !== hotel.name || draft.link.trim() !== hotel.google_maps_link
}

const savingHotelId = ref<string | null>(null)

const saveHotel = async (id: string) => {
  const draft = hotelDrafts.value[id]
  if (!draft || !draft.name.trim()) return
  savingHotelId.value = id
  try {
    await updateHotel(id, draft.name.trim(), draft.link.trim())
  } catch (e) {
    alert('Failed to save hotel: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    savingHotelId.value = null
  }
}
</script>

<template>
  <FinalListSection
    :name="finalList?.metadata.name ?? ''"
    :owner-name="finalList?.metadata.owner_name ?? ''"
    :filtered-count="filteredIds.length"
    :total-count="comingIds.length"
    count-label="coming"
    :filters-active="filtersActive"
  >
    <template #filters>
      <div class="it__filter-group">
        <span class="it__filter-label">Payment</span>
        <button
          v-for="opt in [
            ['all', 'All'],
            ['none', 'No accommodation'],
            ['we_reserved', 'We reserved'],
            ['we_paid', 'We paid'],
            ['they', 'They paid']
          ] as const"
          :key="opt[0]"
          class="it__filter-btn"
          :class="{ 'it__filter-btn--active': filterPayment === opt[0] }"
          @click.stop="filterPayment = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>
      <div class="it__filter-group">
        <span class="it__filter-label">Hotel</span>
        <select v-model="filterHotel" class="it__filter-select" @click.stop>
          <option value="all">All</option>
          <option v-for="hotel in finalHotels" :key="hotel.id" :value="hotel.id">
            {{ hotel.name }}
          </option>
        </select>
      </div>
    </template>
  </FinalListSection>

  <div v-if="groups.length === 0" class="it__empty">No coming guests match.</div>
  <RootGroupSection
    v-for="group in groups"
    :key="group.name"
    :name="group.name"
    :color="group.color"
    :count="group.ids.length"
  >
    <div class="it__entry it__entry--accom it__entry--header">
      <div class="it__col-person">Guest</div>
      <div class="it__col-hotel">Hotel</div>
      <div class="it__col-center">Payment</div>
      <div class="it__col-center">Paid back</div>
    </div>
    <div v-for="id in group.ids" :key="id" class="it__entry it__entry--accom">
      <div class="it__col-person" data-label="Guest">
        <PersonInfoDisplay :person-id="id" :display-root-name="false" :display-rsvp="false" />
      </div>
      <div class="it__col-hotel" data-label="Hotel">
        <div class="it__hotel-picker">
          <select
            v-if="finalEntries[id]"
            class="it__hotel-select"
            :value="hotelIdOf(id)"
            :disabled="!isUniversalInvitationListSetter"
            @change="onHotelChange(id, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">— None</option>
            <option v-for="hotel in finalHotels" :key="hotel.id" :value="hotel.id">
              {{ hotel.name }}
            </option>
          </select>
          <a
            v-if="hotelLinkOf(id)"
            class="it__hotel-link"
            :href="hotelLinkOf(id)"
            target="_blank"
            rel="noopener"
            title="Open in Google Maps"
            >🗺️</a
          >
          <button
            v-if="isUniversalInvitationListSetter"
            class="it__hotel-new-btn"
            type="button"
            title="Add a new hotel"
            @click="startNewHotel(id)"
          >
            ＋
          </button>
        </div>
        <div v-if="newHotelRow === id" class="it__new-hotel">
          <input
            v-model="newHotelName"
            class="it__new-hotel-input"
            type="text"
            placeholder="Hotel name"
            @keyup.enter="confirmNewHotel(id)"
          />
          <input
            v-model="newHotelLink"
            class="it__new-hotel-input"
            type="text"
            placeholder="Google Maps link (optional)"
            @keyup.enter="confirmNewHotel(id)"
          />
          <div class="it__new-hotel-actions">
            <button
              class="it__new-hotel-add"
              :disabled="!newHotelName.trim() || creatingHotel"
              @click="confirmNewHotel(id)"
            >
              {{ creatingHotel ? 'Adding…' : 'Add' }}
            </button>
            <button class="it__new-hotel-cancel" @click="cancelNewHotel">Cancel</button>
          </div>
        </div>
      </div>
      <div class="it__col-center" :data-label="finalEntries[id]?.accommodation ? 'Payment' : null">
        <select
          v-if="finalEntries[id] && finalEntries[id].accommodation"
          v-model="finalEntries[id].accommodation!.payment"
          class="it__payment-select"
          :class="`it__payment-select--${finalEntries[id].accommodation!.payment.toLowerCase()}`"
          :disabled="!isUniversalInvitationListSetter"
        >
          <option value="THEY_RESERVED_AND_PAID">They paid</option>
          <option value="WE_RESERVED">We reserved</option>
          <option value="WE_PAID">We paid</option>
        </select>
      </div>
      <div
        class="it__col-center"
        :data-label="
          finalEntries[id]?.accommodation?.payment === 'WE_RESERVED' ? 'Paid back' : null
        "
      >
        <input
          v-if="finalEntries[id] && finalEntries[id].accommodation?.payment === 'WE_RESERVED'"
          v-model="finalEntries[id].accommodation!.paid_back"
          type="checkbox"
          class="it__checkbox"
          :disabled="!isUniversalInvitationListSetter"
        />
      </div>
    </div>
  </RootGroupSection>

  <section v-if="isUniversalInvitationListSetter" class="it__section it__hotels-mgmt">
    <h3 class="it__section-title it__section-title--static">Manage hotels</h3>
    <div v-if="finalHotels.length === 0" class="it__empty">No hotels yet.</div>
    <div v-for="hotel in finalHotels" :key="hotel.id" class="it__hotel-mgmt-row">
      <input
        v-model="hotelDrafts[hotel.id].name"
        class="it__new-hotel-input"
        type="text"
        placeholder="Hotel name"
        @keyup.enter="saveHotel(hotel.id)"
      />
      <input
        v-model="hotelDrafts[hotel.id].link"
        class="it__new-hotel-input"
        type="text"
        placeholder="Google Maps link (optional)"
        @keyup.enter="saveHotel(hotel.id)"
      />
      <a
        v-if="hotelDrafts[hotel.id].link.trim()"
        class="it__hotel-link"
        :href="hotelDrafts[hotel.id].link"
        target="_blank"
        rel="noopener"
        title="Open in Google Maps"
        >🗺️</a
      >
      <span v-else class="it__hotel-mgmt-mapcol"></span>
      <button
        class="it__new-hotel-add"
        :disabled="
          !hotelDrafts[hotel.id].name.trim() ||
          !isHotelDirty(hotel.id) ||
          savingHotelId === hotel.id
        "
        @click="saveHotel(hotel.id)"
      >
        {{ savingHotelId === hotel.id ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </section>
</template>
