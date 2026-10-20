import { Fraction, niceTex } from '../math/fraction';
import { type Node, toTex, evaluate, variables } from '../math/expr';
import { Poly, toPoly, rootValue, rootTex } from '../math/poly';
import type { DiagramSpec, Solution, SolutionStep } from '../../types';
import { step, hints, SolveError } from './common';
import { solvePolyZero } from './equations';

/** Linear form Σ coef[v]·v + c. */
interface Lin {
  coef: Record<string, Fraction>;
  c: Fraction;
}

const ZERO = Fraction.ZERO;

function linAdd(a: Lin, b: Lin, sign = 1): Lin {
  const coef: Record<string, Fraction> = { ...a.coef };
  for (const [k, v] of Object.entries(b.coef)) coef[k] = (coef[k] ?? ZERO).add(sign > 0 ? v : v.neg());
  return { coef, c: sign > 0 ? a.c.add(b.c) : a.c.sub(b.c) };
}
function linScale(a: Lin, k: Fraction): Lin {
  const coef: Record<string, Fraction> = {};
  for (const [v, c] of Object.entries(a.coef)) coef[v] = c.mul(k);
  return { coef, c: a.c.mul(k) };
}
const isConst = (a: Lin) => Object.values(a.coef).every((c) => c.isZero());

export function toLinear(n: Node): Lin | null {
  switch (n.k) {
    case 'num':
      return { coef: {}, c: n.v };
    case 'var':
      return { coef: { [n.n]: Fraction.ONE }, c: ZERO };
    case 'neg': {
      const a = toLinear(n.a);
      return a && linScale(a, new Fraction(-1));
    }
    case 'add':
    case 'sub': {
      const a = toLinear(n.a);
      const b = toLinear(n.b);
      return a && b && linAdd(a, b, n.k === 'add' ? 1 : -1);
    }
    case 'mul': {
      const a = toLinear(n.a);
      const b = toLinear(n.b);
      if (!a || !b) return null;
      if (isConst(a)) return linScale(b, a.c);
      if (isConst(b)) return linScale(a, b.c);
      return null;
    }
    case 'div': {
      const a = toLinear(n.a);
      const b = toLinear(n.b);
      if (!a || !b || !isConst(b) || b.c.isZero()) return null;
      return linScale(a, Fraction.ONE.div(b.c));
    }
    case 'pow': {
      const b = toLinear(n.b);
      if (!b || !isConst(b) || !b.c.eq(1)) return null;
      return toLinear(n.a);
    }
    default:
      return null;
  }
}

function linTex(coefs: [Fraction, string][], c?: Fraction): string {
  const parts: string[] = [];
  for (const [k, v] of coefs) {
    if (k.isZero()) continue;
    const abs = k.abs();
    const body = `${abs.eq(1) ? '' : abs.toTex()}${v}`;
    parts.push(parts.length ? `${k.isNeg() ? '-' : '+'} ${body}` : `${k.isNeg() ? '-' : ''}${body}`);
  }
  if (c && !c.isZero()) parts.push(parts.length ? `${c.isNeg() ? '-' : '+'} ${c.abs().toTex()}` : c.toTex());
  return parts.join(' ') || '0';
}

function substitute(n: Node, name: string, by: Node): Node {
  switch (n.k) {
    case 'var':
      return n.n === name ? by : n;
    case 'neg':
      return { k: 'neg', a: substitute(n.a, name, by) };
    case 'fn':
      return { ...n, a: substitute(n.a, name, by) };
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'pow':
      return { k: n.k, a: substitute(n.a, name, by), b: substitute(n.b, name, by) };
    default:
      return n;
  }
}

function linToNode(l: Lin, vars: string[]): Node {
  let node: Node = { k: 'num', v: l.c };
  for (const v of vars) {
    const k = l.coef[v];
    if (!k || k.isZero()) continue;
    node = { k: 'add', a: node, b: { k: 'mul', a: { k: 'num', v: k }, b: { k: 'var', n: v } } };
  }
  return node;
}

