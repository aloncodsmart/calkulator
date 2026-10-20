import { Fraction } from '../math/fraction';
import { solveProblem, type SolveMode } from '../solver';
import type { Hints, SolutionStep } from '../../types';
import { type Exercise, type Difficulty, type Rng, int, nonZero, pick, shuffle, term, polyTex } from './types';

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Uses the step-by-step solver to produce the worked solution of a generated exercise. */
function solved(input: string, mode: SolveMode = 'auto', extra = {}): { steps: SolutionStep[]; hints: Hints; answer: string } {
  const r = solveProblem(input, mode, extra);
  if (!r.ok) throw new Error(`generator produced unsolvable input: ${input} (${r.error})`);
  return { steps: r.solution.steps, hints: r.solution.hints, answer: r.solution.answer };
}

const fr = (n: number, d = 1) => new Fraction(n, d);

// ---------- equations ----------

export function linearEquation(rng: Rng, d: Difficulty): Exercise {
  const x = d === 3 ? pick(rng, [-3, -2, -1, 1, 2, 3, 4, 5]) : int(rng, -6, 9);
  let input: string;
  if (d === 1) {
    const a = nonZero(rng, -5, 7);
    const b = int(rng, -9, 9);
    input = `${a}x${b >= 0 ? '+' : ''}${b}=${a * x + b}`;
  } else if (d === 2) {
    const a = nonZero(rng, 2, 5),
      b = nonZero(rng, -6, 6),
      c = nonZero(rng, -4, 4);
    const rhsConst = a * (x + b) - c * x;
    input = `${a}(x${b >= 0 ? '+' : ''}${b})=${c}x${rhsConst >= 0 ? '+' : ''}${rhsConst}`;
  } else {
    const p = pick(rng, [2, 3, 4]),
      q = pick(rng, [3, 5, 6]);
    const k = int(rng, 1, 4);
    // x/p + k = (x + m)/q  →  choose m so that x is the solution
    const m = q * (x / p + k) - x;
    const mFr = fr(Math.round(m * p), p);
    if (!mFr.isInt()) return linearEquation(rng, 2);
    input = `x/${p}+${k}=(x${mFr.n >= 0 ? '+' : ''}${mFr.n})/${q}`;
  }
  const s = solved(input);
  return {
    id: uid('lin'),
    topic: 'equations',
    difficulty: d,
    question: `פתרו את המשוואה: $${s.steps[0].tex}$`,
    answer: { kind: 'numbers', values: [x] },
    answerDisplay: s.answer,
    inputHint: 'ערך של x',
    hints: s.hints,
    steps: s.steps,
  };
}

export function quadraticEquation(rng: Rng, d: Difficulty): Exercise {
  let input: string;
  let roots: number[];
  if (d === 1) {
    const r1 = int(rng, -6, 6);
    let r2 = int(rng, -6, 6);
    if (r2 === r1) r2 += 1;
    roots = [r1, r2];
    input = `x^2${term(-(r1 + r2), 'x')}${term(r1 * r2, '')}=0`.replace(/\s/g, '');
  } else if (d === 2) {
    const a = pick(rng, [2, 3]);
    const r1 = int(rng, -4, 4);
    const r2n = pick(rng, [-3, -1, 1, 3, 5]);
    // a(x - r1)(x - r2n/a)
    const B = -(a * r1 + r2n);
    const C = r1 * r2n;
    roots = [r1, r2n / a];
    input = `${a}x^2${term(B, 'x')}${term(C, '')}=0`.replace(/\s/g, '');
    if (new Set(roots).size === 1) return quadraticEquation(rng, 1);
  } else {
    // irrational roots: x^2 + bx + c with non-square discriminant
    let b = 0,
      c = 0,
      D = 0;
    do {
      b = int(rng, -6, 6);
      c = int(rng, -8, 4);
      D = b * b - 4 * c;
    } while (D <= 0 || Number.isInteger(Math.sqrt(D)));
    roots = [(-b - Math.sqrt(D)) / 2, (-b + Math.sqrt(D)) / 2];
    input = `x^2${term(b, 'x')}${term(c, '')}=0`.replace(/\s/g, '');
  }
  const s = solved(input);
  return {
    id: uid('quad'),
    topic: 'equations',
    difficulty: d,
    question: `פתרו את המשוואה: $${s.steps[0].tex}$`,
    answer: { kind: 'numbers', values: roots, tol: d === 3 ? 0.005 : 1e-6 },
    answerDisplay: s.answer,
    inputHint: d === 3 ? 'שני הפתרונות, מופרדים בפסיק (אפשר בקירוב: 2 ספרות אחרי הנקודה, או עם sqrt)' : 'שני הפתרונות, מופרדים בפסיק',
    hints: s.hints,
    steps: s.steps,
  };
}

