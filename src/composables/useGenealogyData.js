import { ref, watch } from 'vue'
import { useLocalStorage } from './useLocalStorage.ts'

const STORAGE_KEY = 'wedding-genealogy-tree'

const roots = []
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

/**
 * Check if a position overlaps with any existing node
 */
function hasCollision(x, y, excludeNodeId = null) {
  const margin = 20
  return nodes.value.some(node => {
    if (node.id === excludeNodeId) return false
    const dx = Math.abs(node.position.x - x)
    const dy = Math.abs(node.position.y - y)
    return dx < (NODE_WIDTH + margin) && dy < (NODE_HEIGHT + margin)
  })
}

/**
 * Shift all nodes to the right of a given x position
 */
function shiftNodesRight(fromX, atY, offset) {
  const margin = NODE_HEIGHT + 50
  nodes.value.forEach(node => {
    // Only shift nodes that are to the right and at similar Y level
    if (node.position.x >= fromX && Math.abs(node.position.y - atY) < margin) {
      node.position.x += offset
    }
  })
}

/**
 * Get the depth level of a node in the tree (distance from root)
 */
function getNodeDepth(nodeId) {
  let depth = 0
  let currentId = nodeId
  const visited = new Set()

  while (!visited.has(currentId)) {
    visited.add(currentId)
    const parentEdge = edges.value.find(e => e.target === currentId)
    if (!parentEdge) break
    depth++
    currentId = parentEdge.source
  }

  return depth
}

/**
 * Get all nodes at a specific depth level
 */
function getNodesAtDepth(depth) {
  return nodes.value.filter(node => getNodeDepth(node.id) === depth)
}

export function useGenealogyData() {
  
  const serializeData = () => {
    return {
      'nodes': nodes.value,
      'edges': edges.value
    }
  }
  
  const {saveToLocalStorage, loadFromLocalStorage} = useLocalStorage(STORAGE_KEY)

  const initializeData = () => {
    const savedData = loadFromLocalStorage()

    if (savedData && savedData.nodes && savedData.edges) {
      // Preserve positions as-is from saved data
      nodes.value = savedData.nodes
      edges.value = savedData.edges
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

    // Calculate position for new child
    // Find siblings (other children of the same parent)
    const siblingEdges = edges.value.filter(e => e.source === parentId)
    const siblings = siblingEdges.map(e => nodes.value.find(n => n.id === e.target)).filter(Boolean)

    let newX, newY

    if (siblings.length > 0) {
      // Position next to siblings
      // Find the rightmost sibling
      const rightmostSibling = siblings.reduce((max, sib) =>
        sib.position.x > max.position.x ? sib : max
      )
      newX = rightmostSibling.position.x + NODE_WIDTH + HORIZONTAL_SPACING
      newY = rightmostSibling.position.y // Same Y as siblings
    } else {
      // First child - position below parent
      newX = parent.position.x
      newY = parent.position.y + VERTICAL_SPACING
    }

    // Check for collisions and adjust if needed
    if (hasCollision(newX, newY, newId)) {
      shiftNodesRight(newX, newY, NODE_WIDTH + HORIZONTAL_SPACING)
    }

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: newX, y: newY },
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

    return newId
  }

  const addParent = (childId, parentData) => {
    const newId = `person-${Date.now()}`

    const child = nodes.value.find(n => n.id === childId)
    if (!child) return

    const rootId = findRootNode(childId)
    const root = nodes.value.find(n => n.id === rootId)
    const color = root ? root.data.color : '#3b82f6'

    // Calculate position for new parent
    // Position above the child
    let newX = child.position.x
    let newY = child.position.y - VERTICAL_SPACING

    // Check if there are other nodes at the same depth (siblings of this new parent)
    const childDepth = getNodeDepth(childId)
    const newParentDepth = childDepth - 1
    const nodesAtSameLevel = getNodesAtDepth(newParentDepth)

    if (nodesAtSameLevel.length > 0) {
      // Use the same Y level as other nodes at this depth
      const avgY = nodesAtSameLevel.reduce((sum, n) => sum + n.position.y, 0) / nodesAtSameLevel.length
      newY = avgY
    }

    // Check for collisions and adjust if needed
    if (hasCollision(newX, newY, newId)) {
      shiftNodesRight(newX, newY, NODE_WIDTH + HORIZONTAL_SPACING)
    }

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: newX, y: newY },
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

    return newId
  }

  const addRoot = (rootData) => {
    const newId = `person-${Date.now()}`

    // Calculate position for new root
    // Find all existing root nodes (nodes with no parents)
    const rootNodes = nodes.value.filter(node => {
      const hasParent = edges.value.some(e => e.target === node.id)
      return !hasParent
    })

    let newX, newY

    if (rootNodes.length > 0) {
      // Position to the right of existing roots at the same Y level
      const rightmostRoot = rootNodes.reduce((max, root) =>
        root.position.x > max.position.x ? root : max
      )
      newX = rightmostRoot.position.x + NODE_WIDTH + HORIZONTAL_SPACING * 3
      newY = rightmostRoot.position.y // Same Y as other roots
    } else {
      // First root - start at origin
      newX = 50
      newY = 50
    }

    // Check for collisions and adjust if needed
    if (hasCollision(newX, newY, newId)) {
      shiftNodesRight(newX, newY, NODE_WIDTH + HORIZONTAL_SPACING)
    }

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: newX, y: newY },
      data: {
        name: rootData.name || 'New Group',
        role: 'Group',
        color: getNextColor(),
        invited: false,
        manuallyPositioned: false
      }
    }

    nodes.value = [...nodes.value, newNode]

    return newId
  }

  const removePerson = (id) => {
    // Find all descendants recursively
    const findAllDescendants = (nodeId) => {
      const descendants = new Set()
      const toProcess = [nodeId]

      while (toProcess.length > 0) {
        const currentId = toProcess.pop()
        descendants.add(currentId)

        // Find all children of the current node
        const childEdges = edges.value.filter(e => e.source === currentId)
        childEdges.forEach(edge => {
          if (!descendants.has(edge.target)) {
            toProcess.push(edge.target)
          }
        })
      }

      return descendants
    }

    // Get all nodes to remove (the node and all its descendants)
    const nodesToRemove = findAllDescendants(id)

    // Remove all nodes and their edges
    nodes.value = nodes.value.filter(n => !nodesToRemove.has(n.id))
    edges.value = edges.value.filter(e =>
      !nodesToRemove.has(e.source) && !nodesToRemove.has(e.target)
    )
    // No layout recalculation - preserve positions of remaining nodes
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
    saveToLocalStorage(serializeData())
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
