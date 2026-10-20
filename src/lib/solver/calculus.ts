import { Fraction, niceTex } from '../math/fraction';
import { type Node, toTex, evaluate, compile } from '../math/expr';
import { Poly, PowerSum, toPoly, toRational, toPowerSum, polyRoots, polyGcd, rootValue, rootTex, termTex, type Root, type Term } from '../math/poly';
import { diff, prettyTex, containsVar } from '../math/symbolic';
import type { DiagramSpec, Solution, SolutionStep } from '../../types';
import { step, hints, SolveError } from './common';
import { solvePolyZero } from './equations';

// ---------- derivative ----------

interface Derived {
  steps: SolutionStep[];
  /** LaTeX of f'(x). */
  tex: string;
  /** Numerator / denominator of f' when f is rational (for solving f' = 0). */
  rational?: { num: Poly; den: Poly };
  node?: Node;
  rule: string;
}

function termDerivTex(t: Term, v: string): string {
  const d = { c: t.c.mul(t.e), e: t.e.sub(1) };
  if (t.e.isZero()) return '0';
  return termTex(d, v, true);
}

export function derive(f: Node, v = 'x'): Derived {
  const steps: SolutionStep[] = [];
  // chain rule for (poly)^n with a non-monomial base
  if (f.k === 'pow' && !containsVar(f.b, v)) {
    const inner = toPoly(f.a, v);
    const n = evaluate(f.b);
    if (inner && inner.deg >= 1 && inner.c.filter((c) => !c.isZero()).length >= 2 && n !== 0 && n !== 1) {
      const di = inner.derivative();
      const nF = Fraction.fromDecimal(n);
      steps.push(step('זו פונקציה מורכבת: משתמשים בכלל השרשרת', `\\left[g(${v})^n\\right]' = n\\,g(${v})^{n-1}\\cdot g'(${v})`));
      steps.push(step('מזהים את הפונקציה הפנימית', `g(${v}) = ${inner.toTex(v)},\\quad g'(${v}) = ${di.toTex(v)}`));
      const power = nF.sub(1).eq(1) ? '' : `^{${nF.sub(1).toTex()}}`;
      let tex = `${nF.toTex()}\\left(${inner.toTex(v)}\\right)${power}\\cdot\\left(${di.toTex(v)}\\right)`;
      steps.push(step('מציבים', `f'(${v}) = ${tex}`));
      if (di.isConst()) {
        const k = nF.mul(di.c[0]);
        tex = `${k.eq(1) ? '' : k.eq(-1) ? '-' : k.toTex()}\\left(${inner.toTex(v)}\\right)${power}`;
        steps.push(step('מכפילים את המספרים', `f'(${v}) = ${tex}`));
      }
      const full = toPoly(f, v);
      if (full && nF.isInt() && nF.n > 0) {
        steps.push(step('אפשר גם לפתוח סוגריים ולגזור איבר-איבר', `f'(${v}) = ${full.derivative().toTex(v)}`));
        return { steps, tex, rational: { num: full.derivative(), den: Poly.const(1) }, rule: 'chain' };
      }
      const R = toRational(f, v);
      if (R) {
        const num = R.num.derivative().mul(R.den).sub(R.num.mul(R.den.derivative()));
        return { steps, tex, rational: { num, den: R.den.mul(R.den) }, node: diff(f, v), rule: 'chain' };
      }
      return { steps, tex, node: diff(f, v), rule: 'chain' };
    }
  }
  const ps = toPowerSum(f, v);
  if (ps) {
    const P = ps.isPolynomial() ? ps.toPoly() : null;
    const fTex = ps.toTex(v);
    if (fTex !== toTex(f)) steps.push(step('מפשטים ורושמים כסכום של חזקות', `f(${v}) = ${fTex}`, ps.terms.some((t) => t.e.isNeg() || !t.e.isInt()) ? 'כותבים שורשים ושברים כחזקות: $\\sqrt{x} = x^{1/2}$, $\\frac{1}{x^n} = x^{-n}$.' : undefined));
    const per = ps.terms.map((t) => `\\left(${termTex(t, v, true)}\\right)' = ${termDerivTex(t, v)}`);
    steps.push(step('גוזרים כל איבר לפי $(x^n)\' = n\\,x^{n-1}$ (נגזרת של קבוע היא 0)', per.join('\\\\ ')));
    const d = ps.derivative();
    const tex = d.toTex(v);
    steps.push(step('מחברים', `f'(${v}) = ${tex}`));
    const dp = d.toPoly();
    return { steps, tex, rational: dp ? { num: dp, den: Poly.const(1) } : powerSumAsRational(d), node: undefined, rule: P ? 'polynomial' : 'power' };
  }
  const R = toRational(f, v);
  if (R && f.k === 'div') {
    const u = R.num,
      w = R.den;
    const du = u.derivative(),
      dw = w.derivative();
    steps.push(step('זו מנה של שתי פונקציות: משתמשים בכלל הנגזרת של מנה', `\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}`));
    steps.push(step('מזהים', `u = ${u.toTex(v)},\\quad u' = ${du.toTex(v)},\\qquad v = ${w.toTex(v)},\\quad v' = ${dw.toTex(v)}`));
    const num = du.mul(w).sub(u.mul(dw));
    const denTex = `\\left(${w.toTex(v)}\\right)^2`;
    steps.push(
      step(
        'מציבים בנוסחה',
        `f'(${v}) = \\frac{\\left(${du.toTex(v)}\\right)\\left(${w.toTex(v)}\\right) - \\left(${u.toTex(v)}\\right)\\left(${dw.toTex(v)}\\right)}{${denTex}}`,
      ),
    );
    const tex = `\\frac{${num.toTex(v)}}{${denTex}}`;
    steps.push(step('פותחים סוגריים במונה', `f'(${v}) = ${tex}`));
    return { steps, tex, rational: { num, den: w.mul(w) }, rule: 'quotient' };
  }
  if (f.k === 'fn' && f.n === 'sqrt') {
    const inner = toPoly(f.a, v);
    if (inner && inner.deg >= 1) {
      const di = inner.derivative();
      steps.push(step('נגזרת של שורש של פונקציה (כלל השרשרת)', `\\left(\\sqrt{g(${v})}\\right)' = \\frac{g'(${v})}{2\\sqrt{g(${v})}}`));
      steps.push(step('מזהים', `g(${v}) = ${inner.toTex(v)},\\quad g'(${v}) = ${di.toTex(v)}`));
      const tex = `\\frac{${di.toTex(v)}}{2\\sqrt{${inner.toTex(v)}}}`;
      steps.push(step('מציבים', `f'(${v}) = ${tex}`));
      return { steps, tex, node: diff(f, v), rule: 'chain' };
    }
  }
  // general symbolic fallback (products, trig, exp, log)
  const d = diff(f, v);
  const RULES: string[] = [];
  const scan = (n: Node): void => {
    if (n.k === 'mul' && containsVar(n.a, v) && containsVar(n.b, v)) RULES.push("מכפלה: $(uv)' = u'v + uv'$");
    if (n.k === 'div' && containsVar(n.b, v)) RULES.push("מנה: $\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}$");
    if (n.k === 'fn') {
      if (n.n === 'sin') RULES.push("$(\\sin x)' = \\cos x$");
      if (n.n === 'cos') RULES.push("$(\\cos x)' = -\\sin x$");
      if (n.n === 'tan') RULES.push("$(\\tan x)' = \\frac{1}{\\cos^2 x}$");
      if (n.n === 'ln') RULES.push("$(\\ln x)' = \\frac{1}{x}$");
      if (n.n === 'exp') RULES.push("$(e^x)' = e^x$");
      if (n.a.k !== 'var') RULES.push('כלל השרשרת: כופלים בנגזרת הפנימית');
    }
    if (n.k === 'pow' && n.a.k === 'const' && n.a.n === 'e') RULES.push("$(e^x)' = e^x$");
    switch (n.k) {
      case 'neg':
      case 'fn':
        scan(n.a);
        break;
      case 'add':
      case 'sub':
      case 'mul':
      case 'div':
      case 'pow':
        scan(n.a);
        scan(n.b);
        break;
    }
  };
  scan(f);
  steps.push(step('כללי הגזירה שמשתמשים בהם', undefined, [...new Set(RULES)].join(' · ') || 'גזירה לפי הכללים.'));
  const tex = prettyTex(d, v);
  steps.push(step('גוזרים', `f'(${v}) = ${tex}`));
  return { steps, tex, node: d, rule: 'general' };
}

