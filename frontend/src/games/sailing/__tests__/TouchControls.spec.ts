import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TouchControls from '../TouchControls.vue'

/** happy-dom has no pointer-capture API, so stub it on the mounted pads. */
function mountPads() {
  const wrapper = mount(TouchControls, { attachTo: document.body })
  const captured = new Set<number>()
  wrapper.findAll('button').forEach(b => {
    const el = b.element as HTMLElement
    el.setPointerCapture = vi.fn((id: number) => void captured.add(id))
    el.releasePointerCapture = vi.fn((id: number) => void captured.delete(id))
    el.hasPointerCapture = vi.fn((id: number) => captured.has(id))
  })
  return { wrapper, captured }
}

const pad = (w: ReturnType<typeof mountPads>['wrapper'], label: string) =>
  w.findAll('button').find(b => b.attributes('aria-label') === label)!

describe('TouchControls', () => {
  it('emits press then release for each control', async () => {
    const { wrapper } = mountPads()
    const cases: [string, string][] = [
      ['kormidlo doleva', 'turnLeft'],
      ['kormidlo doprava', 'turnRight'],
      ['plachta doprava', 'sailUp'],
      ['plachta doleva', 'sailDown']
    ]
    for (const [label, control] of cases) {
      const p = pad(wrapper, label)
      await p.trigger('pointerdown', { pointerId: 1 })
      await p.trigger('pointerup', { pointerId: 1 })
      expect(wrapper.emitted('press')).toContainEqual([control])
      expect(wrapper.emitted('release')).toContainEqual([control])
    }
  })

  it('captures the pointer so a finger sliding off still releases', async () => {
    const { wrapper, captured } = mountPads()
    const p = pad(wrapper, 'kormidlo doleva')
    await p.trigger('pointerdown', { pointerId: 7 })
    expect(captured.has(7)).toBe(true)
    await p.trigger('pointerup', { pointerId: 7 })
    expect(captured.has(7)).toBe(false)
  })

  it('releases the control when the gesture is cancelled', async () => {
    const { wrapper } = mountPads()
    const p = pad(wrapper, 'plachta doprava')
    await p.trigger('pointerdown', { pointerId: 2 })
    await p.trigger('pointercancel', { pointerId: 2 })
    expect(wrapper.emitted('release')).toContainEqual(['sailUp'])
  })

  it('supports steering and trimming at the same time', async () => {
    const { wrapper } = mountPads()
    const rudder = pad(wrapper, 'kormidlo doprava')
    const sail = pad(wrapper, 'plachta doprava')
    await rudder.trigger('pointerdown', { pointerId: 1 })
    await sail.trigger('pointerdown', { pointerId: 2 })
    expect(wrapper.emitted('press')).toEqual([['turnRight'], ['sailUp']])
    // Lifting one thumb must not release the other control.
    await sail.trigger('pointerup', { pointerId: 2 })
    expect(wrapper.emitted('release')).toEqual([['sailUp']])
  })
})
