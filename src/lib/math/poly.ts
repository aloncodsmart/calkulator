import { Fraction, lcm, plusMinusTex, sqrtFraction, surdTex, niceTex, type Surd } from './fraction';
import type { Node } from './expr';

/** Polynomial with rational coefficients; c[i] is the coefficient of x^i. */
export class Poly {
  readonly c: Fraction[];
  constructor(c: (Fraction | number)[]) {
    const arr = c.map((x) => Fraction.of(x));
    while (arr.length > 1 && arr[arr.length - 1].isZero()) arr.pop();
    if (!arr.length) arr.push(Fraction.ZERO);
    this.c = arr;
  }
  static const(v: Fraction | number): Poly {
    return new Poly([v]);
  }
  static readonly X = new Poly([0, 1]);

  get deg(): number {
    return this.c.length === 1 && this.c[0].isZero() ? -Infinity : this.c.length - 1;
  }
  isZero(): boolean {
    return this.deg === -Infinity;
  }
  isConst(): boolean {
    return this.c.length === 1;
  }
  coef(i: number): Fraction {
    return this.c[i] ?? Fraction.ZERO;
  }
  lead(): Fraction {
    return this.c[this.c.length - 1];
  }
  add(o: Poly): Poly {
    const n = Math.max(this.c.length, o.c.length);
    return new Poly(Array.from({ length: n }, (_, i) => this.coef(i).add(o.coef(i))));
  }
  sub(o: Poly): Poly {
    return this.add(o.neg());
  }
  neg(): Poly {
    return new Poly(this.c.map((x) => x.neg()));
  }
  scale(k: Fraction | number): Poly {
    return new Poly(this.c.map((x) => x.mul(k)));
  }
  mul(o: Poly): Poly {
    const r: Fraction[] = Array.from({ length: this.c.length + o.c.length - 1 }, () => Fraction.ZERO);
    this.c.forEach((a, i) => o.c.forEach((b, j) => (r[i + j] = r[i + j].add(a.mul(b)))));
    return new Poly(r);
  }
  pow(k: number): Poly {
    let r = Poly.const(1);
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }
  eval(x: number): number {
    let r = 0;
    for (let i = this.c.length - 1; i >= 0; i--) r = r * x + this.c[i].toNumber();
    return r;
  }
  evalF(x: Fraction): Fraction {
    let r = Fraction.ZERO;
    for (let i = this.c.length - 1; i >= 0; i--) r = r.mul(x).add(this.c[i]);
    return r;
  }
  derivative(): Poly {
    if (this.c.length === 1) return Poly.const(0);
    return new Poly(this.c.slice(1).map((x, i) => x.mul(i + 1)));
  }
  /** Antiderivative with zero constant. */
  integral(): Poly {
    return new Poly([Fraction.ZERO, ...this.c.map((x, i) => x.div(i + 1))]);
  }
  /** Synthetic division by (x − r); returns quotient (assumes r is a root or ignores remainder). */
  divRoot(r: Fraction): { q: Poly; rem: Fraction } {
    const n = this.c.length - 1;
    const q: Fraction[] = new Array(n).fill(Fraction.ZERO);
    let acc = Fraction.ZERO;
    for (let i = n; i >= 1; i--) {
      acc = acc.mul(r).add(this.c[i]);
      q[i - 1] = acc;
    }
    const rem = acc.mul(r).add(this.c[0]);
    return { q: new Poly(q), rem };
  }
  /** Polynomial long division. */
  divmod(o: Poly): { q: Poly; r: Poly } {
    let r: Poly = this;
    let q = Poly.const(0);
    while (!r.isZero() && r.deg >= o.deg) {
      const k = r.deg - o.deg;
      const t = r.lead().div(o.lead());
      const mono = new Poly([...new Array(k).fill(0), t]);
      q = q.add(mono);
      r = r.sub(o.mul(mono));
    }
    return { q, r };
  }
  equals(o: Poly): boolean {
    return this.sub(o).isZero();
  }

