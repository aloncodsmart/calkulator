import { Fraction, niceTex } from '../math/fraction';
import { type Node, toTex } from '../math/expr';
import { Poly, toPoly, toRational, polyRoots, rootValue, rootTex, monoTex, polyGcd, type Root } from '../math/poly';
import type { DiagramSpec, Solution, SolutionStep } from '../../types';
import { step, hints, flip, REL_TEX, type Rel, coefLcd } from './common';

const isStrict = (r: Rel) => r === '<' || r === '>';
const wantsPositive = (r: Rel) => r === '>' || r === '\\ge';

export function solveInequality(L: Node, R: Node, rel: Rel, v = 'x'): Solution {
  const original = `${toTex(L)} ${REL_TEX[rel]} ${toTex(R)}`;
  const PL = toPoly(L, v);
  const PR = toPoly(R, v);
  if (PL && PR && PL.sub(PR).deg === 1) return linearInequality(PL, PR, rel, v, original);
  const RL = toRational(L, v);
  const RR = toRational(R, v);
  if (!RL || !RR) throw new Error('כרגע אפשר לפתור אי-שוויונות פולינומיים ואי-שוויונות עם שברים אלגבריים.');
  return signChartInequality(RL.num.mul(RR.den).sub(RR.num.mul(RL.den)), RL.den.mul(RR.den), rel, v, original, !!(PL && PR));
}

function linearInequality(PL: Poly, PR: Poly, rel: Rel, v: string, original: string): Solution {
  const steps: SolutionStep[] = [step('אי-השוויון', original)];
  let pl = PL,
    pr = PR;
  const expanded = `${pl.toTex(v)} ${REL_TEX[rel]} ${pr.toTex(v)}`;
  if (expanded !== original) steps.push(step('פותחים סוגריים ומכנסים', expanded));
  const m = coefLcd(pl, pr);
  if (m !== 1) {
    pl = pl.scale(m);
    pr = pr.scale(m);
    steps.push(step(`כופלים ב-${m} (מספר חיובי – הסימן לא משתנה)`, `${pl.toTex(v)} ${REL_TEX[rel]} ${pr.toTex(v)}`));
  }
  const a = pl.coef(1).sub(pr.coef(1));
  const b = pr.coef(0).sub(pl.coef(0));
  steps.push(step('מעבירים אגפים ומכנסים', `${monoTex(a, 1, v, true)} ${REL_TEX[rel]} ${b.toTex()}`));
  const x = b.div(a);
  const finalRel = a.isNeg() ? flip(rel) : rel;
  steps.push(
    step(
      `מחלקים ב-${a.toTex()}${a.isNeg() ? ' – מספר שלילי, ולכן הופכים את כיוון הסימן!' : ''}`,
      `${v} ${REL_TEX[finalRel]} ${x.toTex()}`,
    ),
  );
  const intervals: Interval[] =
    finalRel === '>' || finalRel === '\\ge'
      ? [{ a: x.toNumber(), b: Infinity, ia: finalRel === '\\ge', ib: false, aTex: x.toTex(), bTex: '\\infty' }]
      : [{ a: -Infinity, b: x.toNumber(), ia: false, ib: finalRel === '\\le', aTex: '-\\infty', bTex: x.toTex() }];
  return {
    kind: 'linear-inequality',
    title: 'אי-שוויון ממעלה ראשונה',
    problemTex: original,
    topic: 'inequalities',
    steps,
    answer: `$${v} ${REL_TEX[finalRel]} ${x.toTex()}$`,
    diagram: numberLineDiagram(intervals, [x.toNumber()]),
    hints: hints(
      'פותרים כמו משוואה, עם הבדל אחד חשוב.',
      'כשכופלים או מחלקים במספר שלילי, הופכים את כיוון אי-השוויון.',
      `העבירו אגפים: $${monoTex(a, 1, v, true)} ${REL_TEX[rel]} ${b.toTex()}$.`,
    ),
  };
}

interface Interval {
  a: number;
  b: number;
  ia: boolean;
  ib: boolean;
  aTex: string;
  bTex: string;
}

function intervalTex(iv: Interval, v: string): string {
  if (iv.a === -Infinity && iv.b === Infinity) return `\\text{כל } ${v}`;
  if (iv.a === -Infinity) return `${v} ${iv.ib ? '\\le' : '<'} ${iv.bTex}`;
  if (iv.b === Infinity) return `${v} ${iv.ia ? '\\ge' : '>'} ${iv.aTex}`;
  if (iv.a === iv.b) return `${v} = ${iv.aTex}`;
  return `${iv.aTex} ${iv.ia ? '\\le' : '<'} ${v} ${iv.ib ? '\\le' : '<'} ${iv.bTex}`;
}