function powerSumAsRational(d: PowerSum): { num: Poly; den: Poly } | undefined {
  // multiply by x^k so all exponents become non-negative integers
  if (!d.terms.every((t) => t.e.isInt())) return undefined;
  const minE = Math.min(0, ...d.terms.map((t) => t.e.n));
  const shifted = new PowerSum(d.terms.map((t) => ({ c: t.c, e: t.e.sub(minE) }))).toPoly();
  if (!shifted) return undefined;
  return { num: shifted, den: Poly.X.pow(-minE) };
}

export function derivativeSolution(f: Node, v = 'x'): Solution {
  const fTex = toTex(f);
  const d = derive(f, v);
  return {
    kind: 'derivative',
    title: 'גזירת פונקציה',
    problemTex: `f(${v}) = ${fTex}`,
    topic: 'derivatives',
    steps: [step('הפונקציה', `f(${v}) = ${fTex}`), ...d.steps],
    answer: `$f'(${v}) = ${d.tex}$`,
    hints: hints(
      'מזהים מאיזה סוג הפונקציה: סכום חזקות, מכפלה, מנה או פונקציה מורכבת.',
      d.rule === 'quotient'
        ? 'כלל המנה: $\\left(\\frac{u}{v}\\right)\' = \\frac{u\'v - uv\'}{v^2}$.'
        : d.rule === 'chain'
          ? 'כלל השרשרת: נגזרת החיצונית כפול נגזרת הפנימית.'
          : '$(x^n)\' = n\\,x^{n-1}$, ונגזרת של קבוע היא 0.',
      d.rule === 'quotient' ? 'כתבו מה הם $u$ ו-$v$, וגזרו כל אחד מהם.' : 'גזרו כל איבר בנפרד.',
    ),
  };
}