export function systemEquations(rng: Rng, d: Difficulty): Exercise {
  const x = int(rng, -4, 6),
    y = int(rng, -4, 6);
  let a1: number, b1: number, a2: number, b2: number;
  do {
    a1 = d === 1 ? 1 : nonZero(rng, -4, 5);
    b1 = nonZero(rng, -4, 5);
    a2 = nonZero(rng, -4, 5);
    b2 = d === 1 ? pick(rng, [1, -1]) : nonZero(rng, -4, 5);
  } while (a1 * b2 - a2 * b1 === 0);
  const e1 = `${term(a1, 'x', true)}${term(b1, 'y')}=${a1 * x + b1 * y}`.replace(/\s/g, '');
  const e2 = `${term(a2, 'x', true)}${term(b2, 'y')}=${a2 * x + b2 * y}`.replace(/\s/g, '');
  const s = solved(`${e1}\n${e2}`);
  return {
    id: uid('sys'),
    topic: 'equations',
    difficulty: d,
    question: `פתרו את מערכת המשוואות: $${s.steps[0].tex}$`,
    answer: { kind: 'numbers', values: [x, y] },
    answerDisplay: s.answer,
    inputHint: 'x, y (קודם x ואחר כך y)',
    hints: s.hints,
    steps: s.steps,
  };
}

export function rationalEquation(rng: Rng, d: Difficulty): Exercise {
  const p = nonZero(rng, -5, 5);
  const k = pick(rng, [2, 3, 4, -2]);
  // (x + q)/(x - p) = k  →  x + q = kx - kp  → x = (q + kp)/(k - 1)
  const x = int(rng, -5, 8);
  if (x === p) return rationalEquation(rng, d);
  const q = (k - 1) * x - k * p;
  const input = `(x${q >= 0 ? '+' : ''}${q})/(x${-p >= 0 ? '+' : ''}${-p})=${k}`;
  const s = solved(input);
  return {
    id: uid('rat'),
    topic: 'equations',
    difficulty: d,
    question: `פתרו את המשוואה: $${s.steps[0].tex}$`,
    answer: { kind: 'numbers', values: [x] },
    answerDisplay: s.answer,
    inputHint: 'ערך של x',
    hints: s.hints,
    steps: s.steps,
  };
}

// ---------- inequalities ----------

export function linearInequality(rng: Rng, d: Difficulty): Exercise {
  const a = d === 1 ? nonZero(rng, 1, 5) : nonZero(rng, -5, 5);
  const x0 = int(rng, -5, 6);
  const b = int(rng, -8, 8);
  const rel = pick(rng, ['>', '<', '>=', '<='] as const);
  const input = `${a}x${b >= 0 ? '+' : ''}${b}${rel}${a * x0 + b}`;
  const s = solved(input);
  const flipped = a < 0;
  const relTex = { '>': '>', '<': '<', '>=': '\\ge', '<=': '\\le' } as const;
  const flipMap = { '>': '<', '<': '>', '>=': '<=', '<=': '>=' } as const;
  const finalRel = flipped ? flipMap[rel] : rel;
  const all = ['>', '<', '>=', '<='] as const;
  const options = shuffle(rng, all.map((r) => `$x ${relTex[r]} ${x0}$`));
  const correct = options.indexOf(`$x ${relTex[finalRel]} ${x0}$`);
  return {
    id: uid('ineq'),
    topic: 'inequalities',
    difficulty: d,
    question: `פתרו את אי-השוויון: $${s.steps[0].tex}$`,
    answer: { kind: 'choice', options, correct },
    answerDisplay: s.answer,
    hints: s.hints,
    steps: s.steps,
  };
}

export function quadraticInequality(rng: Rng, d: Difficulty): Exercise {
  const r1 = int(rng, -5, 2);
  const r2 = r1 + int(rng, 1, 5);
  const between = rng() < 0.5;
  const strict = d < 3 || rng() < 0.5;
  const rel = between ? (strict ? '<' : '<=') : strict ? '>' : '>=';
  const input = `x^2${term(-(r1 + r2), 'x')}${term(r1 * r2, '')}${rel}0`.replace(/\s/g, '');
  const s = solved(input);
  const le = strict ? '<' : '\\le';
  const ge = strict ? '>' : '\\ge';
  const opts = [
    `$${r1} ${le} x ${le} ${r2}$`,
    `$x ${le} ${r1}$ או $x ${ge} ${r2}$`,
    `$x ${ge} ${r1}$`,
    `$x ${le} ${r2}$`,
  ];
  const correctText = between ? opts[0] : opts[1];
  const options = shuffle(rng, opts);
  return {
    id: uid('qineq'),
    topic: 'inequalities',
    difficulty: d,
    question: `פתרו את אי-השוויון: $${s.steps[0].tex}$`,
    answer: { kind: 'choice', options, correct: options.indexOf(correctText) },
    answerDisplay: s.answer,
    hints: s.hints,
    steps: s.steps,
  };
}