export function solveSystem(eqs: { L: Node; R: Node }[]): Solution {
  if (eqs.length !== 2) throw new SolveError('כרגע אפשר לפתור מערכת של שתי משוואות.');
  const vs = new Set<string>();
  eqs.forEach((e) => {
    variables(e.L, vs);
    variables(e.R, vs);
  });
  const vars = [...vs].sort();
  if (vars.length !== 2) throw new SolveError('מערכת של שתי משוואות צריכה שני נעלמים (למשל x ו-y).');
  const [u, w] = vars;
  const original = `\\begin{cases} ${toTex(eqs[0].L)} = ${toTex(eqs[0].R)} \\\\ ${toTex(eqs[1].L)} = ${toTex(eqs[1].R)} \\end{cases}`;
  const lins = eqs.map((e) => {
    const a = toLinear(e.L);
    const b = toLinear(e.R);
    return a && b ? linAdd(a, b, -1) : null;
  });
  if (lins[0] && lins[1]) return linearSystem(lins as Lin[], u, w, original, eqs);
  return mixedSystem(eqs, lins, u, w, original);
}

function linearSystem(lins: Lin[], u: string, w: string, original: string, eqs: { L: Node; R: Node }[]): Solution {
  const [e1, e2] = lins;
  const a1 = e1.coef[u] ?? ZERO,
    b1 = e1.coef[w] ?? ZERO,
    c1 = e1.c.neg();
  const a2 = e2.coef[u] ?? ZERO,
    b2 = e2.coef[w] ?? ZERO,
    c2 = e2.c.neg();
  const steps: SolutionStep[] = [step('מערכת המשוואות', original)];
  const std = `\\begin{cases} ${linTex([[a1, u], [b1, w]])} = ${c1.toTex()} \\\\ ${linTex([[a2, u], [b2, w]])} = ${c2.toTex()} \\end{cases}`;
  if (std.replace(/\s/g, '') !== original.replace(/\s/g, '')) steps.push(step('מסדרים כל משוואה בצורה $ax + by = c$', std));
  const det = a1.mul(b2).sub(a2.mul(b1));
  if (det.isZero()) {
    // parallel or identical lines
    const dependent = a1.mul(c2).sub(a2.mul(c1)).isZero() && b1.mul(c2).sub(b2.mul(c1)).isZero();
    steps.push(
      step(
        'המקדמים של המשוואות פרופורציוניים',
        undefined,
        dependent
          ? 'שתי המשוואות מתארות את אותו ישר, ולכן יש אינסוף פתרונות.'
          : 'הישרים מקבילים ואינם נפגשים, ולכן למערכת אין פתרון.',
      ),
    );
    return {
      kind: 'system',
      title: 'מערכת משוואות ממעלה ראשונה',
      problemTex: original,
      topic: 'equations',
      steps,
      answer: dependent ? 'אינסוף פתרונות (המשוואות שקולות).' : 'אין פתרון.',
      hints: hints('יש שתי משוואות ושני נעלמים.', 'שיטת ההצבה או שיטת השוואת מקדמים.', 'סדרו כל משוואה בצורה $ax + by = c$ והשוו את היחסים בין המקדמים.'),
    };
  }
  const U = c1.mul(b2).sub(c2.mul(b1)).div(det);
  const W = a1.mul(c2).sub(a2.mul(c1)).div(det);
  // choose method: substitution if some coefficient is ±1
  const unit = [
    { eq: 0, v: w, k: b1 },
    { eq: 0, v: u, k: a1 },
    { eq: 1, v: w, k: b2 },
    { eq: 1, v: u, k: a2 },
  ].find((t) => t.k.abs().eq(1));
  let method: string;
  if (unit) {
    method = 'שיטת ההצבה';
    const [A, B, C] = unit.eq === 0 ? [a1, b1, c1] : [a2, b2, c2];
    const [A2, B2, C2] = unit.eq === 0 ? [a2, b2, c2] : [a1, b1, c1];
    const other = unit.v === w ? u : w;
    const kOther = unit.v === w ? A : B; // coefficient of the other variable in the chosen equation
    const kSelf = unit.v === w ? B : A;
    // v = (C - kOther·other)/kSelf
    const cst = C.div(kSelf);
    const slope = kOther.neg().div(kSelf);
    const exprTex = linTex([[slope, other]], cst);
    steps.push(step(`מבודדים את $${unit.v}$ מהמשוואה ה${unit.eq === 0 ? 'ראשונה' : 'שנייה'}`, `${unit.v} = ${exprTex}`));
    const kv2 = unit.v === w ? B2 : A2;
    const ko2 = unit.v === w ? A2 : B2;
    const subTex = `${linTex([[ko2, other]])} ${kv2.isNeg() ? '-' : '+'} ${kv2.abs().eq(1) ? '' : kv2.abs().toTex()}\\left(${exprTex}\\right) = ${C2.toTex()}`;
    steps.push(step('מציבים במשוואה השנייה', subTex));
    const coefO = ko2.add(kv2.mul(slope));
    const rhs = C2.sub(kv2.mul(cst));
    steps.push(step('פותחים סוגריים ומכנסים', `${linTex([[coefO, other]])} = ${rhs.toTex()} \\Rightarrow ${other} = ${rhs.div(coefO).toTex()}`));
    const otherVal = rhs.div(coefO);
    const selfVal = cst.add(slope.mul(otherVal));
    steps.push(step(`מציבים בחזרה כדי למצוא את $${unit.v}$`, `${unit.v} = ${linTex([[slope, `\\cdot ${otherVal.isNeg() ? `(${otherVal.toTex()})` : otherVal.toTex()}`]], cst).replace(/\\cdot /, '\\cdot ')} = ${selfVal.toTex()}`));
  } else {
    method = 'שיטת השוואת מקדמים';
    const m1 = a2.abs();
    const m2 = a1.abs();
    const sign = a1.isNeg() === a2.isNeg() ? -1 : 1;
    const r1 = [a1.mul(m1), b1.mul(m1), c1.mul(m1)];
    const r2 = [a2.mul(m2), b2.mul(m2), c2.mul(m2)];
    steps.push(
      step(
        `כופלים את המשוואה הראשונה ב-${m1.toTex()} ואת השנייה ב-${m2.toTex()}, כדי שהמקדמים של $${u}$ יהיו שווים בגודלם`,
        `\\begin{cases} ${linTex([[r1[0], u], [r1[1], w]])} = ${r1[2].toTex()} \\\\ ${linTex([[r2[0], u], [r2[1], w]])} = ${r2[2].toTex()} \\end{cases}`,
      ),
    );
    const bw = sign < 0 ? r1[1].sub(r2[1]) : r1[1].add(r2[1]);
    const cw = sign < 0 ? r1[2].sub(r2[2]) : r1[2].add(r2[2]);
    steps.push(step(sign < 0 ? 'מחסירים את המשוואות זו מזו' : 'מחברים את המשוואות', `${linTex([[bw, w]])} = ${cw.toTex()} \\Rightarrow ${w} = ${W.toTex()}`));
    steps.push(step(`מציבים $${w} = ${W.toTex()}$ במשוואה הראשונה`, `${linTex([[a1, u]])} ${b1.mul(W).isNeg() ? '-' : '+'} ${b1.mul(W).abs().toTex()} = ${c1.toTex()} \\Rightarrow ${u} = ${U.toTex()}`));
  }
  const chk = eqs
    .map((e) => {
      const env = { [u]: U.toNumber(), [w]: W.toNumber() };
      return `${niceTex(evaluate(e.L, env))} = ${niceTex(evaluate(e.R, env))} \\ \\checkmark`;
    })
    .join('\\\\ ');
  steps.push(step('בדיקה בשתי המשוואות', chk));
  return {
    kind: 'system',
    title: 'מערכת משוואות ממעלה ראשונה',
    problemTex: original,
    topic: 'equations',
    steps,
    answer: `$${u} = ${U.toTex()},\\quad ${w} = ${W.toTex()}$`,
    diagram: systemDiagram(e1, e2, u, w, U.toNumber(), W.toNumber()),
    notes: [`הפתרון הוא נקודת החיתוך של שני הישרים: $(${U.toTex()}, ${W.toTex()})$.`],
    hints: hints(
      'יש שתי משוואות ושני נעלמים. צריך \"להעלים\" נעלם אחד ולקבל משוואה עם נעלם אחד.',
      `${method}: ${unit ? 'מבודדים נעלם שהמקדם שלו 1 ומציבים במשוואה השנייה.' : 'מכפילים את המשוואות כך שמקדמי אחד הנעלמים יהיו שווים, ואז מחסרים או מחברים.'}`,
      unit ? `בודדו את $${unit.v}$ מהמשוואה ה${unit.eq === 0 ? 'ראשונה' : 'שנייה'}.` : `כפלו את המשוואות כך שהמקדמים של $${u}$ יהיו שווים.`,
    ),
  };
}