// ---------- function investigation (extremum points) ----------

function fracOrApprox(r: Root): string {
  return rootTex(r).replace('\\approx ', '\\approx');
}

function valueAt(f: Node, x: Root, v: string): string {
  if (x.kind === 'rational') {
    const R = toRational(f, v);
    if (R) {
      const den = R.den.evalF(x.v);
      if (!den.isZero()) return R.num.evalF(x.v).div(den).toTex();
    }
  }
  const y = evaluate(f, { [v]: rootValue(x) });
  return niceTex(Math.round(y * 1000) / 1000);
}

export function investigateSolution(f: Node, v = 'x'): Solution {
  const fTex = toTex(f);
  const steps: SolutionStep[] = [step('הפונקציה', `f(${v}) = ${fTex}`)];
  const R = toRational(f, v);
  // 1. domain
  let excluded: Root[] = [];
  if (R && R.den.deg > 0) {
    excluded = polyRoots(R.den);
    steps.push(step('תחום הגדרה: המכנה שונה מאפס', excluded.map((r) => `${v} \\neq ${rootTex(r)}`).join(',\\quad ')));
  } else if (R) steps.push(step('תחום הגדרה', `\\text{כל } ${v}`, 'פולינום מוגדר לכל $x$.'));
  // 2. derivative
  const d = derive(f, v);
  steps.push(...d.steps.map((s) => ({ ...s, title: `נגזרת: ${s.title}` })));
  if (!d.rational) throw new SolveError('חקירה אוטומטית זמינה כרגע לפולינומים ולפונקציות רציונליות.');
  // 3. critical points
  let num = d.rational.num;
  const g = polyGcd(num, d.rational.den);
  if (g.deg > 0 && d.rational.den.deg > 0) num = num.divmod(g).q;
  steps.push(step("נקודות חשודות לקיצון: משווים את הנגזרת לאפס (מספיק שהמונה יתאפס)", `${num.toTex(v)} = 0`));
  const { steps: sub, roots } = solvePolyZero(num, v);
  steps.push(...sub);
  const crit = roots.filter((r) => !excluded.some((e) => Math.abs(rootValue(e) - rootValue(r)) < 1e-9));
  // 4. sign table of f'
  const fp = (x: number) => d.rational!.num.eval(x) / d.rational!.den.eval(x);
  const marks = [...crit.map((r) => ({ x: rootValue(r), r, pole: false })), ...excluded.map((r) => ({ x: rootValue(r), r, pole: true }))].sort((a, b) => a.x - b.x);
  const bounds = [-Infinity, ...marks.map((m) => m.x), Infinity];
  const signs: number[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i],
      hi = bounds[i + 1];
    const mid = lo === -Infinity ? (hi === Infinity ? 0 : hi - 1) : hi === Infinity ? lo + 1 : (lo + hi) / 2;
    signs.push(Math.sign(fp(mid)));
  }
  const header: string[] = [v];
  const sRow: string[] = ["f'(x)"];
  const fRow: string[] = ['f(x)'];
  const extrema: { r: Root; type: 'max' | 'min'; y: string }[] = [];
  signs.forEach((s, i) => {
    const left = i > 0 ? marks[i - 1] : undefined;
    const right = i < marks.length ? marks[i] : undefined;
    header.push(!left ? `x < ${fracOrApprox(right ? right.r : { kind: 'rational', v: Fraction.ZERO })}` : !right ? `x > ${fracOrApprox(left.r)}` : `${fracOrApprox(left.r)} < x < ${fracOrApprox(right.r)}`);
    if (!marks.length) header[header.length - 1] = `\\text{כל } ${v}`;
    sRow.push(s > 0 ? '+' : s < 0 ? '-' : '0');
    fRow.push(s > 0 ? '\\nearrow' : s < 0 ? '\\searrow' : '\\rightarrow');
    if (right) {
      header.push(fracOrApprox(right.r));
      if (right.pole) {
        sRow.push('\\nexists');
        fRow.push('\\nexists');
      } else {
        sRow.push('0');
        const next = signs[i + 1];
        let label = '\\text{—}';
        if (s > 0 && next < 0) {
          label = '\\text{max}';
          extrema.push({ r: right.r, type: 'max', y: valueAt(f, right.r, v) });
        } else if (s < 0 && next > 0) {
          label = '\\text{min}';
          extrema.push({ r: right.r, type: 'min', y: valueAt(f, right.r, v) });
        }
        fRow.push(label);
      }
    }
  });
  steps.push(
    step(
      'טבלת עלייה וירידה',
      `\\begin{array}{c|${'c'.repeat(header.length - 1)}} ${header.join(' & ')} \\\\ \\hline ${sRow.join(' & ')} \\\\ ${fRow.join(' & ')} \\end{array}`,
      'בכל קטע מציבים מספר בנגזרת. נגזרת חיובית – הפונקציה עולה, שלילית – יורדת.',
    ),
  );
  if (extrema.length)
    steps.push(
      step(
        'מחשבים את ערכי הפונקציה בנקודות הקיצון',
        extrema.map((e) => `f(${fracOrApprox(e.r)}) = ${e.y} \\Rightarrow \\left(${fracOrApprox(e.r)},\\ ${e.y}\\right)\\ \\text{${e.type === 'max' ? 'מקסימום' : 'מינימום'}}`).join('\\\\ '),
      ),
    );
  // 5. intervals
  const inc: string[] = [];
  const dec: string[] = [];
  signs.forEach((s, i) => {
    const left = i > 0 ? marks[i - 1] : undefined;
    const right = i < marks.length ? marks[i] : undefined;
    const t = !left && !right ? `\\text{כל } ${v}` : !left ? `x < ${fracOrApprox(right!.r)}` : !right ? `x > ${fracOrApprox(left.r)}` : `${fracOrApprox(left.r)} < x < ${fracOrApprox(right.r)}`;
    if (s > 0) inc.push(t);
    else if (s < 0) dec.push(t);
  });
  // 6. asymptotes
  const notes: string[] = [];
  if (R && R.den.deg > 0) {
    const gg = polyGcd(R.num, R.den);
    const n2 = gg.deg > 0 ? R.num.divmod(gg).q : R.num;
    const d2 = gg.deg > 0 ? R.den.divmod(gg).q : R.den;
    const va = polyRoots(d2).map((r) => `x = ${rootTex(r)}`);
    let ha = '';
    if (n2.deg < d2.deg) ha = 'y = 0';
    else if (n2.deg === d2.deg) ha = `y = ${n2.lead().div(d2.lead()).toTex()}`;
    steps.push(
      step(
        'אסימפטוטות',
        [va.length ? `\\text{אנכיות: } ${va.join(',\\ ')}` : '', ha ? `\\text{אופקית: } ${ha}` : ''].filter(Boolean).join('\\qquad ') || '\\text{אין}',
        'אסימפטוטה אנכית: איפה שהמכנה מתאפס (אחרי צמצום). אופקית: לפי היחס בין מעלות המונה והמכנה.',
      ),
    );
  }
  // 7. intercepts
  const y0ok = !excluded.some((e) => Math.abs(rootValue(e)) < 1e-12);
  if (y0ok) notes.push(`חיתוך עם ציר $y$: $(0,\\ ${valueAt(f, { kind: 'rational', v: Fraction.ZERO }, v)})$.`);
  const extremaText = extrema.length
    ? extrema.map((e) => `${e.type === 'max' ? 'מקסימום' : 'מינימום'} $\\left(${fracOrApprox(e.r)},\\ ${e.y}\\right)$`).join(' , ')
    : 'אין נקודות קיצון.';
  const answer = `${extremaText}\nעולה: ${inc.length ? inc.map((t) => `$${t}$`).join(' , ') : '—'}\nיורדת: ${dec.length ? dec.map((t) => `$${t}$`).join(' , ') : '—'}`;
  return {
    kind: 'investigation',
    title: 'חקירת פונקציה – נקודות קיצון ותחומי עלייה וירידה',
    problemTex: `f(${v}) = ${fTex}`,
    topic: 'derivatives',
    steps,
    answer,
    notes,
    diagram: functionDiagram(f, v, [...crit.map(rootValue), ...excluded.map(rootValue)], extrema.map((e) => rootValue(e.r)), excluded.map(rootValue)),
    hints: hints(
      'חקירה: תחום הגדרה ← נגזרת ← השוואה לאפס ← טבלה ← נקודות קיצון.',
      'נקודת קיצון היא נקודה שבה הנגזרת מתאפסת ומחליפה סימן. מקסימום: מ-+ ל-−. מינימום: מ-− ל-+.',
      `גזרו את הפונקציה: $f'(${v}) = ${d.tex}$, והשוו לאפס.`,
    ),
  };
}