// ---------- algebraic expressions ----------

export function expandExpression(rng: Rng, d: Difficulty): Exercise {
  const a = nonZero(rng, -6, 6);
  const k = d === 1 ? 1 : pick(rng, [2, 3]);
  const form = d === 1 ? pick(rng, ['sq+', 'sq-', 'diff']) : pick(rng, ['sq+', 'sq-', 'diff', 'prod']);
  let input: string;
  let expanded: string;
  const A = Math.abs(a);
  if (form === 'sq+') {
    input = `(${k === 1 ? '' : k}x+${A})^2`;
    expanded = `${k * k}x^2+${2 * k * A}x+${A * A}`;
  } else if (form === 'sq-') {
    input = `(${k === 1 ? '' : k}x-${A})^2`;
    expanded = `${k * k}x^2-${2 * k * A}x+${A * A}`;
  } else if (form === 'diff') {
    input = `(${k === 1 ? '' : k}x-${A})(${k === 1 ? '' : k}x+${A})`;
    expanded = `${k * k}x^2-${A * A}`;
  } else {
    const b = nonZero(rng, -5, 5);
    input = `(x${a >= 0 ? '+' : ''}${a})(${k}x${b >= 0 ? '+' : ''}${b})`;
    expanded = `${k}x^2+${a * k + b}x+${a * b}`;
  }
  const s = solved(input, 'simplify');
  return {
    id: uid('exp'),
    topic: 'algebra',
    difficulty: d,
    question: `פתחו סוגריים ופשטו: $${s.steps[0].tex}$`,
    answer: { kind: 'expression', expr: expanded, vars: ['x'] },
    answerDisplay: `$${s.steps[1]?.tex?.split('=')[1] ?? expanded}$`,
    inputHint: 'ביטוי, למשל x^2+6x+9',
    hints: {
      direction: 'פותחים סוגריים: כל איבר בסוגריים הראשונים כפול כל איבר בשניים.',
      tool: form === 'diff' ? '$(a-b)(a+b) = a^2 - b^2$.' : form === 'prod' ? 'חוק הפילוג: $(a+b)(c+d) = ac + ad + bc + bd$.' : '$(a\\pm b)^2 = a^2 \\pm 2ab + b^2$ – לא לשכוח את האיבר האמצעי!',
      next: 'זהו מה הם $a$ ו-$b$ בנוסחה.',
    },
    steps: s.steps,
  };
}

export function factorExpression(rng: Rng, d: Difficulty): Exercise {
  const r1 = nonZero(rng, -6, 6);
  let r2 = nonZero(rng, -6, 6);
  if (d === 1 && rng() < 0.5) r2 = 0;
  const lead = d === 3 ? pick(rng, [2, 3]) : 1;
  const coefs = [lead, -lead * (r1 + r2), lead * r1 * r2];
  const input = polyTex(coefs).replace(/[{}]/g, '');
  const s = solved(input, 'simplify');
  const factored = `${lead}*(x-(${r1}))*(x-(${r2}))`;
  return {
    id: uid('fac'),
    topic: 'algebra',
    difficulty: d,
    question: `פרקו לגורמים: $${polyTex(coefs)}$`,
    answer: { kind: 'expression', expr: factored, vars: ['x'], product: true },
    answerDisplay: s.answer,
    inputHint: 'מכפלה, למשל (x-2)(x+3)',
    hints: {
      direction: 'רוצים לכתוב את הביטוי כמכפלה.',
      tool: r2 === 0 ? 'הוצאת גורם משותף.' : 'טרינום: מחפשים שני מספרים שסכומם הוא המקדם של $x$ ומכפלתם האיבר החופשי (אחרי חלוקה במקדם המוביל).',
      next: r2 === 0 ? 'מה משותף לשני האיברים?' : 'אפשר למצוא את השורשים של הטרינום ולכתוב $a(x - x_1)(x - x_2)$.',
    },
    steps: s.steps,
  };
}

// ---------- powers and logarithms ----------

