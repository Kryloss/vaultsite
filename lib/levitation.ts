/**
 * SpongeBob's levitation beside the /music player — the maths only, so it can
 * be tested without a browser. Drawn by components/MusicBackdrop.tsx; the
 * picture is cut in two by scripts/make-music-backdrop.py. DECISIONS #199.
 *
 * Two bodies, one simulation:
 *
 * - HE floats. A soft, slightly underdamped spring pulls him toward a target
 *   that is redrawn at random every few seconds — a new depth inside his
 *   range, a little sideways drift, a lean — so every rise and dip turns
 *   somewhere new and settles with a small overshoot, like something buoyant.
 *   Over that sits a faint hover shimmer, and he leans a touch into the way
 *   he is drifting. Every so often a GUST — a soft half-second sideways push
 *   — nudges him: that is what really sets the iPod swinging, because his
 *   float alone accelerates the fork too gently against gravity to show.
 * - THE CORD AND IPOD hang from the cord's fork as a damped pendulum, and the
 *   only thing that moves them is the fork's real acceleration: when he starts
 *   to sink the iPod goes light and lags, when he stops it swings on, when he
 *   leans it swings. Its pull rocks him back a little in return.
 *
 * Units: px and seconds; angles in radians, positive CLOCKWISE on screen (the
 * sense of CSS `rotate()`, y pointing down). `swing` is the iPod's angle from
 * hanging straight down, positive to the RIGHT.
 */

export type Vec = { x: number; y: number };

export type LevitationParams = {
  /** How far below his resting place he may sink, px. */
  range: number;
  /** The fork, relative to the point he rotates about, px. */
  fork: Vec;
  /** Fork to the iPod's centre, px. */
  length: number;
  /** Room he may drift into sideways before something (the text column, the
   *  window's edge) is in the way, px each side. Drift and gusts are kept to
   *  it. */
  room: { left: number; right: number };
};

export type Levitation = {
  t: number;
  /** Sink below his resting place, px, and its speed. */
  y: number;
  vy: number;
  /** Sideways drift, px. */
  x: number;
  vx: number;
  /** His lean, rad. */
  lean: number;
  vlean: number;
  target: { y: number; x: number; lean: number };
  retargetAt: number;
  /** The current or next gust: when it blows, for how long, how hard (px/s²,
   *  signed; + pushes right). */
  gust: { at: number; for: number; force: number };
  /** The pendulum: angle from straight down (rad, + = right) and its speed. */
  swing: number;
  vswing: number;
  /** The fork's position and velocity last step, for its acceleration. */
  forkAt: Vec | null;
  forkV: Vec | null;
};

/** The feel, in one place. Periods in seconds. */
export const FEEL = {
  /** His float: a slow spring, a little under critical so moves settle with
   *  a soft overshoot rather than stopping dead. */
  floatPeriod: 9,
  floatDamping: 0.62,
  /** A new target every this many seconds (uniformly between). */
  retargetMin: 4.5,
  retargetMax: 9,
  /** A new depth is at least this share of the range away from the old. */
  minMove: 0.22,
  /** Targets stay this share of the range inside it, so the overshoot does. */
  margin: 0.05,
  /** Sideways drift and lean either way; sideways has its own, stiffer
   *  spring so a gust never carries him far across the gutter. */
  drift: 8,
  driftPeriod: 4.5,
  leanMax: (1.6 * Math.PI) / 180,
  /** His lean has its own, quicker spring — the flick that sets the iPod off. */
  leanPeriod: 4.2,
  leanDamping: 0.45,
  /** Lean into sideways drift: rad per px/s. */
  leanIntoDrift: 0.0007,
  /** Gusts: every this many seconds (uniformly between), lasting this long,
   *  changing his sideways speed by this much (px/s, either way). */
  gustMin: 6,
  gustMax: 14,
  gustLength: 0.55,
  gustKick: [45, 85] as const,
  /** How far a gust carries him, px per px/s of kick: the drift spring's
   *  first peak (measured; see levitation.test.ts). */
  gustReach: 0.36,
  /** The hover shimmer on top of everything. */
  shimmer: 3,
  shimmerPeriod: 2.9,
  /** The pendulum: its period sets gravity for the picture's size. */
  swingPeriod: 2.3,
  /** Per second; a swing loses about half its reach in 4.5s. */
  swingDamping: 0.3,
  /** How hard the swinging iPod rocks him back, rad/s² per unit sin(swing). */
  recoil: 0.35,
};

/** Fixed simulation step: the frame loop runs as many as time has passed. */
export const STEP = 1 / 120;

type Random = () => number;

/**
 * A fresh simulation. `swing` is where the iPod starts: the picture draws the
 * cord a few degrees off plumb, so starting there and letting go makes its
 * first move a real swing instead of a snap.
 */
export function start(
  params: LevitationParams,
  random: Random,
  swing = 0,
): Levitation {
  // He starts where the page drew him, at rest; the first target (drawn on
  // the first step) is what sets him off.
  return {
    t: 0,
    y: 0,
    vy: 0,
    x: 0,
    vx: 0,
    lean: 0,
    vlean: 0,
    target: { y: 0, x: 0, lean: 0 },
    retargetAt: 0,
    gust: nextGust(2 + 3 * random(), params, random),
    swing,
    vswing: 0,
    forkAt: null,
    forkV: null,
  };
}

/** Where he is drawn: the springs plus the shimmer. */
export function pose(s: Levitation): { x: number; y: number; lean: number } {
  return {
    x: s.x,
    y: s.y + FEEL.shimmer * Math.sin((2 * Math.PI * s.t) / FEEL.shimmerPeriod),
    lean: s.lean,
  };
}

