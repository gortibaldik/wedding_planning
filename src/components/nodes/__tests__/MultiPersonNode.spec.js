import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiPersonNode from '@/components/nodes/MultiPersonNode.vue'
import { ref } from 'vue'

// Mock the composables
vi.mock('@/composables/useInvitationLists.ts', () => ({
  useInvitationLists: () => ({
    activeInvitationList: ref('main'),
    availableInvitationLists: ref(['main'])
  })
}))

vi.mock('@/composables/useGenealogyData.ts', () => ({
  useGenealogyData: () => ({
    nodes: ref([])
  }),
  MultiPersonData: class MultiPersonData {
    constructor(name, people) {
      this.name = name
      this.people = people
    }
  }
}))

// Mock NodeBase component
vi.mock('@/components/nodes/NodeBase.vue', () => ({
  default: {
    name: 'NodeBase',
    template: '<div class="node-base-mock"><slot /></div>',
    props: ['id', 'data']
  }
}))

describe('MultiPersonNode - All Invited Checkbox', () => {
  let mockToggleAllInvited
  let mockTogglePersonInvited

  const makePeople = invitedFlags =>
    invitedFlags.map((flag, i) => ({
      id: `person-${i + 1}`,
      name: ['Alice', 'Bob', 'Charlie'][i],
      invited: { main: flag }
    }))

  const mountNode = people =>
    mount(MultiPersonNode, {
      props: {
        id: 'test-node-1',
        data: {
          name: 'Test Group',
          people,
          hasChildren: false,
          onToggleAllInvited: mockToggleAllInvited,
          onTogglePersonInvited: mockTogglePersonInvited
        }
      }
    })

  beforeEach(() => {
    mockToggleAllInvited = vi.fn()
    mockTogglePersonInvited = vi.fn()
  })

  it('should show master unchecked and not indeterminate when no one is invited', () => {
    const wrapper = mountNode(makePeople([false, false, false]))
    const master = wrapper.find('.person-node__checkbox-master')

    expect(master.element.checked).toBe(false)
    expect(master.element.indeterminate).toBe(false)
  })

  it('should show master as indeterminate when some (not all) are invited', () => {
    const wrapper = mountNode(makePeople([true, false, false]))
    const master = wrapper.find('.person-node__checkbox-master')

    expect(master.element.checked).toBe(false)
    expect(master.element.indeterminate).toBe(true)
  })

  it('should show master checked and not indeterminate when all are invited', () => {
    const wrapper = mountNode(makePeople([true, true, true]))
    const master = wrapper.find('.person-node__checkbox-master')

    expect(master.element.checked).toBe(true)
    expect(master.element.indeterminate).toBe(false)
  })

  it('should call onToggleAllInvited with node id when master checkbox is clicked', async () => {
    const wrapper = mountNode(makePeople([false, false, false]))
    const master = wrapper.find('.person-node__checkbox-master')

    await master.trigger('change')

    expect(mockToggleAllInvited).toHaveBeenCalledWith('test-node-1')
  })

  it('should update master checkbox when people data changes from none to all invited', async () => {
    const wrapper = mountNode(makePeople([false, false, false]))
    const master = wrapper.find('.person-node__checkbox-master')

    expect(master.element.checked).toBe(false)

    // Simulate the parent updating props after toggleAllInvited runs
    await wrapper.setProps({
      data: {
        ...wrapper.props().data,
        people: makePeople([true, true, true])
      }
    })

    expect(master.element.checked).toBe(true)
    expect(master.element.indeterminate).toBe(false)
  })

  it('should reflect individual checkbox states from people data', () => {
    const wrapper = mountNode(makePeople([true, false, true]))
    const checkboxes = wrapper.findAll('.person-node__checkbox-small')

    expect(checkboxes.length).toBe(3)
    expect(checkboxes[0].element.checked).toBe(true)
    expect(checkboxes[1].element.checked).toBe(false)
    expect(checkboxes[2].element.checked).toBe(true)
  })
})