export function powerRules(rng: Rng, d: Difficulty): Exercise {
  const base = pick(rng, [2, 3, 5]);
  const m = int(rng, 2, 6),
    n = int(rng, 1, 5),
    k = int(rng, 1, 6);
  const e = d === 1 ? m + n - k : d === 2 ? m * 2 - n - k : m + n - 2 * k;
  if (e < -2 || e > 6) return powerRules(rng, d);
  const tex =
    d === 1
      ? `\\frac{${base}^{${m}} \\cdot ${base}^{${n}}}{${base}^{${k}}}`
      : d === 2
        ? `\\frac{\\left(${base}^{${m}}\\right)^2}{${base}^{${n}}\\cdot ${base}^{${k}}}`
        : `\\frac{${base}^{${m}} \\cdot ${base}^{${n}}}{\\left(${base}^{${k}}\\right)^2}`;
  const value = Math.pow(base, e);
  const expTex = d === 1 ? `${m}+${n}-${k}` : d === 2 ? `2\\cdot${m}-${n}-${k}` : `${m}+${n}-2\\cdot${k}`;
  return {
    id: uid('pow'),
    topic: 'powers',
    difficulty: d,
    question: `חשבו בעזרת חוקי חזקות: $${tex}$`,
    answer: { kind: 'numbers', values: [value] },
    answerDisplay: `$${base}^{${e}} = ${Number.isInteger(value) ? value : new Fraction(1, Math.pow(base, -e)).toTex()}$`,
    inputHint: 'מספר (אפשר שבר)',
    hints: {
      direction: 'כל החזקות באותו בסיס. מספיק לחשב את המעריך.',
      tool: '$a^m \\cdot a^n = a^{m+n}$, $\\frac{a^m}{a^n} = a^{m-n}$, $(a^m)^n = a^{mn}$.',
      next: `חשבו את המעריך: $${expTex}$.`,
    },
    steps: [
      { title: 'מחשבים את המעריך לפי חוקי החזקות', tex: `${base}^{${expTex}} = ${base}^{${e}}` },
      { title: 'מחשבים', tex: `${base}^{${e}} = ${Number.isInteger(value) ? value : new Fraction(1, Math.pow(base, -e)).toTex()}` },
    ],
  };
}

export function logarithms(rng: Rng, d: Difficulty): Exercise {
  const base = pick(rng, [2, 3, 5, 10]);
  const a = int(rng, 1, base === 10 ? 3 : 4);
  const b = int(rng, 1, base === 10 ? 3 : 3);
  if (d === 1) {
    const x = Math.pow(base, a);
    return {
      id: uid('log'),
      topic: 'powers',
      difficulty: d,
      question: `חשבו: $\\log_{${base}} ${x}$`,
      answer: { kind: 'numbers', values: [a] },
      answerDisplay: `$${a}$, כי $${base}^{${a}} = ${x}$`,
      hints: { direction: 'השאלה: באיזו חזקה צריך להעלות את הבסיס כדי לקבל את המספר?', tool: '$\\log_a b = c \\iff a^c = b$.', next: `נסו: $${base}^1, ${base}^2, ${base}^3, \\dots$` },
      steps: [{ title: 'לפי הגדרת הלוגריתם', tex: `\\log_{${base}} ${x} = ${a} \\iff ${base}^{${a}} = ${x}` }],
    };
  }
  if (d === 2) {
    const x = Math.pow(base, a),
      y = Math.pow(base, b);
    return {
      id: uid('log'),
      topic: 'powers',
      difficulty: d,
      question: `חשבו: $\\log_{${base}} ${x} + \\log_{${base}} ${y}$`,
      answer: { kind: 'numbers', values: [a + b] },
      answerDisplay: `$${a + b}$`,
      hints: { direction: 'אפשר לחשב כל לוגריתם בנפרד, או להשתמש בחוק המכפלה.', tool: '$\\log_a x + \\log_a y = \\log_a(xy)$.', next: `חשבו את $\\log_{${base}} ${x}$.` },
      steps: [{ title: 'מחשבים כל איבר', tex: `${a} + ${b} = ${a + b}` }],
    };
  }
  // exponential equation
  const c = int(rng, -2, 3);
  const target = a + c;
  if (target < 1) return logarithms(rng, 2);
  const eq = `${base}^(x${c >= 0 ? '+' : ''}${c})=${Math.pow(base, target)}`;
  const s = solved(eq);
  return {
    id: uid('expeq'),
    topic: 'powers',
    difficulty: d,
    question: `פתרו את המשוואה: $${s.steps[0].tex}$`,
    answer: { kind: 'numbers', values: [target - c] },
    answerDisplay: s.answer,
    hints: s.hints,
    steps: s.steps,
  };
}

