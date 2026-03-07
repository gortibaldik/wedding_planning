import { useBaseGraph } from './useBaseGraph'
import {
  ChartNode,
  PersonData,
  RootData,
  MultiPersonData,
  PersonInNode,
  useStoredData,
  PersonInfo
} from './useStoredData'

export function useGenealogyData() {
  const { people } = useStoredData()

  const { addRootBase, addChildBase } = useBaseGraph()

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
      const personId = `person-${Date.now()}`
      people.value[personId] = new PersonInfo(false, name)

      node = {
        id: personId,
        type: 'person',
        position: { x: 0, y: 0 },
        data: new PersonData(personId, name)
      }
    }

    console.info(`Add child node ${node}, ${parentId}`)

    return addChildBase(parentId, node)
  }

  // // Populate all nodes with a new invitation list (set to false by default)
  // const populateNodesWithNewList = (listName: string) => {
  //   typedNodes.value.forEach(node => {
  //     if (node.data instanceof PersonData) {
  //       if (!node.data.invited[listName]) {
  //         node.data.invited[listName] = false
  //       }
  //     } else if (node.data instanceof MultiPersonData) {
  //       node.data.people.forEach(person => {
  //         if (!person.invited[listName]) {
  //           person.invited[listName] = false
  //         }
  //       })
  //     }
  //   })
  // }

  // // Remove an invitation list from all nodes
  // const removeListFromNodes = (listName: string) => {
  //   typedNodes.value.forEach(node => {
  //     if (node.data instanceof PersonData) {
  //       delete node.data.invited[listName]
  //     } else if (node.data instanceof MultiPersonData) {
  //       node.data.people.forEach(person => {
  //         delete person.invited[listName]
  //       })
  //     }
  //   })
  // }

  // // Toggle invited status for entire subtree (node + all descendants)
  // const toggleSubtreeInvited = (nodeId: string) => {
  //   const node = typedNodes.value.find(n => n.id === nodeId)
  //   if (!node) return

  //   // Determine the new invited state based on the current node
  //   let newInvitedState: boolean
  //   if (node.data instanceof PersonData) {
  //     newInvitedState = !(node.data.invited[activeInvitationList.value] || false)
  //   } else if (node.data instanceof MultiPersonData) {
  //     // For multi-person, toggle based on whether all are currently invited
  //     newInvitedState = !node.data.allInvited
  //   } else {
  //     // For groups, we'll invite all descendants
  //     newInvitedState = true
  //   }

  //   // Get all descendants (including the node itself)
  //   const descendants = findAllDescendants(nodeId)

  //   // Apply to all nodes in the subtree
  //   descendants.forEach(descendantId => {
  //     const descendantNode = typedNodes.value.find(n => n.id === descendantId)
  //     if (descendantNode) {
  //       if (descendantNode.data instanceof PersonData) {
  //         descendantNode.data.invited[activeInvitationList.value] = newInvitedState
  //       } else if (descendantNode.data instanceof MultiPersonData) {
  //         descendantNode.data.people.forEach(p => {
  //           p.invited[activeInvitationList.value] = newInvitedState
  //         })
  //       }
  //     }
  //   })
  // }

  return {
    addRootNode,
    addChildNode
  }
}
