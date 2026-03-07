import { ref, watch } from 'vue'
import { useLocalStorage } from './useLocalStorage'
import { useBackendStorage } from './useBackendStorage'

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

export class PersonInNode {
  constructor(public id: string) {}

  get name(): string {
    return people.value[this.id]?.name
  }

  set name(value: string) {
    if (people.value[this.id]) {
      people.value[this.id].name = value
    }
  }
}

export class PersonData extends BaseData {
  constructor(public id: string) {
    super('invalid-color', false, false)
  }

  get name(): string {
    return people.value[this.id]?.name
  }

  set name(value: string) {
    if (people.value[this.id]) {
      people.value[this.id].name = value
    }
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
  constructor(
    public invited: boolean,
    public name: string
  ) {}
}

const nodes = ref<ChartNode<BaseData>[]>([])
const edges = ref<any[]>([])
const familyStructureUnsync = ref<boolean>(false)
const loadedFamilyStructureFromBE = ref<any>(null)
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
      data = new PersonData(newNode.id)
    } else if (newNode.type === 'multi-person') {
      const people = (newNode.data['people'] || []).map((p: any) => new PersonInNode(p.id))
      data = new MultiPersonData(newNode.data['name'], people)
    } else {
      throw TypeError(`unexpected node type: ${newNode.type}`)
    }

    data.color = newNode.data.color
    data.manuallyPositioned = newNode.data.manuallyPositioned
    newNode.data = data
  })
  nodes.value = newNodes
}

function isFamilyStructure(structure: unknown): structure is { nodes: any; edges: any } {
  return (
    !!structure &&
    typeof structure === 'object' &&
    !Array.isArray(structure) &&
    'nodes' in structure &&
    'edges' in structure
  )
}

function parseFamilyStructure(structure: unknown) {
  if (!isFamilyStructure(structure)) {
    if (structure) {
      console.warn('WEIRD STRUCTURE:', structure)
    }
    return null
  }
  return structure
}

let initialized = false

async function saveFamilyStructureToBackend() {
  const {
    saveToBackendStorage: saveFamilyStructureToBEStorage,
    loadFromBackendStorage: loadFamilyStructureFromBEStorage
  } = useBackendStorage('family-structure')

  await saveFamilyStructureToBEStorage({
    nodes: nodes.value,
    edges: edges.value
  })
  loadedFamilyStructureFromBE.value = parseFamilyStructure(await loadFamilyStructureFromBEStorage())
}

async function initStoredData() {
  if (initialized) return
  initialized = true

  const { loadFromBackendStorage: loadFamilyStructureFromBEStorage } =
    useBackendStorage('family-structure')

  loadedFamilyStructureFromBE.value = parseFamilyStructure(await loadFamilyStructureFromBEStorage())
  let stored

  if (loadedFamilyStructureFromBE.value) {
    stored = loadedFamilyStructureFromBE.value
    const { people: peopleContent } = loadFromLocalStorage()
    stored['people'] = peopleContent
    console.info('COMPOSED STORED:', stored)
  } else {
    stored = loadFromLocalStorage()
  }

  watch(
    [nodes, edges, people],
    () => {
      console.info('SAVING TO LOCAL STORAGE', nodes.value)
      saveToLocalStorage({ nodes: nodes.value, edges: edges.value, people: people.value })
    },
    { deep: true }
  )

  watch([nodes, edges, loadedFamilyStructureFromBE], () => {
    console.info('UPDATING UNSYNC')
    if (!loadedFamilyStructureFromBE.value) {
      console.info('No loaded family structure!')
      if (nodes.value || edges.value) {
        familyStructureUnsync.value = true
      } else {
        console.info('!nodes and !edges', nodes.value, edges.value)
        familyStructureUnsync.value = false
      }
      return
    }

    console.info('Loaded family structure!', loadedFamilyStructureFromBE.value)
    const currentStr = JSON.stringify({ nodes: nodes.value, edges: edges.value })
    const loadedStr = JSON.stringify({
      nodes: loadedFamilyStructureFromBE.value['nodes'],
      edges: loadedFamilyStructureFromBE.value['edges']
    })
    if (currentStr !== loadedStr) {
      console.info('currentStr', currentStr, 'loadedStr', loadedStr)
      familyStructureUnsync.value = true
    } else {
      familyStructureUnsync.value = false
    }
  })

  if (stored) {
    if (stored.nodes) {
      parseData(stored.nodes)
    }
    if (stored.edges) {
      edges.value = stored.edges
    }
    if (stored.people) {
      console.info('INITIALIZING PEOPLE')
      people.value = stored.people
    }
  }
}

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
    clearAll,
    familyStructureUnsync,
    saveFamilyStructureToBackend,
    initStoredData
  }
}
