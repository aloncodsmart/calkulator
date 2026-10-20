import { Fraction, niceTex, sqrtFraction } from '../math/fraction';
import { type Node, toTex, evaluate, compile } from '../math/expr';
import {
  Poly,
  toPoly,
  toRational,
  denominators,
  polyRoots,
  quadraticRoots,
  quadraticPmTex,
  rationalRoots,
  rootValue,
  rootTex,
  numericRoots,
  polyGcd,
  factoredTex,
  monoTex,
  type Root,
} from '../math/poly';
import { containsVar } from '../math/symbolic';
import type { Solution, SolutionStep } from '../../types';
import { step, hints, rootsAnswer, coefLcd, coefGcd } from './common';

const TOPIC = 'equations';

/** Normalizes a polynomial equation D = 0: integer coefficients, no common factor, positive leading coefficient. */
function normalize(D: Poly): { P: Poly; note?: string } {
  let P = D;
  const notes: string[] = [];
  const m = coefLcd(P);
  if (m !== 1) {
    P = P.scale(m);
    notes.push(`כופלים ב-${m} כדי להיפטר מהשברים`);
  }
  if (P.lead().isNeg()) {
    P = P.neg();
    notes.push('כופלים ב-(−1) כדי שהמקדם המוביל יהיה חיובי');
  }
  const g = coefGcd(P);
  if (g > 1) {
    P = P.scale(new Fraction(1, g));
    notes.push(`מחלקים ב-${g}`);
  }
  return { P, note: notes.length ? notes.join(', ') : undefined };
}