function systemDiagram(e1: Lin, e2: Lin, u: string, w: string, x0: number, y0: number): DiagramSpec | undefined {
  if (u !== 'x' || w !== 'y') return undefined;
  const fnOf = (e: Lin): string | null => {
    const a = e.coef.x ?? ZERO,
      b = e.coef.y ?? ZERO;
    if (b.isZero()) return null;
    // y = (-a x - c)/b
    return `(${a.neg().div(b).toNumber()})*x + (${e.c.neg().div(b).toNumber()})`;
  };
  const f1 = fnOf(e1);
  const f2 = fnOf(e2);
  if (!f1 || !f2) return undefined;
  const span = Math.max(4, Math.abs(x0) + 3, Math.abs(y0) + 3);
  return {
    id: 'dyn-system',
    shape: 'graph',
    window: [x0 - span, x0 + span, y0 - span * 0.75, y0 + span * 0.75],
    points: { S: [x0, y0] },
    elements: [
      { t: 'axes', grid: true },
      { t: 'fn', f: f1, c: 'accent' },
      { t: 'fn', f: f2, c: 'accent2' },
      { t: 'pts', p: ['S'], c: 'warn', nolabel: true },
      { t: 'text', at: [x0, y0 + span * 0.18], s: `(${niceTex(x0)}, ${niceTex(y0)})`, c: 'warn', bold: true },
    ],
  };
}

