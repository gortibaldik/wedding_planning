import type { Boat, Controls, SpeedModel, Vec2, Wind } from './types'
import { LATERAL_MAX, LATERAL_MIN, PORT_X } from './world'

/**
 * The simulation. Everything here is pure world-space geometry — no canvas, no
 * DOM.
 *
 * Coordinate frames: angles are math degrees (0 = +x, 90 = +y up). World +y
 * points UP, but `angUnit` returns a SCREEN-space vector (y flipped), because
 * that is the frame the renderer wants and the one the original game was
 * written in. World motion therefore flips `y` back when integrating — see
 * `updateBoat`.
 */

export const WIND_SPEED = 1.0

/** Wind described by where it BLOWS TOWARD. East wind blows toward the west
 *  (180) — a dead headwind that has to be beaten upwind by tacking. */
export const WIND_DIRS: Wind[] = [
  { from: 'západu', to: 0 },
  { from: 'severozápadu', to: -45 },
  { from: 'jihozápadu', to: 45 },
  { from: 'severu', to: -90 },
  { from: 'jihu', to: 90 },
  { from: 'severovýchodu', to: -135 },
  { from: 'jihovýchodu', to: 135 },
  { from: 'východu', to: 180 }
]

/** Degrees either side of straight-into-wind where the sail cannot drive. */
const NO_GO = 42

/** Sail polar read off a measured CL/CD-vs-angle-of-attack chart: attached flow
 *  to ~25° (steep lift rise to the 1.52 peak), separating to ~50°, stalled
 *  beyond (lift collapses while drag keeps growing). Rows are [aoa°, CL, CD];
 *  `polarValue` interpolates linearly between rows. */
const SAIL_POLAR = [
  [0, 0.0, 0.1],
  [10, 0.15, 0.14],
  [15, 0.88, 0.17],
  [18, 1.16, 0.18],
  [20, 1.4, 0.21],
  [25, 1.52, 0.25],
  [30, 1.47, 0.32],
  [40, 1.38, 0.45],
  [50, 0.95, 0.55],
  [60, 0.75, 0.75],
  [70, 0.44, 0.97],
  [80, 0.29, 1.25],
  [90, 0.15, 1.4]
]

/** Tuning: brings the aero force into the same speed range as `defaultSpeedModel`. */
const LD_THRUST_SCALE = 40

/** Turn rate and sail swing rate, degrees per second. */
const TURN_RATE = 75
const TRIM_RATE = 90

const MAX_SPEED = 14
const MIN_SPEED = -1
/** Hull drag, as a fraction of speed shed per second. */
const HULL_DRAG = 0.9

export function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

/** Angle in degrees -> screen-space unit vector (y flipped, since screen +y
 *  goes down). e.g. 90 -> {x: 0, y: -1}. */
export function angUnit(aDeg: number): Vec2 {
  const a = deg2rad(aDeg)
  return { x: Math.cos(a), y: -Math.sin(a) }
}

/** Normalize an angle to [-180, 180), so differences come out as the shortest
 *  signed turn (e.g. 350 -> -10). */
export function angNorm(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180
}

/** The side the wind naturally pushes the sail toward (leeward) for a heading. */
export function leewardSign(heading: number, wind: Wind): number {
  const f = angUnit(heading)
  const w = angUnit(wind.to)
  return f.x * w.y - f.y * w.x >= 0 ? 1 : -1
}

/** Boom direction in degrees. `boat.sail` is the signed position the player
 *  sets, -90..+90: 0 = sheeted in along the centreline, ±90 = boom all the way
 *  out on either side. */
export function boomAngle(boat: Boat): number {
  return boat.heading + 180 + boat.sail
}

function polarValue(aoa: number, col: number): number {
  const t = SAIL_POLAR
  if (aoa <= t[0][0]) return t[0][col]
  for (let i = 1; i < t.length; i++) {
    if (aoa <= t[i][0]) {
      const f = (aoa - t[i - 1][0]) / (t[i][0] - t[i - 1][0])
      return t[i - 1][col] + f * (t[i][col] - t[i - 1][col])
    }
  }
  return t[t.length - 1][col]
}

function coefficientOfLift(aoa: number): number {
  return polarValue(aoa, 1)
}

function coefficientOfDrag(aoa: number): number {
  return polarValue(aoa, 2)
}

/** Applies hull drag and clamps to the sailable speed range. */
function integrateSpeed(speed: number, thrust: number, dt: number): number {
  let next = speed + thrust * dt
  next -= next * HULL_DRAG * dt
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, next))
}

/**
 * The simple model: sail power falls off inside the no-go zone, and the drive
 * is the sail normal projected onto the heading and the wind.
 */
export const defaultSpeedModel: SpeedModel = (boat, wind, dt) => {
  const fwd = angUnit(boat.heading)
  const windTo = angUnit(wind.to)

  // sail power: 1 normally, ramping to 0 as the bow points into the wind. The
  // wind comes FROM (wind.to + 180); pointing there = in irons.
  const bowToWind = Math.abs(angNorm(boat.heading - (wind.to + 180)))
  const power = bowToWind >= NO_GO ? 1 : Math.max(0, (bowToWind - (NO_GO - 10)) / 10)

  // drive: >0 correct (leeward) side, <=0 backwinded (wrong side).
  const n = angUnit(boomAngle(boat) + 90) // sail normal
  const drive = (n.x * fwd.x + n.y * fwd.y) * (windTo.x * n.x + windTo.y * n.y)

  boat.sailFull = power >= 0.5
  boat.driving = drive > 0.04

  let thrust = drive * WIND_SPEED * 26
  if (thrust < 0) thrust *= 0.25 // sail backwinded (wrong side) -> barely any drive
  thrust *= power // sail luffs in the no-go zone -> no drive
  boat.thrust = thrust

  return integrateSpeed(boat.speed, thrust, dt)
}

