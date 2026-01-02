import { Ref } from 'vue'

const NODE_WIDTH = 180
const HORIZONTAL_SPACING = 80
const VERTICAL_SPACING = 150

const GROUP_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316'
]

let nextColorIndex = 0

function getNextColor() {
  const color = GROUP_COLORS[nextColorIndex % GROUP_COLORS.length]
  nextColorIndex++
  return color
}

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

export function useBaseGraph(nodes: Ref<ChartNode<BaseData>[]>, edges: Ref<any[]>) {
  const groupRootNodes: ChartNode<BaseData>[] = []

  const removePersonNode = (nodeId: string) => {
    const node = nodes.value.filter(n => n.id === nodeId)[0]
    const nodesToRemove = findAllDescendants(nodeId)

    if (node.data.isRoot) {
      const rootNodesIndex = groupRootNodes.indexOf(node)
      if (rootNodesIndex !== -1) {
        groupRootNodes.splice(rootNodesIndex, 1)
      }
    }

    nodes.value = nodes.value.filter(n => !nodesToRemove.has(n.id))
    edges.value = edges.value.filter(
      e => !nodesToRemove.has(e.source) && !nodesToRemove.has(e.target)
    )
  }

  const updatePersonNode = (nodeId: string, data: any) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.data = { ...node.data, ...data }
    }
  }

  /** Add a root node.
   *
   * Root node is a special type of node that starts a tree.
   */
  const addRootBase = (node: ChartNode<BaseData>) => {
    let newX: number, newY: number
    if (groupRootNodes.length > 0) {
      // Position to the right of existing roots at the same Y level
      const rightmostRoot = groupRootNodes.reduce((max, root) =>
        root.position.x > max.position.x ? root : max
      )
      newX = rightmostRoot.position.x + NODE_WIDTH + HORIZONTAL_SPACING * 3
      newY = rightmostRoot.position.y // Same Y as other roots
    } else {
      // First root - start at origin
      newX = 50
      newY = 50
    }

    node.position = { x: newX, y: newY }
    node.data.color = getNextColor()

    nodes.value = [...nodes.value, node]
    groupRootNodes.push(node)

    return node
  }

  const findAllDescendants = (nodeId: string) => {
    const descendants: Set<string> = new Set()
    const toProcess = [nodeId]

    while (toProcess.length > 0) {
      const currentId = toProcess.pop()
      descendants.add(currentId)

      edges.value
        .filter(e => e.source === currentId)
        .forEach(edge => {
          toProcess.push(edge.target)
        })
    }

    return descendants
  }

  const findNode = (nodeId: string) => {
    return nodes.value.find(n => n.id === nodeId)
  }

  /** Clear all nodes and edges from the graph. */
  const clearAll = () => {
    nodes.value = []
    edges.value = []
  }

  const calculateNextChildPosition = (parent: ChartNode<any>) => {
    const edgesToChildren = edges.value.filter(e => e.source === parent.id)
    const children = edgesToChildren
      .map(e => nodes.value.find(n => n.id === e.target))
      .filter(Boolean)

    // if there is no children, then just return the position right below the node
    if (children.length === 0) {
      return {
        x: parent.position.x,
        y: parent.position.y + VERTICAL_SPACING
      }
    }

    const rightmostChild = children.reduce((max, sib) =>
      sib.position.x > max.position.x ? sib : max
    )

    return {
      x: rightmostChild.position.x + NODE_WIDTH + HORIZONTAL_SPACING,
      y: parent.position.y + VERTICAL_SPACING
    }
  }

  const addChildBase = (parentId: string, childNode: ChartNode<BaseData>) => {
    const parent = findNode(parentId)
    if (!parent) return

    const color = parent.data.color
    const nextPosition = calculateNextChildPosition(parent)
    childNode.position = nextPosition
    childNode.data.color = color

    const newEdge = {
      id: `e-${parentId}-${childNode.id}`,
      source: parentId,
      target: childNode.id,
      type: 'smoothstep'
    }

    nodes.value = [...nodes.value, childNode]
    edges.value = [...edges.value, newEdge]

    return childNode.id
  }

  return {
    nodes,
    edges,
    removePersonNode,
    updatePersonNode,
    addChildBase,
    findNode,
    addRootBase,
    clearAll,
    findAllDescendants
  }
}