/** Steps for solving P(x) = 0 (P already in standard form). */
export function solvePolyZero(P: Poly, v = 'x'): { steps: SolutionStep[]; roots: Root[]; method: string } {
  const steps: SolutionStep[] = [];
  const zero = `${P.toTex(v)} = 0`;
  if (P.deg < 1) return { steps, roots: [], method: 'none' };
  if (P.deg === 1) {
    const r = P.c[0].neg().div(P.c[1]);
    steps.push(step('מבודדים את הנעלם', `${monoTex(P.c[1], 1, v, true)} = ${P.c[0].neg().toTex()} \\ \\Rightarrow\\ ${v} = ${r.toTex()}`));
    return { steps, roots: [{ kind: 'rational', v: r }], method: 'linear' };
  }
  if (P.deg === 2) {
    const [c, b, a] = P.c;
    if (c.isZero()) {
      const r = b.neg().div(a);
      steps.push(
        step(
          'מוציאים גורם משותף',
          `${v}\\left(${new Poly([b, a]).toTex(v)}\\right) = 0`,
          'מכפלה שווה לאפס כאשר לפחות אחד הגורמים שווה לאפס.',
        ),
      );
      steps.push(step('משווים כל גורם לאפס', `${v} = 0 \\quad \\text{או} \\quad ${new Poly([b, a]).toTex(v)} = 0 \\Rightarrow ${v} = ${r.toTex()}`));
      const roots: Root[] = [{ kind: 'rational', v: Fraction.ZERO }, { kind: 'rational', v: r }];
      roots.sort((x, y) => rootValue(x) - rootValue(y));
      return { steps, roots, method: 'factor' };
    }
    if (b.isZero()) {
      const rhs = c.neg().div(a);
      steps.push(step('מבודדים את הריבוע', `${v}^2 = ${rhs.toTex()}`));
      if (rhs.isNeg()) {
        steps.push(step('ריבוע של מספר ממשי אינו שלילי', undefined, `אין מספר ממשי שהריבוע שלו $${rhs.toTex()}$, ולכן אין פתרון.`));
        return { steps, roots: [], method: 'square' };
      }
      const s = sqrtFraction(rhs);
      const pos: Root = s.q.isZero() ? { kind: 'rational', v: s.p } : { kind: 'surd', v: s };
      const neg: Root = s.q.isZero() ? { kind: 'rational', v: s.p.neg() } : { kind: 'surd', v: { p: Fraction.ZERO, q: s.q.neg(), r: s.r } };
      steps.push(step('מוציאים שורש – לא שוכחים את הפתרון השלילי', `${v} = \\pm\\sqrt{${rhs.toTex()}} = \\pm ${rootTex(pos)}`));
      return { steps, roots: rhs.isZero() ? [pos] : [neg, pos], method: 'square' };
    }
    steps.push(step('מזהים את המקדמים', `a = ${a.toTex()},\\quad b = ${b.toTex()},\\quad c = ${c.toTex()}`));
    const { disc, roots } = quadraticRoots(a, b, c);
    const wrap = (f: Fraction) => (f.isNeg() ? `(${f.toTex()})` : f.toTex());
    steps.push(
      step(
        'מחשבים את הדיסקרימיננטה',
        `\\Delta = b^2 - 4ac = ${wrap(b)}^2 - 4\\cdot ${wrap(a)} \\cdot ${wrap(c)} = ${disc.toTex()}`,
        disc.isNeg() ? 'הדיסקרימיננטה שלילית, ולכן אין למשוואה פתרון ממשי.' : disc.isZero() ? 'הדיסקרימיננטה אפס, ולכן יש פתרון אחד.' : 'הדיסקרימיננטה חיובית, ולכן יש שני פתרונות.',
      ),
    );
    if (disc.isNeg()) return { steps, roots: [], method: 'formula' };
    const pm = quadraticPmTex(a, b, c);
    const formula = `${v}_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} = \\frac{${b.neg().toTex()} \\pm \\sqrt{${disc.toTex()}}}{${a.mul(2).toTex()}}`;
    if (pm) steps.push(step('מציבים בנוסחת השורשים', `${formula} = ${pm}`));
    else
      steps.push(
        step(
          'מציבים בנוסחת השורשים',
          roots.length === 1 ? `${formula} = ${rootTex(roots[0])}` : `${formula} \\Rightarrow ${v}_1 = ${rootTex(roots[0])},\\ ${v}_2 = ${rootTex(roots[1])}`,
        ),
      );
    return { steps, roots, method: 'formula' };
  }
  // degree ≥ 3
  let k = 0;
  while (P.c[k].isZero()) k++;
  if (k > 0) {
    const Q = new Poly(P.c.slice(k));
    steps.push(
      step('מוציאים גורם משותף', `${k === 1 ? v : `${v}^{${k}}`}\\left(${Q.toTex(v)}\\right) = 0`, 'מכפלה שווה לאפס כאשר לפחות אחד הגורמים אפס.'),
    );
    steps.push(step('גורם ראשון', `${k === 1 ? v : `${v}^{${k}}`} = 0 \\Rightarrow ${v} = 0`));
    const sub = solvePolyZero(Q, v);
    steps.push(step('גורם שני', `${Q.toTex(v)} = 0`));
    steps.push(...sub.steps);
    const roots = dedupe([{ kind: 'rational', v: Fraction.ZERO }, ...sub.roots]);
    return { steps, roots, method: 'factor' };
  }
  const evenOnly = P.deg === 4 && P.c.every((c, i) => i % 2 === 0 || c.isZero());
  if (evenOnly) {
    const T = new Poly([P.c[0], P.c[2], P.c[4]]);
    steps.push(step('זו משוואה דו-ריבועית: מציבים $t = x^2$', `${T.toTex('t')} = 0`));
    const sub = solvePolyZero(T, 't');
    steps.push(...sub.steps);
    const roots: Root[] = [];
    const parts: string[] = [];
    for (const tr of sub.roots) {
      const tv = rootValue(tr);
      if (tv < -1e-12) {
        parts.push(`${v}^2 = ${rootTex(tr)} \\text{ – אין פתרון}`);
        continue;
      }
      if (tr.kind === 'rational') {
        const s = sqrtFraction(tr.v);
        if (s.q.isZero()) {
          roots.push({ kind: 'rational', v: s.p }, { kind: 'rational', v: s.p.neg() });
          parts.push(`${v}^2 = ${tr.v.toTex()} \\Rightarrow ${v} = \\pm ${s.p.toTex()}`);
        } else {
          roots.push({ kind: 'surd', v: s }, { kind: 'surd', v: { p: Fraction.ZERO, q: s.q.neg(), r: s.r } });
          parts.push(`${v}^2 = ${tr.v.toTex()} \\Rightarrow ${v} = \\pm ${rootTex({ kind: 'surd', v: s })}`);
        }
      } else {
        roots.push({ kind: 'approx', v: Math.sqrt(tv) }, { kind: 'approx', v: -Math.sqrt(tv) });
        parts.push(`${v}^2 = ${rootTex(tr)} \\Rightarrow ${v} \\approx \\pm ${niceTex(Math.round(Math.sqrt(tv) * 1000) / 1000)}`);
      }
    }
    steps.push(step('חוזרים מ-$t$ ל-$x$', parts.join('\\\\ ')));
    return { steps, roots: dedupe(roots), method: 'biquadratic' };
  }
  const rr = rationalRoots(P);
  if (rr.length) {
    const r = rr[0];
    const { q } = P.divRoot(r);
    steps.push(step('מנחשים שורש (בין המחלקים של האיבר החופשי)', `P(${r.toTex()}) = 0`, `לכן $${new Poly([r.neg(), 1]).toTex(v)}$ הוא גורם של הפולינום.`));
    steps.push(step('מחלקים את הפולינום בגורם (חילוק פולינומים)', `\\left(${new Poly([r.neg(), 1]).toTex(v)}\\right)\\left(${q.toTex(v)}\\right) = 0`));
    const sub = solvePolyZero(q, v);
    steps.push(...sub.steps);
    return { steps, roots: dedupe([{ kind: 'rational', v: r }, ...sub.roots]), method: 'rational-root' };
  }
  const roots = polyRoots(P);
  steps.push(step('פתרון מקורב', zero, 'לא מצאנו פירוק פשוט. הפתרונות חושבו נומרית (בקירוב).'));
  return { steps, roots, method: 'numeric' };
}

