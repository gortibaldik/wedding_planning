import { useInvitationLists } from './useInvitationLists'
import { useBaseGraph } from './useBaseGraph'
import { RootData } from './useStoredData'

/** A group of guests sharing the same genealogy root, used by the final-list tabs. */
export interface RootGroup {
  name: string
  color: string
  ids: string[]
}

/** Groups guest ids by their genealogy root, sorted for stable display. */
export function useFinalListGrouping() {
  const { getPersonName, getMultiPersonNodeName, getPersonNodeId } = useInvitationLists()
  const { findRootNode } = useBaseGraph()

  const getRootInfo = (personId: string): { name: string; color: string } => {
    const nodeId = getPersonNodeId(personId)
    if (!nodeId) return { name: '', color: '#9ca3af' }
    const root = findRootNode(nodeId)
    if (!root || !(root.data instanceof RootData)) return { name: '', color: '#9ca3af' }
    return { name: root.data.name, color: root.data.color }
  }

  const buildRootGroups = (ids: Iterable<string>): RootGroup[] => {
    const groups = new Map<string, RootGroup>()
    for (const id of ids) {
      const { name, color } = getRootInfo(id)
      const key = name || '__unknown__'
      if (!groups.has(key)) {
        groups.set(key, { name: name || 'Unknown', color, ids: [] })
      }
      groups.get(key)!.ids.push(id)
    }
    for (const group of groups.values()) {
      group.ids.sort((a, b) => {
        const nodeCmp = (getMultiPersonNodeName(a) ?? '').localeCompare(
          getMultiPersonNodeName(b) ?? ''
        )
        if (nodeCmp !== 0) return nodeCmp
        return getPersonName(a).localeCompare(getPersonName(b))
      })
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  return { buildRootGroups }
}