export function functionDiagram(f: Node, v: string, xs: number[], marks: number[], asymptotes: number[] = []): DiagramSpec {
  const fin = xs.filter(Number.isFinite);
  const lo = fin.length ? Math.min(...fin) : -2;
  const hi = fin.length ? Math.max(...fin) : 2;
  const pad = Math.max(2, (hi - lo) * 0.5);
  const x0 = lo - pad,
    x1 = hi + pad;
  const g = compile(f, v);
  const ys: number[] = [];
  for (let i = 0; i <= 80; i++) {
    const y = g(x0 + ((x1 - x0) * i) / 80);
    if (Number.isFinite(y)) ys.push(y);
  }
  marks.forEach((m) => ys.push(g(m)));
  ys.sort((a, b) => a - b);
  // robust range: ignore extreme outliers near asymptotes
  let ylo = ys[Math.floor(ys.length * 0.08)] ?? -3;
  let yhi = ys[Math.ceil(ys.length * 0.92) - 1] ?? 3;
  marks.forEach((m) => {
    const y = g(m);
    if (Number.isFinite(y)) {
      ylo = Math.min(ylo, y);
      yhi = Math.max(yhi, y);
    }
  });
  ylo = Math.min(ylo, 0);
  yhi = Math.max(yhi, 0);
  const span = yhi - ylo || 2;
  const points: Record<string, [number, number]> = {};
  marks.forEach((m, i) => (points[`m${i}`] = [m, g(m)]));
  const src = exprToString(f);
  return {
    id: 'dyn-fn',
    shape: 'graph',
    window: [x0, x1, ylo - span * 0.15, yhi + span * 0.15],
    free: true,
    points,
    elements: [
      { t: 'axes', grid: true },
      ...asymptotes.map((a) => ({ t: 'vline' as const, x: a })),
      { t: 'fn', f: src, c: 'accent' },
      ...(marks.length ? [{ t: 'pts' as const, p: marks.map((_, i) => `m${i}`), c: 'warn' as const, nolabel: true }] : []),
    ],
  };
}

