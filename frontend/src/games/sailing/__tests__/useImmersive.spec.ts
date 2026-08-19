import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useImmersive } from '../useImmersive'

/**
 * Mounts the composable in a real component so its lifecycle hooks run.
 * `api` is held in a plain variable, not a ref: a ref would deeply unwrap the
 * refs inside it and `immersive.value` would read as undefined.
 */
function mountImmersive() {
  let api: ReturnType<typeof useImmersive> | null = null
  const target = ref<HTMLElement | null>(null)
  const wrapper = mount(
    defineComponent({
      setup() {
        target.value = document.createElement('div')
        api = useImmersive(target)
        return () => h('div')
      }
    }),
    { attachTo: document.body }
  )
  return { wrapper, api: api! as ReturnType<typeof useImmersive>, target }
}

function setFullscreenElement(el: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', {
    value: el,
    configurable: true,
    writable: true
  })
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia
  setFullscreenElement(null)
  document.body.style.overflow = ''
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.style.overflow = ''
})

describe('useImmersive', () => {
  it('requests fullscreen and locks to landscape', async () => {
    const lock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(screen, 'orientation', { value: { lock }, configurable: true })

    const { api, target } = mountImmersive()
    const requestFullscreen = vi.fn().mockImplementation(() => {
      setFullscreenElement(target.value)
      return Promise.resolve()
    })
    target.value!.requestFullscreen = requestFullscreen

    await api.enter()
    expect(requestFullscreen).toHaveBeenCalled()
    expect(lock).toHaveBeenCalledWith('landscape')
    expect(api.immersive.value).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('still goes immersive when the browser has no element fullscreen (iOS)', async () => {
    Object.defineProperty(screen, 'orientation', { value: undefined, configurable: true })
    const { api, target } = mountImmersive()
    // iPhone Safari exposes no requestFullscreen on elements at all.
    delete (target.value as Partial<HTMLElement>).requestFullscreen

    await api.enter()
    expect(api.immersive.value).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('stays immersive when the orientation lock is refused', async () => {
    const lock = vi.fn().mockRejectedValue(new Error('not supported'))
    Object.defineProperty(screen, 'orientation', { value: { lock }, configurable: true })

    const { api, target } = mountImmersive()
    target.value!.requestFullscreen = vi.fn().mockResolvedValue(undefined)

    await expect(api.enter()).resolves.toBeUndefined()
    expect(api.immersive.value).toBe(true)
  })

  it('drops out of immersive when the player leaves fullscreen themselves', async () => {
    Object.defineProperty(screen, 'orientation', { value: { unlock: vi.fn() }, configurable: true })
    const { api, target } = mountImmersive()
    target.value!.requestFullscreen = vi.fn().mockImplementation(() => {
      setFullscreenElement(target.value)
      return Promise.resolve()
    })

    await api.enter()
    expect(api.immersive.value).toBe(true)

    // Esc / the Android back button: the browser exits without telling us first.
    setFullscreenElement(null)
    document.dispatchEvent(new Event('fullscreenchange'))
    await nextTick()

    expect(api.immersive.value).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('releases the body scroll lock when unmounted mid-game', async () => {
    Object.defineProperty(screen, 'orientation', { value: undefined, configurable: true })
    const { wrapper, api, target } = mountImmersive()
    delete (target.value as Partial<HTMLElement>).requestFullscreen

    await api.enter()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    await nextTick()
    expect(document.body.style.overflow).toBe('')
  })
})
