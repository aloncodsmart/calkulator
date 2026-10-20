import { Fraction, lcm, niceTex } from '../math/fraction';
import type { Node } from '../math/expr';
import { Poly, rootTex, rootValue, type Root } from '../math/poly';
import type { Hints, Solution, SolutionStep } from '../../types';

export class SolveError extends Error {}

export const step = (title: string, tex?: string, text?: string): SolutionStep => ({ title, tex, text });

export function eqTex(a: string, b: string, rel = '='): string {
  return `${a} ${rel} ${b}`;
}

/** "x = 3" or "x_1 = 2,\ x_2 = 5". */
export function rootsTex(roots: Root[], v = 'x'): string {
  if (!roots.length) return '\\text{אין פתרון}';
  if (roots.length === 1) return `${v} = ${rootTex(roots[0]).replace('\\approx ', '\\approx ')}`;
  return roots.map((r, i) => `${v}_{${i + 1}} ${r.kind === 'approx' ? '' : '='} ${rootTex(r)}`).join(',\\quad ');
}

export function rootsAnswer(roots: Root[], v = 'x'): string {
  if (!roots.length) return 'אין פתרון ממשי.';
  return `$${rootsTex(roots, v)}$`;
}

/** Least common multiple of all coefficient denominators. */
export function coefLcd(...ps: Poly[]): number {
  return ps.reduce((acc, p) => p.c.reduce((a, c) => lcm(a, c.d), acc), 1);
}

/** Greatest common divisor of integer coefficients. */
export function coefGcd(p: Poly): number {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
  return p.c.reduce((acc, c) => (c.isZero() ? acc : g(acc, c.n)), 0) || 1;
}

/** Simple fraction or decimal display of a root value for checks. */
export function valueTex(x: number): string {
  return niceTex(x);
}

export function rootsMatch(a: Root[], b: number[]): boolean {
  return a.length === b.length && a.every((r, i) => Math.abs(rootValue(r) - b[i]) < 1e-6);
}

/** Collects $…$ friendly text for a list of numbers. */
export function listTex(values: string[]): string {
  return values.join(',\\ ');
}

export function frac(n: number, d = 1): Fraction {
  return new Fraction(n, d);
}

export function hints(direction: string, tool: string, next: string): Hints {
  return { direction, tool, next };
}

export interface Parsed {
  L: Node;
  R: Node;
  rel: Rel;
}

export type Rel = '=' | '<' | '>' | '\\le' | '\\ge';

export const REL_TEX: Record<Rel, string> = { '=': '=', '<': '<', '>': '>', '\\le': '\\le', '\\ge': '\\ge' };

/** Flips an inequality relation (when multiplying by a negative number or swapping sides). */
export function flip(rel: Rel): Rel {
  return rel === '<' ? '>' : rel === '>' ? '<' : rel === '\\le' ? '\\ge' : rel === '\\ge' ? '\\le' : rel;
}

export type { Solution };
