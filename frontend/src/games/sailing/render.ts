import type { Boat, Vec2, Wind } from './types'
import { angUnit, boomAngle } from './physics'
import { MARKER_SPACING, METERS_PER_UNIT, PORT_X, Viewport } from './world'

/**
 * The renderer. Everything here draws into a 2D context through a `Viewport`;
 * it reads the world but never changes it.
 */

/** Everything one frame needs to know beyond the world itself. */
export interface Scene {
  boat: Boat
  wind: Wind
  /** Seconds of animation elapsed, driving the wind streaks and the sail flap. */
  waveT: number
  /** Whether the force-arrows overlay ("Síly") is on. */
  showForces: boolean
}

function drawWater(ctx: CanvasRenderingContext2D, view: Viewport, scene: Scene): void {
  ctx.fillStyle = '#3a7da8'
  ctx.fillRect(0, 0, view.width, view.height)
  // moving wind streaks (in the wind-blowing direction) for readability
  const u = angUnit(scene.wind.to)
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 2
  for (let i = 0; i < 26; i++) {
    const bx = ((i * 73 + scene.waveT * 40) % (view.width + 60)) - 30
    const by = (i * 53) % view.height
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + u.x * 16, by + u.y * 16)
    ctx.stroke()
  }
}

/** Grass + dock at the western shore; scrolls off once we sail away. */
function drawPort(ctx: CanvasRenderingContext2D, view: Viewport): void {
  const x1 = view.sx(PORT_X)
  if (x1 < -40) return
  ctx.fillStyle = '#6a8f4f'
  ctx.fillRect(0, 0, Math.max(0, x1 - 6), view.height)
  // dock planks jutting out
  ctx.fillStyle = '#8a5a33'
  const dy = view.sy(50)
  ctx.fillRect(x1 - 6, dy - 26, 26, 52)
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1
  for (let p = 0; p < 4; p++) {
    ctx.beginPath()
    ctx.moveTo(x1 - 6, dy - 26 + p * 17)
    ctx.lineTo(x1 + 20, dy - 26 + p * 17)
    ctx.stroke()
  }
  // little lighthouse
  const ly = view.sy(72) - 4
  ctx.fillStyle = '#f4f4f4'
  ctx.fillRect(14, ly, 14, 34)
  ctx.fillStyle = '#d23b3b'
  ctx.fillRect(14, ly, 14, 9)
  ctx.beginPath()
  ctx.moveTo(12, ly)
  ctx.lineTo(30, ly)
  ctx.lineTo(21, ly - 10)
  ctx.closePath()
  ctx.fillStyle = '#d23b3b'
  ctx.fill()
}

/**
 * Distance buoys every MARKER_SPACING world units — the only fixed things out
 * on the open sea, so they are what makes the scrolling readable. Only the ones
 * currently in view are drawn, so the course can run on forever.
 */
function drawMarkers(ctx: CanvasRenderingContext2D, view: Viewport): void {
  const first = Math.max(1, Math.ceil((view.worldXAt(-40) - PORT_X) / MARKER_SPACING))
  const last = Math.floor((view.worldXAt(view.width + 40) - PORT_X) / MARKER_SPACING)
  for (let i = first; i <= last; i++) {
    const bx = view.sx(PORT_X + i * MARKER_SPACING)
    // deterministic lateral placement so a buoy keeps its spot
    const by = view.sy(18 + ((i * 37) % 64))
    // mooring line
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx, by + 12)
    ctx.stroke()
    // float
    ctx.beginPath()
    ctx.arc(bx, by, 7, 0, Math.PI * 2)
    ctx.fillStyle = '#e2c044'
    ctx.fill()
    ctx.strokeStyle = '#8a6a10'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // little mast + pennant
    ctx.strokeStyle = '#8a6a10'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bx, by - 6)
    ctx.lineTo(bx, by - 20)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(bx, by - 20)
    ctx.lineTo(bx + 12, by - 16)
    ctx.lineTo(bx, by - 12)
    ctx.closePath()
    ctx.fillStyle = '#d23b3b'
    ctx.fill()
    // distance label
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(Math.round(i * MARKER_SPACING * METERS_PER_UNIT) + ' m', bx, by + 26)
  }
}

/** Mast position (the sail's pivot, a bit forward of centre) in screen space. */
function mastPos(view: Viewport, boat: Boat): Vec2 {
  const fwd = angUnit(boat.heading)
  return { x: view.sx(boat.x) + fwd.x * 3.6, y: view.sy(boat.y) + fwd.y * 3.6 }
}