// ---------- functions ----------

export function parabolaVertex(rng: Rng, d: Difficulty): Exercise {
  const a = d === 1 ? 1 : pick(rng, [-2, -1, 1, 2]);
  const p = int(rng, -4, 4),
    k = int(rng, -5, 5);
  const coefs = [a, -2 * a * p, a * p * p + k];
  return {
    id: uid('vertex'),
    topic: 'functions',
    difficulty: d,
    question: `מצאו את קודקוד הפרבולה $y = ${polyTex(coefs)}$.`,
    answer: { kind: 'numbers', values: [p, k], count: 2 },
    answerDisplay: `$(${p},\\ ${k})$ – ${a > 0 ? 'מינימום' : 'מקסימום'}`,
    inputHint: 'x, y של הקודקוד',
    hints: {
      direction: 'הקודקוד נמצא על ציר הסימטריה.',
      tool: '$x_{\\text{קודקוד}} = -\\frac{b}{2a}$, ואז מציבים בפונקציה.',
      next: `חשבו: $x = -\\frac{${coefs[1]}}{2\\cdot ${a}}$.`,
    },
    steps: [
      { title: 'מזהים את המקדמים', tex: `a = ${a},\\ b = ${coefs[1]},\\ c = ${coefs[2]}` },
      { title: 'שיעור ה-$x$ של הקודקוד', tex: `x = -\\frac{b}{2a} = -\\frac{${coefs[1]}}{${2 * a}} = ${p}` },
      { title: 'מציבים בפונקציה', tex: `y(${p}) = ${a}\\cdot(${p})^2 ${coefs[1] >= 0 ? '+' : '-'} ${Math.abs(coefs[1])}\\cdot(${p}) ${coefs[2] >= 0 ? '+' : '-'} ${Math.abs(coefs[2])} = ${k}` },
    ],
    diagram: {
      id: 'dyn-vertex',
      shape: 'graph',
      window: [p - 5, p + 5, Math.min(k, 0) - 4, Math.max(k, 0) + 4],
      free: true,
      points: { V: [p, k] },
      elements: [
        { t: 'axes', grid: true },
        { t: 'fn', f: `${a}*(x-(${p}))^2+(${k})` },
        { t: 'pts', p: ['V'], c: 'warn', nolabel: true },
      ],
    },
  };
}

export function lineThroughPoints(rng: Rng, d: Difficulty): Exercise {
  const x1 = int(rng, -4, 3);
  const x2 = x1 + int(rng, 1, 4);
  const m = d === 1 ? nonZero(rng, -3, 3) : new Fraction(nonZero(rng, -5, 5), pick(rng, [1, 2])).toNumber();
  const b = int(rng, -4, 4);
  const y1 = m * x1 + b,
    y2 = m * x2 + b;
  if (!Number.isInteger(y1) || !Number.isInteger(y2)) return lineThroughPoints(rng, 1);
  return {
    id: uid('line'),
    topic: 'analytic',
    difficulty: d,
    question: `מצאו את משוואת הישר העובר דרך הנקודות $A(${x1}, ${y1})$ ו-$B(${x2}, ${y2})$. כתבו את השיפוע $m$ ואת $b$ (בצורה $y = mx + b$).`,
    answer: { kind: 'numbers', values: [m, b] },
    answerDisplay: `$y = ${polyTex([m, b]).replace(/\.5/g, '.5')}$`,
    inputHint: 'm, b',
    hints: {
      direction: 'קודם מוצאים את השיפוע, ואחר כך מציבים נקודה.',
      tool: '$m = \\frac{y_2 - y_1}{x_2 - x_1}$, ואז $y - y_1 = m(x - x_1)$.',
      next: `חשבו: $m = \\frac{${y2} - (${y1})}{${x2} - (${x1})}$.`,
    },
    steps: [
      { title: 'מחשבים שיפוע', tex: `m = \\frac{${y2} - (${y1})}{${x2} - (${x1})} = ${new Fraction(y2 - y1, x2 - x1).toTex()}` },
      { title: 'מציבים את הנקודה $A$', tex: `y - (${y1}) = ${new Fraction(y2 - y1, x2 - x1).toTex()}\\left(x - (${x1})\\right)` },
      { title: 'מסדרים', tex: `y = ${new Fraction(y2 - y1, x2 - x1).toTex()}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}` },
    ],
  };
}

// ---------- calculus ----------