function dedupe(roots: Root[]): Root[] {
  const out: Root[] = [];
  for (const r of roots.sort((a, b) => rootValue(a) - rootValue(b))) if (!out.some((o) => Math.abs(rootValue(o) - rootValue(r)) < 1e-9)) out.push(r);
  return out;
}

function checkStep(L: Node, R: Node, roots: Root[], v: string): SolutionStep | null {
  const exact = roots.filter((r) => r.kind === 'rational').slice(0, 3);
  if (!exact.length) return null;
  const PL = toPoly(L, v);
  const PR = toPoly(R, v);
  const lines = exact.map((r) => {
    const x = (r as { v: Fraction }).v;
    if (PL && PR) return `${v} = ${x.toTex()}:\\quad ${PL.evalF(x).toTex()} = ${PR.evalF(x).toTex()} \\ \\checkmark`;
    const a = evaluate(L, { [v]: x.toNumber() });
    const b = evaluate(R, { [v]: x.toNumber() });
    return `${v} = ${x.toTex()}:\\quad ${niceTex(a)} = ${niceTex(b)} \\ ${Math.abs(a - b) < 1e-9 ? '\\checkmark' : '\\times'}`;
  });
  return step('בדיקה: מציבים במשוואה המקורית', lines.join('\\\\ '), 'כדאי תמיד לבדוק – כך תופסים טעויות חישוב.');
}

export function solveEquation(L: Node, R: Node, v = 'x'): Solution {
  const original = `${toTex(L)} = ${toTex(R)}`;
  const PL = toPoly(L, v);
  const PR = toPoly(R, v);
  if (PL && PR) return polynomialEquation(L, R, PL, PR, v, original);
  const RL = toRational(L, v);
  const RR = toRational(R, v);
  if (RL && RR) return rationalEquation(L, R, v, original);
  const special = sqrtEquation(L, R, v, original) ?? exponentialEquation(L, R, v, original) ?? logEquation(L, R, v, original);
  if (special) return special;
  return numericEquation(L, R, v, original);
}

