import { Fraction, fmt } from './fraction';

/** Expression AST. */
export type Node =
  | { k: 'num'; v: Fraction }
  | { k: 'real'; v: number }
  | { k: 'var'; n: string }
  | { k: 'const'; n: 'pi' | 'e' }
  | { k: 'add' | 'sub' | 'mul' | 'div' | 'pow'; a: Node; b: Node }
  | { k: 'neg'; a: Node }
  | { k: 'fn'; n: FnName; a: Node; base?: Node };

export type FnName = 'sin' | 'cos' | 'tan' | 'ln' | 'log' | 'sqrt' | 'abs' | 'exp';

const FN_NAMES: Record<string, FnName> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  tg: 'tan',
  ln: 'ln',
  log: 'log',
  sqrt: 'sqrt',
  abs: 'abs',
  exp: 'exp',
};

export class ParseError extends Error {}

type Tok =
  | { t: 'num'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'fn'; v: FnName; base?: string };

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
};

/** Normalizes common Unicode math characters typed on phones. */
export function normalizeInput(s: string): string {
  let out = s
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/‏|‎/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\\left|\\right/g, '')
    .replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'));
  // superscripts → ^(...)
  out = out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => `^(${[...m].map((c) => SUPERSCRIPTS[c]).join('')})`);
  return out;
}

function tokenize(src: string): Tok[] {
  const s = normalizeInput(src);
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = s.slice(i, j);
      if ((v.match(/\./g) || []).length > 1 || v === '.') throw new ParseError(`מספר לא תקין: ${v}`);
      toks.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      let word = s.slice(i, j);
      i = j;
      // Split a word into known function names / constants / single-letter variables.
      while (word.length) {
        const fn = Object.keys(FN_NAMES)
          .sort((a, b) => b.length - a.length)
          .find((f) => word.startsWith(f));
        if (fn) {
          word = word.slice(fn.length);
          const name = FN_NAMES[fn];
          if (name === 'log' && !word.length) {
            // log_2(x) · log_{2}(x) · log_(2)(x) · log2(x)
            let k = i;
            let base: string | undefined;
            const digitsEnd = (from: number) => {
              let m = from;
              while (m < s.length && /[0-9.]/.test(s[m])) m++;
              return m;
            };
            if (s[k] === '_') {
              k++;
              if (s[k] === '(') {
                const close = s.indexOf(')', k);
                if (close > k) {
                  base = s.slice(k + 1, close);
                  k = close + 1;
                }
              } else {
                const m = digitsEnd(k);
                if (m > k) {
                  base = s.slice(k, m);
                  k = m;
                } else if (/[a-z]/.test(s[k] ?? '')) {
                  base = s[k];
                  k++;
                }
              }
            } else if (/[0-9]/.test(s[k] ?? '')) {
              const m = digitsEnd(k);
              if (s[m] === '(') {
                base = s.slice(k, m);
                k = m;
              }
            }
            if (base !== undefined) {
              toks.push({ t: 'fn', v: 'log', base });
              i = k;
              continue;
            }
          }
          toks.push({ t: 'fn', v: name });
          continue;
        }
        if (word.startsWith('pi')) {
          toks.push({ t: 'id', v: 'pi' });
          word = word.slice(2);
          continue;
        }
        toks.push({ t: 'id', v: word[0] });
        word = word.slice(1);
      }
      continue;
    }
    if ('+-*/^()|'.includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '[') {
      toks.push({ t: 'op', v: '(' });
      i++;
      continue;
    }
    if (c === ']') {
      toks.push({ t: 'op', v: ')' });
      i++;
      continue;
    }
    if (c === ':') {
      toks.push({ t: 'op', v: '/' });
      i++;
      continue;
    }
    throw new ParseError(`תו לא מוכר: "${c}"`);
  }
  return toks;
}

class Parser {
  private i = 0;
  private absDepth = 0;
  constructor(private toks: Tok[]) {}

