import { watch, ref, Ref } from 'vue'
import { useLocalStorage } from './useLocalStorage.js'
import { useBaseGraph, BaseData, ChartNode } from './useBaseGraph.js'

export class GenealogyData extends BaseData {
  constructor(
    public role: 'person' | 'group',
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

const STORAGE_KEY = 'wedding-genealogy-tree'

let nodes: Ref<ChartNode<GenealogyData>[]> = ref([])
let edges = ref([])

export function useGenealogyData() {
  const { addRootBase, addChildBase, removePersonNode, updatePersonNode, clearAll } = useBaseGraph(
    nodes,
    edges
  )

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
      let data: RootData | PersonData
      if (newNode.data.role === 'group') {
        data = new RootData(newNode.data['name'])
      } else if (newNode.data.role === 'person') {
        data = new PersonData(newNode.data['name'], newNode.data['invited'], newNode.data.role)
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

  const addChildNode = (parentId: string, name: string) => {
    const node: ChartNode<PersonData> = {
      id: `person-${Date.now()}`,
      type: 'person',
      position: { x: 0, y: 0 },
      data: new PersonData(name, false, 'person')
    }

    return addChildBase(parentId, node)
  }

  const toggleInvited = (nodeId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && node.data instanceof PersonData && node.data.role === 'person') {
      node.data.invited = !node.data.invited
    }
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
    addRootNode,
    addChildPersonNode: addChildNode,
    nodes,
    edges,
    removePersonNode,
    updatePersonNode,
    clearAll,
    initializeNodesAndEdges
  }
}