export function derivativeAtPoint(rng: Rng, d: Difficulty): Exercise {
  const a = nonZero(rng, -3, 4),
    b = int(rng, -5, 5),
    c = int(rng, -6, 6);
  const deg = d === 1 ? 2 : 3;
  const coefs = deg === 2 ? [a, b, c] : [a, b, c, int(rng, -5, 5)];
  const x0 = int(rng, -3, 3);
  const fx = polyTex(coefs).replace(/[{}]/g, '');
  const s = solved(`f(x)=${fx}`, 'derivative');
  const dcoefs = coefs.slice(0, -1).map((q, i) => q * (coefs.length - 1 - i));
  const val = dcoefs.reduce((acc, q) => acc * x0 + q, 0);
  return {
    id: uid('dval'),
    topic: 'derivatives',
    difficulty: d,
    question: `נתונה הפונקציה $f(x) = ${polyTex(coefs)}$. חשבו את $f'(${x0})$.`,
    answer: { kind: 'numbers', values: [val] },
    answerDisplay: `$f'(x) = ${polyTex(dcoefs)}$, ולכן $f'(${x0}) = ${val}$`,
    hints: {
      direction: 'קודם גוזרים, ואחר כך מציבים.',
      tool: '$(x^n)\' = nx^{n-1}$, ונגזרת של קבוע היא 0.',
      next: 'גזרו כל איבר בנפרד.',
    },
    steps: [...s.steps, { title: `מציבים $x = ${x0}$`, tex: `f'(${x0}) = ${val}` }],
  };
}

export function extremumPoints(rng: Rng, d: Difficulty): Exercise {
  // f'(x) = 3a(x - p)(x - q)
  const p = int(rng, -3, 1);
  const q = p + int(rng, 1, 3);
  const a = d === 3 ? pick(rng, [-1, 1]) : 1;
  const coefs = [a, (-3 * a * (p + q)) / 2, 3 * a * p * q, int(rng, -4, 4)];
  if (!Number.isInteger(coefs[1])) return extremumPoints(rng, d);
  const fx = polyTex(coefs).replace(/[{}]/g, '');
  const s = solved(`f(x)=${fx}`, 'investigate');
  return {
    id: uid('ext'),
    topic: 'derivatives',
    difficulty: d,
    question: `מצאו את שיעורי ה-$x$ של נקודות הקיצון של $f(x) = ${polyTex(coefs)}$, וקבעו את סוגן.`,
    answer: { kind: 'numbers', values: [p, q] },
    answerDisplay: s.answer,
    inputHint: 'שני ערכי x, מופרדים בפסיק',
    hints: s.hints,
    steps: s.steps,
  };
}

export function tangentLine(rng: Rng, d: Difficulty): Exercise {
  const a = nonZero(rng, -2, 2),
    b = int(rng, -4, 4),
    c = int(rng, -5, 5);
  const x0 = int(rng, -2, 3);
  const fx = polyTex([a, b, c]).replace(/[{}]/g, '');
  const s = solved(`f(x)=${fx}`, 'tangent', { x0: String(x0) });
  const m = 2 * a * x0 + b;
  const y0 = a * x0 * x0 + b * x0 + c;
  const bb = y0 - m * x0;
  return {
    id: uid('tan'),
    topic: 'derivatives',
    difficulty: d,
    question: `מצאו את משוואת המשיק לגרף $f(x) = ${polyTex([a, b, c])}$ בנקודה שבה $x = ${x0}$. כתבו את $m$ ואת $b$ של המשיק $y = mx + b$.`,
    answer: { kind: 'numbers', values: [m, bb] },
    answerDisplay: s.answer,
    inputHint: 'm, b',
    hints: s.hints,
    steps: s.steps,
  };
}

export function definiteIntegral(rng: Rng, d: Difficulty): Exercise {
  const a0 = int(rng, -2, 1);
  const b0 = a0 + int(rng, 1, 3);
  const coefs = d === 1 ? [nonZero(rng, 1, 3) * 2, int(rng, -4, 4)] : [3 * nonZero(rng, -2, 2), 2 * int(rng, -3, 3), int(rng, -4, 4)];
  const fx = polyTex(coefs).replace(/[{}]/g, '');
  const s = solved(fx, 'integral', { a: String(a0), b: String(b0) });
  const deg = coefs.length - 1;
  const F = (x: number) => coefs.reduce((acc, c, i) => acc + (c * Math.pow(x, deg - i + 1)) / (deg - i + 1), 0);
  const val = F(b0) - F(a0);
  return {
    id: uid('int'),
    topic: 'integrals',
    difficulty: d,
    question: `חשבו: $\\int_{${a0}}^{${b0}} \\left(${polyTex(coefs)}\\right) dx$`,
    answer: { kind: 'numbers', values: [val], tol: 1e-6 },
    answerDisplay: s.answer,
    hints: s.hints,
    steps: s.steps,
  };
}

