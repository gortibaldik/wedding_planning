import { Ref, ref, watch } from 'vue'
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
  constructor(
    public id: string,
    public internalName: string
  ) {}

  get name(): string {
    if (!(this.id in people.value)) {
      console.warn(
        'NEW UNRECOGNIZED PERSON -> creating a new PersonInfo with:',
        this.id,
        this.internalName
      )
      people.value[this.id] = new PersonInfo(false, this.internalName)
    } else if (people.value[this.id].name != this.internalName) {
      console.warn(
        'PERSON WITH DIFFERENT NAME',
        this.id,
        this.internalName,
        people.value[this.id].name
      )
      people.value[this.id].name = this.internalName
    }
    return people.value[this.id]?.name
  }

  set name(value: string) {
    if (people.value[this.id]) {
      people.value[this.id].name = value
      this.internalName = value
    }
  }
}

export class PersonData extends BaseData {
  constructor(
    public id: string,
    public internalName: string
  ) {
    super('invalid-color', false, false)
  }

  get name(): string {
    if (!(this.id in people.value)) {
      console.warn(
        'NEW UNRECOGNIZED PERSON -> creating a new PersonInfo with:',
        this.id,
        this.internalName
      )
      people.value[this.id] = new PersonInfo(false, this.internalName)
    } else if (people.value[this.id].name != this.internalName) {
      console.warn(
        'PERSON WITH DIFFERENT NAME',
        this.id,
        this.internalName,
        people.value[this.id].name
      )
      people.value[this.id].name = this.internalName
    }
    return people.value[this.id]?.name
  }

  set name(value: string) {
    if (people.value[this.id]) {
      people.value[this.id].name = value
      this.internalName = value
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
      data = new PersonData(newNode.id, newNode.data['internalName'])
    } else if (newNode.type === 'multi-person') {
      const people = (newNode.data['people'] || []).map(
        (p: any) => new PersonInNode(p.id, p.internalName)
      )
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

const importGenealogyTree = () => {
  console.info('IMPORT')
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'

  input.onchange = e => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target.result)

        if (!data.nodes || !data.edges) {
          alert('Invalid file format. The file must contain "nodes" and "edges" properties.')
          return
        }

        const confirmMessage = 'Import this file? This will replace your current family tree.'

        if (confirm(confirmMessage)) {
          parseData(data.nodes)
          edges.value = data.edges
        }
      } catch (error) {
        alert('Error reading file: ' + error.message)
      }
    }
    reader.readAsText(file)
  }

  input.click()
}

const exportGenealogyTree = () => {
  const data = JSON.stringify({ nodes: nodes.value, edges: edges.value }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'genealogy-tree.json'
  a.click()
  URL.revokeObjectURL(url)
}

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
    stored = JSON.parse(JSON.stringify(loadedFamilyStructureFromBE.value))
    try {
      const { people: peopleContentUntyped } = loadFromLocalStorage()
      const peopleContent = peopleContentUntyped as Record<string, PersonInfo>

      Object.entries(peopleContent).forEach(([id, info]) => {})

      stored['people'] = peopleContent
    } catch (e) {
      console.warn('Caught error', e, 'initializing people to empty dict.')
      stored['people'] = {}
    }
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

  watch(
    [nodes, edges, loadedFamilyStructureFromBE],
    () => {
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
        console.info('NOT EQUAL -> currentStr', currentStr, 'loadedStr', loadedStr)
        familyStructureUnsync.value = true
      } else {
        console.info('EQUAL -> currentStr', currentStr, 'loadedStr', loadedStr)
        familyStructureUnsync.value = false
      }
    },
    { deep: true }
  )

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
    initStoredData,
    importGenealogyTree,
    exportGenealogyTree
  }
}
