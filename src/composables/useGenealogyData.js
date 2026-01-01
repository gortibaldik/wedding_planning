import { ref, watch } from 'vue'

const STORAGE_KEY = 'wedding-genealogy-tree'

const nodes = ref([])
const edges = ref([])

const NODE_WIDTH = 180
const NODE_HEIGHT = 100
const HORIZONTAL_SPACING = 80
const VERTICAL_SPACING = 150

function calculateTreeLayout() {
  const nodeMap = new Map()
  nodes.value.forEach(node => nodeMap.set(node.id, node))

  const childrenMap = new Map()
  const parentsMap = new Map()

  edges.value.forEach(edge => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, [])
    }
    childrenMap.get(edge.source).push(edge.target)

    if (!parentsMap.has(edge.target)) {
      parentsMap.set(edge.target, [])
    }
    parentsMap.get(edge.target).push(edge.source)
  })

  function calculateSubtreeWidth(nodeId, visited = new Set()) {
    if (visited.has(nodeId)) return NODE_WIDTH
    visited.add(nodeId)

    const children = childrenMap.get(nodeId) || []
    if (children.length === 0) {
      return NODE_WIDTH
    }

    let totalWidth = 0
    children.forEach(childId => {
      totalWidth += calculateSubtreeWidth(childId, visited)
    })

    return Math.max(totalWidth + (children.length - 1) * HORIZONTAL_SPACING, NODE_WIDTH)
  }

  function layoutNode(nodeId, x, y, visited = new Set()) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = nodeMap.get(nodeId)
    if (!node) return

    node.position = { x, y }

    const children = childrenMap.get(nodeId) || []
    if (children.length === 0) return

    const childWidths = children.map(childId => calculateSubtreeWidth(childId))
    const totalWidth = childWidths.reduce((sum, w) => sum + w, 0) + (children.length - 1) * HORIZONTAL_SPACING

    let currentX = x - totalWidth / 2

    children.forEach((childId, index) => {
      const childWidth = childWidths[index]
      const childCenterX = currentX + childWidth / 2
      layoutNode(childId, childCenterX, y + VERTICAL_SPACING, visited)
      currentX += childWidth + HORIZONTAL_SPACING
    })
  }

  const rootNodes = nodes.value.filter(node => {
    const parents = parentsMap.get(node.id) || []
    return parents.length === 0
  })

  let currentX = 0
  rootNodes.forEach(root => {
    const subtreeWidth = calculateSubtreeWidth(root.id)
    layoutNode(root.id, currentX + subtreeWidth / 2, 50)
    currentX += subtreeWidth + HORIZONTAL_SPACING * 3
  })
}

function saveToLocalStorage() {
  try {
    const data = {
      nodes: nodes.value,
      edges: edges.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save genealogy data to localStorage:', error)
  }
}

function loadFromLocalStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      return data
    }
  } catch (error) {
    console.error('Failed to load genealogy data from localStorage:', error)
  }
  return null
}

export function useGenealogyData() {
  const initializeData = () => {
    const savedData = loadFromLocalStorage()

    if (savedData && savedData.nodes && savedData.edges) {
      nodes.value = savedData.nodes
      edges.value = savedData.edges
      calculateTreeLayout()
      return
    }

    nodes.value = []
    edges.value = []
  }

  const addChild = (parentId, childData) => {
    const newId = `person-${Date.now()}`

    const parent = nodes.value.find(n => n.id === parentId)
    if (!parent) return

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: 0, y: 0 },
      data: {
        name: childData.name || 'New Person',
        side: parent.data.side,
        role: childData.role || 'guest'
      }
    }

    const newEdge = {
      id: `e-${parentId}-${newId}`,
      source: parentId,
      target: newId,
      type: 'smoothstep'
    }

    nodes.value = [...nodes.value, newNode]
    edges.value = [...edges.value, newEdge]

    calculateTreeLayout()

    return newId
  }

  const addParent = (childId, parentData) => {
    const newId = `person-${Date.now()}`

    const child = nodes.value.find(n => n.id === childId)
    if (!child) return

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: 0, y: 0 },
      data: {
        name: parentData.name || 'New Person',
        side: child.data.side,
        role: parentData.role || 'guest'
      }
    }

    const newEdge = {
      id: `e-${newId}-${childId}`,
      source: newId,
      target: childId,
      type: 'smoothstep'
    }

    nodes.value = [...nodes.value, newNode]
    edges.value = [...edges.value, newEdge]

    calculateTreeLayout()

    return newId
  }

  const addRoot = (rootData) => {
    const newId = `person-${Date.now()}`

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: 0, y: 0 },
      data: {
        name: rootData.name || 'New Person',
        side: rootData.side || 'neutral',
        role: rootData.role || 'guest'
      }
    }

    nodes.value = [...nodes.value, newNode]

    calculateTreeLayout()

    return newId
  }

  const removePerson = (id) => {
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)

    calculateTreeLayout()
  }

  const updatePerson = (id, data) => {
    const node = nodes.value.find(n => n.id === id)
    if (node) {
      node.data = { ...node.data, ...data }
    }
  }

  const clearAll = () => {
    nodes.value = []
    edges.value = []
  }

  initializeData()

  watch([nodes, edges], () => {
    saveToLocalStorage()
  }, { deep: true })

  return {
    nodes,
    edges,
    addChild,
    addParent,
    addRoot,
    removePerson,
    updatePerson,
    clearAll
  }
}
