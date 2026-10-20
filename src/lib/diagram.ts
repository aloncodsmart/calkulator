import type { Compass, DiagramSpec, PointDef } from '../types';

export type V = [number, number];

export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
export const len = (a: V): number => Math.hypot(a[0], a[1]);
export const unit = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: V, b: V): number => a[0] * b[1] - a[1] * b[0];
const rotate = (a: V, phi: number): V => [a[0] * Math.cos(phi) - a[1] * Math.sin(phi), a[0] * Math.sin(phi) + a[1] * Math.cos(phi)];

export const DEFAULT_SIZE: [number, number] = [320, 240];
const PAD = 16;

export interface Frame {
  width: number;
  height: number;
  /** Model → view transform. */
  toView: (p: V) => V;
  /** Model length → view length. */
  scale: number;
  /** Visible model window (math mode). */
  window?: [number, number, number, number];
  math: boolean;
}

export function makeFrame(spec: DiagramSpec): Frame {
  const [width, height] = spec.size ?? DEFAULT_SIZE;
  if (!spec.window) return { width, height, toView: (p) => p, scale: 1, math: false };
  const [x0, x1, y0, y1] = spec.window;
  let sx = (width - 2 * PAD) / (x1 - x0);
  let sy = (height - 2 * PAD) / (y1 - y0);
  if (!spec.free) sx = sy = Math.min(sx, sy);
  // center the window inside the view
  const ox = (width - (x1 - x0) * sx) / 2;
  const oy = (height - (y1 - y0) * sy) / 2;
  const toView = (p: V): V => [ox + (p[0] - x0) * sx, oy + (y1 - p[1]) * sy];
  // the actually visible window (may be larger than requested because of equal scaling)
  const vis: [number, number, number, number] = [x0 - ox / sx, x0 + (width - ox) / sx, y1 - (height - oy) / sy, y1 + oy / sy];
  return { width, height, toView, scale: sx, window: vis, math: true };
}

export class DiagramError extends Error {}

/** Resolves all point definitions to model coordinates (in declaration order, allowing references). */
export function resolvePoints(spec: DiagramSpec): Record<string, V> {
  const defs = spec.points ?? {};
  const out: Record<string, V> = {};
  const orient = spec.window ? 1 : -1; // y-up vs y-down
  const get = (name: string): V => {
    if (out[name]) return out[name];
    const d = defs[name];
    if (!d) throw new DiagramError(`Diagram ${spec.id}: unknown point "${name}"`);
    out[name] = resolve(d);
    return out[name];
  };
  const resolve = (d: PointDef): V => {
    if (Array.isArray(d)) return [d[0], d[1]];
    if ('mid' in d) return mul(add(get(d.mid[0]), get(d.mid[1])), 0.5);
    if ('polar' in d) {
      const [cx, cy, r, deg] = d.polar;
      const t = (deg * Math.PI) / 180;
      return [cx + r * Math.cos(t), cy + orient * r * Math.sin(t)];
    }
    if ('on' in d) {
      const c = get(d.on[0]);
      const t = (d.on[2] * Math.PI) / 180;
      return [c[0] + d.on[1] * Math.cos(t), c[1] + orient * d.on[1] * Math.sin(t)];
    }
    if ('foot' in d) {
      const p = get(d.foot[0]);
      const a = get(d.foot[1]);
      const b = get(d.foot[2]);
      const ab = sub(b, a);
      const t = dot(sub(p, a), ab) / dot(ab, ab);
      return add(a, mul(ab, t));
    }
    if ('along' in d) {
      const a = get(d.along[0]);
      const b = get(d.along[1]);
      return add(a, mul(sub(b, a), d.along[2]));
    }
    if ('inter' in d) {
      const [a, b, c, e] = d.inter.map(get);
      const r = sub(b, a);
      const s = sub(e, c);
      const den = cross(r, s);
      if (Math.abs(den) < 1e-12) throw new DiagramError(`Diagram ${spec.id}: parallel lines in inter`);
      const t = cross(sub(c, a), s) / den;
      return add(a, mul(r, t));
    }
    if ('rot' in d) {
      const p = get(d.rot[0]);
      const c = get(d.rot[1]);
      const phi = (orient * d.rot[2] * Math.PI) / 180;
      return add(c, rotate(sub(p, c), phi));
    }
    if ('add' in d) {
      const [a, b, c] = d.add.map(get);
      return sub(add(a, c), b);
    }
    if ('tan' in d) {
      const p = get(d.tan[0]);
      const o = get(d.tan[1]);
      const r = d.tan[2];
      const dist = len(sub(p, o));
      if (dist <= r) throw new DiagramError(`Diagram ${spec.id}: tangent point from inside the circle`);
      const alpha = Math.acos(r / dist);
      return add(o, mul(rotate(unit(sub(p, o)), Math.sign(d.tan[3] || 1) * alpha), r));
    }
    if ('refl' in d) {
      const p = get(d.refl[0]);
      const a = get(d.refl[1]);
      const b = get(d.refl[2]);
      const ab = sub(b, a);
      const t = dot(sub(p, a), ab) / dot(ab, ab);
      const f = add(a, mul(ab, t));
      return sub(mul(f, 2), p);
    }
    if ('incenter' in d) {
      const [A, B, C] = d.incenter.map(get);
      const a = len(sub(B, C));
      const b = len(sub(C, A));
      const c = len(sub(A, B));
      return mul(add(add(mul(A, a), mul(B, b)), mul(C, c)), 1 / (a + b + c));
    }
    if ('centroid' in d) {
      const [A, B, C] = d.centroid.map(get);
      return mul(add(add(A, B), C), 1 / 3);
    }
    if ('circumcenter' in d) {
      const [A, B, C] = d.circumcenter.map(get);
      const D = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
      const a2 = dot(A, A),
        b2 = dot(B, B),
        c2 = dot(C, C);
      return [
        (a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / D,
        (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / D,
      ];
    }
    if ('orthocenter' in d) {
      const [A, B, C] = d.orthocenter.map(get);
      const O = resolve({ circumcenter: d.orthocenter });
      // H = A + B + C − 2O
      return sub(add(add(A, B), C), mul(O, 2));
    }
    if ('chordx' in d) {
      const p = get(d.chordx[0]);
      const a = get(d.chordx[1]);
      const o = get(d.chordx[2]);
      const r2 = dot(sub(a, o), sub(a, o));
      const ap = sub(a, p);
      const qa = dot(ap, ap);
      const qc = dot(sub(p, o), sub(p, o)) - r2;
      return add(p, mul(ap, qc / qa));
    }
    throw new DiagramError(`Diagram ${spec.id}: bad point definition`);
  };
  for (const name of Object.keys(defs)) get(name);
  return out;
}

const COMPASS: Record<Compass, V> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [0.75, -0.75],
  nw: [-0.75, -0.75],
  se: [0.75, 0.75],
  sw: [-0.75, 0.75],
  c: [0, 0],
};

export function compassOffset(c: Compass, dist = 13): V {
  return mul(COMPASS[c], dist);
}

/** Every point name referenced by the diagram's elements. */
export function referencedPoints(spec: DiagramSpec): string[] {
  const names: string[] = [];
  for (const el of spec.elements) {
    if ('p' in el) {
      if (Array.isArray(el.p)) names.push(...el.p);
      else names.push(el.p);
    }
    if ('o' in el) names.push(el.o);
    if (el.t === 'circle' && el.through) names.push(el.through);
    if (el.t === 'arc') names.push(el.from, el.to);
  }
  return names;
}
