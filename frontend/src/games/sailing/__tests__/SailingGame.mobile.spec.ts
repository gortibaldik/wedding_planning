import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SailingGame from '../SailingGame.vue'

/** Drive the game loop by hand so frames are deterministic. */
let frames: FrameRequestCallback[] = []

function setPointerKind(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null
  })) as unknown as typeof window.matchMedia
}

/** Run n frames of 16ms each. */
function step(n: number, startAt = 1000) {
  for (let i = 0; i < n; i++) {
    const pending = frames
    frames = []
    pending.forEach(cb => cb(startAt + i * 16))
  }
}

function stubCapture(el: HTMLElement) {
  const held = new Set<number>()
  el.setPointerCapture = vi.fn((id: number) => void held.add(id))
  el.releasePointerCapture = vi.fn((id: number) => void held.delete(id))
  el.hasPointerCapture = vi.fn((id: number) => held.has(id))
}

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

const trim = (w: ReturnType<typeof mount>) => Number(w.findAll('.stats b')[2].text())

describe('SailingGame on touch devices', () => {
  // coarsePointer is resolved in onMounted, so the pads land on the next tick.
  it('hides the pads when the pointer is not coarse', async () => {
    setPointerKind(false)
    const wrapper = mount(SailingGame, { attachTo: document.body })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.touch-controls').exists()).toBe(false)
  })

  it('shows the pads on a coarse pointer', async () => {
    setPointerKind(true)
    const wrapper = mount(SailingGame, { attachTo: document.body })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.touch-controls').exists()).toBe(true)
    expect(wrapper.findAll('.touch-controls .pad')).toHaveLength(4)
  })

  it('goes fullscreen when the game starts on a touch device', async () => {
    setPointerKind(true)
    const wrapper = mount(SailingGame, { attachTo: document.body })
    await wrapper.vm.$nextTick()

    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    ;(wrapper.find('.sail-wrap').element as HTMLElement).requestFullscreen = requestFullscreen

    await wrapper.find('.start-btn').trigger('click')
    // The request must happen during the gesture, not a tick later.
    expect(requestFullscreen).toHaveBeenCalled()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sail-wrap').classes()).toContain('is-immersive')
    expect(wrapper.find('.exit-immersive').exists()).toBe(true)
  })

  it('does not hijack the screen when starting with a mouse', async () => {
    setPointerKind(false)
    const wrapper = mount(SailingGame, { attachTo: document.body })
    await wrapper.vm.$nextTick()

    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    ;(wrapper.find('.sail-wrap').element as HTMLElement).requestFullscreen = requestFullscreen

    await wrapper.find('.start-btn').trigger('click')
    expect(requestFullscreen).not.toHaveBeenCalled()
    expect(wrapper.find('.sail-wrap').classes()).not.toContain('is-immersive')
  })

  it('trims the sail while a pad is held, and stops when released', async () => {
    setPointerKind(true)
    const wrapper = mount(SailingGame, { attachTo: document.body })
    await wrapper.find('.start-btn').trigger('click')

    const sailPad = wrapper
      .findAll('.touch-controls .pad')
      .find(b => b.attributes('aria-label') === 'plachta doprava')!
    stubCapture(sailPad.element as HTMLElement)

    step(1)
    const before = trim(wrapper)

    await sailPad.trigger('pointerdown', { pointerId: 1 })
    step(12)
    await wrapper.vm.$nextTick()
    const held = trim(wrapper)
    expect(held).not.toBe(before)

    await sailPad.trigger('pointerup', { pointerId: 1 })
    step(12)
    await wrapper.vm.$nextTick()
    expect(trim(wrapper)).toBe(held)
  })
})
