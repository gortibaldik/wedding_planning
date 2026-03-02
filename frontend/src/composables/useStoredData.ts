import { ref, watch } from 'vue'
import { useLocalStorage } from './useLocalStorage'

export type ChartNode<DataType> = {
  id: string
  type: string
  position: {
    x: number
    y: number
  }
  data: DataType
}

export class BaseData {
  constructor(
    public color: string,
    public isRoot: boolean,
    public manuallyPositioned: boolean = false
  ) {}
}

export interface PersonInNode {
  id: string // Unique ID for seating assignments
  name: string // Can be "+1", "Guest of John", etc.
}

export class PersonData extends BaseData {
  constructor(public name: string) {
    super('invalid-color', false, false)
  }
}

export class RootData extends BaseData {
  constructor(public name: string) {
    super('invalid-color', true, false)
  }
}

export class MultiPersonData extends BaseData {
  constructor(
    public name: string, // Group name like "Frederik and Veronika" or "John's kids"
    public people: PersonInNode[]
  ) {
    super('invalid-color', false, false)
  }

  // Helper: Get all invited people for the active list
  get invitedPeople(): PersonInNode[] {
    return this.people.filter(p => people.value[p.id]?.invited === true)
  }

  // Helper: Are all people invited for the active list?
  get allInvited(): boolean {
    return this.people.length > 0 && this.people.every(p => people.value[p.id]?.invited === true)
  }

  // Helper: Are some (but not all) people invited for the active list?
  get someInvited(): boolean {
    const invitedCount = this.people.filter(p => people.value[p.id]?.invited === true).length
    return invitedCount > 0 && invitedCount < this.people.length
  }

  /**
   * inviteAll
   */
  public inviteAllToggle() {
    let previousState = this.allInvited
    this.people.map(p => (people.value[p.id].invited = !previousState))
  }
}

export class PersonInfo {
  constructor(public invited: boolean) {}
}

const nodes = ref<ChartNode<BaseData>[]>([])
const edges = ref<any[]>([])
const tables = ref<any[]>([])
const people = ref<Record<string, PersonInfo>>({})
const invitationListIds = ref<string[]>()

const { saveToLocalStorage, loadFromLocalStorage } = useLocalStorage('wedding-app::stored-data')

const parseData = (newNodes: ChartNode<BaseData>[]) => {
  newNodes.forEach(newNode => {
    let data: RootData | PersonData | MultiPersonData
    if (newNode.type === 'group') {
      data = new RootData(newNode.data['name'])
    } else if (newNode.type === 'person') {
      data = new PersonData(newNode.data['name'])
    } else if (newNode.type === 'multi-person') {
      data = new MultiPersonData(newNode.data['name'], newNode.data['people'] || [])
    } else {
      throw TypeError(`unexpected node type: ${newNode.type}`)
    }

    data.color = newNode.data.color
    data.manuallyPositioned = newNode.data.manuallyPositioned
    newNode.data = data
  })
  nodes.value = newNodes
}

const stored = loadFromLocalStorage()
if (stored) {
  if (stored.nodes) {
    parseData(stored.nodes)
  }
  if (stored.edges) {
    edges.value = stored.edges
  }
  if (stored.people) {
    people.value = stored.people
  }
}

watch(
  [nodes, edges, people],
  () => {
    saveToLocalStorage({ nodes: nodes.value, edges: edges.value, people: people.value })
  },
  { deep: true }
)

const clearAll = () => {
  nodes.value = []
  edges.value = []
  people.value = {}
}

export function useStoredData() {
  return {
    nodes,
    edges,
    tables,
    invitationListIds,
    people,
    clearAll
  }
}