function polynomialEquation(L: Node, R: Node, PL: Poly, PR: Poly, v: string, original: string): Solution {
  const D = PL.sub(PR);
  const steps: SolutionStep[] = [step('המשוואה', original)];
  if (D.deg < 1) {
    const identity = D.isZero();
    steps.push(step('מעבירים את כל האיברים לאגף אחד', `${D.toTex(v)} = 0`, identity ? 'השוויון נכון תמיד.' : 'השוויון אף פעם לא נכון.'));
    return {
      kind: 'equation-degenerate',
      title: 'משוואה',
      problemTex: original,
      topic: TOPIC,
      steps,
      answer: identity ? 'כל מספר ממשי הוא פתרון (המשוואה היא זהות).' : 'אין פתרון.',
      hints: hints('נסו לפשט את שני האגפים ולראות מה נשאר.', 'פתיחת סוגריים וכינוס איברים דומים.', 'פשטו כל אגף והעבירו הכול לאגף אחד.'),
    };
  }
  if (D.deg === 1) return linearEquation(L, R, PL, PR, v, original);
  const expanded = `${PL.toTex(v)} = ${PR.toTex(v)}`;
  if (expanded !== original && !(PR.isZero() && PL.toTex(v) === toTex(L))) steps.push(step('פותחים סוגריים ומפשטים', expanded));
  const standard = `${D.toTex(v)} = 0`;
  if (!PR.isZero()) steps.push(step('מעבירים את כל האיברים לאגף אחד', standard));
  const { P, note } = normalize(D);
  if (note) steps.push(step(note, `${P.toTex(v)} = 0`));
  const { steps: sub, roots, method } = solvePolyZero(P, v);
  steps.push(...sub);
  if (P.deg === 2 && roots.length === 2 && roots.every((r) => r.kind === 'rational')) {
    const ft = factoredTex(P, v);
    if (ft && method === 'formula') steps.push(step('אפשר גם לפרק לגורמים', `${ft} = 0`));
  }
  const chk = checkStep(L, R, roots, v);
  if (chk) steps.push(chk);
  const isQuad = P.deg === 2;
  const firstMove = !PR.isZero() || expanded !== original ? `העבירו את כל האיברים לאגף אחד: $${standard}$.` : '';
  const [c, b, a] = [P.coef(0), P.coef(1), P.coef(2)];
  return {
    kind: isQuad ? 'quadratic' : 'polynomial',
    title: isQuad ? 'משוואה ריבועית' : `משוואה ממעלה ${P.deg}`,
    problemTex: original,
    topic: TOPIC,
    steps,
    answer: rootsAnswer(roots, v),
    hints: isQuad
      ? hints(
          'זו משוואה ריבועית (יש $x^2$). מביאים אותה לצורה $ax^2 + bx + c = 0$.',
          c.isZero()
            ? 'אין איבר חופשי, ולכן אפשר להוציא גורם משותף $x$.'
            : b.isZero()
              ? 'אין איבר עם $x$, ולכן אפשר לבודד את $x^2$ ולהוציא שורש (עם ±).'
              : 'נוסחת השורשים: $x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$, או פירוק לגורמים.',
          firstMove || `זהו את המקדמים: $a = ${a.toTex()},\\ b = ${b.toTex()},\\ c = ${c.toTex()}$, וחשבו את $b^2 - 4ac$.`,
        )
      : hints(
          `זו משוואה ממעלה ${P.deg}. מנסים לפרק אותה לגורמים.`,
          method === 'biquadratic'
            ? 'יש רק חזקות זוגיות: הציבו $t = x^2$ וקבלו משוואה ריבועית.'
            : 'הוצאת גורם משותף, או ניחוש שורש מבין המחלקים של האיבר החופשי וחילוק פולינומים.',
          firstMove || (method === 'factor' ? 'הוציאו גורם משותף מכל האיברים.' : 'נסו להציב $x = \\pm1, \\pm2$ ולמצוא שורש.'),
        ),
  };
}

function linearEquation(L: Node, R: Node, PL: Poly, PR: Poly, v: string, original: string): Solution {
  const steps: SolutionStep[] = [step('המשוואה', original)];
  let pl = PL;
  let pr = PR;
  const expanded = `${pl.toTex(v)} = ${pr.toTex(v)}`;
  const hasFractions = [...pl.c, ...pr.c].some((c) => !c.isInt());
  let m = 1;
  if (hasFractions) {
    m = coefLcd(pl, pr);
    if (expanded !== original) steps.push(step('מפשטים כל אגף', expanded));
    pl = pl.scale(m);
    pr = pr.scale(m);
    steps.push(step(`כופלים את שני האגפים ב-${m} (מכנה משותף) כדי להיפטר מהשברים`, `${pl.toTex(v)} = ${pr.toTex(v)}`));
  } else if (expanded !== original) {
    steps.push(step('פותחים סוגריים ומכנסים איברים דומים', expanded));
  }
  const a = pl.coef(1).sub(pr.coef(1));
  const b = pr.coef(0).sub(pl.coef(0));
  const needsMove = !pr.coef(1).isZero() || !pl.coef(0).isZero();
  if (needsMove) {
    const lt = [pl.coef(1), pr.coef(1).neg()].filter((c) => !c.isZero()).map((c, i) => monoTex(c, 1, v, i === 0));
    const rt = [pr.coef(0), pl.coef(0).neg()].filter((c) => !c.isZero()).map((c, i) => monoTex(c, 0, v, i === 0));
    steps.push(
      step(
        'מעבירים אגפים: איברים עם הנעלם לשמאל, מספרים לימין',
        `${lt.join(' ') || '0'} = ${rt.join(' ') || '0'}`,
        'איבר שעובר לאגף השני מחליף את הסימן שלו.',
      ),
    );
    steps.push(step('מכנסים איברים דומים', `${monoTex(a, 1, v, true)} = ${b.toTex()}`));
  }
  const x = b.div(a);
  if (!a.eq(1)) steps.push(step(`מחלקים את שני האגפים ב-${a.toTex()}`, `${v} = \\frac{${b.toTex()}}{${a.toTex()}} = ${x.toTex()}`));
  const roots: Root[] = [{ kind: 'rational', v: x }];
  const chk = checkStep(L, R, roots, v);
  if (chk) steps.push(chk);
  const next = hasFractions
    ? `כפלו את שני האגפים ב-${m} כדי להיפטר מהשברים.`
    : expanded !== original
      ? `פתחו סוגריים בכל אגף: $${expanded}$.`
      : `העבירו את האיברים עם $${v}$ לשמאל ואת המספרים לימין: $${monoTex(a, 1, v, true)} = ${b.toTex()}$.`;
  return {
    kind: 'linear',
    title: 'משוואה ממעלה ראשונה',
    problemTex: original,
    topic: TOPIC,
    steps,
    answer: `$${v} = ${x.toTex()}$`,
    hints: hints(
      `זו משוואה ממעלה ראשונה. המטרה: להשאיר את $${v}$ לבד בצד אחד.`,
      'פותחים סוגריים, מעבירים אגפים (איבר שעובר אגף מחליף סימן), ובסוף מחלקים במקדם של הנעלם.',
      next,
    ),
  };
}