/** Serializes an AST back to parser input. */
export function exprToString(n: Node): string {
  switch (n.k) {
    case 'num':
      return `(${n.v.n}/${n.v.d})`;
    case 'real':
      return `(${n.v})`;
    case 'var':
      return n.n;
    case 'const':
      return n.n;
    case 'neg':
      return `(-${exprToString(n.a)})`;
    case 'add':
      return `(${exprToString(n.a)}+${exprToString(n.b)})`;
    case 'sub':
      return `(${exprToString(n.a)}-${exprToString(n.b)})`;
    case 'mul':
      return `(${exprToString(n.a)}*${exprToString(n.b)})`;
    case 'div':
      return `(${exprToString(n.a)}/${exprToString(n.b)})`;
    case 'pow':
      return `(${exprToString(n.a)}^${exprToString(n.b)})`;
    case 'fn':
      if (n.n === 'log' && n.base) return `(ln(${exprToString(n.a)})/ln(${exprToString(n.base)}))`;
      return `${n.n}(${exprToString(n.a)})`;
  }
}

// ---------- tangent line ----------

export function tangentSolution(f: Node, x0: Fraction, v = 'x'): Solution {
  const fTex = toTex(f);
  const d = derive(f, v);
  const steps: SolutionStep[] = [step('הפונקציה והנקודה', `f(${v}) = ${fTex},\\qquad ${v}_0 = ${x0.toTex()}`)];
  const y0 = valueAt(f, { kind: 'rational', v: x0 }, v);
  steps.push(step('מחשבים את שיעור ה-$y$ של נקודת ההשקה', `f(${x0.toTex()}) = ${y0}`));
  steps.push(...d.steps.map((s) => ({ ...s, title: `נגזרת: ${s.title}` })));
  let m: string;
  let mNum: number;
  if (d.rational && !d.rational.den.evalF(x0).isZero()) {
    const mf = d.rational.num.evalF(x0).div(d.rational.den.evalF(x0));
    m = mf.toTex();
    mNum = mf.toNumber();
  } else {
    mNum = evaluate(d.node ?? diff(f, v), { [v]: x0.toNumber() });
    m = niceTex(Math.round(mNum * 10000) / 10000);
  }
  steps.push(step('שיפוע המשיק = ערך הנגזרת בנקודה', `m = f'(${x0.toTex()}) = ${m}`));
  const y0n = evaluate(f, { [v]: x0.toNumber() });
  const bNum = y0n - mNum * x0.toNumber();
  const bTex = niceTex(Math.round(bNum * 10000) / 10000);
  steps.push(step('משוואת המשיק', `y - ${y0.startsWith('-') ? `(${y0})` : y0} = ${m}\\left(x - ${x0.isNeg() ? `(${x0.toTex()})` : x0.toTex()}\\right) \\Rightarrow y = ${m}x ${bNum < 0 ? '-' : '+'} ${niceTex(Math.abs(Math.round(bNum * 10000) / 10000))}`));
  void bTex;
  return {
    kind: 'tangent',
    title: 'משוואת משיק לגרף',
    problemTex: `f(${v}) = ${fTex},\\ x_0 = ${x0.toTex()}`,
    topic: 'derivatives',
    steps,
    answer: `$y = ${m}x ${bNum < 0 ? '-' : '+'} ${niceTex(Math.abs(Math.round(bNum * 10000) / 10000))}$`,
    diagram: {
      ...functionDiagram(f, v, [x0.toNumber() - 2, x0.toNumber() + 2], [x0.toNumber()]),
      elements: [
        ...functionDiagram(f, v, [x0.toNumber() - 2, x0.toNumber() + 2], [x0.toNumber()]).elements,
        { t: 'fn', f: `${mNum}*x+(${bNum})`, c: 'accent2', dash: true },
      ],
    },
    hints: hints(
      'כדי לכתוב משוואת ישר צריך נקודה ושיפוע.',
      'השיפוע של המשיק שווה לנגזרת בנקודת ההשקה: $m = f\'(x_0)$. משוואת הישר: $y - y_0 = m(x - x_0)$.',
      `חשבו את $f(${x0.toTex()})$, ואז גזרו את הפונקציה.`,
    ),
  };
}

