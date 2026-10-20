import { Fraction } from './fraction';
import type { Node } from './expr';
import { toTex } from './expr';
import { toPowerSum } from './poly';

const N = (v: number | Fraction): Node => ({ k: 'num', v: Fraction.of(v) });
const isNum = (n: Node, v?: number): boolean => n.k === 'num' && (v === undefined || n.v.eq(v));
const numVal = (n: Node): Fraction => (n as { v: Fraction }).v;

export function containsVar(n: Node, v = 'x'): boolean {
  switch (n.k) {
    case 'var':
      return n.n === v;
    case 'num':
    case 'real':
    case 'const':
      return false;
    case 'neg':
      return containsVar(n.a, v);
    case 'fn':
      return containsVar(n.a, v) || (!!n.base && containsVar(n.base, v));
    default:
      return containsVar(n.a, v) || containsVar(n.b, v);
  }
}

/** Light algebraic simplification (constant folding and identities). */
export function simplify(n: Node): Node {
  switch (n.k) {
    case 'num':
    case 'real':
    case 'var':
    case 'const':
      return n;
    case 'neg': {
      const a = simplify(n.a);
      if (isNum(a)) return N(numVal(a).neg());
      if (a.k === 'neg') return a.a;
      return { k: 'neg', a };
    }
    case 'fn': {
      const a = simplify(n.a);
      return { ...n, a, base: n.base && simplify(n.base) };
    }
    default: {
      const a = simplify(n.a);
      const b = simplify(n.b);
      if (isNum(a) && isNum(b)) {
        try {
          switch (n.k) {
            case 'add':
              return N(numVal(a).add(numVal(b)));
            case 'sub':
              return N(numVal(a).sub(numVal(b)));
            case 'mul':
              return N(numVal(a).mul(numVal(b)));
            case 'div':
              return N(numVal(a).div(numVal(b)));
            case 'pow':
              if (numVal(b).isInt() && Math.abs(numVal(b).n) <= 12) return N(numVal(a).pow(numVal(b).n));
          }
        } catch {
          /* fall through */
        }
      }
      switch (n.k) {
        case 'add':
          if (isNum(a, 0)) return b;
          if (isNum(b, 0)) return a;
          if (b.k === 'neg') return simplify({ k: 'sub', a, b: b.a });
          if (isNum(b) && numVal(b).isNeg()) return { k: 'sub', a, b: N(numVal(b).neg()) };
          return { k: 'add', a, b };
        case 'sub':
          if (isNum(b, 0)) return a;
          if (isNum(a, 0)) return simplify({ k: 'neg', a: b });
          if (b.k === 'neg') return simplify({ k: 'add', a, b: b.a });
          return { k: 'sub', a, b };
        case 'mul':
          if (isNum(a, 0) || isNum(b, 0)) return N(0);
          if (isNum(a, 1)) return b;
          if (isNum(b, 1)) return a;
          if (isNum(a, -1)) return simplify({ k: 'neg', a: b });
          if (isNum(b, -1)) return simplify({ k: 'neg', a });
          if (isNum(b) && !isNum(a)) return simplify({ k: 'mul', a: b, b: a });
          if (isNum(a) && b.k === 'mul' && isNum(b.a)) return simplify({ k: 'mul', a: N(numVal(a).mul(numVal(b.a))), b: b.b });
          if (a.k === 'neg') return simplify({ k: 'neg', a: { k: 'mul', a: a.a, b } });
          if (b.k === 'neg') return simplify({ k: 'neg', a: { k: 'mul', a, b: b.a } });
          return { k: 'mul', a, b };
        case 'div':
          if (isNum(a, 0)) return N(0);
          if (isNum(b, 1)) return a;
          if (a.k === 'neg') return simplify({ k: 'neg', a: { k: 'div', a: a.a, b } });
          return { k: 'div', a, b };
        case 'pow':
          if (isNum(b, 0)) return N(1);
          if (isNum(b, 1)) return a;
          return { k: 'pow', a, b };
      }
      return n;
    }
  }
}

/** Symbolic derivative with respect to v. */
export function diff(n: Node, v = 'x'): Node {
  const d = (m: Node) => diff(m, v);
  if (!containsVar(n, v)) return N(0);
  switch (n.k) {
    case 'var':
      return N(1);
    case 'neg':
      return simplify({ k: 'neg', a: d(n.a) });
    case 'add':
    case 'sub':
      return simplify({ k: n.k, a: d(n.a), b: d(n.b) });
    case 'mul':
      return simplify({ k: 'add', a: { k: 'mul', a: d(n.a), b: n.b }, b: { k: 'mul', a: n.a, b: d(n.b) } });
    case 'div':
      return simplify({
        k: 'div',
        a: { k: 'sub', a: { k: 'mul', a: d(n.a), b: n.b }, b: { k: 'mul', a: n.a, b: d(n.b) } },
        b: { k: 'pow', a: n.b, b: N(2) },
      });
    case 'pow': {
      if (!containsVar(n.b, v)) {
        // n u^{n-1} u'
        return simplify({
          k: 'mul',
          a: { k: 'mul', a: n.b, b: { k: 'pow', a: n.a, b: simplify({ k: 'sub', a: n.b, b: N(1) }) } },
          b: d(n.a),
        });
      }
      if (!containsVar(n.a, v)) {
        // a^u ln a u'
        const lnA: Node = n.a.k === 'const' && n.a.n === 'e' ? N(1) : { k: 'fn', n: 'ln', a: n.a };
        return simplify({ k: 'mul', a: { k: 'mul', a: n, b: lnA }, b: d(n.b) });
      }
      // u^v = e^{v ln u}
      const inner: Node = { k: 'mul', a: n.b, b: { k: 'fn', n: 'ln', a: n.a } };
      return simplify({ k: 'mul', a: n, b: d(inner) });
    }
    case 'fn': {
      const u = n.a;
      const du = d(u);
      let outer: Node;
      switch (n.n) {
        case 'sin':
          outer = { k: 'fn', n: 'cos', a: u };
          break;
        case 'cos':
          outer = { k: 'neg', a: { k: 'fn', n: 'sin', a: u } };
          break;
        case 'tan':
          outer = { k: 'div', a: N(1), b: { k: 'pow', a: { k: 'fn', n: 'cos', a: u }, b: N(2) } };
          break;
        case 'ln':
          outer = { k: 'div', a: N(1), b: u };
          break;
        case 'log':
          outer = { k: 'div', a: N(1), b: { k: 'mul', a: u, b: { k: 'fn', n: 'ln', a: n.base ?? N(10) } } };
          break;
        case 'sqrt':
          outer = { k: 'div', a: N(1), b: { k: 'mul', a: N(2), b: { k: 'fn', n: 'sqrt', a: u } } };
          break;
        case 'exp':
          outer = n;
          break;
        case 'abs':
          outer = { k: 'div', a: u, b: n };
          break;
      }
      if (isNum(simplify(du), 1)) return simplify(outer);
      return simplify({ k: 'mul', a: outer, b: du });
    }
    default:
      return N(0);
  }
}

/** Pretty LaTeX: uses the power-sum form when the expression is a sum of powers of x. */
export function prettyTex(n: Node, v = 'x'): string {
  const ps = toPowerSum(n, v);
  if (ps) return ps.toTex(v);
  return toTex(simplify(n));
}