function signChartInequality(N0: Poly, D0: Poly, rel: Rel, v: string, original: string, polynomial: boolean): Solution {
  const steps: SolutionStep[] = [step('אי-השוויון', original)];
  // cancel common factors but keep their roots as excluded points
  const excludedRoots = D0.deg > 0 ? polyRoots(D0) : [];
  const g = polyGcd(N0, D0);
  const N = g.deg > 0 ? N0.divmod(g).q : N0;
  const D = g.deg > 0 ? D0.divmod(g).q : D0;
  const fTex = D.deg > 0 ? `\\frac{${N.toTex(v)}}{${D.toTex(v)}}` : N.toTex(v);
  steps.push(step('מעבירים את כל האיברים לאגף אחד', `${fTex} ${REL_TEX[rel]} 0`));
  const zeros = polyRoots(N);
  const poles = excludedRoots;
  steps.push(step('מוצאים את האפסים של הביטוי', zeros.length ? zeros.map((r) => `${v} = ${rootTex(r)}`).join(',\\quad ') : '\\text{אין אפסים}'));
  if (poles.length) steps.push(step('נקודות שבהן הביטוי לא מוגדר (מכנה אפס)', poles.map((r) => `${v} \\neq ${rootTex(r)}`).join(',\\quad ')));
  const crit: { x: number; tex: string; zero: boolean; pole: boolean }[] = [];
  const add = (r: Root, zero: boolean, pole: boolean) => {
    const x = rootValue(r);
    const prev = crit.find((c) => Math.abs(c.x - x) < 1e-9);
    if (prev) {
      prev.zero ||= zero;
      prev.pole ||= pole;
    } else crit.push({ x, tex: rootTex(r).replace('\\approx ', ''), zero, pole });
  };
  zeros.forEach((r) => add(r, true, false));
  poles.forEach((r) => add(r, false, true));
  crit.sort((a, b) => a.x - b.x);
  const f = (x: number) => N.eval(x) / D.eval(x);
  // sign in each interval
  const bounds = [-Infinity, ...crit.map((c) => c.x), Infinity];
  const signs: number[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i],
      hi = bounds[i + 1];
    const mid = lo === -Infinity ? (hi === Infinity ? 0 : hi - 1) : hi === Infinity ? lo + 1 : (lo + hi) / 2;
    signs.push(Math.sign(f(mid)));
  }
  // sign table as LaTeX array
  const cols = [
    v,
    ...crit.flatMap((c, i) => [i === 0 ? `${v} < ${c.tex}` : `${crit[i - 1].tex} < ${v} < ${c.tex}`, `${v} = ${c.tex}`]),
    crit.length ? `${v} > ${crit[crit.length - 1].tex}` : `\\text{כל } ${v}`,
  ];
  const signRow: string[] = [];
  signs.forEach((s, i) => {
    signRow.push(s > 0 ? '+' : s < 0 ? '-' : '0');
    if (i < crit.length) signRow.push(crit[i].pole ? '\\nexists' : '0');
  });
  steps.push(
    step(
      'טבלת סימנים',
      `\\begin{array}{c|${'c'.repeat(cols.length - 1)}} ${cols.join(' & ')} \\\\ \\hline \\text{סימן} & ${signRow.join(' & ')} \\end{array}`,
      'בוחרים מספר בכל קטע ובודקים את סימן הביטוי.',
    ),
  );
  const want = wantsPositive(rel) ? 1 : -1;
  const intervals: Interval[] = [];
  for (let i = 0; i < signs.length; i++) {
    if (signs[i] !== want) continue;
    const left = i > 0 ? crit[i - 1] : undefined;
    const right = i < crit.length ? crit[i] : undefined;
    intervals.push({
      a: left ? left.x : -Infinity,
      b: right ? right.x : Infinity,
      ia: !!left && left.zero && !left.pole && !isStrict(rel),
      ib: !!right && right.zero && !right.pole && !isStrict(rel),
      aTex: left ? left.tex : '-\\infty',
      bTex: right ? right.tex : '\\infty',
    });
  }
  // isolated zeros for ≤ / ≥ (e.g. (x-1)^2 ≤ 0)
  if (!isStrict(rel))
    for (const c of crit)
      if (c.zero && !c.pole && !intervals.some((iv) => (iv.a === c.x && iv.ia) || (iv.b === c.x && iv.ib)))
        intervals.push({ a: c.x, b: c.x, ia: true, ib: true, aTex: c.tex, bTex: c.tex });
  intervals.sort((a, b) => a.a - b.a);
  // merge touching intervals at included points
  const merged: Interval[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.b - iv.a) < 1e-12 && (last.ib || iv.ia || iv.a === iv.b)) {
      last.b = iv.b;
      last.ib = iv.ib;
      last.bTex = iv.bTex;
    } else merged.push({ ...iv });
  }
  const answer = merged.length ? merged.map((iv) => `$${intervalTex(iv, v)}$`).join(' או ') : 'אין פתרון.';
  steps.push(step(`בוחרים את הקטעים שבהם הביטוי ${want > 0 ? 'חיובי' : 'שלילי'}${isStrict(rel) ? '' : ' (כולל האפסים)'}`, undefined, answer));
  const isQuad = polynomial && N.deg === 2 && D.deg === 0;
  return {
    kind: isQuad ? 'quadratic-inequality' : 'sign-inequality',
    title: isQuad ? 'אי-שוויון ריבועי' : polynomial ? 'אי-שוויון פולינומי' : 'אי-שוויון עם שברים',
    problemTex: original,
    topic: 'inequalities',
    steps,
    answer,
    diagram: polynomial ? graphDiagram(N, D, merged, crit.map((c) => c.x)) : numberLineDiagram(merged, crit.map((c) => c.x)),
    hints: hints(
      isQuad ? 'אי-שוויון ריבועי פותרים בעזרת השורשים ובעזרת צורת הפרבולה.' : 'מעבירים הכול לאגף אחד ובודקים איפה הביטוי חיובי ואיפה שלילי.',
      isQuad
        ? 'מוצאים את השורשים. אם $a > 0$ הפרבולה שלילית בין השורשים וחיובית מחוצה להם.'
        : 'מוצאים את האפסים ואת הנקודות שבהן המכנה מתאפס, ובונים טבלת סימנים. אסור לכפול במכנה שעלול להיות שלילי!',
      `מצאו את האפסים של $${N.toTex(v)}$.`,
    ),
  };
}