function rationalEquation(L: Node, R: Node, v: string, original: string): Solution {
  const steps: SolutionStep[] = [step('המשוואה', original)];
  const dens = [...denominators(L, v), ...denominators(R, v)];
  const excluded: Root[] = [];
  for (const d of dens) for (const r of polyRoots(d)) if (!excluded.some((e) => Math.abs(rootValue(e) - rootValue(r)) < 1e-9)) excluded.push(r);
  excluded.sort((a, b) => rootValue(a) - rootValue(b));
  if (excluded.length)
    steps.push(
      step('תחום הצבה: מכנה אינו יכול להיות אפס', excluded.map((r) => `${v} \\neq ${rootTex(r)}`).join(',\\quad ')),
    );
  const RL = toRational(L, v)!;
  const RR = toRational(R, v)!;
  let N = RL.num.mul(RR.den).sub(RR.num.mul(RL.den));
  const den = RL.den.mul(RR.den);
  const g = polyGcd(N, den);
  if (g.deg > 0) N = N.divmod(g).q;
  const { P, note } = normalize(N);
  steps.push(
    step(
      'כופלים את שני האגפים במכנה המשותף ומעבירים לאגף אחד',
      `${(note ? P : N).toTex(v)} = 0`,
      'אחרי הכפל במכנה המשותף מקבלים משוואה בלי שברים.',
    ),
  );
  if (P.deg < 1) {
    const identity = P.isZero();
    return {
      kind: 'rational',
      title: 'משוואה עם שברים אלגבריים',
      problemTex: original,
      topic: TOPIC,
      steps,
      answer: identity ? `כל $${v}$ בתחום ההצבה הוא פתרון.` : 'אין פתרון.',
      hints: hints('יש נעלם במכנה. קובעים תחום הצבה ומתפטרים מהמכנים.', 'כפל במכנה משותף.', 'מצאו מתי כל מכנה מתאפס.'),
    };
  }
  const { steps: sub, roots } = solvePolyZero(P, v);
  steps.push(...sub);
  const valid = roots.filter((r) => !excluded.some((e) => Math.abs(rootValue(e) - rootValue(r)) < 1e-9));
  const rejected = roots.filter((r) => !valid.includes(r));
  if (excluded.length)
    steps.push(
      step(
        'בודקים מול תחום ההצבה',
        undefined,
        rejected.length
          ? `הפתרון $${rejected.map((r) => `${v} = ${rootTex(r)}`).join(', ')}$ נפסל, כי הוא מאפס מכנה.`
          : 'כל הפתרונות בתחום ההצבה.',
      ),
    );
  const chk = checkStep(L, R, valid, v);
  if (chk) steps.push(chk);
  return {
    kind: 'rational',
    title: 'משוואה עם שברים אלגבריים',
    problemTex: original,
    topic: TOPIC,
    steps,
    answer: rootsAnswer(valid, v),
    hints: hints(
      'יש נעלם במכנה. לפני הכול קובעים תחום הצבה, ואז מתפטרים מהמכנים.',
      'כופלים את שני האגפים במכנה המשותף. בסוף בודקים שהפתרונות לא מאפסים מכנה.',
      excluded.length ? `קבעו את תחום ההצבה: $${excluded.map((r) => `${v} \\neq ${rootTex(r)}`).join(',\\ ')}$.` : 'כפלו במכנה המשותף.',
    ),
  };
}

// ---------- equations with roots, exponents and logarithms ----------

function replaceNode(n: Node, target: Node, by: Node): Node {
  if (n === target) return by;
  switch (n.k) {
    case 'neg':
      return { k: 'neg', a: replaceNode(n.a, target, by) };
    case 'fn':
      return { ...n, a: replaceNode(n.a, target, by) };
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'pow':
      return { k: n.k, a: replaceNode(n.a, target, by), b: replaceNode(n.b, target, by) };
    default:
      return n;
  }
}