  /** LaTeX in descending powers, e.g. 2x^{2} - 3x + 1. */
  toTex(v = 'x'): string {
    const terms: string[] = [];
    for (let i = this.c.length - 1; i >= 0; i--) {
      const a = this.c[i];
      if (a.isZero()) continue;
      terms.push(monoTex(a, i, v, terms.length === 0));
    }
    return terms.length ? terms.join(' ') : '0';
  }
}

/** One signed term. `first` controls whether a leading + is printed. */
export function monoTex(a: Fraction, power: number | Fraction, v = 'x', first = false): string {
  const p = Fraction.of(power);
  const neg = a.isNeg();
  const abs = a.abs();
  let varPart = '';
  if (!p.isZero()) {
    if (p.eq(1)) varPart = v;
    else if (p.eq(new Fraction(1, 2))) varPart = `\\sqrt{${v}}`;
    else varPart = `${v}^{${p.toTex()}}`;
  }
  let coef: string;
  if (varPart && abs.eq(1)) coef = '';
  else coef = abs.toTex();
  const body = `${coef}${varPart}`;
  if (first) return `${neg ? '-' : ''}${body}`;
  return `${neg ? '-' : '+'} ${body}`;
}

// ---------- conversion from AST ----------

/** Converts an AST to a polynomial in `v`, or null when it is not a polynomial. */
export function toPoly(n: Node, v = 'x'): Poly | null {
  switch (n.k) {
    case 'num':
      return Poly.const(n.v);
    case 'real':
      return null;
    case 'var':
      return n.n === v ? Poly.X : null;
    case 'const':
      return null;
    case 'neg': {
      const a = toPoly(n.a, v);
      return a && a.neg();
    }
    case 'add':
    case 'sub':
    case 'mul': {
      const a = toPoly(n.a, v);
      const b = toPoly(n.b, v);
      if (!a || !b) return null;
      return n.k === 'add' ? a.add(b) : n.k === 'sub' ? a.sub(b) : a.mul(b);
    }
    case 'div': {
      const a = toPoly(n.a, v);
      const b = toPoly(n.b, v);
      if (!a || !b || !b.isConst() || b.isZero()) return null;
      return a.scale(Fraction.ONE.div(b.c[0]));
    }
    case 'pow': {
      const a = toPoly(n.a, v);
      const e = toPoly(n.b, v);
      if (!a || !e || !e.isConst()) return null;
      const k = e.c[0];
      if (!k.isInt() || k.n < 0 || k.n > 12) return null;
      return a.pow(k.n);
    }
    case 'fn':
      return null;
  }
}

/** Rational function num/den (no cancellation). */
export interface Rational {
  num: Poly;
  den: Poly;
}

export function toRational(n: Node, v = 'x'): Rational | null {
  switch (n.k) {
    case 'num':
    case 'var':
    case 'const':
    case 'real': {
      const p = toPoly(n, v);
      return p && { num: p, den: Poly.const(1) };
    }
    case 'neg': {
      const a = toRational(n.a, v);
      return a && { num: a.num.neg(), den: a.den };
    }
    case 'add':
    case 'sub': {
      const a = toRational(n.a, v);
      const b = toRational(n.b, v);
      if (!a || !b) return null;
      if (a.den.equals(b.den)) {
        return { num: n.k === 'add' ? a.num.add(b.num) : a.num.sub(b.num), den: a.den };
      }
      const num1 = a.num.mul(b.den);
      const num2 = b.num.mul(a.den);
      return { num: n.k === 'add' ? num1.add(num2) : num1.sub(num2), den: a.den.mul(b.den) };
    }
    case 'mul': {
      const a = toRational(n.a, v);
      const b = toRational(n.b, v);
      if (!a || !b) return null;
      return { num: a.num.mul(b.num), den: a.den.mul(b.den) };
    }
    case 'div': {
      const a = toRational(n.a, v);
      const b = toRational(n.b, v);
      if (!a || !b || b.num.isZero()) return null;
      return { num: a.num.mul(b.den), den: a.den.mul(b.num) };
    }
    case 'pow': {
      const a = toRational(n.a, v);
      const e = toPoly(n.b, v);
      if (!a || !e || !e.isConst()) return null;
      const k = e.c[0];
      if (!k.isInt() || Math.abs(k.n) > 12) return null;
      if (k.n >= 0) return { num: a.num.pow(k.n), den: a.den.pow(k.n) };
      return { num: a.den.pow(-k.n), den: a.num.pow(-k.n) };
    }
    case 'fn':
      return null;
  }
}

