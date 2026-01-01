import { ref, watch } from 'vue'

const STORAGE_KEY = 'wedding-genealogy-tree'

const nodes = ref([])
const edges = ref([])

const NODE_WIDTH = 180
const NODE_HEIGHT = 100
const HORIZONTAL_SPACING = 80
const VERTICAL_SPACING = 150

const GROUP_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

let nextColorIndex = 0

function getNextColor() {
  const color = GROUP_COLORS[nextColorIndex % GROUP_COLORS.length]
  nextColorIndex++
  return color
}

function findRootNode(nodeId) {
  const visited = new Set()
  let currentId = nodeId

  while (!visited.has(currentId)) {
    visited.add(currentId)
    const parentEdge = edges.value.find(e => e.target === currentId)
    if (!parentEdge) {
      return currentId
    }
    currentId = parentEdge.source
  }

  return currentId
}

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

  /**
   * Check if two nodes would overlap at given positions
   * Uses node dimensions plus a margin for spacing
   */
  function nodesCollide(pos1, pos2) {
    const margin = 20 // Add some margin around nodes
    const totalWidth = NODE_WIDTH + margin
    const totalHeight = NODE_HEIGHT + margin

    return Math.abs(pos1.x - pos2.x) < totalWidth &&
           Math.abs(pos1.y - pos2.y) < totalHeight
  }

  /**
   * Find a position near (desiredX, desiredY) that doesn't collide
   * with any manually positioned nodes. Uses a spiral search pattern.
   */
  function findNonCollidingPosition(desiredX, desiredY, excludeNodeId) {
    let testX = desiredX
    let testY = desiredY

    // Get all manually positioned nodes (these are the ones we must avoid)
    // We only check against manually positioned nodes because:
    // 1. Auto-positioned siblings are laid out left-to-right and won't overlap naturally
    // 2. We want to maintain the tree structure as much as possible
    // 3. Only manually positioned nodes can be in "unexpected" positions
    const manualNodes = Array.from(nodeMap.values())
      .filter(n => n.id !== excludeNodeId && n.data.manuallyPositioned)

    // If no collision, return desired position
    const hasCollision = manualNodes.some(node =>
      nodesCollide({ x: testX, y: testY }, node.position)
    )

    if (!hasCollision) {
      return { x: testX, y: testY }
    }

    // Try positions in a spiral pattern around the desired position
    const step = HORIZONTAL_SPACING
    let radius = step
    const maxAttempts = 50

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Try positions in a circle around the desired position
      for (let angle = 0; angle < 360; angle += 45) {
        const rad = (angle * Math.PI) / 180
        testX = desiredX + radius * Math.cos(rad)
        testY = desiredY + radius * Math.sin(rad)

        const collision = manualNodes.some(node =>
          nodesCollide({ x: testX, y: testY }, node.position)
        )

        if (!collision) {
          return { x: testX, y: testY }
        }
      }

      radius += step
    }

    // If we still haven't found a spot, return the desired position
    // (better to have overlap than to place it very far away)
    return { x: desiredX, y: desiredY }
  }

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

    // Only update position if node is not manually positioned
    if (!node.data.manuallyPositioned) {
      // Check for collisions and find a safe position
      const safePosition = findNonCollidingPosition(x, y, nodeId)
      node.position = safePosition
    }

    const children = childrenMap.get(nodeId) || []
    if (children.length === 0) return

    // Get manually positioned and auto-positioned children
    const manualChildren = children.filter(childId => {
      const child = nodeMap.get(childId)
      return child && child.data.manuallyPositioned
    })
    const autoChildren = children.filter(childId => {
      const child = nodeMap.get(childId)
      return child && !child.data.manuallyPositioned
    })

    // If this node is manually positioned, position auto children relative to it
    if (node.data.manuallyPositioned) {
      // Position auto children below the manually positioned parent
      const childWidths = autoChildren.map(childId => calculateSubtreeWidth(childId))
      const totalWidth = childWidths.reduce((sum, w) => sum + w, 0) +
                         (autoChildren.length - 1) * HORIZONTAL_SPACING

      let currentX = node.position.x - totalWidth / 2

      autoChildren.forEach((childId, index) => {
        const childWidth = childWidths[index]
        const childCenterX = currentX + childWidth / 2
        layoutNode(childId, childCenterX, node.position.y + VERTICAL_SPACING, visited)
        currentX += childWidth + HORIZONTAL_SPACING
      })

      // Still traverse manually positioned children to handle their descendants
      manualChildren.forEach(childId => {
        const child = nodeMap.get(childId)
        if (child) {
          layoutNode(childId, child.position.x, child.position.y, visited)
        }
      })
    } else {
      // Standard layout for auto-positioned nodes
      const childWidths = children.map(childId => calculateSubtreeWidth(childId))
      const totalWidth = childWidths.reduce((sum, w) => sum + w, 0) +
                         (children.length - 1) * HORIZONTAL_SPACING

      let currentX = x - totalWidth / 2

      children.forEach((childId, index) => {
        const childWidth = childWidths[index]
        const childCenterX = currentX + childWidth / 2
        layoutNode(childId, childCenterX, y + VERTICAL_SPACING, visited)
        currentX += childWidth + HORIZONTAL_SPACING
      })
    }
  }

  const rootNodes = nodes.value.filter(node => {
    const parents = parentsMap.get(node.id) || []
    return parents.length === 0
  })

  let currentX = 0
  rootNodes.forEach(root => {
    // If root is manually positioned, use its existing position
    if (root.data.manuallyPositioned) {
      layoutNode(root.id, root.position.x, root.position.y)
    } else {
      const subtreeWidth = calculateSubtreeWidth(root.id)
      layoutNode(root.id, currentX + subtreeWidth / 2, 50)
      currentX += subtreeWidth + HORIZONTAL_SPACING * 3
    }
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

    const rootId = findRootNode(parentId)
    const root = nodes.value.find(n => n.id === rootId)
    const color = root ? root.data.color : '#3b82f6'

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: 0, y: 0 },
      data: {
        name: childData.name || 'New Person',
        role: 'Person',
        color: color,
        invited: false,
        manuallyPositioned: false
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

    const rootId = findRootNode(childId)
    const root = nodes.value.find(n => n.id === rootId)
    const color = root ? root.data.color : '#3b82f6'

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: 0, y: 0 },
      data: {
        name: parentData.name || 'New Person',
        role: 'Person',
        color: color,
        invited: false,
        manuallyPositioned: false
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
        name: rootData.name || 'New Group',
        role: 'Group',
        color: getNextColor(),
        invited: false,
        manuallyPositioned: false
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

  const toggleInvited = (id) => {
    const node = nodes.value.find(n => n.id === id)
    if (node && node.data.role === 'Person') {
      node.data.invited = !node.data.invited
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
    toggleInvited,
    clearAll
  }
}