/** Rotate a vector the way CSS `rotate(angle)` does, y pointing down. */
export function rotate(v: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** The fork's offset from where it sits at rest, px: where the cord hangs from. */
export function forkOffset(s: Levitation, params: LevitationParams): Vec {
  const p = pose(s);
  const turned = rotate(params.fork, p.lean);
  return { x: p.x + turned.x - params.fork.x, y: p.y + turned.y - params.fork.y };
}

/** Gravity for the picture's size: whatever gives the pendulum its period. */
export function gravity(length: number): number {
  return length * ((2 * Math.PI) / FEEL.swingPeriod) ** 2;
}

function retarget(s: Levitation, params: LevitationParams, random: Random) {
  const lo = params.range * FEEL.margin;
  const hi = params.range * (1 - FEEL.margin);
  let y = lo + (hi - lo) * random();
  if (Math.abs(y - s.target.y) < params.range * FEEL.minMove) {
    // Too small a move to read as one: go the other way from where he is.
    y = s.target.y < params.range / 2 ? hi - (hi - y) * 0.5 : lo + (y - lo) * 0.5;
  }
  s.target = {
    y,
    x: Math.min(FEEL.drift, params.room.right, params.room.left) * (2 * random() - 1),
    lean: FEEL.leanMax * (2 * random() - 1),
  };
  s.retargetAt =
    s.t + FEEL.retargetMin + (FEEL.retargetMax - FEEL.retargetMin) * random();
}

function nextGust(at: number, params: LevitationParams, random: Random) {
  const [lo, hi] = FEEL.gustKick;
  const dir = random() < 0.5 ? -1 : 1;
  // Never further than the room that way, after his own drift.
  const room = dir > 0 ? params.room.right : params.room.left;
  const most = Math.max(0, (room - FEEL.drift) / FEEL.gustReach);
  const kick = Math.min(lo + (hi - lo) * random(), most) * dir;
  // A sin² push over `for` seconds changes speed by force × for / 2.
  return { at, for: FEEL.gustLength, force: (2 * kick) / FEEL.gustLength };
}

/** The gust's push at time t, px/s²: a smooth swell and fall, never a jolt. */
export function gustForce(s: Levitation): number {
  const u = (s.t - s.gust.at) / s.gust.for;
  if (u < 0 || u > 1) return 0;
  return s.gust.force * Math.sin(Math.PI * u) ** 2;
}

/** One fixed step of STEP seconds. Mutates and returns `s`. */
export function step(
  s: Levitation,
  params: LevitationParams,
  random: Random,
  dt = STEP,
): Levitation {
  if (s.t >= s.retargetAt) retarget(s, params, random);
  if (s.t > s.gust.at + s.gust.for) {
    s.gust = nextGust(
      s.t + FEEL.gustMin + (FEEL.gustMax - FEEL.gustMin) * random(),
      params,
      random,
    );
  }

  // A resize may have shrunk his range under his target.
  s.target.y = Math.min(s.target.y, params.range * (1 - FEEL.margin));

  // His float: damped springs toward the target (semi-implicit Euler).
  const w = (2 * Math.PI) / FEEL.floatPeriod;
  const c = 2 * FEEL.floatDamping * w;
  s.vy += (w * w * (s.target.y - s.y) - c * s.vy) * dt;
  const wx = (2 * Math.PI) / FEEL.driftPeriod;
  const cx = 2 * FEEL.floatDamping * wx;
  s.vx += (wx * wx * (s.target.x - s.x) - cx * s.vx + gustForce(s)) * dt;

  const wl = (2 * Math.PI) / FEEL.leanPeriod;
  const cl = 2 * FEEL.leanDamping * wl;
  const leanGoal = s.target.lean + FEEL.leanIntoDrift * s.vx;
  // The iPod swinging right pulls the fork right; the fork hangs below the
  // point he turns about, so that turns him anticlockwise, and vice versa.
  const recoil = -FEEL.recoil * Math.sin(s.swing) * Math.sign(params.fork.y || 1);
  s.vlean += (wl * wl * (leanGoal - s.lean) - cl * s.vlean + recoil) * dt;

  s.y += s.vy * dt;
  s.x += s.vx * dt;
  s.lean += s.vlean * dt;
  s.t += dt;

  // The fork's acceleration, from where it actually went.
  const at = forkOffset(s, params);
  let a: Vec = { x: 0, y: 0 };
  if (s.forkAt) {
    const v = { x: (at.x - s.forkAt.x) / dt, y: (at.y - s.forkAt.y) / dt };
    if (s.forkV) a = { x: (v.x - s.forkV.x) / dt, y: (v.y - s.forkV.y) / dt };
    s.forkV = v;
  }
  s.forkAt = at;

  // A pendulum whose pivot accelerates by `a` feels gravity minus `a`.
  const g = gravity(params.length);
  const L = params.length;
  const accel =
    (-a.x * Math.cos(s.swing) - (g - a.y) * Math.sin(s.swing)) / L -
    FEEL.swingDamping * s.vswing;
  s.vswing += accel * dt;
  s.swing += s.vswing * dt;
  return s;
}

/**
 * Run the simulation forward by `elapsed` seconds in fixed steps. Returns the
 * time left over (less than a step), to carry into the next frame. A long gap
 * (a background tab) is cut to half a second rather than replayed.
 */
export function advance(
  s: Levitation,
  params: LevitationParams,
  random: Random,
  elapsed: number,
): number {
  let left = Math.min(elapsed, 0.5);
  while (left >= STEP) {
    step(s, params, random);
    left -= STEP;
  }
  return left;
}