/** Collects denominators that appear anywhere in the expression (for domain restrictions). */
export function denominators(n: Node, v = 'x', out: Poly[] = []): Poly[] {
  switch (n.k) {
    case 'div': {
      denominators(n.a, v, out);
      denominators(n.b, v, out);
      const d = toPoly(n.b, v);
      if (d && !d.isConst()) out.push(d);
      else {
        const r = toRational(n.b, v);
        if (r && !r.num.isConst()) out.push(r.num);
      }
      break;
    }
    case 'pow': {
      denominators(n.a, v, out);
      const e = toPoly(n.b, v);
      if (e && e.isConst() && e.c[0].isNeg()) {
        const base = toPoly(n.a, v);
        if (base && !base.isConst()) out.push(base);
      }
      break;
    }
    case 'add':
    case 'sub':
    case 'mul':
      denominators(n.a, v, out);
      denominators(n.b, v, out);
      break;
    case 'neg':
    case 'fn':
      denominators(n.a, v, out);
      break;
  }
  return out;
}

// ---------- roots ----------

export type Root =
  | { kind: 'rational'; v: Fraction }
  | { kind: 'surd'; v: Surd }
  | { kind: 'approx'; v: number };

export function rootValue(r: Root): number {
  if (r.kind === 'rational') return r.v.toNumber();
  if (r.kind === 'surd') return r.v.p.toNumber() + r.v.q.toNumber() * Math.sqrt(r.v.r);
  return r.v;
}

export function rootTex(r: Root): string {
  if (r.kind === 'rational') return r.v.toTex();
  if (r.kind === 'surd') return surdTex(r.v);
  return `\\approx ${niceTex(Math.round(r.v * 1000) / 1000)}`;
}

function divisors(n: number): number[] {
  n = Math.abs(n);
  const out: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      out.push(i);
      if (i * i !== n) out.push(n / i);
    }
  }
  return out;
}

/** Scales a polynomial to integer coefficients. */
export function integerize(p: Poly): Poly {
  const L = p.c.reduce((acc, x) => lcm(acc, x.d), 1);
  return p.scale(L);
}

/** Rational roots (rational root theorem). Returns distinct roots. */
export function rationalRoots(p: Poly): Fraction[] {
  if (p.deg < 1) return [];
  let q = integerize(p);
  const roots: Fraction[] = [];
  // factor out x^k
  while (q.deg >= 1 && q.c[0].isZero()) {
    if (!roots.some((r) => r.isZero())) roots.push(Fraction.ZERO);
    q = new Poly(q.c.slice(1));
  }
  if (q.deg < 1) return roots;
  const a0 = q.c[0].n;
  const an = q.lead().n;
  if (Math.abs(a0) > 1e7 || Math.abs(an) > 1e7) return roots;
  const cands: Fraction[] = [];
  for (const pp of divisors(a0)) for (const qq of divisors(an)) cands.push(new Fraction(pp, qq), new Fraction(-pp, qq));
  for (const c of cands) {
    if (roots.some((r) => r.eq(c))) continue;
    if (q.evalF(c).isZero()) roots.push(c);
  }
  return roots.sort((a, b) => a.cmp(b));
}

