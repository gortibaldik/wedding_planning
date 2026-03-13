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

  return {
    addRootNode,
    addChildNode
  }
}
