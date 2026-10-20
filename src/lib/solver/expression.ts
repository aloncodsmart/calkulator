import { niceTex } from '../math/fraction';
import { type Node, toTex, evaluate, variables } from '../math/expr';
import { toPoly, toRational, polyGcd, factoredTex, polyRoots, rootTex, Poly } from '../math/poly';
import type { Solution, SolutionStep } from '../../types';
import { step, hints, coefGcd } from './common';

export function expressionSolution(n: Node): Solution {
  const tex = toTex(n);
  const vars = [...variables(n)];
  const steps: SolutionStep[] = [step('הביטוי', tex)];
  if (!vars.length) {
    const val = evaluate(n);
    const P = toPoly(n);
    const exact = P && P.isConst() ? P.c[0].toTex() : niceTex(Math.round(val * 1e6) / 1e6);
    steps.push(step('מחשבים לפי סדר פעולות החשבון: סוגריים, חזקות, כפל וחילוק, חיבור וחיסור', `${tex} = ${exact}`));
    return {
      kind: 'arithmetic',
      title: 'חישוב',
      problemTex: tex,
      topic: 'algebra',
      steps,
      answer: `$${exact}$`,
      hints: hints('זה תרגיל חשבון.', 'סדר פעולות: סוגריים, חזקות, כפל וחילוק, חיבור וחיסור.', 'התחילו מהסוגריים הפנימיים ביותר.'),
    };
  }
  const v = vars.includes('x') ? 'x' : vars[0];
  if (vars.length === 1) {
    const P = toPoly(n, v);
    if (P) return polySimplify(n, P, v, steps);
    const R = toRational(n, v);
    if (R) {
      const g = polyGcd(R.num, R.den);
      const num = R.num.divmod(g).q;
      const den = R.den.divmod(g).q;
      const exclusions = polyRoots(R.den).map((r) => `${v} \\neq ${rootTex(r)}`);
      steps.push(step('מפרקים מונה ומכנה לגורמים', `\\frac{${factoredTex(R.num, v) ?? R.num.toTex(v)}}{${factoredTex(R.den, v) ?? R.den.toTex(v)}}`));
      if (g.deg > 0) steps.push(step('מצמצמים גורמים משותפים', `\\frac{${num.toTex(v)}}{${den.toTex(v)}}`, `צמצמנו את הגורם $${g.toTex(v)}$.`));
      if (exclusions.length) steps.push(step('תחום הגדרה (מהביטוי המקורי)', exclusions.join(',\\quad ')));
      const simple = den.isConst() ? num.scale(den.c[0].pow(-1)).toTex(v) : `\\frac{${num.toTex(v)}}{${den.toTex(v)}}`;
      return {
        kind: 'rational-expression',
        title: 'פישוט שבר אלגברי',
        problemTex: tex,
        topic: 'algebra',
        steps,
        answer: `$${simple}$${exclusions.length ? ` (בתנאי $${exclusions.join(',\\ ')}$)` : ''}`,
        hints: hints('זה שבר אלגברי. מפשטים אותו בעזרת צמצום.', 'מפרקים את המונה ואת המכנה לגורמים, ומצמצמים רק גורמים (כפל), לא מחוברים.', 'פרקו את המונה ואת המכנה: גורם משותף, כפל מקוצר או טרינום.'),
      };
    }
  }
  // multivariate polynomial: expand only
  steps.push(step('ביטוי עם כמה משתנים', undefined, 'אפשר לפשט אותו בפתיחת סוגריים ובכינוס איברים דומים. כרגע הפותר האוטומטי מטפל במלואו בביטויים במשתנה אחד.'));
  return {
    kind: 'expression',
    title: 'ביטוי אלגברי',
    problemTex: tex,
    topic: 'algebra',
    steps,
    answer: `$${tex}$`,
    hints: hints('פשטו את הביטוי.', 'חוק הפילוג וכינוס איברים דומים.', 'פתחו את הסוגריים.'),
  };
}

function polySimplify(n: Node, P: Poly, v: string, steps: SolutionStep[]): Solution {
  const tex = toTex(n);
  const expanded = P.toTex(v);
  if (expanded !== tex) steps.push(step('פותחים סוגריים ומכנסים איברים דומים', `${tex} = ${expanded}`));
  let factored: string | null = null;
  if (P.deg >= 2) {
    // common factor first
    let k = 0;
    while (P.c[k].isZero()) k++;
    const g = P.c.every((c) => c.isInt()) ? coefGcd(P) : 1;
    if (k > 0 || g > 1) {
      const inner = new Poly(P.c.slice(k)).scale(1 / g);
      const pref = `${g > 1 ? g : ''}${k === 0 ? '' : k === 1 ? v : `${v}^{${k}}`}`;
      steps.push(step('מוציאים גורם משותף', `${expanded} = ${pref}\\left(${inner.toTex(v)}\\right)`));
    }
    factored = factoredTex(P, v);
    if (factored && factored.replace(/\s/g, '') !== expanded.replace(/\s/g, ''))
      steps.push(
        step(
          'מפרקים לגורמים',
          `${expanded} = ${factored}`,
          P.deg === 2 ? 'מוצאים את השורשים $x_1, x_2$ ומשתמשים ב-$ax^2 + bx + c = a(x - x_1)(x - x_2)$.' : 'מוצאים שורשים ומפרקים.',
        ),
      );
    else factored = null;
  }
  return {
    kind: 'polynomial-expression',
    title: 'פישוט ופירוק ביטוי',
    problemTex: tex,
    topic: 'algebra',
    steps,
    answer: factored ? `$${expanded} = ${factored}$` : `$${expanded}$`,
    hints: hints(
      'מפשטים את הביטוי: פותחים סוגריים ומכנסים איברים דומים.',
      'חוק הפילוג, נוסחאות הכפל המקוצר, ולפירוק: גורם משותף או טרינום.',
      expanded !== tex ? 'פתחו את הסוגריים בעזרת חוק הפילוג.' : 'בדקו אם יש גורם משותף לכל האיברים.',
    ),
  };
}