// ---------- sequences and growth ----------

export function arithmeticSequence(rng: Rng, d: Difficulty): Exercise {
  const a1 = int(rng, -10, 15),
    dd = nonZero(rng, -5, 7);
  const n = int(rng, 8, 30);
  const an = a1 + (n - 1) * dd;
  if (d === 1)
    return {
      id: uid('arith'),
      topic: 'sequences',
      difficulty: d,
      question: `בסדרה חשבונית $a_1 = ${a1}$ ו-$d = ${dd}$. מצאו את $a_{${n}}$.`,
      answer: { kind: 'numbers', values: [an] },
      answerDisplay: `$a_{${n}} = ${an}$`,
      hints: { direction: 'יש נוסחה לאיבר הכללי.', tool: '$a_n = a_1 + (n - 1)d$.', next: `הציבו: $a_{${n}} = ${a1} + ${n - 1}\\cdot(${dd})$.` },
      steps: [{ title: 'מציבים בנוסחת האיבר הכללי', tex: `a_{${n}} = ${a1} + (${n} - 1)\\cdot(${dd}) = ${an}` }],
    };
  const S = (n * (a1 + an)) / 2;
  if (d === 2)
    return {
      id: uid('arith'),
      topic: 'sequences',
      difficulty: d,
      question: `בסדרה חשבונית $a_1 = ${a1}$ ו-$d = ${dd}$. מצאו את סכום ${n} האיברים הראשונים.`,
      answer: { kind: 'numbers', values: [S] },
      answerDisplay: `$S_{${n}} = ${S}$`,
      hints: { direction: 'אפשר למצוא קודם את $a_n$, ואז את הסכום.', tool: '$S_n = \\frac{n(a_1 + a_n)}{2}$.', next: `חשבו את $a_{${n}} = ${a1} + ${n - 1}\\cdot(${dd})$.` },
      steps: [
        { title: 'האיבר האחרון', tex: `a_{${n}} = ${a1} + ${n - 1}\\cdot(${dd}) = ${an}` },
        { title: 'הסכום', tex: `S_{${n}} = \\frac{${n}(${a1} + ${an})}{2} = ${S}` },
      ],
    };
  const k = int(rng, 4, 9);
  const ak = a1 + (k - 1) * dd;
  return {
    id: uid('arith'),
    topic: 'sequences',
    difficulty: d,
    question: `בסדרה חשבונית $a_1 = ${a1}$ ו-$a_{${k}} = ${ak}$. מצאו את ההפרש $d$ ואת $a_{${n}}$.`,
    answer: { kind: 'numbers', values: [dd, an] },
    answerDisplay: `$d = ${dd},\\ a_{${n}} = ${an}$`,
    inputHint: 'd, a_n',
    hints: { direction: 'כתבו את $a_{' + k + '}$ בעזרת $a_1$ ו-$d$.', tool: '$a_n = a_1 + (n - 1)d$.', next: `$${ak} = ${a1} + ${k - 1}d$.` },
    steps: [
      { title: 'מוצאים את $d$', tex: `${ak} = ${a1} + ${k - 1}d \\Rightarrow d = ${dd}` },
      { title: `מחשבים את $a_{${n}}$`, tex: `a_{${n}} = ${a1} + ${n - 1}\\cdot(${dd}) = ${an}` },
    ],
  };
}

