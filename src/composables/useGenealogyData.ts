import { watch, ref, Ref } from 'vue'
import { useLocalStorage } from './useLocalStorage.js'
import { useBaseGraph, BaseData, ChartNode } from './useBaseGraph.js'
import { useInvitationLists } from './useInvitationLists.js'

// Interface for individuals within a multi-person node
export interface PersonInNode {
  id: string // Unique ID for seating assignments
  name: string // Can be "+1", "Guest of John", etc.
  invited: { [listName: string]: boolean }
}

export class GenealogyData extends BaseData {
  constructor(color: string, isRoot: boolean, manuallyPositioned: boolean) {
    super(color, isRoot, manuallyPositioned)
  }
}

export class PersonData extends GenealogyData {
  constructor(
    public name: string,
    public invited: { [listName: string]: boolean }
  ) {
    super('invalid-color', false, false)
  }
}

export class RootData extends GenealogyData {
  constructor(public name: string) {
    super('invalid-color', true, false)
  }
}

export class MultiPersonData extends GenealogyData {
  constructor(
    public name: string, // Group name like "Frederik and Veronika" or "John's kids"
    public people: PersonInNode[]
  ) {
    super('invalid-color', false, false)
  }

  // Helper: Get all invited people for the active list
  get invitedPeople(): PersonInNode[] {
    const { activeInvitationList } = useInvitationLists()
    return this.people.filter(p => p.invited[activeInvitationList.value] === true)
  }

  // Helper: Are all people invited for the active list?
  get allInvited(): boolean {
    console.info('All invited on the useGenealogyDataCalled')
    const { activeInvitationList } = useInvitationLists()
    return (
      this.people.length > 0 &&
      this.people.every(p => p.invited[activeInvitationList.value] === true)
    )
  }

  // Helper: Are some (but not all) people invited for the active list?
  get someInvited(): boolean {
    const { activeInvitationList } = useInvitationLists()
    const invitedCount = this.people.filter(
      p => p.invited[activeInvitationList.value] === true
    ).length
    return invitedCount > 0 && invitedCount < this.people.length
  }
}

const STORAGE_KEY = 'wedding-genealogy-tree'

let nodes: Ref<ChartNode<GenealogyData>[]> = ref([])
let edges = ref([])
let initialized = false

export function useGenealogyData() {
  const { activeInvitationList, availableInvitationLists } = useInvitationLists()
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
      if (newNode.type === 'group') {
        data = new RootData(newNode.data['name'])
      } else if (newNode.type === 'person') {
        data = new PersonData(newNode.data['name'], newNode.data['invited'])
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
      type: 'group',
      position: { x: 0, y: 0 },
      data: new RootData(name)
    }
    return addRootBase(node)
  }

  const addChildNode = (
    parentId: string,
    name: string,
    type: 'person' | 'group' | 'multi-person' = 'person'
  ) => {
    let node: ChartNode<PersonData | RootData | MultiPersonData>

    if (type === 'multi-person') {
      // For multi-person, 'name' is the group name
      // People will be added via the edit modal
      const people: PersonInNode[] = []

      node = {
        id: `multi-person-${Date.now()}`,
        type: 'multi-person',
        position: { x: 0, y: 0 },
        data: new MultiPersonData(name, people)
      }
    } else if (type === 'group') {
      node = {
        id: `group-${Date.now()}`,
        type: 'group',
        position: { x: 0, y: 0 },
        data: new RootData(name)
      }
    } else {
      // Initialize invited dictionary with all available lists set to false
      const invitedDict: { [listName: string]: boolean } = {}
      availableInvitationLists.value.forEach(listName => {
        invitedDict[listName] = false
      })

      node = {
        id: `person-${Date.now()}`,
        type: 'person',
        position: { x: 0, y: 0 },
        data: new PersonData(name, invitedDict)
      }
    }

    return addChildBase(parentId, node)
  }

  const toggleInvited = (nodeId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && node.data instanceof PersonData) {
      const currentValue = node.data.invited[activeInvitationList.value] || false
      node.data.invited[activeInvitationList.value] = !currentValue
    }
  }

  // Toggle individual person within a multi-person node
  const togglePersonInvited = (nodeId: string, personId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && node.data instanceof MultiPersonData) {
      const person = node.data.people.find(p => p.id === personId)
      if (person) {
        const currentValue = person.invited[activeInvitationList.value] || false
        person.invited[activeInvitationList.value] = !currentValue
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
      p.invited[activeInvitationList.value] = !allInvited
    })
  }

  // Add person to existing multi-person node
  const addPersonToNode = (nodeId: string, personName: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && node.data instanceof MultiPersonData) {
      // Initialize invited dictionary with all available lists set to false
      const invitedDict: { [listName: string]: boolean } = {}
      availableInvitationLists.value.forEach(listName => {
        invitedDict[listName] = false
      })

      const newPerson: PersonInNode = {
        id: `${nodeId}-${Date.now()}`,
        name: personName,
        invited: invitedDict
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

  // Populate all nodes with a new invitation list (set to false by default)
  const populateNodesWithNewList = (listName: string) => {
    nodes.value.forEach(node => {
      if (node.data instanceof PersonData) {
        if (!node.data.invited[listName]) {
          node.data.invited[listName] = false
        }
      } else if (node.data instanceof MultiPersonData) {
        node.data.people.forEach(person => {
          if (!person.invited[listName]) {
            person.invited[listName] = false
          }
        })
      }
    })
  }

  // Remove an invitation list from all nodes
  const removeListFromNodes = (listName: string) => {
    nodes.value.forEach(node => {
      if (node.data instanceof PersonData) {
        delete node.data.invited[listName]
      } else if (node.data instanceof MultiPersonData) {
        node.data.people.forEach(person => {
          delete person.invited[listName]
        })
      }
    })
  }

  // Toggle invited status for entire subtree (node + all descendants)
  const toggleSubtreeInvited = (nodeId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) return

    // Determine the new invited state based on the current node
    let newInvitedState: boolean
    if (node.data instanceof PersonData) {
      newInvitedState = !(node.data.invited[activeInvitationList.value] || false)
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
        if (descendantNode.data instanceof PersonData) {
          descendantNode.data.invited[activeInvitationList.value] = newInvitedState
        } else if (descendantNode.data instanceof MultiPersonData) {
          descendantNode.data.people.forEach(p => {
            p.invited[activeInvitationList.value] = newInvitedState
          })
        }
      }
    })
  }

  if (!initialized) {
    initializeData()
    initialized = true

    watch(
      [nodes, edges],
      () => {
        saveToLocalStorage(serializeData())
      },
      { deep: true }
    )
  }

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
    initializeNodesAndEdges,
    populateNodesWithNewList,
    removeListFromNodes
  }
}