/** Real roots of a quadratic ax²+bx+c (exact). */
export function quadraticRoots(a: Fraction, b: Fraction, c: Fraction): { disc: Fraction; roots: Root[] } {
  const disc = b.mul(b).sub(a.mul(c).mul(4));
  if (disc.isNeg()) return { disc, roots: [] };
  const s = sqrtFraction(disc);
  const twoA = a.mul(2);
  const p = b.neg().div(twoA);
  if (s.q.isZero()) {
    const root = s.p.div(twoA);
    const r1 = p.sub(root.abs());
    const r2 = p.add(root.abs());
    if (r1.eq(r2)) return { disc, roots: [{ kind: 'rational', v: r1 }] };
    return { disc, roots: [{ kind: 'rational', v: r1 }, { kind: 'rational', v: r2 }].sort((x, y) => x.v.cmp(y.v)) as Root[] };
  }
  const q = s.q.div(twoA).abs();
  return {
    disc,
    roots: [
      { kind: 'surd', v: { p, q: q.neg(), r: s.r } },
      { kind: 'surd', v: { p, q, r: s.r } },
    ],
  };
}

/** LaTeX for the ± form of the two quadratic roots when they are surds. */
export function quadraticPmTex(a: Fraction, b: Fraction, c: Fraction): string | null {
  const disc = b.mul(b).sub(a.mul(c).mul(4));
  if (disc.isNeg()) return null;
  const s = sqrtFraction(disc);
  if (s.q.isZero()) return null;
  const twoA = a.mul(2);
  return plusMinusTex(b.neg().div(twoA), s.q.div(twoA).abs(), s.r);
}

/** Numeric real roots by sign changes / near-zero minima on [lo, hi]. */
export function numericRoots(f: (x: number) => number, lo = -100, hi = 100, steps = 4000): number[] {
  const roots: number[] = [];
  const h = (hi - lo) / steps;
  let x0 = lo;
  let y0 = f(x0);
  const push = (r: number) => {
    if (!roots.some((q) => Math.abs(q - r) < 1e-6)) roots.push(r);
  };
  for (let i = 1; i <= steps; i++) {
    const x1 = lo + i * h;
    const y1 = f(x1);
    if (Number.isFinite(y0) && Number.isFinite(y1)) {
      if (y0 === 0) push(x0);
      else if (y0 * y1 < 0) {
        // bisection
        let a = x0,
          b = x1,
          fa = y0;
        for (let k = 0; k < 80; k++) {
          const m = (a + b) / 2;
          const fm = f(m);
          if (!Number.isFinite(fm)) break;
          if (fa * fm <= 0) b = m;
          else {
            a = m;
            fa = fm;
          }
        }
        const r = (a + b) / 2;
        // reject poles: |f| must actually be small near r
        if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(y0), Math.abs(y1))) push(r);
      }
    }
    x0 = x1;
    y0 = y1;
  }
  // tangential roots (double roots): look for local minima of |f| close to zero
  for (let i = 1; i < steps; i++) {
    const xm = lo + i * h;
    const a = Math.abs(f(xm - h)),
      b = Math.abs(f(xm)),
      c = Math.abs(f(xm + h));
    if (b <= a && b <= c && b < 1e-3) {
      // golden refine
      let l = xm - h,
        r = xm + h;
      for (let k = 0; k < 60; k++) {
        const m1 = l + (r - l) / 3,
          m2 = r - (r - l) / 3;
        if (Math.abs(f(m1)) < Math.abs(f(m2))) r = m2;
        else l = m1;
      }
      const z = (l + r) / 2;
      if (Math.abs(f(z)) < 1e-9) push(z);
    }
  }
  return roots.sort((a, b) => a - b);
}