function mixedSystem(eqs: { L: Node; R: Node }[], lins: (Lin | null)[], u: string, w: string, original: string): Solution {
  const li = lins.findIndex(Boolean);
  if (li < 0) throw new SolveError('שתי המשוואות אינן ממעלה ראשונה. כרגע אפשר לפתור מערכת שבה לפחות משוואה אחת קווית.');
  const lin = lins[li]!;
  const other = eqs[1 - li];
  // isolate a variable from the linear equation (prefer coefficient ±1, then y)
  const cands = [w, u].filter((v) => !(lin.coef[v] ?? ZERO).isZero());
  const iso = cands.find((v) => lin.coef[v].abs().eq(1)) ?? cands[0];
  const rest = iso === w ? u : w;
  const k = lin.coef[iso];
  const expr: Lin = { coef: { [rest]: (lin.coef[rest] ?? ZERO).neg().div(k) }, c: lin.c.neg().div(k) };
  const exprNode = linToNode(expr, [rest]);
  const exprTex = linTex([[expr.coef[rest], rest]], expr.c);
  const steps: SolutionStep[] = [step('מערכת המשוואות', original)];
  steps.push(step(`מבודדים את $${iso}$ מהמשוואה הקווית`, `${iso} = ${exprTex}`));
  const subL = substitute(other.L, iso, exprNode);
  const subR = substitute(other.R, iso, exprNode);
  const PL = toPoly(subL, rest);
  const PR = toPoly(subR, rest);
  if (!PL || !PR) throw new SolveError('לא הצלחנו להציב ולקבל משוואה פולינומית.');
  steps.push(step('מציבים במשוואה השנייה', `${toTex(other.L).replace(new RegExp(iso, 'g'), `(${exprTex})`)} = ${toTex(other.R).replace(new RegExp(iso, 'g'), `(${exprTex})`)}`));
  let D = PL.sub(PR);
  if (D.lead().isNeg()) D = D.neg();
  steps.push(step('פותחים סוגריים ומעבירים לאגף אחד', `${D.toTex(rest)} = 0`));
  const { steps: sub, roots } = solvePolyZero(D, rest);
  steps.push(...sub);
  const pairs = roots.map((r) => {
    const val = rootValue(r);
    const isoVal = expr.c.toNumber() + expr.coef[rest].toNumber() * val;
    return { r, val, isoVal };
  });
  steps.push(
    step(
      `מציבים כל פתרון כדי למצוא את $${iso}$`,
      pairs.map((p) => `${rest} = ${rootTex(p.r)} \\Rightarrow ${iso} = ${niceTex(p.isoVal)}`).join('\\\\ ') || '\\text{אין פתרון}',
    ),
  );
  const answer = pairs.length
    ? pairs.map((p) => `$(${u}, ${w}) = (${u === rest ? rootTex(p.r) : niceTex(p.isoVal)}, ${w === rest ? rootTex(p.r) : niceTex(p.isoVal)})$`).join(' , ')
    : 'אין פתרון.';
  return {
    kind: 'system-mixed',
    title: 'מערכת משוואות (קווית וריבועית)',
    problemTex: original,
    topic: 'equations',
    steps,
    answer,
    hints: hints(
      'משוואה אחת קווית והשנייה לא. משתמשים בשיטת ההצבה.',
      'מבודדים נעלם מהמשוואה הקווית ומציבים במשוואה השנייה. מתקבלת משוואה בנעלם אחד.',
      `בודדו את $${iso}$: $${iso} = ${exprTex}$.`,
    ),
  };
}

export { Poly };