export function geometricSequence(rng: Rng, d: Difficulty): Exercise {
  const a1 = pick(rng, [1, 2, 3, 4, 5, -2]);
  const q = pick(rng, d === 1 ? [2, 3] : [2, 3, -2, 0.5]);
  const n = int(rng, 4, 7);
  const an = a1 * Math.pow(q, n - 1);
  const S = q === 1 ? a1 * n : (a1 * (Math.pow(q, n) - 1)) / (q - 1);
  const qt = q === 0.5 ? '\\frac12' : `${q}`;
  if (d < 3)
    return {
      id: uid('geo'),
      topic: 'sequences',
      difficulty: d,
      question: `בסדרה הנדסית $a_1 = ${a1}$ ו-$q = ${qt}$. מצאו את $a_{${n}}$.`,
      answer: { kind: 'numbers', values: [an] },
      answerDisplay: `$a_{${n}} = ${new Fraction(Math.round(an * 64), 64).toTex()}$`,
      hints: { direction: 'כל איבר מתקבל מהקודם בכפל ב-$q$.', tool: '$a_n = a_1 q^{n-1}$.', next: `$a_{${n}} = ${a1}\\cdot (${qt})^{${n - 1}}$.` },
      steps: [{ title: 'מציבים בנוסחה', tex: `a_{${n}} = ${a1}\\cdot\\left(${qt}\\right)^{${n - 1}} = ${new Fraction(Math.round(an * 64), 64).toTex()}` }],
    };
  return {
    id: uid('geo'),
    topic: 'sequences',
    difficulty: d,
    question: `בסדרה הנדסית $a_1 = ${a1}$ ו-$q = ${qt}$. מצאו את סכום ${n} האיברים הראשונים.`,
    answer: { kind: 'numbers', values: [S], tol: 1e-6 },
    answerDisplay: `$S_{${n}} = ${new Fraction(Math.round(S * 64), 64).toTex()}$`,
    hints: { direction: 'יש נוסחה לסכום של סדרה הנדסית.', tool: '$S_n = \\frac{a_1(q^n - 1)}{q - 1}$.', next: `הציבו $a_1 = ${a1}$, $q = ${qt}$, $n = ${n}$.` },
    steps: [{ title: 'מציבים בנוסחת הסכום', tex: `S_{${n}} = \\frac{${a1}\\left(\\left(${qt}\\right)^{${n}} - 1\\right)}{${qt} - 1} = ${new Fraction(Math.round(S * 64), 64).toTex()}` }],
  };
}

export function growthDecay(rng: Rng, d: Difficulty): Exercise {
  const M0 = pick(rng, [200, 500, 1000, 1500, 2000, 5000]);
  const p = pick(rng, [5, 8, 10, 12, 20, 25]);
  const grow = rng() < 0.6;
  const t = int(rng, 2, 6);
  const q = grow ? 1 + p / 100 : 1 - p / 100;
  const Mt = M0 * Math.pow(q, t);
  if (d < 3)
    return {
      id: uid('growth'),
      topic: 'growth',
      difficulty: d,
      question: `כמות של ${M0} ${grow ? 'גדלה' : 'קטנה'} ב-${p}% בכל שנה. מה תהיה הכמות אחרי ${t} שנים? (עגלו לשתי ספרות אחרי הנקודה)`,
      answer: { kind: 'numbers', values: [Mt], tol: 0.0001 },
      answerDisplay: `$M_{${t}} = ${M0}\\cdot ${q}^{${t}} \\approx ${Math.round(Mt * 100) / 100}$`,
      hints: {
        direction: 'זה תהליך של גדילה או דעיכה באחוז קבוע.',
        tool: '$M_t = M_0 \\cdot q^t$, כאשר $q = 1 \\pm \\frac{p}{100}$.',
        next: `מקדם הגדילה: $q = ${q}$.`,
      },
      steps: [
        { title: 'מקדם השינוי', tex: `q = 1 ${grow ? '+' : '-'} \\frac{${p}}{100} = ${q}` },
        { title: 'מציבים בנוסחה', tex: `M_{${t}} = ${M0}\\cdot ${q}^{${t}} \\approx ${Math.round(Mt * 100) / 100}` },
      ],
    };
  return {
    id: uid('growth'),
    topic: 'growth',
    difficulty: d,
    question: `כמות התחלתית של ${M0} הפכה ל-${Math.round(Mt * 100) / 100} אחרי ${t} שנים, בשינוי באחוז קבוע. מצאו את מקדם השינוי $q$ (עגלו לשתי ספרות).`,
    answer: { kind: 'numbers', values: [q], tol: 0.006 },
    answerDisplay: `$q \\approx ${q}$ – ${grow ? 'גדילה' : 'דעיכה'} של ${p}% בשנה`,
    hints: {
      direction: 'הנעלם הוא הבסיס של החזקה.',
      tool: `$q^{${t}} = \\frac{M_t}{M_0}$, ולכן $q = \\sqrt[${t}]{\\frac{M_t}{M_0}}$.`,
      next: `חשבו את המנה $\\frac{${Math.round(Mt * 100) / 100}}{${M0}}$.`,
    },
    steps: [
      { title: 'מציבים', tex: `${Math.round(Mt * 100) / 100} = ${M0}\\cdot q^{${t}}` },
      { title: 'מבודדים ומוציאים שורש', tex: `q = \\sqrt[${t}]{${Math.round((Mt / M0) * 10000) / 10000}} \\approx ${q}` },
    ],
  };
}