// ---------- integrals ----------

function integrateTerm(t: Term, v: string): string {
  if (t.e.eq(-1)) {
    const c = t.c;
    return `${c.eq(1) ? '' : c.eq(-1) ? '-' : c.toTex()}\\ln|${v}|`;
  }
  return termTex({ c: t.c.div(t.e.add(1)), e: t.e.add(1) }, v, true);
}

export function integralSolution(f: Node, v = 'x', bounds?: [Fraction, Fraction]): Solution {
  const ps = toPowerSum(f, v);
  if (!ps) throw new SolveError('כרגע אפשר לחשב אינטגרלים של סכומי חזקות (פולינומים, שורשים ו-$\\frac{1}{x^n}$).');
  const fTex = ps.toTex(v);
  const steps: SolutionStep[] = [step(bounds ? 'האינטגרל המסוים' : 'האינטגרל', bounds ? `\\int_{${bounds[0].toTex()}}^{${bounds[1].toTex()}} \\left(${fTex}\\right) d${v}` : `\\int \\left(${fTex}\\right) d${v}`)];
  if (fTex !== toTex(f)) steps.push(step('רושמים כסכום של חזקות', `f(${v}) = ${fTex}`));
  const per = ps.terms.map((t) => `\\int ${termTex(t, v, true)}\\,d${v} = ${integrateTerm(t, v)}`);
  steps.push(step('מחשבים פונקציה קדומה לכל איבר: $\\int x^n dx = \\frac{x^{n+1}}{n+1}$', per.join('\\\\ ')));
  const Ftex = ps.terms.map((t, i) => {
    const s = integrateTerm(t, v);
    return i === 0 || s.startsWith('-') ? s : `+ ${s}`;
  }).join(' ');
  const hasLn = ps.terms.some((t) => t.e.eq(-1));
  const F = (x: number) => ps.terms.reduce((s, t) => s + (t.e.eq(-1) ? t.c.toNumber() * Math.log(Math.abs(x)) : (t.c.toNumber() * Math.pow(x, t.e.toNumber() + 1)) / (t.e.toNumber() + 1)), 0);
  if (!bounds) {
    steps.push(step('מוסיפים קבוע אינטגרציה', `\\int f(${v})\\,d${v} = ${Ftex} + C`));
    return {
      kind: 'integral',
      title: 'אינטגרל לא מסוים',
      problemTex: `\\int \\left(${fTex}\\right) d${v}`,
      topic: 'integrals',
      steps,
      answer: `$${Ftex} + C$`,
      hints: hints(
        'מחפשים פונקציה שהנגזרת שלה היא הפונקציה הנתונה.',
        '$\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C$ (עבור $n \\neq -1$). בודקים בגזירה.',
        'כתבו שורשים ושברים כחזקות, ומצאו פונקציה קדומה לכל איבר בנפרד.',
      ),
    };
  }
  const [a, b] = bounds;
  // integrand must be defined on [a, b]
  const bad = ps.terms.some((t) => t.e.isNeg() || (!t.e.isInt() && Math.min(a.toNumber(), b.toNumber()) < 0)) && a.toNumber() <= 0 && b.toNumber() >= 0;
  if (bad) throw new SolveError('הפונקציה אינה מוגדרת בכל הקטע (יש בו $x = 0$), ולכן האינטגרל אינו אינטגרל רגיל.');
  const exact = !hasLn && ps.terms.every((t) => t.e.isInt());
  let value: string;
  let num: number;
  if (exact) {
    const Fx = (x: Fraction) => ps.terms.reduce((s, t) => s.add(t.c.div(t.e.add(1)).mul(x.pow(t.e.add(1).n))), Fraction.ZERO);
    const Fb = Fx(b),
      Fa = Fx(a);
    const val = Fb.sub(Fa);
    value = val.toTex();
    num = val.toNumber();
    steps.push(step('מציבים את הגבולות: $F(b) - F(a)$', `\\left[${Ftex}\\right]_{${a.toTex()}}^{${b.toTex()}} = ${Fb.toTex()} - \\left(${Fa.toTex()}\\right) = ${value}`));
  } else {
    num = F(b.toNumber()) - F(a.toNumber());
    value = niceTex(Math.round(num * 10000) / 10000);
    steps.push(step('מציבים את הגבולות: $F(b) - F(a)$', `\\left[${Ftex}\\right]_{${a.toTex()}}^{${b.toTex()}} \\approx ${value}`));
  }
  const notes: string[] = [];
  const P = ps.toPoly();
  if (P) {
    const inside = polyRoots(P).map(rootValue).filter((r) => r > Math.min(a.toNumber(), b.toNumber()) + 1e-9 && r < Math.max(a.toNumber(), b.toNumber()) - 1e-9);
    if (inside.length) {
      const pts = [a.toNumber(), ...inside, b.toNumber()].sort((p, q) => p - q);
      let area = 0;
      for (let i = 0; i < pts.length - 1; i++) area += Math.abs(F(pts[i + 1]) - F(pts[i]));
      notes.push(
        `שימו לב: הפונקציה מחליפה סימן בתוך הקטע (ב-$x = ${inside.map((r) => niceTex(Math.round(r * 1000) / 1000)).join(', ')}$), ולכן האינטגרל אינו השטח. השטח הכלוא בין הגרף לציר $x$ הוא בערך $${niceTex(Math.round(area * 1000) / 1000)}$ (מחשבים כל קטע בנפרד ולוקחים ערך מוחלט).`,
      );
    }
  }
  const g = compile(f, v);
  const xs = [a.toNumber(), b.toNumber()];
  const diagram = functionDiagram(f, v, xs, []);
  diagram.elements.splice(1, 0, { t: 'area', f: exprToString(f), dom: [Math.min(...xs), Math.max(...xs)], c: 'accent2' });
  void g;
  return {
    kind: 'definite-integral',
    title: 'אינטגרל מסוים',
    problemTex: `\\int_{${a.toTex()}}^{${b.toTex()}} \\left(${fTex}\\right) d${v}`,
    topic: 'integrals',
    steps,
    answer: `$${value}$`,
    notes,
    diagram,
    hints: hints(
      'מוצאים פונקציה קדומה $F$, ואז מציבים את הגבולות.',
      '$\\int_a^b f(x)\\,dx = F(b) - F(a)$.',
      'מצאו פונקציה קדומה לכל איבר בנפרד.',
    ),
  };
}

export { PowerSum };
