import type { Boat } from './types'

/**
 * The world and the camera that looks at it.
 *
 * World x starts at the port and grows without bound to the east — the course
 * is endless, so nothing may assume a finite width. World y is lateral and
 * bounded to 0..WORLD_H, with +y pointing UP the screen.
 */

/** How many world units of x fit across the canvas at once. */
export const VIEW_W = 100
export const WORLD_H = 100

/** The shore: the boat cannot sail west of this. */
export const PORT_X = 9
/** Lateral limits, kept a little inside the edge so the hull stays visible. */
export const LATERAL_MIN = 3
export const LATERAL_MAX = 97

/** World units -> the metres shown in the HUD and on the distance buoys. */
export const METERS_PER_UNIT = 3
/** A distance buoy every N world units. */
export const MARKER_SPACING = 25

/** Where the boat sits across the view once the camera is following it. */
const BOAT_SCREEN_FRAC = 0.4

const PAD_X = 16
const PAD_TOP = 16
const PAD_BOT = 16

/** Distance sailed, in HUD metres. */
export function distanceSailed(boat: Boat): number {
  return Math.max(0, Math.round((boat.x - PORT_X) * METERS_PER_UNIT))
}

/**
 * Maps world coordinates onto the canvas. `camX` is the world x at the left
 * edge of the view; it follows the boat but never scrolls back past the port,
 * so the start of the course stays framed the way it was before the boat moved.
 */
export class Viewport {
  camX = 0

  constructor(
    public width: number,
    public height: number
  ) {}

  /** Re-aims the camera at the boat. Call once per simulation step. */
  follow(boat: Boat) {
    this.camX = Math.max(0, boat.x - VIEW_W * BOAT_SCREEN_FRAC)
  }

  /** World x -> canvas x. */
  sx(wx: number): number {
    return PAD_X + ((wx - this.camX) / VIEW_W) * (this.width - 2 * PAD_X)
  }

  /** World y -> canvas y (flipped: world +y is up, canvas +y is down). */
  sy(wy: number): number {
    return PAD_TOP + ((WORLD_H - wy) / WORLD_H) * (this.height - PAD_TOP - PAD_BOT)
  }

  /** Canvas x -> world x. Used to work out which buoys are on screen. */
  worldXAt(screenX: number): number {
    return this.camX + ((screenX - PAD_X) / (this.width - 2 * PAD_X)) * VIEW_W
  }
}
