import { useBaseGraph } from './useBaseGraph'
import { useInvitationLists } from './useInvitationLists'
import {
  ChartNode,
  PersonData,
  RootData,
  MultiPersonData,
  PersonInNode,
  useStoredData,
  PersonInfo,
  BaseData
} from './useStoredData'

export function useGenealogyData() {
  const { people, nodes } = useStoredData()

  const { addRootBase, addChildBase, findAllDescendants, removeNode } = useBaseGraph()
  const {
    togglePersonInvite,
    isPersonInvited,
    isAllMultiPersonInvited,
    toggleAllMultiPersonInvite,
    deletePerson
  } = useInvitationLists()

  const isFullNodeInvited = (nodeId: string): boolean | null => {
    const node = nodes.value.find(n => n.id == nodeId)
    if (node.data instanceof MultiPersonData) {
      return isAllMultiPersonInvited(node.data)
    } else if (node.data instanceof PersonData) {
      return isPersonInvited(node.data.id)
    }
    return null
  }

  const inviteWholeNode = (nodeData: BaseData, desiredValue: boolean) => {
    if (nodeData instanceof MultiPersonData) {
      toggleAllMultiPersonInvite(nodeData, desiredValue)
    } else if (nodeData instanceof PersonData) {
      togglePersonInvite(nodeData.id, desiredValue)
    }
  }

  const inviteSubTree = (nodeId: string, desiredValue: boolean = true) => {
    const descendants = findAllDescendants(nodeId)
    descendants.forEach(descId => {
      const node = nodes.value.find(n => n.id == descId)
      inviteWholeNode(node.data, desiredValue)
    })
  }

  const onRemoveSingleNode = (node: ChartNode<BaseData>) => {
    if (node.data instanceof PersonData) {
      deletePerson(node.data.id)
    } else if (node.data instanceof MultiPersonData) {
      node.data.people.forEach(p => deletePerson(p.id))
    }
  }

  /**
   * Remove node, all it's descendants and all the people associated to these nodes.
   */
  const removeNodeAndPeople = (node: ChartNode<BaseData>) => {
    const removedNodes = removeNode(node)
    removedNodes.forEach(onRemoveSingleNode)
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
      const personId = `person-${Date.now()}`
      people.value[personId] = new PersonInfo(false, name, personId)

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

  return {
    addRootNode,
    addChildNode,
    inviteSubTree,
    removeNodeAndPeople,
    isFullNodeInvited
  }
}
