import { watch, ref, Ref } from 'vue'
import { useLocalStorage } from './useLocalStorage.js'
import { useBaseGraph, BaseData, ChartNode } from './useBaseGraph.js'

// Interface for individuals within a multi-person node
export interface PersonInNode {
  id: string // Unique ID for seating assignments
  name: string // Can be "+1", "Guest of John", etc.
  invited: boolean
}

export class GenealogyData extends BaseData {
  constructor(
    public role: 'person' | 'group' | 'multi-person',
    color: string,
    isRoot: boolean,
    manuallyPositioned: boolean
  ) {
    super(color, isRoot, manuallyPositioned)
  }
}

export class PersonData extends GenealogyData {
  constructor(
    public name: string,
    public invited: boolean,
    role: 'person' | 'group'
  ) {
    super(role, 'invalid-color', false, false)
  }
}

export class RootData extends GenealogyData {
  constructor(public name: string) {
    super('group', 'invalid-color', true, false)
  }
}

export class MultiPersonData extends GenealogyData {
  constructor(
    public name: string, // Group name like "Frederik and Veronika" or "John's kids"
    public people: PersonInNode[]
  ) {
    super('multi-person', 'invalid-color', false, false)
  }

  // Helper: Get all invited people
  get invitedPeople(): PersonInNode[] {
    return this.people.filter(p => p.invited)
  }

  // Helper: Are all people invited?
  get allInvited(): boolean {
    return this.people.length > 0 && this.people.every(p => p.invited)
  }

  // Helper: Are some (but not all) people invited?
  get someInvited(): boolean {
    const invitedCount = this.people.filter(p => p.invited).length
    return invitedCount > 0 && invitedCount < this.people.length
  }
}

const STORAGE_KEY = 'wedding-genealogy-tree'

let nodes: Ref<ChartNode<GenealogyData>[]> = ref([])
let edges = ref([])

export function useGenealogyData() {
  const {
    addRootBase,
    addChildBase,
    removePersonNode,
    updatePersonNode,
    clearAll,
    findAllDescendants
  } = useBaseGraph(nodes, edges)

  const serializeData = () => {
    return {
      nodes: nodes.value,
      edges: edges.value
    }
  }

  const { saveToLocalStorage, loadFromLocalStorage } = useLocalStorage(STORAGE_KEY)

  const initializeNodesAndEdges = (newNodes: ChartNode<GenealogyData>[], newEdges: []) => {
    edges.value = newEdges

    newNodes.forEach(newNode => {
      let data: RootData | PersonData | MultiPersonData
      if (newNode.data.role === 'group') {
        data = new RootData(newNode.data['name'])
      } else if (newNode.data.role === 'person') {
        data = new PersonData(newNode.data['name'], newNode.data['invited'], newNode.data.role)
      } else if (newNode.data.role === 'multi-person') {
        data = new MultiPersonData(newNode.data['name'], newNode.data['people'] || [])
      } else {
        throw TypeError(`unexpected role: ${newNode.data.role}`)
      }

      data.color = newNode.data.color
      data.manuallyPositioned = newNode.data.manuallyPositioned
      newNode.data = data
    })

    nodes.value = newNodes
  }

  const initializeData = () => {
    const savedData = loadFromLocalStorage()

    if (savedData && savedData.nodes && savedData.edges) {
      initializeNodesAndEdges(savedData.nodes, savedData.edges)
      return
    }

    nodes.value = []
    edges.value = []
  }

  /** Add root node to the chart */
  const addRootNode = (name: string) => {
    const node: ChartNode<RootData> = {
      id: `root-${Date.now()}`,
      type: 'person',
      position: { x: 0, y: 0 },
      data: new RootData(name)
    }
    return addRootBase(node)
  }

  const addChildNode = (
    parentId: string,
    name: string,
    role: 'person' | 'group' | 'multi-person' = 'person'
  ) => {
    let node: ChartNode<PersonData | RootData | MultiPersonData>

    if (role === 'multi-person') {
      // For multi-person, 'name' is the group name
      // People will be added via the edit modal
      const people: PersonInNode[] = []

      node = {
        id: `multi-person-${Date.now()}`,
        type: 'person', // Still uses 'person' type for vue-flow rendering
        position: { x: 0, y: 0 },
        data: new MultiPersonData(name, people)
      }
    } else if (role === 'group') {
      node = {
        id: `group-${Date.now()}`,
        type: 'person',
        position: { x: 0, y: 0 },
        data: new RootData(name)
      }
    } else {
      node = {
        id: `person-${Date.now()}`,
        type: 'person',
        position: { x: 0, y: 0 },
        data: new PersonData(name, false, 'person')
      }
    }

    return addChildBase(parentId, node)
  }

  const toggleInvited = (nodeId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && node.data instanceof PersonData && node.data.role === 'person') {
      node.data.invited = !node.data.invited
    }
  }

  // Toggle individual person within a multi-person node
  const togglePersonInvited = (nodeId: string, personId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && node.data instanceof MultiPersonData) {
      const person = node.data.people.find(p => p.id === personId)
      if (person) {
        person.invited = !person.invited
      }
    }
  }

  // Toggle all people in a multi-person node
  const toggleAllInvited = (nodeId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node || !(node.data instanceof MultiPersonData)) {
      return
    }

    const allInvited = node.data.allInvited
    node.data.people.forEach(p => {
      p.invited = !allInvited
    })
  }

  // Add person to existing multi-person node
  const addPersonToNode = (nodeId: string, personName: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && node.data instanceof MultiPersonData) {
      const newPerson: PersonInNode = {
        id: `${nodeId}-${Date.now()}`,
        name: personName,
        invited: false
      }
      node.data.people.push(newPerson)
    }
  }

  // Remove person from multi-person node
  const removePersonFromNode = (nodeId: string, personId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && node.data instanceof MultiPersonData) {
      node.data.people = node.data.people.filter(p => p.id !== personId)
    }
  }

  // Toggle invited status for entire subtree (node + all descendants)
  const toggleSubtreeInvited = (nodeId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) return

    // Determine the new invited state based on the current node
    let newInvitedState: boolean
    if (node.data instanceof PersonData && node.data.role === 'person') {
      newInvitedState = !node.data.invited
    } else if (node.data instanceof MultiPersonData) {
      // For multi-person, toggle based on whether all are currently invited
      newInvitedState = !node.data.allInvited
    } else {
      // For groups, we'll invite all descendants
      newInvitedState = true
    }

    // Get all descendants (including the node itself)
    const descendants = findAllDescendants(nodeId)

    // Apply to all nodes in the subtree
    descendants.forEach(descendantId => {
      const descendantNode = nodes.value.find(n => n.id === descendantId)
      if (descendantNode) {
        if (descendantNode.data instanceof PersonData && descendantNode.data.role === 'person') {
          descendantNode.data.invited = newInvitedState
        } else if (descendantNode.data instanceof MultiPersonData) {
          descendantNode.data.people.forEach(p => {
            p.invited = newInvitedState
          })
        }
      }
    })
  }

  initializeData()

  watch(
    [nodes, edges],
    () => {
      saveToLocalStorage(serializeData())
    },
    { deep: true }
  )

  return {
    toggleInvited,
    togglePersonInvited,
    toggleAllInvited,
    toggleSubtreeInvited,
    addPersonToNode,
    removePersonFromNode,
    addRootNode,
    addChildNode,
    nodes,
    edges,
    removePersonNode,
    updatePersonNode,
    clearAll,
    initializeNodesAndEdges
  }
}
