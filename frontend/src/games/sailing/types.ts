/** A 2D vector. Whether it lives in world or screen space depends on the
 *  producer — see the note on coordinate frames in `physics.ts`. */
export interface Vec2 {
  x: number
  y: number
}

/** A wind direction: `to` is where the wind BLOWS TOWARD in math degrees
 *  (0 = +x, 90 = +y up), `from` is the Czech label shown in the HUD. */
export interface Wind {
  from: string
  to: number
}

/** The boat's control state plus the aero values derived from it. The control
 *  fields are what the player drives; the derived ones are rewritten by the
 *  speed model every frame and read by the renderer and the HUD. */
export interface Boat {
  // control state
  x: number
  y: number
  heading: number
  /** Signed boom position the player sets, -90..90. 0 = sheeted in on the
   *  centreline, ±90 = boom all the way out on one side or the other. */
  sail: number
  speed: number

  // derived by the speed model
  /** Sail is filled rather than luffing. */
  sailFull: boolean
  /** Sail is on the correct side and actually pulling. */
  driving: boolean
  /** Signed force along the heading; negative means backwinded. */
  thrust: number
}

/** Which steering/trim keys are held this frame. */
export interface Controls {
  turnLeft: boolean
  turnRight: boolean
  sailUp: boolean
  sailDown: boolean
}

/**
 * A speed model owns the whole aero evaluation for one frame. It must
 * (a) write the derived values back onto `boat` (`sailFull`, `driving`,
 * `thrust`) for the renderer and the HUD warnings, and (b) return the boat's
 * new speed after `dt` seconds.
 *
 * Called once with `dt = 0` on reset, purely to fill the derived values so a
 * boat that has not moved yet still renders correctly; the speed comes back
 * unchanged in that case.
 */
export type SpeedModel = (boat: Boat, wind: Wind, dt: number) => number