function drawBoat(ctx: CanvasRenderingContext2D, view: Viewport, scene: Scene): void {
  const boat = scene.boat
  const P = { x: view.sx(boat.x), y: view.sy(boat.y) }
  const fwd = angUnit(boat.heading) // screen-space forward
  const perp = { x: -fwd.y, y: fwd.x } // screen-space port/starboard
  const L = 30
  const Wd = 9

  // hull
  const bow = { x: P.x + fwd.x * L * 0.6, y: P.y + fwd.y * L * 0.6 }
  const sl = {
    x: P.x - fwd.x * L * 0.45 + perp.x * Wd,
    y: P.y - fwd.y * L * 0.45 + perp.y * Wd
  }
  const sr = {
    x: P.x - fwd.x * L * 0.45 - perp.x * Wd,
    y: P.y - fwd.y * L * 0.45 - perp.y * Wd
  }
  const midl = {
    x: P.x + fwd.x * L * 0.2 + perp.x * Wd * 0.95,
    y: P.y + fwd.y * L * 0.2 + perp.y * Wd * 0.95
  }
  const midr = {
    x: P.x + fwd.x * L * 0.2 - perp.x * Wd * 0.95,
    y: P.y + fwd.y * L * 0.2 - perp.y * Wd * 0.95
  }
  ctx.beginPath()
  ctx.moveTo(bow.x, bow.y)
  ctx.lineTo(midl.x, midl.y)
  ctx.lineTo(sl.x, sl.y)
  ctx.lineTo(sr.x, sr.y)
  ctx.lineTo(midr.x, midr.y)
  ctx.closePath()
  ctx.fillStyle = '#5b3a1e'
  ctx.fill()
  ctx.strokeStyle = '#3a2512'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // mast (a bit forward of centre)
  const mast = mastPos(view, boat)

  // sail rendered at the angle the player has set it to; the boom always
  // renders on the side the player set it on
  const windTo = angUnit(scene.wind.to)
  const sailLen = L * 0.95
  const boom = angUnit(boomAngle(boat))
  const clew = { x: mast.x + boom.x * sailLen, y: mast.y + boom.y * sailLen }

  if (!boat.sailFull || !boat.driving) {
    // luffing (in irons) or backwinded (wrong side): limp, flapping sail, no drive
    const flap = Math.sin(scene.waveT * 16) * 7
    const bp = { x: -boom.y, y: boom.x }
    const midF = {
      x: (mast.x + clew.x) / 2 + bp.x * flap,
      y: (mast.y + clew.y) / 2 + bp.y * flap
    }
    ctx.beginPath()
    ctx.moveTo(mast.x, mast.y)
    ctx.quadraticCurveTo(midF.x, midF.y, clew.x, clew.y)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.stroke()
  } else {
    // working sail: billows downwind
    const bn = { x: -boom.y, y: boom.x }
    if (bn.x * windTo.x + bn.y * windTo.y < 0) {
      bn.x = -bn.x
      bn.y = -bn.y
    }
    const bulge = 9
    const midB = {
      x: (mast.x + clew.x) / 2 + bn.x * bulge,
      y: (mast.y + clew.y) / 2 + bn.y * bulge
    }
    ctx.beginPath()
    ctx.moveTo(mast.x, mast.y)
    ctx.quadraticCurveTo(midB.x, midB.y, clew.x, clew.y)
    ctx.quadraticCurveTo(midB.x, midB.y, mast.x, mast.y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.fill()
    ctx.strokeStyle = '#cfd6db'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  // mast dot
  ctx.beginPath()
  ctx.arc(mast.x, mast.y, 2.5, 0, Math.PI * 2)
  ctx.fillStyle = '#2a2a2a'
  ctx.fill()
}

/** Arrow from `from` in direction `aDeg`, `len` px long, with an arrowhead and
 *  an optional label past the tip. */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  aDeg: number,
  len: number,
  color: string,
  label?: string
): void {
  if (len < 2) return // nothing meaningful to show
  const u = angUnit(aDeg)
  const tipX = from.x + u.x * len
  const tipY = from.y + u.y * len
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()
  const pa = Math.atan2(u.y, u.x)
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX - Math.cos(pa - 0.4) * 9, tipY - Math.sin(pa - 0.4) * 9)
  ctx.lineTo(tipX - Math.cos(pa + 0.4) * 9, tipY - Math.sin(pa + 0.4) * 9)
  ctx.closePath()
  ctx.fill()
  if (label) {
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(label, tipX + u.x * 14, tipY + u.y * 14 + 4)
  }
  ctx.restore()
}

/**
 * Force overlay (the "Síly" checkbox): wind and current thrust as arrows rooted
 * at the mast. Thrust acts along the heading; a negative thrust (backwinded
 * sail) points backwards.
 */
function drawForces(ctx: CanvasRenderingContext2D, view: Viewport, scene: Scene): void {
  const boat = scene.boat
  const mast = mastPos(view, boat)
  drawArrow(ctx, mast, scene.wind.to, 45, '#c33', 'vítr')
  let t = boat.thrust
  let ang = boat.heading
  if (t < 0) {
    ang += 180
    t = -t
  }
  drawArrow(ctx, mast, ang, Math.min(80, t * 3), '#1d7a1d', 'tah')
}

function drawWindBadge(ctx: CanvasRenderingContext2D, view: Viewport, scene: Scene): void {
  const cx = view.width - 46
  const cy = 46
  const r = 26
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
  ctx.stroke()
  const u = angUnit(scene.wind.to)
  ctx.strokeStyle = '#c33'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx - u.x * r, cy - u.y * r)
  ctx.lineTo(cx + u.x * r, cy + u.y * r)
  ctx.stroke()
  const hx = cx + u.x * r
  const hy = cy + u.y * r
  const pa = Math.atan2(u.y, u.x)
  ctx.beginPath()
  ctx.moveTo(hx, hy)
  ctx.lineTo(hx - Math.cos(pa - 0.4) * 10, hy - Math.sin(pa - 0.4) * 10)
  ctx.lineTo(hx - Math.cos(pa + 0.4) * 10, hy - Math.sin(pa + 0.4) * 10)
  ctx.closePath()
  ctx.fillStyle = '#c33'
  ctx.fill()
  ctx.fillStyle = '#222'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('vítr', cx, cy + r + 16)
  ctx.restore()
}

/** Paints one whole frame, back to front. */
export function drawScene(ctx: CanvasRenderingContext2D, view: Viewport, scene: Scene): void {
  drawWater(ctx, view, scene)
  drawPort(ctx, view)
  drawMarkers(ctx, view)
  drawBoat(ctx, view, scene)
  if (scene.showForces) drawForces(ctx, view, scene)
  drawWindBadge(ctx, view, scene)
}