function findSqrt(n: Node): Node | null {
  switch (n.k) {
    case 'fn':
      return n.n === 'sqrt' ? n : findSqrt(n.a);
    case 'pow':
      if (n.b.k === 'num' && n.b.v.eq(new Fraction(1, 2))) return n;
      return findSqrt(n.a) ?? findSqrt(n.b);
    case 'neg':
      return findSqrt(n.a);
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
      return findSqrt(n.a) ?? findSqrt(n.b);
    default:
      return null;
  }
}

function sqrtEquation(L0: Node, R0: Node, v: string, original: string): Solution | null {
  let L = L0;
  let R = R0;
  let S = findSqrt(L);
  if (!S) {
    S = findSqrt(R);
    if (!S) return null;
    [L, R] = [R, L];
  }
  if (findSqrt(R)) return null;
  const inner = S.k === 'fn' ? S.a : (S as { a: Node }).a;
  const P = toPoly(inner, v);
  const PR = toPoly(R, v);
  if (!P || !PR) return null;
  // L = a·s + b(x)
  const sVar: Node = { k: 'var', n: '§' };
  const Ls = replaceNode(L, S, sVar);
  const b = toPoly(replaceNode(Ls, sVar, { k: 'num', v: Fraction.ZERO }), v);
  const b1 = toPoly(replaceNode(Ls, sVar, { k: 'num', v: Fraction.ONE }), v);
  if (!b || !b1) return null;
  const aPoly = b1.sub(b);
  if (!aPoly.isConst() || aPoly.isZero()) return null;
  const a = aPoly.c[0];
  const Q = PR.sub(b).scale(Fraction.ONE.div(a));
  const steps: SolutionStep[] = [step('המשוואה', original)];
  steps.push(step('תנאי: הביטוי שבתוך השורש אינו שלילי', `${P.toTex(v)} \\ge 0`));
  const sqrtTex = `\\sqrt{${P.toTex(v)}}`;
  if (!b.isZero() || !a.eq(1)) steps.push(step('מבודדים את השורש באגף אחד', `${sqrtTex} = ${Q.toTex(v)}`));
  steps.push(step('תנאי נוסף: שורש אינו שלילי, ולכן גם האגף השני', `${Q.toTex(v)} \\ge 0`));
  const Q2 = Q.mul(Q);
  steps.push(step('מעלים את שני האגפים בריבוע', `${P.toTex(v)} = ${Q2.toTex(v)}`, 'העלאה בריבוע עלולה להוסיף פתרונות זרים, ולכן נבדוק בסוף.'));
  const D = P.sub(Q2);
  const { P: Pn } = normalize(D);
  steps.push(step('מעבירים לאגף אחד', `${Pn.toTex(v)} = 0`));
  const { steps: sub, roots } = solvePolyZero(Pn, v);
  steps.push(...sub);
  const f = compile({ k: 'sub', a: L0, b: R0 }, v);
  const good = roots.filter((r) => {
    const x = rootValue(r);
    return Math.abs(f(x)) < 1e-7 && Q.eval(x) >= -1e-9 && P.eval(x) >= -1e-9;
  });
  const bad = roots.filter((r) => !good.includes(r));
  steps.push(
    step(
      'בודקים כל פתרון במשוואה המקורית',
      roots
        .map((r) => {
          const x = rootValue(r);
          const lv = evaluate(L0, { [v]: x });
          const rv = evaluate(R0, { [v]: x });
          return `${v} = ${rootTex(r)}:\\ ${niceTex(lv)} ${Math.abs(lv - rv) < 1e-7 ? '=' : '\\neq'} ${niceTex(rv)} ${good.includes(r) ? '\\ \\checkmark' : '\\ \\times'}`;
        })
        .join('\\\\ '),
      bad.length ? `$${bad.map((r) => `${v} = ${rootTex(r)}`).join(', ')}$ הוא פתרון זר ונפסל.` : 'כל הפתרונות מתאימים.',
    ),
  );
  return {
    kind: 'sqrt-equation',
    title: 'משוואה עם שורש',
    problemTex: original,
    topic: TOPIC,
    steps,
    answer: rootsAnswer(good, v),
    hints: hints(
      'יש נעלם בתוך שורש. מבודדים את השורש ומעלים בריבוע.',
      'שורש מוגדר רק לביטוי אי-שלילי, והוא עצמו אי-שלילי. אחרי העלאה בריבוע חייבים לבדוק את הפתרונות.',
      `בודדו את השורש: $${sqrtTex} = ${Q.toTex(v)}$.`,
    ),
  };
}

