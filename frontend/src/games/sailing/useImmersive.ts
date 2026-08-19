import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * The Screen Orientation API, as much of it as we can rely on. `lock` is
 * missing from the DOM lib this project compiles against, and both methods are
 * absent at runtime on several browsers — so this is a structural type applied
 * to `screen.orientation` rather than an extension of the built-in one.
 */
interface LockableOrientation {
  lock?: (orientation: 'landscape') => Promise<void>
  unlock?: () => void
}

function orientationApi(): LockableOrientation | undefined {
  return screen.orientation as LockableOrientation | undefined
}

/**
 * Runs the game full-screen and landscape while it is being played.
 *
 * Three things can independently fail here, so each is handled on its own:
 *
 *  - `requestFullscreen` needs a user gesture, and iOS Safari on iPhone has no
 *    element fullscreen at all. When it is missing or refused we fall back to a
 *    fixed-position layer that covers the viewport, which looks the same to the
 *    player minus the hidden browser chrome.
 *  - `screen.orientation.lock` rejects on desktop and on iOS. That is not an
 *    error worth surfacing: we just let the page stay in whatever orientation
 *    it is and show a rotate hint instead.
 *  - The player can leave fullscreen behind our back (Esc, the Android back
 *    button, a system gesture), so `fullscreenchange` is the source of truth
 *    rather than whatever we last asked for.
 */
export function useImmersive(target: Ref<HTMLElement | null>) {
  /** Covering the viewport, whether via the Fullscreen API or the fallback. */
  const immersive = ref(false)
  /** Immersive but still portrait — the caller shows a "rotate" hint. */
  const portrait = ref(false)

  let orientationQuery: MediaQueryList | null = null

  function syncOrientation(): void {
    portrait.value = orientationQuery?.matches ?? false
  }

  /** Stops the page behind the fallback layer from scrolling under it. */
  function lockBodyScroll(locked: boolean): void {
    document.body.style.overflow = locked ? 'hidden' : ''
  }

  async function enter(): Promise<void> {
    if (immersive.value) return
    immersive.value = true
    lockBodyScroll(true)

    const el = target.value
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' })
      } catch {
        // Refused (no user gesture, or disallowed) — the fallback layer stands.
        return
      }
    }

    try {
      await orientationApi()?.lock?.('landscape')
    } catch {
      // Unsupported or refused; the rotate hint covers this case.
    }
  }

  async function exit(): Promise<void> {
    if (!immersive.value) return
    immersive.value = false
    lockBodyScroll(false)

    try {
      orientationApi()?.unlock?.()
    } catch {
      // Never supported without lock support; nothing to undo.
    }
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {
        // Already gone.
      }
    }
  }

  function toggle(): void {
    void (immersive.value ? exit() : enter())
  }

  /** The player left fullscreen on their own; drop the fallback layer too. */
  function onFullscreenChange(): void {
    if (!document.fullscreenElement && immersive.value) void exit()
  }

  onMounted(() => {
    orientationQuery = window.matchMedia('(orientation: portrait)')
    syncOrientation()
    orientationQuery.addEventListener('change', syncOrientation)
    document.addEventListener('fullscreenchange', onFullscreenChange)
  })

  onBeforeUnmount(() => {
    orientationQuery?.removeEventListener('change', syncOrientation)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    // Leaving the page mid-game must not strand a locked body or orientation.
    if (immersive.value) void exit()
  })

  return { immersive, portrait, enter, exit, toggle }
}
