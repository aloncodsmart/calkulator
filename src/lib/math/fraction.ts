/** Exact rational arithmetic for school-level problems. */

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

export class Fraction {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('Division by zero');
    if (!Number.isInteger(n) || !Number.isInteger(d)) {
      const f = Fraction.fromDecimal(n / d);
      n = f.n;
      d = f.d;
    }
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1;
    this.n = n / g;
    this.d = d / g;
  }

  static readonly ZERO = new Fraction(0);
  static readonly ONE = new Fraction(1);

  static of(x: number | Fraction): Fraction {
    return x instanceof Fraction ? x : Fraction.fromDecimal(x);
  }

  /** Converts a finite decimal (e.g. 0.25) or a near-rational float to a fraction. */
  static fromDecimal(x: number): Fraction {
    if (Number.isInteger(x)) return new Fraction(x, 1);
    if (!Number.isFinite(x)) throw new Error('Not a finite number');
    // Exact decimal expansion for numbers typed by people (up to 9 digits).
    const s = x.toString();
    if (!s.includes('e')) {
      const [, frac = ''] = s.split('.');
      if (frac.length <= 9) {
        const d = 10 ** frac.length;
        return new Fraction(Math.round(x * d), d);
      }
    }
    // Continued fraction approximation.
    let h1 = 1,
      h0 = 0,
      k1 = 0,
      k0 = 1,
      b = x;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(b);
      [h1, h0] = [a * h1 + h0, h1];
      [k1, k0] = [a * k1 + k0, k1];
      if (Math.abs(x - h1 / k1) < 1e-12 || k1 > 1e9) break;
      b = 1 / (b - a);
    }
    return new Fraction(h1, k1);
  }

  add(o: Fraction | number): Fraction {
    const f = Fraction.of(o);
    return new Fraction(this.n * f.d + f.n * this.d, this.d * f.d);
  }
  sub(o: Fraction | number): Fraction {
    const f = Fraction.of(o);
    return new Fraction(this.n * f.d - f.n * this.d, this.d * f.d);
  }
  mul(o: Fraction | number): Fraction {
    const f = Fraction.of(o);
    return new Fraction(this.n * f.n, this.d * f.d);
  }
  div(o: Fraction | number): Fraction {
    const f = Fraction.of(o);
    if (f.n === 0) throw new Error('Division by zero');
    return new Fraction(this.n * f.d, this.d * f.n);
  }
  neg(): Fraction {
    return new Fraction(-this.n, this.d);
  }
  abs(): Fraction {
    return new Fraction(Math.abs(this.n), this.d);
  }
  pow(k: number): Fraction {
    if (!Number.isInteger(k)) throw new Error('Non-integer power');
    if (k < 0) return Fraction.ONE.div(this.pow(-k));
    let r: Fraction = Fraction.ONE;
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }
  isZero(): boolean {
    return this.n === 0;
  }
  isInt(): boolean {
    return this.d === 1;
  }
  isNeg(): boolean {
    return this.n < 0;
  }
  eq(o: Fraction | number): boolean {
    const f = Fraction.of(o);
    return this.n === f.n && this.d === f.d;
  }
  cmp(o: Fraction | number): number {
    const f = Fraction.of(o);
    return this.n * f.d - f.n * this.d;
  }
  valueOf(): number {
    return this.n / this.d;
  }
  toNumber(): number {
    return this.n / this.d;
  }

  toString(): string {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }

  /** LaTeX, e.g. -\frac{1}{2}. */
  toTex(): string {
    if (this.d === 1) return `${this.n}`;
    const sign = this.n < 0 ? '-' : '';
    return `${sign}\\frac{${Math.abs(this.n)}}{${this.d}}`;
  }
}

/** Greatest square factor: n = k² · m with m square-free. */
export function splitSquare(n: number): { k: number; m: number } {
  let k = 1;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    while (m % (p * p) === 0) {
      m /= p * p;
      k *= p;
    }
  }
  return { k, m };
}

/** Value p + q·√r (r square-free positive integer, r = 1 means rational). */
export interface Surd {
  p: Fraction;
  q: Fraction;
  r: number;
}

export function surdValue(s: Surd): number {
  return s.p.toNumber() + s.q.toNumber() * Math.sqrt(s.r);
}

/** √(f) as a surd 0 + q√r, for f ≥ 0. */
export function sqrtFraction(f: Fraction): Surd {
  if (f.isNeg()) throw new Error('sqrt of negative');
  if (f.isZero()) return { p: Fraction.ZERO, q: Fraction.ZERO, r: 1 };
  // √(n/d) = √(n·d)/d
  const { k, m } = splitSquare(f.n * f.d);
  if (m === 1) return { p: new Fraction(k, f.d), q: Fraction.ZERO, r: 1 };
  return { p: Fraction.ZERO, q: new Fraction(k, f.d), r: m };
}

function sqrtTex(r: number): string {
  return `\\sqrt{${r}}`;
}

/** LaTeX for a single surd value p + q√r. */
export function surdTex(s: Surd): string {
  if (s.r === 1 || s.q.isZero()) return s.p.add(s.r === 1 ? s.q : 0).toTex();
  const L = lcm(s.p.d, s.q.d);
  const P = s.p.mul(L).n;
  const Q = s.q.mul(L).n;
  const qAbs = Math.abs(Q);
  const rad = `${qAbs === 1 ? '' : qAbs}${sqrtTex(s.r)}`;
  let numer: string;
  if (P === 0) numer = `${Q < 0 ? '-' : ''}${rad}`;
  else numer = `${P} ${Q < 0 ? '-' : '+'} ${rad}`;
  if (L === 1) return numer;
  if (P === 0 && Q < 0) return `-\\frac{${rad}}{${L}}`;
  return `\\frac{${numer}}{${L}}`;
}

/** LaTeX for the pair p ± q√r (q > 0). */
export function plusMinusTex(p: Fraction, q: Fraction, r: number): string {
  const L = lcm(p.d, q.d);
  const P = p.mul(L).n;
  const Q = Math.abs(q.mul(L).n);
  const rad = `${Q === 1 ? '' : Q}${sqrtTex(r)}`;
  const numer = P === 0 ? `\\pm ${rad}` : `${P} \\pm ${rad}`;
  if (L === 1) return numer;
  if (P === 0) return `\\pm\\frac{${rad}}{${L}}`;
  return `\\frac{${numer}}{${L}}`;
}

/** Formats a float for display: integers stay integers, others get up to `digits` decimals. */
export function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '\\infty' : '-\\infty';
  const r = Math.round(x);
  if (Math.abs(x - r) < 1e-9) return `${r}`;
  return `${parseFloat(x.toFixed(digits))}`;
}

/** Best exact-looking representation of a float: fraction if it is a simple rational, else decimal. */
export function niceTex(x: number): string {
  if (Math.abs(x - Math.round(x)) < 1e-9) return `${Math.round(x)}`;
  const f = Fraction.fromDecimal(x);
  if (f.d <= 100 && Math.abs(f.toNumber() - x) < 1e-9) return f.toTex();
  return fmt(x);
}