/** If n is c·base^(poly) returns its parts. */
function expParts(n: Node, v: string): { base: number; expo: Poly; coef: number } | null {
  if (n.k === 'pow' && !containsVar(n.a, v)) {
    const expo = toPoly(n.b, v);
    if (!expo) return null;
    const base = evaluate(n.a);
    if (!(base > 0) || base === 1) return null;
    return { base, expo, coef: 1 };
  }
  if (n.k === 'fn' && n.n === 'exp') {
    const expo = toPoly(n.a, v);
    return expo ? { base: Math.E, expo, coef: 1 } : null;
  }
  if (n.k === 'mul' && !containsVar(n.a, v)) {
    const inner = expParts(n.b, v);
    return inner ? { ...inner, coef: inner.coef * evaluate(n.a) } : null;
  }
  return null;
}

function asPowerOf(x: number, base: number): Fraction | null {
  const k = Math.log(x) / Math.log(base);
  const f = Fraction.fromDecimal(Math.round(k * 1e9) / 1e9);
  return f.d <= 12 && Math.abs(Math.pow(base, f.toNumber()) - x) < 1e-9 * Math.max(1, x) ? f : null;
}

function exponentialEquation(L0: Node, R0: Node, v: string, original: string): Solution | null {
  let L = L0;
  let R = R0;
  let eL = expParts(L, v);
  if (!eL) {
    [L, R] = [R, L];
    eL = expParts(L, v);
    if (!eL) return null;
  }
  const steps: SolutionStep[] = [step('המשוואה', original)];
  const eR = expParts(R, v);
  const btex = (b: number) => (b === Math.E ? 'e' : niceTex(b));
  if (eR) {
    // same base family: a^P = b^Q
    let r = 0;
    let m: Fraction | null = null;
    let n: Fraction | null = null;
    for (const cand of [eL.base, 2, 3, 5, 6, 7, 10]) {
      m = asPowerOf(eL.base, cand);
      n = asPowerOf(eR.base, cand);
      if (m && n) {
        r = cand;
        break;
      }
    }
    if (!r || !m || !n || eL.coef !== 1 || eR.coef !== 1) return null;
    const PL = eL.expo.scale(m);
    const PR = eR.expo.scale(n);
    steps.push(step(`כותבים את שני האגפים כחזקות של ${btex(r)}`, `${btex(r)}^{${PL.toTex(v)}} = ${btex(r)}^{${PR.toTex(v)}}`));
    steps.push(step('בסיסים שווים ⇐ מעריכים שווים', `${PL.toTex(v)} = ${PR.toTex(v)}`));
    const { P } = normalize(PL.sub(PR));
    const { steps: sub, roots } = solvePolyZero(P, v);
    steps.push(...sub);
    return expSolution(steps, roots, original, v);
  }
  if (containsVar(R, v)) return null;
  const c = evaluate(R) / eL.coef;
  if (eL.coef !== 1) steps.push(step(`מחלקים ב-${niceTex(eL.coef)}`, `${btex(eL.base)}^{${eL.expo.toTex(v)}} = ${niceTex(c)}`));
  if (!(c > 0)) {
    steps.push(step('חזקה של בסיס חיובי היא תמיד חיובית', undefined, 'לכן אין פתרון.'));
    return expSolution(steps, [], original, v);
  }
  const k = asPowerOf(c, eL.base);
  let target: Poly;
  if (k) {
    steps.push(step(`כותבים את ${niceTex(c)} כחזקה של ${btex(eL.base)}`, `${btex(eL.base)}^{${eL.expo.toTex(v)}} = ${btex(eL.base)}^{${k.toTex()}}`));
    steps.push(step('בסיסים שווים ⇐ מעריכים שווים', `${eL.expo.toTex(v)} = ${k.toTex()}`));
    target = Poly.const(k);
  } else {
    const val = Math.log(c) / Math.log(eL.base);
    const logTex = eL.base === Math.E ? `\\ln ${niceTex(c)}` : `\\log_{${btex(eL.base)}} ${niceTex(c)}`;
    steps.push(step('מוציאים לוגריתם משני האגפים', `${eL.expo.toTex(v)} = ${logTex} \\approx ${niceTex(Math.round(val * 10000) / 10000)}`));
    target = Poly.const(Fraction.fromDecimal(Math.round(val * 1e6) / 1e6));
  }
  const { P } = normalize(eL.expo.sub(target));
  const { steps: sub, roots } = solvePolyZero(P, v);
  steps.push(...sub);
  return expSolution(steps, roots, original, v, !k);
}