function windowFor(points: number[]): [number, number] {
  const finite = points.filter(Number.isFinite);
  const lo = finite.length ? Math.min(...finite) : 0;
  const hi = finite.length ? Math.max(...finite) : 0;
  const pad = Math.max(2, (hi - lo) * 0.4);
  return [lo - pad, hi + pad];
}

function numberLineDiagram(intervals: Interval[], crit: number[]): DiagramSpec {
  const [x0, x1] = windowFor(crit);
  const h = (x1 - x0) * 0.375;
  const points: Record<string, [number, number]> = {};
  const elements: DiagramSpec['elements'] = [{ t: 'axes', noY: true, step: niceStepFor(x1 - x0) }];
  intervals.forEach((iv, i) => {
    const a = Math.max(iv.a, x0),
      b = Math.min(iv.b, x1);
    points[`a${i}`] = [a, 0];
    points[`b${i}`] = [b, 0];
    elements.push({ t: 'seg', p: [`a${i}`, `b${i}`], c: 'accent', w: 5 });
    if (Number.isFinite(iv.a)) elements.push({ t: 'pts', p: [`a${i}`], open: !iv.ia, nolabel: true, c: 'accent' });
    if (Number.isFinite(iv.b) && iv.b !== iv.a) elements.push({ t: 'pts', p: [`b${i}`], open: !iv.ib, nolabel: true, c: 'accent' });
  });
  crit.forEach((c, i) => {
    elements.push({ t: 'text', at: [c, h * 0.3], s: niceTex(c).replace(/\\frac\{(-?\d+)\}\{(\d+)\}/, '$1/$2'), size: 11, c: 'warn' });
    void i;
  });
  return { id: 'dyn-numline', shape: 'number-line', window: [x0, x1, -h, h], points, elements };
}

function niceStepFor(span: number): number {
  return span <= 12 ? 1 : span <= 30 ? 2 : 5;
}

function graphDiagram(N: Poly, D: Poly, intervals: Interval[], crit: number[]): DiagramSpec {
  const [x0, x1] = windowFor(crit);
  const xs = Array.from({ length: 60 }, (_, i) => x0 + ((x1 - x0) * i) / 59);
  const ys = xs.map((x) => N.eval(x) / D.eval(x)).filter((y) => Number.isFinite(y));
  let lo = Math.min(0, ...ys),
    hi = Math.max(0, ...ys);
  const span = hi - lo || 2;
  lo -= span * 0.1;
  hi += span * 0.1;
  const fx = `(${N.c.map((c, i) => `${c.toNumber()}*x^${i}`).join('+')})/(${D.c.map((c, i) => `${c.toNumber()}*x^${i}`).join('+')})`;
  const points: Record<string, [number, number]> = {};
  const elements: DiagramSpec['elements'] = [{ t: 'axes' }];
  intervals.forEach((iv, i) => {
    points[`a${i}`] = [Math.max(iv.a, x0), 0];
    points[`b${i}`] = [Math.min(iv.b, x1), 0];
    elements.push({ t: 'seg', p: [`a${i}`, `b${i}`], c: 'good', w: 5 });
  });
  elements.push({ t: 'fn', f: fx, c: 'accent' });
  crit.forEach((c, i) => {
    points[`c${i}`] = [c, 0];
  });
  if (crit.length) elements.push({ t: 'pts', p: crit.map((_, i) => `c${i}`), nolabel: true, c: 'warn' });
  return { id: 'dyn-ineq', shape: 'graph', window: [x0, x1, lo, hi], free: true, points, elements };
}

export { Fraction };