  parse(): Node {
    if (!this.toks.length) throw new ParseError('ביטוי ריק');
    const n = this.expr();
    if (this.i < this.toks.length) throw new ParseError('יש תווים מיותרים בסוף הביטוי');
    return n;
  }

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === 'op' && t.v === v;
  }

  private expr(): Node {
    let n = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { v: string }).v;
      const b = this.term();
      n = { k: op === '+' ? 'add' : 'sub', a: n, b };
    }
    return n;
  }

  private startsAtom(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.t === 'num' || t.t === 'id' || t.t === 'fn') return true;
    if (t.t === 'op' && t.v === '(') return true;
    if (t.t === 'op' && t.v === '|' && this.absDepth === 0) return true;
    return false;
  }

  private term(): Node {
    let n = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.i++] as { v: string }).v;
        const b = this.unary();
        n = { k: op === '*' ? 'mul' : 'div', a: n, b };
      } else if (this.startsAtom()) {
        const b = this.power();
        n = { k: 'mul', a: n, b };
      } else break;
    }
    return n;
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.i++;
      return { k: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.atom();
    if (this.isOp('^')) {
      this.i++;
      const exp = this.unary();
      return { k: 'pow', a: base, b: exp };
    }
    return base;
  }

  private atom(): Node {
    const t = this.peek();
    if (!t) throw new ParseError('הביטוי נגמר באמצע');
    if (t.t === 'num') {
      this.i++;
      return { k: 'num', v: Fraction.fromDecimal(parseFloat(t.v)) };
    }
    if (t.t === 'id') {
      this.i++;
      if (t.v === 'pi') return { k: 'const', n: 'pi' };
      if (t.v === 'e') return { k: 'const', n: 'e' };
      return { k: 'var', n: t.v };
    }
    if (t.t === 'fn') {
      this.i++;
      let base: Node | undefined;
      if (t.base !== undefined) base = new Parser(tokenize(t.base)).parse();
      let arg: Node;
      // allow sin^2(x)
      if (this.isOp('^')) {
        this.i++;
        const e = this.atom();
        const a = this.fnArg();
        return { k: 'pow', a: { k: 'fn', n: t.v, a, base }, b: e };
      }
      arg = this.fnArg();
      return { k: 'fn', n: t.v, a: arg, base };
    }
    if (t.t === 'op' && t.v === '(') {
      this.i++;
      const n = this.expr();
      if (!this.isOp(')')) throw new ParseError('חסר סוגר ")"');
      this.i++;
      return n;
    }
    if (t.t === 'op' && t.v === '|') {
      this.i++;
      this.absDepth++;
      const n = this.expr();
      this.absDepth--;
      if (!this.isOp('|')) throw new ParseError('חסר "|" סוגר של ערך מוחלט');
      this.i++;
      return { k: 'fn', n: 'abs', a: n };
    }
    throw new ParseError(`לא ציפיתי ל-"${(t as { v: string }).v}" כאן`);
  }

  private fnArg(): Node {
    if (this.isOp('(')) return this.atom();
    // sin x, sin 2x – argument is a product of factors
    let n = this.power();
    while (this.startsAtom() && this.peek()?.t !== 'fn') {
      n = { k: 'mul', a: n, b: this.power() };
    }
    return n;
  }
}

export function parse(src: string): Node {
  return new Parser(tokenize(src)).parse();
}

export function tryParse(src: string): Node | null {
  try {
    return parse(src);
  } catch {
    return null;
  }
}

// ---------- evaluation ----------

export type Env = Record<string, number>;

export function evaluate(n: Node, env: Env = {}): number {
  switch (n.k) {
    case 'num':
      return n.v.toNumber();
    case 'real':
      return n.v;
    case 'var': {
      const v = env[n.n];
      if (v === undefined) throw new Error(`unbound ${n.n}`);
      return v;
    }
    case 'const':
      return n.n === 'pi' ? Math.PI : Math.E;
    case 'add':
      return evaluate(n.a, env) + evaluate(n.b, env);
    case 'sub':
      return evaluate(n.a, env) - evaluate(n.b, env);
    case 'mul':
      return evaluate(n.a, env) * evaluate(n.b, env);
    case 'div':
      return evaluate(n.a, env) / evaluate(n.b, env);
    case 'pow': {
      const b = evaluate(n.a, env);
      const e = evaluate(n.b, env);
      // real odd roots of negatives, e.g. (-8)^(1/3)
      if (b < 0 && !Number.isInteger(e)) {
        const f = Fraction.fromDecimal(e);
        if (f.d % 2 === 1) return (f.n % 2 === 0 ? 1 : -1) * Math.pow(-b, e);
      }
      return Math.pow(b, e);
    }
    case 'neg':
      return -evaluate(n.a, env);
    case 'fn': {
      const a = evaluate(n.a, env);
      switch (n.n) {
        case 'sin':
          return Math.sin(a);
        case 'cos':
          return Math.cos(a);
        case 'tan':
          return Math.tan(a);
        case 'ln':
          return Math.log(a);
        case 'log': {
          const base = n.base ? evaluate(n.base, env) : 10;
          return Math.log(a) / Math.log(base);
        }
        case 'sqrt':
          return Math.sqrt(a);
        case 'abs':
          return Math.abs(a);
        case 'exp':
          return Math.exp(a);
      }
    }
  }
}

export function variables(n: Node, out = new Set<string>()): Set<string> {
  switch (n.k) {
    case 'var':
      out.add(n.n);
      break;
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'pow':
      variables(n.a, out);
      variables(n.b, out);
      break;
    case 'neg':
      variables(n.a, out);
      break;
    case 'fn':
      variables(n.a, out);
      if (n.base) variables(n.base, out);
      break;
  }
  return out;
}