/** All distinct real roots of a polynomial, as exact as possible. */
export function polyRoots(p: Poly): Root[] {
  if (p.deg < 1) return [];
  if (p.deg === 1) return [{ kind: 'rational', v: p.c[0].neg().div(p.c[1]) }];
  if (p.deg === 2) return quadraticRoots(p.c[2], p.c[1], p.c[0]).roots;
  const rr = rationalRoots(p);
  let q = p;
  for (const r of rr) {
    // deflate all multiplicities
    for (;;) {
      const { q: qq, rem } = q.divRoot(r);
      if (!rem.isZero() || q.deg < 1) break;
      q = qq;
    }
  }
  const out: Root[] = rr.map((v) => ({ kind: 'rational', v }));
  if (q.deg === 2) out.push(...quadraticRoots(q.c[2], q.c[1], q.c[0]).roots);
  else if (q.deg > 2) {
    // biquadratic in disguise: only even powers
    const even = q.c.every((c, i) => i % 2 === 0 || c.isZero());
    if (even && q.deg === 4) {
      const t = quadraticRoots(q.c[4], q.c[2], q.c[0]).roots;
      for (const tr of t) {
        const tv = rootValue(tr);
        if (tv < 0) continue;
        if (tr.kind === 'rational') {
          const s = sqrtFraction(tr.v);
          const pos: Root = s.q.isZero() ? { kind: 'rational', v: s.p } : { kind: 'surd', v: s };
          const neg: Root =
            s.q.isZero() ? { kind: 'rational', v: s.p.neg() } : { kind: 'surd', v: { p: Fraction.ZERO, q: s.q.neg(), r: s.r } };
          out.push(neg, pos);
        } else {
          out.push({ kind: 'approx', v: -Math.sqrt(tv) }, { kind: 'approx', v: Math.sqrt(tv) });
        }
      }
    } else {
      const bound = 1 + Math.max(...q.c.slice(0, -1).map((c) => Math.abs(c.div(q.lead()).toNumber())));
      for (const r of numericRoots((x) => q.eval(x), -bound - 1, bound + 1)) out.push({ kind: 'approx', v: r });
    }
  } else if (q.deg === 1) out.push({ kind: 'rational', v: q.c[0].neg().div(q.c[1]) });
  // de-duplicate and sort
  const uniq: Root[] = [];
  for (const r of out.sort((a, b) => rootValue(a) - rootValue(b))) {
    if (!uniq.some((u) => Math.abs(rootValue(u) - rootValue(r)) < 1e-9)) uniq.push(r);
  }
  return uniq;
}

// ---------- power sums  Σ c·x^e  (e rational) ----------

export interface Term {
  c: Fraction;
  e: Fraction;
}

export class PowerSum {
  readonly terms: Term[];
  constructor(terms: Term[]) {
    const map = new Map<string, Term>();
    for (const t of terms) {
      const key = t.e.toString();
      const prev = map.get(key);
      map.set(key, { c: prev ? prev.c.add(t.c) : t.c, e: t.e });
    }
    this.terms = [...map.values()].filter((t) => !t.c.isZero()).sort((a, b) => b.e.cmp(a.e));
  }
  static const(v: Fraction): PowerSum {
    return new PowerSum([{ c: v, e: Fraction.ZERO }]);
  }
  add(o: PowerSum): PowerSum {
    return new PowerSum([...this.terms, ...o.terms]);
  }
  neg(): PowerSum {
    return new PowerSum(this.terms.map((t) => ({ c: t.c.neg(), e: t.e })));
  }
  mul(o: PowerSum): PowerSum {
    const out: Term[] = [];
    for (const a of this.terms) for (const b of o.terms) out.push({ c: a.c.mul(b.c), e: a.e.add(b.e) });
    return new PowerSum(out);
  }
  isMonomial(): boolean {
    return this.terms.length === 1;
  }
  isConst(): boolean {
    return this.terms.length === 0 || (this.terms.length === 1 && this.terms[0].e.isZero());
  }
  constValue(): Fraction {
    return this.terms.length ? this.terms[0].c : Fraction.ZERO;
  }
  derivative(): PowerSum {
    return new PowerSum(this.terms.filter((t) => !t.e.isZero()).map((t) => ({ c: t.c.mul(t.e), e: t.e.sub(1) })));
  }
  eval(x: number): number {
    return this.terms.reduce((s, t) => s + t.c.toNumber() * Math.pow(x, t.e.toNumber()), 0);
  }
  isPolynomial(): boolean {
    return this.terms.every((t) => t.e.isInt() && t.e.n >= 0);
  }
  toPoly(): Poly | null {
    if (!this.isPolynomial()) return null;
    const deg = Math.max(0, ...this.terms.map((t) => t.e.n));
    const c: Fraction[] = new Array(deg + 1).fill(Fraction.ZERO);
    for (const t of this.terms) c[t.e.n] = c[t.e.n].add(t.c);
    return new Poly(c);
  }
  toTex(v = 'x'): string {
    if (!this.terms.length) return '0';
    return this.terms.map((t, i) => termTex(t, v, i === 0)).join(' ');
  }
}

