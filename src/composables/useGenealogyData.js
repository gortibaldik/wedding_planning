import { ref } from 'vue'

const nodes = ref([])
const edges = ref([])

export function useGenealogyData() {
  const initializeData = () => {
    nodes.value = [
      {
        id: 'bride',
        type: 'person',
        position: { x: 200, y: 50 },
        data: {
          name: 'Bride',
          side: 'bride',
          role: 'bride'
        }
      },
      {
        id: 'groom',
        type: 'person',
        position: { x: 400, y: 50 },
        data: {
          name: 'Groom',
          side: 'groom',
          role: 'groom'
        }
      },
      {
        id: 'bride-parent-1',
        type: 'person',
        position: { x: 100, y: 200 },
        data: {
          name: 'Bride\'s Mother',
          side: 'bride',
          role: 'parent'
        }
      },
      {
        id: 'bride-parent-2',
        type: 'person',
        position: { x: 300, y: 200 },
        data: {
          name: 'Bride\'s Father',
          side: 'bride',
          role: 'parent'
        }
      },
      {
        id: 'groom-parent-1',
        type: 'person',
        position: { x: 400, y: 200 },
        data: {
          name: 'Groom\'s Mother',
          side: 'groom',
          role: 'parent'
        }
      },
      {
        id: 'groom-parent-2',
        type: 'person',
        position: { x: 600, y: 200 },
        data: {
          name: 'Groom\'s Father',
          side: 'groom',
          role: 'parent'
        }
      }
    ]

    edges.value = [
      {
        id: 'e-bride-parent-1',
        source: 'bride',
        target: 'bride-parent-1',
        type: 'smoothstep'
      },
      {
        id: 'e-bride-parent-2',
        source: 'bride',
        target: 'bride-parent-2',
        type: 'smoothstep'
      },
      {
        id: 'e-groom-parent-1',
        source: 'groom',
        target: 'groom-parent-1',
        type: 'smoothstep'
      },
      {
        id: 'e-groom-parent-2',
        source: 'groom',
        target: 'groom-parent-2',
        type: 'smoothstep'
      }
    ]
  }

  const addChild = (parentId, childData) => {
    const newId = `person-${Date.now()}`

    const parent = nodes.value.find(n => n.id === parentId)
    if (!parent) return

    const childrenCount = edges.value.filter(e => e.source === parentId).length
    const baseX = parent.position.x - 100 + (childrenCount * 100)
    const baseY = parent.position.y + 150

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: baseX, y: baseY },
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

    nodes.value.push(newNode)
    edges.value.push(newEdge)

    return newId
  }

  const addParent = (childId, parentData) => {
    const newId = `person-${Date.now()}`

    const child = nodes.value.find(n => n.id === childId)
    if (!child) return

    const parentsCount = edges.value.filter(e => e.target === childId).length
    const baseX = child.position.x - 100 + (parentsCount * 100)
    const baseY = child.position.y - 150

    const newNode = {
      id: newId,
      type: 'person',
      position: { x: baseX, y: baseY },
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

    nodes.value.push(newNode)
    edges.value.push(newEdge)

    return newId
  }

  const removePerson = (id) => {
    if (id === 'bride' || id === 'groom') {
      return
    }

    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
  }

  const updatePerson = (id, data) => {
    const node = nodes.value.find(n => n.id === id)
    if (node) {
      node.data = { ...node.data, ...data }
    }
  }

  initializeData()

  return {
    nodes,
    edges,
    addChild,
    addParent,
    removePerson,
    updatePerson
  }
}