export function compile(n: Node, v = 'x'): (x: number) => number {
  return (x: number) => {
    try {
      return evaluate(n, { [v]: x });
    } catch {
      return NaN;
    }
  };
}

// ---------- LaTeX ----------

const PREC: Record<string, number> = { add: 1, sub: 1, mul: 2, div: 2, neg: 3, pow: 4 };

function prec(n: Node): number {
  if (n.k === 'num') return n.v.isNeg() || !n.v.isInt() ? 2 : 9;
  if (n.k === 'real') return n.v < 0 ? 2 : 9;
  return PREC[n.k] ?? 9;
}

function wrap(s: string): string {
  return `\\left(${s}\\right)`;
}

/** Starts with a digit (used to decide when an explicit · is needed). */
function startsWithDigit(tex: string): boolean {
  return /^[0-9]/.test(tex) || /^\\frac/.test(tex);
}

export function toTex(n: Node): string {
  switch (n.k) {
    case 'num':
      return n.v.toTex();
    case 'real':
      return fmt(n.v);
    case 'var':
      return n.n;
    case 'const':
      return n.n === 'pi' ? '\\pi' : 'e';
    case 'add':
      return `${toTex(n.a)} + ${toTex(n.b)}`;
    case 'sub': {
      const b = toTex(n.b);
      return `${toTex(n.a)} - ${prec(n.b) <= 1 ? wrap(b) : b}`;
    }
    case 'neg': {
      const a = toTex(n.a);
      return `-${prec(n.a) <= 2 && n.a.k !== 'mul' && n.a.k !== 'div' ? wrap(a) : a}`;
    }
    case 'mul': {
      let a = toTex(n.a);
      let b = toTex(n.b);
      if (prec(n.a) < 2) a = wrap(a);
      if (prec(n.b) <= 2 || n.b.k === 'neg') b = wrap(b);
      const implicit =
        (n.a.k === 'num' && /^[a-zA-Z\\]/.test(b) && !b.startsWith('\\frac')) ||
        (n.a.k === 'num' && n.a.v.isInt() && !startsWithDigit(b)) ||
        ((n.a.k === 'var' || n.a.k === 'const') && (n.b.k === 'var' || n.b.k === 'const' || n.b.k === 'fn' || n.b.k === 'pow')) ||
        (b.startsWith('\\left(') && !startsWithDigit(b));
      if (n.a.k === 'num' && n.a.v.eq(-1)) return `-${b}`;
      return implicit ? `${a}${b}` : `${a} \\cdot ${b}`;
    }
    case 'div':
      return `\\frac{${toTex(n.a)}}{${toTex(n.b)}}`;
    case 'pow': {
      if (n.b.k === 'num' && n.b.v.eq(new Fraction(1, 2))) return `\\sqrt{${toTex(n.a)}}`;
      let a = toTex(n.a);
      if (prec(n.a) <= 4 || n.a.k === 'fn') a = wrap(a);
      return `${a}^{${toTex(n.b)}}`;
    }
    case 'fn': {
      const a = toTex(n.a);
      switch (n.n) {
        case 'sqrt':
          return `\\sqrt{${a}}`;
        case 'abs':
          return `\\left|${a}\\right|`;
        case 'exp':
          return `e^{${a}}`;
        case 'log':
          return `\\log${n.base ? `_{${toTex(n.base)}}` : ''}${wrap(a)}`;
        default: {
          const simple = n.a.k === 'var' || (n.a.k === 'mul' && n.a.a.k === 'num' && n.a.b.k === 'var');
          return `\\${n.n}${simple ? ` ${a}` : wrap(a)}`;
        }
      }
    }
  }
}

/** Parses an input and returns LaTeX, or null when it does not parse. */
export function inputToTex(src: string): string | null {
  const n = tryParse(src);
  return n ? toTex(n) : null;
}

// ---------- helpers for building nodes ----------

export const num = (v: number | Fraction): Node => ({ k: 'num', v: Fraction.of(v) });
export const X: Node = { k: 'var', n: 'x' };

/** Numerical equivalence test of two expressions in the given variables. */
export function equivalent(a: Node, b: Node, vars: string[] = ['x'], samples = 12): boolean {
  let compared = 0;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < samples * 4 && compared < samples; i++) {
    const env: Env = {};
    for (const v of vars) env[v] = Math.round((rnd() * 10 - 5) * 1000) / 1000 + 0.137;
    let va: number, vb: number;
    try {
      va = evaluate(a, env);
      vb = evaluate(b, env);
    } catch {
      return false;
    }
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    compared++;
    const tol = 1e-7 * Math.max(1, Math.abs(va), Math.abs(vb));
    if (Math.abs(va - vb) > tol) return false;
  }
  return compared > 0;
}