/** Nice LaTeX for c·x^e: negative powers become fractions, 1/2 becomes a root. */
export function termTex(t: Term, v = 'x', first = false): string {
  const neg = t.c.isNeg();
  const sign = first ? (neg ? '-' : '') : neg ? '- ' : '+ ';
  const c = t.c.abs();
  if (t.e.isZero()) return `${sign}${c.toTex()}`;
  if (t.e.isNeg()) {
    const pe = t.e.neg();
    const den = pe.eq(1) ? v : pe.eq(new Fraction(1, 2)) ? `\\sqrt{${v}}` : `${v}^{${pe.toTex()}}`;
    const numer = c.n;
    const denFull = c.d === 1 ? den : `${c.d}${den}`;
    return `${sign}\\frac{${numer}}{${denFull}}`;
  }
  const coef = c.eq(1) ? '' : c.toTex();
  let varPart: string;
  if (t.e.eq(1)) varPart = v;
  else if (t.e.eq(new Fraction(1, 2))) varPart = `\\sqrt{${v}}`;
  else varPart = `${v}^{${t.e.toTex()}}`;
  return `${sign}${coef}${varPart}`;
}

export function toPowerSum(n: Node, v = 'x'): PowerSum | null {
  switch (n.k) {
    case 'num':
      return PowerSum.const(n.v);
    case 'var':
      return n.n === v ? new PowerSum([{ c: Fraction.ONE, e: Fraction.ONE }]) : null;
    case 'real':
    case 'const':
      return null;
    case 'neg': {
      const a = toPowerSum(n.a, v);
      return a && a.neg();
    }
    case 'add':
    case 'sub': {
      const a = toPowerSum(n.a, v);
      const b = toPowerSum(n.b, v);
      if (!a || !b) return null;
      return n.k === 'add' ? a.add(b) : a.add(b.neg());
    }
    case 'mul': {
      const a = toPowerSum(n.a, v);
      const b = toPowerSum(n.b, v);
      return a && b && a.mul(b);
    }
    case 'div': {
      const a = toPowerSum(n.a, v);
      const b = toPowerSum(n.b, v);
      if (!a || !b || !b.isMonomial()) return null;
      const m = b.terms[0];
      return a.mul(new PowerSum([{ c: Fraction.ONE.div(m.c), e: m.e.neg() }]));
    }
    case 'pow': {
      const a = toPowerSum(n.a, v);
      const e = toPowerSum(n.b, v);
      if (!a || !e || !e.isConst()) return null;
      const k = e.constValue();
      if (a.isMonomial()) {
        const m = a.terms[0];
        if (!k.isInt() && !m.c.eq(1)) return null;
        return new PowerSum([{ c: k.isInt() ? m.c.pow(k.n) : Fraction.ONE, e: m.e.mul(k) }]);
      }
      if (k.isInt() && k.n >= 0 && k.n <= 8) {
        let r = PowerSum.const(Fraction.ONE);
        for (let i = 0; i < k.n; i++) r = r.mul(a);
        return r;
      }
      return null;
    }
    case 'fn': {
      if (n.n !== 'sqrt') return null;
      const a = toPowerSum(n.a, v);
      if (!a || !a.isMonomial() || !a.terms[0].c.eq(1)) return null;
      return new PowerSum([{ c: Fraction.ONE, e: a.terms[0].e.div(2) }]);
    }
  }
}