function expSolution(steps: SolutionStep[], roots: Root[], original: string, v: string, approx = false): Solution {
  return {
    kind: 'exponential',
    title: 'משוואה מעריכית',
    problemTex: original,
    topic: 'powers',
    steps,
    answer: approx ? `${rootsAnswer(roots, v)} (בקירוב)` : rootsAnswer(roots, v),
    hints: hints(
      'הנעלם נמצא במעריך. מנסים להגיע לאותו בסיס בשני האגפים.',
      'אם $a^{f(x)} = a^{g(x)}$ אז $f(x) = g(x)$. אם אי אפשר להגיע לאותו בסיס – מוציאים לוגריתם.',
      'כתבו את המספר שבאגף השני כחזקה של הבסיס (למשל $32 = 2^5$).',
    ),
  };
}

function logEquation(L0: Node, R0: Node, v: string, original: string): Solution | null {
  let L = L0;
  let R = R0;
  const isLog = (n: Node) => n.k === 'fn' && (n.n === 'log' || n.n === 'ln');
  if (!isLog(L)) {
    [L, R] = [R, L];
    if (!isLog(L)) return null;
  }
  if (containsVar(R, v) || L.k !== 'fn') return null;
  const P = toPoly(L.a, v);
  if (!P) return null;
  const base = L.n === 'ln' ? Math.E : L.base ? evaluate(L.base) : 10;
  const c = evaluate(R);
  const btex = L.n === 'ln' ? 'e' : niceTex(base);
  const steps: SolutionStep[] = [step('המשוואה', original)];
  steps.push(step('תנאי: מה שבתוך הלוגריתם חיובי', `${P.toTex(v)} > 0`));
  const value = Math.pow(base, c);
  const valueF = Fraction.fromDecimal(Math.round(value * 1e9) / 1e9);
  const exact = Math.abs(valueF.toNumber() - value) < 1e-9 && valueF.d <= 1000;
  steps.push(step('לפי הגדרת הלוגריתם', `${P.toTex(v)} = ${btex}^{${niceTex(c)}} = ${exact ? valueF.toTex() : niceTex(value)}`));
  const { P: Pn } = normalize(P.sub(Poly.const(exact ? valueF : Fraction.fromDecimal(Math.round(value * 1e6) / 1e6))));
  const { steps: sub, roots } = solvePolyZero(Pn, v);
  steps.push(...sub);
  const good = roots.filter((r) => P.eval(rootValue(r)) > 0);
  if (good.length !== roots.length) steps.push(step('בודקים את התנאי', undefined, 'חלק מהפתרונות לא מקיימים את התנאי ונפסלים.'));
  return {
    kind: 'logarithmic',
    title: 'משוואה לוגריתמית',
    problemTex: original,
    topic: 'powers',
    steps,
    answer: rootsAnswer(good, v),
    hints: hints(
      'הנעלם נמצא בתוך לוגריתם. משתמשים בהגדרת הלוגריתם.',
      '$\\log_a f(x) = c \\iff f(x) = a^c$, ובתנאי ש-$f(x) > 0$.',
      `כתבו: $${P.toTex(v)} = ${btex}^{${niceTex(c)}}$.`,
    ),
  };
}

function numericEquation(L: Node, R: Node, v: string, original: string): Solution {
  const f = compile({ k: 'sub', a: L, b: R }, v);
  const roots = numericRoots(f, -60, 60, 24000)
    .filter((x) => Math.abs(f(x)) < 1e-6)
    .map((x): Root => ({ kind: 'approx', v: x }));
  const steps: SolutionStep[] = [
    step('המשוואה', original),
    step(
      'פתרון נומרי',
      `f(${v}) = ${toTex(L)} - \\left(${toTex(R)}\\right) = 0`,
      'למשוואה הזו אין לנו שיטה אלגברית אוטומטית, ולכן חיפשנו נקודות שבהן $f(x) = 0$ בתחום $-60 \\le x \\le 60$. הפתרונות מקורבים.',
    ),
  ];
  return {
    kind: 'numeric',
    title: 'משוואה (פתרון מקורב)',
    problemTex: original,
    topic: TOPIC,
    steps,
    answer: roots.length ? `${rootsAnswer(roots, v)} (בקירוב)` : 'לא נמצא פתרון בתחום שנבדק.',
    notes: ['כדאי לנסות לפתור אלגברית ולהשוות. אם יש מפתח AI בהגדרות, אפשר לבקש פתרון מלא עם הסבר.'],
    hints: hints(
      'נסו לזהות את סוג המשוואה: שורש, חזקה, לוגריתם או ערך מוחלט.',
      'בודדו את הביטוי הבעייתי באגף אחד.',
      'בדקו את תחום ההגדרה לפני שמתחילים.',
    ),
  };
}

export { rationalRoots };