/**
 * The realistic model: the boom's angle against the wind is the angle of
 * attack; the coefficient curves turn it into lift (perpendicular to the wind)
 * and drag (along the wind); their sum projected onto the heading is the
 * thrust. The projection uses the wind-to-heading geometry, not the angle of
 * attack itself — downwind the drive is pure drag (aoa 90°, zero lift), upwind
 * it is mostly lift. No explicit no-go zone is needed: pointing too high leaves
 * the sail with no usable angle of attack.
 */
export const liftDragSpeedModel: SpeedModel = (boat, wind, dt) => {
  const fwd = angUnit(boat.heading)
  const windTo = angUnit(wind.to)

  // signed angle between the wind flow and the sail chord (the boom line); the
  // sign says which side of the sail the wind strikes
  const alpha = angNorm(wind.to - boomAngle(boat))
  // a chord has no front/back: fold the angle of attack to 0..90
  const aoa = Math.abs(alpha) > 90 ? 180 - Math.abs(alpha) : Math.abs(alpha)

  const lift = coefficientOfLift(aoa) * WIND_SPEED * WIND_SPEED * 0.5
  const drag = coefficientOfDrag(aoa) * WIND_SPEED * WIND_SPEED * 0.5

  // lift acts perpendicular to the wind, away from the sail's windward side:
  // pick the perpendicular with a positive component along the sail's
  // downwind-facing normal
  const n = angUnit(boomAngle(boat) + 90)
  if (n.x * windTo.x + n.y * windTo.y < 0) {
    n.x = -n.x
    n.y = -n.y
  }
  const l = { x: -windTo.y, y: windTo.x }
  if (l.x * n.x + l.y * n.y < 0) {
    l.x = -l.x
    l.y = -l.y
  }

  // thrust = lift·sin(β) − drag·cos(β) with β the heading-to-wind angle, done
  // vectorially so every sign case (backwinded, in irons) works out
  const thrust =
    (lift * (l.x * fwd.x + l.y * fwd.y) + drag * (windTo.x * fwd.x + windTo.y * fwd.y)) *
    LD_THRUST_SCALE

  boat.sailFull = aoa >= 10 // flow nearly along the chord -> the sail just flaps
  boat.driving = thrust > 0.5
  boat.thrust = thrust

  return integrateSpeed(boat.speed, thrust, dt)
}

/** Picks a wind at random for a fresh race. */
export function randomWind(): Wind {
  return WIND_DIRS[Math.floor(Math.random() * WIND_DIRS.length)]
}

/**
 * A boat at the dock, with its derived aero values already filled in by
 * `speedModel` so a boat that has not moved yet still renders correctly.
 */
export function createBoat(wind: Wind, speedModel: SpeedModel): Boat {
  const boat: Boat = {
    x: PORT_X,
    y: 50,
    heading: 0,
    speed: 0,
    sail: 45,
    // derived quantities, filled in by the speed model just below
    sailFull: false,
    driving: false,
    thrust: 0
  }
  boat.sail = leewardSign(boat.heading, wind) * 45 // start with the sail on the leeward side
  speedModel(boat, wind, 0)
  return boat
}

/**
 * Advances the boat by `dt` seconds: (1) applies the player's input, (2)
 * delegates the speed update (and the aero evaluation behind it) to
 * `speedModel`, and (3) integrates motion. Only called while sailing; while
 * paused the derived values stay valid, since heading, sail and wind cannot
 * change.
 */
export function updateBoat(
  boat: Boat,
  wind: Wind,
  controls: Controls,
  dt: number,
  speedModel: SpeedModel
): void {
  // steering
  if (controls.turnLeft) boat.heading += TURN_RATE * dt
  if (controls.turnRight) boat.heading -= TURN_RATE * dt
  // sail: swings across the whole range, through the centreline to the other side
  if (controls.sailUp) boat.sail = Math.min(90, boat.sail + TRIM_RATE * dt)
  if (controls.sailDown) boat.sail = Math.max(-90, boat.sail - TRIM_RATE * dt)

  boat.speed = speedModel(boat, wind, dt)

  // move (world +y = up; angUnit is screen-space, so flip y back)
  const fwd = angUnit(boat.heading)
  boat.x += fwd.x * boat.speed * dt
  boat.y += -fwd.y * boat.speed * dt

  // bounds: the shore stops us to the west, the sea is open to the east
  if (boat.x < PORT_X) {
    boat.x = PORT_X
    boat.speed *= 0.3
  }
  if (boat.y < LATERAL_MIN) {
    boat.y = LATERAL_MIN
    boat.speed *= 0.4
  }
  if (boat.y > LATERAL_MAX) {
    boat.y = LATERAL_MAX
    boat.speed *= 0.4
  }
}
