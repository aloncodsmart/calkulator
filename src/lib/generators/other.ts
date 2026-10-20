import { Fraction } from '../math/fraction';
import { type Exercise, type Difficulty, type Rng, int, pick, nonZero, shuffle } from './types';

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const r2 = (x: number) => Math.round(x * 100) / 100;
const frTex = (n: number, d: number) => new Fraction(n, d).toTex();

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

export function probabilityBasic(rng: Rng, d: Difficulty): Exercise {
  if (d === 1) {
    const kind = pick(rng, ['even', 'greater', 'prime']);
    const k = int(rng, 2, 5);
    const fav = kind === 'even' ? 3 : kind === 'prime' ? 3 : 6 - k;
    const desc = kind === 'even' ? 'מספר זוגי' : kind === 'prime' ? 'מספר ראשוני' : `מספר גדול מ-${k}`;
    return {
      id: uid('prob'),
      topic: 'probability',
      difficulty: d,
      question: `מטילים קובייה הוגנת פעם אחת. מה ההסתברות לקבל ${desc}?`,
      diagram: 'c-die',
      answer: { kind: 'numbers', values: [fav / 6] },
      answerDisplay: `$P = \\frac{${fav}}{6} = ${frTex(fav, 6)}$`,
      inputHint: 'שבר (למשל 1/2) או מספר עשרוני',
      hints: { direction: 'כל 6 התוצאות שוות סיכוי.', tool: '$P(A) = \\frac{\\text{מספר התוצאות המתאימות}}{\\text{מספר כל התוצאות}}$.', next: 'רשמו את כל התוצאות המתאימות.' },
      steps: [{ title: 'סופרים תוצאות מתאימות', tex: `P = \\frac{${fav}}{6} = ${frTex(fav, 6)}` }],
    };
  }
  if (d === 2) {
    const p = pick(rng, [0.2, 0.3, 0.4, 0.6, 0.7]);
    const q = pick(rng, [0.5, 0.25, 0.8, 0.9]);
    return {
      id: uid('prob'),
      topic: 'probability',
      difficulty: d,
      question: `ההסתברות שדנה תקלע לסל היא $${p}$, וההסתברות שיוסי יקלע היא $${q}$ (באופן בלתי תלוי). מה ההסתברות שלפחות אחד מהם יקלע?`,
      diagram: 'c-tree',
      answer: { kind: 'numbers', values: [1 - (1 - p) * (1 - q)], tol: 1e-9 },
      answerDisplay: `$1 - (1 - ${p})(1 - ${q}) = ${r2(1 - (1 - p) * (1 - q))}$`,
      hints: {
        direction: '"לפחות אחד" – כדאי לחשב דרך המאורע המשלים.',
        tool: '$P(\\text{לפחות אחד}) = 1 - P(\\text{אף אחד})$, ובמאורעות בלתי תלויים כופלים הסתברויות.',
        next: `ההסתברות ששניהם יחטיאו: $(1 - ${p})(1 - ${q})$.`,
      },
      steps: [
        { title: 'ההסתברות ששניהם מחטיאים', tex: `(1 - ${p})\\cdot(1 - ${q}) = ${r2((1 - p) * (1 - q))}` },
        { title: 'מאורע משלים', tex: `P = 1 - ${r2((1 - p) * (1 - q))} = ${r2(1 - (1 - p) * (1 - q))}` },
      ],
    };
  }
  const n = int(rng, 4, 6),
    k = int(rng, 1, n - 1);
  const p = pick(rng, [0.5, 0.2, 0.3, 0.6]);
  const val = binom(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  return {
    id: uid('binom'),
    topic: 'probability',
    difficulty: d,
    question: `ההסתברות להצלחה בניסוי היא $${p}$. חוזרים על הניסוי $${n}$ פעמים באופן בלתי תלוי. מה ההסתברות לבדיוק $${k}$ הצלחות? (עגלו ל-4 ספרות)`,
    diagram: 'c-binomial-chart',
    answer: { kind: 'numbers', values: [val], tol: 0.0006 },
    answerDisplay: `$\\binom{${n}}{${k}}\\cdot ${p}^{${k}}\\cdot ${r2(1 - p)}^{${n - k}} \\approx ${Math.round(val * 10000) / 10000}$`,
    hints: { direction: 'ניסוי חוזר עם שתי תוצאות – התפלגות בינומית.', tool: 'נוסחת ברנולי: $P_n(k) = \\binom{n}{k}p^k(1 - p)^{n - k}$.', next: `$\\binom{${n}}{${k}} = ${binom(n, k)}$.` },
    steps: [{ title: 'נוסחת ברנולי', tex: `P_{${n}}(${k}) = ${binom(n, k)}\\cdot ${p}^{${k}}\\cdot ${r2(1 - p)}^{${n - k}} \\approx ${Math.round(val * 10000) / 10000}` }],
  };
}

export function conditionalProbability(rng: Rng, d: Difficulty): Exercise {
  const a = int(rng, 1, 4) / 10,
    b = int(rng, 1, 4) / 10;
  const c = int(rng, 1, 3) / 10;
  const total = a + b + c;
  if (total >= 0.95) return conditionalProbability(rng, d);
  // table: P(A∩B)=a, P(A∩B̄)=b, P(Ā∩B)=c, P(Ā∩B̄)=1-a-b-c
  const pB = a + c;
  return {
    id: uid('cond'),
    topic: 'probability',
    difficulty: d,
    question: `בכיתה: $P(A \\cap B) = ${a}$, $P(A \\cap \\bar{B}) = ${b}$, $P(\\bar{A} \\cap B) = ${c}$. חשבו את $P(A \\mid B)$ (עגלו לשתי ספרות).`,
    diagram: 'c-two-way-table',
    answer: { kind: 'numbers', values: [a / pB], tol: 0.006 },
    answerDisplay: `$P(A \\mid B) = \\frac{${a}}{${r2(pB)}} \\approx ${r2(a / pB)}$`,
    hints: { direction: 'כדאי לבנות טבלה דו-ממדית.', tool: '$P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}$.', next: `$P(B) = P(A \\cap B) + P(\\bar{A} \\cap B) = ${a} + ${c}$.` },
    steps: [
      { title: 'מחשבים את $P(B)$', tex: `P(B) = ${a} + ${c} = ${r2(pB)}` },
      { title: 'נוסחת ההסתברות המותנית', tex: `P(A \\mid B) = \\frac{${a}}{${r2(pB)}} \\approx ${r2(a / pB)}` },
    ],
  };
}

export function statisticsEx(rng: Rng, d: Difficulty): Exercise {
  const n = d === 1 ? 5 : 6;
  const data = Array.from({ length: n }, () => int(rng, 2, 20));
  const sorted = [...data].sort((x, y) => x - y);
  const mean = data.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const list = data.join(',\\ ');
  if (d === 1)
    return {
      id: uid('stat'),
      topic: 'statistics',
      difficulty: d,
      question: `מצאו את הממוצע ואת החציון של הנתונים: $${list}$.`,
      diagram: 'c-median-sorted',
      answer: { kind: 'numbers', values: [mean, median], tol: 0.002 },
      answerDisplay: `ממוצע $${r2(mean)}$, חציון $${median}$`,
      inputHint: 'ממוצע, חציון (קודם הממוצע)',
      hints: { direction: 'ממוצע – סכום חלקי מספר הנתונים. חציון – הערך האמצעי אחרי סידור.', tool: '$\\bar{x} = \\frac{\\sum x_i}{n}$.', next: 'סדרו את הנתונים מהקטן לגדול.' },
      steps: [
        { title: 'ממוצע', tex: `\\bar{x} = \\frac{${data.join('+')}}{${n}} = ${r2(mean)}` },
        { title: 'מסדרים לחציון', tex: `${sorted.join(',\\ ')} \\Rightarrow \\text{חציון} = ${median}` },
      ],
    };
  const sd = Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return {
    id: uid('stat'),
    topic: 'statistics',
    difficulty: d,
    question: `חשבו את סטיית התקן של הנתונים: $${list}$ (עגלו לשתי ספרות).`,
    diagram: 'c-std',
    answer: { kind: 'numbers', values: [sd], tol: 0.003 },
    answerDisplay: `$\\sigma \\approx ${r2(sd)}$ (ממוצע $${r2(mean)}$)`,
    hints: { direction: 'קודם מחשבים את הממוצע.', tool: '$\\sigma = \\sqrt{\\frac{\\sum (x_i - \\bar{x})^2}{n}}$.', next: `הממוצע הוא $${r2(mean)}$. חשבו את ריבוע המרחק של כל נתון ממנו.` },
    steps: [
      { title: 'ממוצע', tex: `\\bar{x} = ${r2(mean)}` },
      { title: 'שונות', tex: `\\sigma^2 = \\frac{${data.map((x) => `(${x} - ${r2(mean)})^2`).join(' + ')}}{${n}} \\approx ${r2(sd * sd)}` },
      { title: 'סטיית תקן', tex: `\\sigma = \\sqrt{${r2(sd * sd)}} \\approx ${r2(sd)}` },
    ],
  };
}

export function normalDistributionEx(rng: Rng, d: Difficulty): Exercise {
  const mu = pick(rng, [60, 70, 75, 80]),
    sigma = pick(rng, [5, 8, 10]);
  const k = pick(rng, [1, 2]);
  const above = rng() < 0.5;
  const pct = k === 1 ? (above ? 15.87 : 84.13) : above ? 2.28 : 97.72;
  return {
    id: uid('normal'),
    topic: 'statistics',
    difficulty: d,
    question: `ציוני מבחן מתפלגים נורמלית עם ממוצע $${mu}$ וסטיית תקן $${sigma}$. כמה אחוזים מהתלמידים קיבלו ציון ${above ? 'גבוה' : 'נמוך'} מ-$${mu + k * sigma}$?`,
    diagram: 'c-normal',
    answer: { kind: 'numbers', values: [pct], tol: 0.005 },
    answerDisplay: `$${pct}\\%$`,
    inputHint: 'אחוזים (בלי הסימן %)',
    hints: {
      direction: `$${mu + k * sigma}$ נמצא $${k}$ סטיות תקן מעל הממוצע.`,
      tool: 'בין $\\mu$ ל-$\\mu + \\sigma$: 34.13%. בין $\\mu + \\sigma$ ל-$\\mu + 2\\sigma$: 13.59%. מעל $\\mu$: 50%.',
      next: 'סמנו את האזור על עקומת הפעמון וחברו את האחוזים.',
    },
    steps: [
      { title: 'ציון תקן', tex: `z = \\frac{${mu + k * sigma} - ${mu}}{${sigma}} = ${k}` },
      { title: 'מחברים אחוזים', tex: above ? (k === 1 ? '50\\% - 34.13\\% = 15.87\\%' : '50\\% - 34.13\\% - 13.59\\% = 2.28\\%') : k === 1 ? '50\\% + 34.13\\% = 84.13\\%' : '50\\% + 34.13\\% + 13.59\\% = 97.72\\%' },
    ],
  };
}

export function analyticEx(rng: Rng, d: Difficulty): Exercise {
  const kind = pick(rng, d === 1 ? ['mid', 'dist'] : ['mid', 'dist', 'circle']);
  const x1 = int(rng, -6, 6),
    y1 = int(rng, -6, 6);
  if (kind === 'mid') {
    const x2 = int(rng, -6, 6),
      y2 = int(rng, -6, 6);
    return {
      id: uid('mid'),
      topic: 'analytic',
      difficulty: d,
      question: `מצאו את אמצע הקטע $AB$, כאשר $A(${x1}, ${y1})$ ו-$B(${x2}, ${y2})$.`,
      diagram: 'c-midpoint-coord',
      answer: { kind: 'numbers', values: [(x1 + x2) / 2, (y1 + y2) / 2] },
      answerDisplay: `$M(${(x1 + x2) / 2},\\ ${(y1 + y2) / 2})$`,
      inputHint: 'x, y',
      hints: { direction: 'אמצע הקטע הוא "ממוצע" של הנקודות.', tool: '$M\\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}\\right)$.', next: `$x_M = \\frac{${x1} + ${x2}}{2}$.` },
      steps: [{ title: 'נוסחת אמצע קטע', tex: `M\\left(\\frac{${x1} + ${x2}}{2},\\ \\frac{${y1} + ${y2}}{2}\\right) = (${(x1 + x2) / 2},\\ ${(y1 + y2) / 2})` }],
    };
  }
  if (kind === 'dist') {
    const [a, b, c] = pick(rng, [
      [3, 4, 5],
      [6, 8, 10],
      [5, 12, 13],
      [8, 6, 10],
    ]);
    const sx = pick(rng, [1, -1]),
      sy = pick(rng, [1, -1]);
    const x2 = x1 + sx * a,
      y2 = y1 + sy * b;
    return {
      id: uid('dist'),
      topic: 'analytic',
      difficulty: d,
      question: `מצאו את המרחק בין הנקודות $A(${x1}, ${y1})$ ו-$B(${x2}, ${y2})$.`,
      diagram: 'c-distance',
      answer: { kind: 'numbers', values: [c] },
      answerDisplay: `$AB = ${c}$`,
      hints: { direction: 'המרחק הוא היתר במשולש ישר זווית.', tool: '$d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$.', next: `$\\Delta x = ${x2 - x1}$, $\\Delta y = ${y2 - y1}$.` },
      steps: [{ title: 'נוסחת המרחק', tex: `d = \\sqrt{(${x2 - x1})^2 + (${y2 - y1})^2} = \\sqrt{${c * c}} = ${c}` }],
    };
  }
  const a = int(rng, -4, 4),
    b = int(rng, -4, 4),
    R = int(rng, 2, 7);
  const D = -2 * a,
    E = -2 * b,
    F = a * a + b * b - R * R;
  const t = (k: number, v: string) => (k === 0 ? '' : `${k > 0 ? '+' : '-'} ${Math.abs(k)}${v}`);
  return {
    id: uid('circle'),
    topic: 'analytic',
    difficulty: d,
    question: `מצאו את המרכז ואת הרדיוס של המעגל $x^2 + y^2 ${t(D, 'x')} ${t(E, 'y')} ${t(F, '')} = 0$.`,
    diagram: 'c-circle-eq',
    answer: { kind: 'numbers', values: [a, b, R] },
    answerDisplay: `מרכז $(${a}, ${b})$, רדיוס $${R}$`,
    inputHint: 'x של המרכז, y של המרכז, רדיוס',
    hints: { direction: 'משלימים לריבוע כדי להגיע לצורה $(x - a)^2 + (y - b)^2 = R^2$.', tool: '$x^2 + Dx = \\left(x + \\frac{D}{2}\\right)^2 - \\frac{D^2}{4}$.', next: `השלימו לריבוע את האיברים עם $x$: $x^2 ${t(D, 'x')}$.` },
    steps: [
      { title: 'השלמה לריבוע', tex: `(x ${a > 0 ? '-' : '+'} ${Math.abs(a)})^2 + (y ${b > 0 ? '-' : '+'} ${Math.abs(b)})^2 = ${R * R}` },
      { title: 'קוראים את המרכז והרדיוס', tex: `M(${a}, ${b}),\\quad R = \\sqrt{${R * R}} = ${R}` },
    ],
  };
}

export function vectorsEx(rng: Rng, d: Difficulty): Exercise {
  const u = [nonZero(rng, -4, 4), int(rng, -4, 4), d === 1 ? 0 : int(rng, -3, 3)];
  const v = [int(rng, -4, 4), nonZero(rng, -4, 4), d === 1 ? 0 : int(rng, -3, 3)];
  const vt = (w: number[]) => `(${w.join(', ')})`;
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  if (d === 1) {
    const [a, b, c] = pick(rng, [
      [3, 4, 5],
      [6, 8, 10],
      [5, 12, 13],
    ]);
    return {
      id: uid('vec'),
      topic: 'vectors',
      difficulty: d,
      question: `מצאו את הגודל של הוקטור $\\vec{u} = (${a}, ${b})$.`,
      diagram: 'c-vector-components',
      answer: { kind: 'numbers', values: [c] },
      answerDisplay: `$|\\vec{u}| = ${c}$`,
      hints: { direction: 'גודל וקטור = אורך החץ.', tool: '$|\\vec{u}| = \\sqrt{x^2 + y^2}$.', next: `$\\sqrt{${a}^2 + ${b}^2}$.` },
      steps: [{ title: 'נוסחת הגודל', tex: `|\\vec{u}| = \\sqrt{${a}^2 + ${b}^2} = ${c}` }],
    };
  }
  if (d === 2)
    return {
      id: uid('vec'),
      topic: 'vectors',
      difficulty: d,
      question: `חשבו את המכפלה הסקלרית של $\\vec{u} = ${vt(u)}$ ו-$\\vec{v} = ${vt(v)}$.`,
      diagram: 'c-dot-product',
      answer: { kind: 'numbers', values: [dot] },
      answerDisplay: `$\\vec{u}\\cdot\\vec{v} = ${dot}$`,
      hints: { direction: 'מכפילים רכיב ברכיב ומחברים.', tool: '$\\vec{u}\\cdot\\vec{v} = x_1x_2 + y_1y_2 + z_1z_2$.', next: `$${u[0]}\\cdot(${v[0]}) + \\dots$` },
      steps: [{ title: 'מכפלה סקלרית', tex: `${u[0]}\\cdot(${v[0]}) + ${u[1]}\\cdot(${v[1]}) + ${u[2]}\\cdot(${v[2]}) = ${dot}` }],
    };
  const lu = Math.sqrt(u.reduce((s, x) => s + x * x, 0));
  const lv = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  const ang = (Math.acos(dot / (lu * lv)) * 180) / Math.PI;
  return {
    id: uid('vec'),
    topic: 'vectors',
    difficulty: d,
    question: `מצאו את הזווית בין $\\vec{u} = ${vt(u)}$ ל-$\\vec{v} = ${vt(v)}$ (במעלות, עגלו לספרה אחת).`,
    diagram: 'c-dot-product',
    answer: { kind: 'numbers', values: [ang], tol: 0.002 },
    answerDisplay: `$\\theta \\approx ${Math.round(ang * 10) / 10}^\\circ$`,
    hints: { direction: 'הזווית קשורה למכפלה הסקלרית.', tool: '$\\cos\\theta = \\frac{\\vec{u}\\cdot\\vec{v}}{|\\vec{u}||\\vec{v}|}$.', next: `המכפלה הסקלרית היא $${dot}$.` },
    steps: [
      { title: 'מכפלה סקלרית וגדלים', tex: `\\vec{u}\\cdot\\vec{v} = ${dot},\\ |\\vec{u}| = \\sqrt{${u.reduce((s, x) => s + x * x, 0)}},\\ |\\vec{v}| = \\sqrt{${v.reduce((s, x) => s + x * x, 0)}}` },
      { title: 'הזווית', tex: `\\cos\\theta = \\frac{${dot}}{${r2(lu * lv)}} \\Rightarrow \\theta \\approx ${Math.round(ang * 10) / 10}^\\circ` },
    ],
  };
}

export function complexEx(rng: Rng, d: Difficulty): Exercise {
  const a = nonZero(rng, -5, 5),
    b = nonZero(rng, -5, 5),
    c = nonZero(rng, -4, 4),
    e = nonZero(rng, -4, 4);
  const z = (x: number, y: number) => `${x} ${y < 0 ? '-' : '+'} ${Math.abs(y) === 1 ? '' : Math.abs(y)}i`;
  if (d === 1) {
    const [p, q, m] = pick(rng, [
      [3, 4, 5],
      [6, 8, 10],
      [5, 12, 13],
    ]);
    const sp = pick(rng, [1, -1]),
      sq = pick(rng, [1, -1]);
    return {
      id: uid('cx'),
      topic: 'complex',
      difficulty: d,
      question: `מצאו את הערך המוחלט של $z = ${z(sp * p, sq * q)}$.`,
      diagram: 'c-complex-polar',
      answer: { kind: 'numbers', values: [m] },
      answerDisplay: `$|z| = ${m}$`,
      hints: { direction: 'הערך המוחלט הוא המרחק מהראשית.', tool: '$|a + bi| = \\sqrt{a^2 + b^2}$.', next: `$\\sqrt{${p}^2 + ${q}^2}$.` },
      steps: [{ title: 'ערך מוחלט', tex: `|z| = \\sqrt{${sp * p}^2 + (${sq * q})^2} = ${m}` }],
    };
  }
  const re = a * c - b * e,
    im = a * e + b * c;
  if (d === 2)
    return {
      id: uid('cx'),
      topic: 'complex',
      difficulty: d,
      question: `חשבו: $(${z(a, b)})(${z(c, e)})$. כתבו את החלק הממשי ואת החלק המדומה.`,
      diagram: 'c-complex-plane',
      answer: { kind: 'numbers', values: [re, im] },
      answerDisplay: `$${z(re, im)}$`,
      inputHint: 'חלק ממשי, חלק מדומה',
      hints: { direction: 'פותחים סוגריים כמו בביטוי אלגברי.', tool: 'זכרו: $i^2 = -1$.', next: `$${a}\\cdot${c} + ${a}\\cdot${e}i + ${b}i\\cdot${c} + ${b}\\cdot${e}i^2$.` },
      steps: [
        { title: 'פותחים סוגריים', tex: `${a * c} ${a * e >= 0 ? '+' : '-'} ${Math.abs(a * e)}i ${b * c >= 0 ? '+' : '-'} ${Math.abs(b * c)}i ${b * e >= 0 ? '+' : '-'} ${Math.abs(b * e)}i^2` },
        { title: '$i^2 = -1$ ומכנסים', tex: z(re, im) },
      ],
    };
  // division
  const den = c * c + e * e;
  const qre = (a * c + b * e) / den,
    qim = (b * c - a * e) / den;
  return {
    id: uid('cx'),
    topic: 'complex',
    difficulty: d,
    question: `חשבו: $\\frac{${z(a, b)}}{${z(c, e)}}$. כתבו את החלק הממשי ואת החלק המדומה (שברים או עשרוניים).`,
    diagram: 'c-conjugate',
    answer: { kind: 'numbers', values: [qre, qim], tol: 1e-4 },
    answerDisplay: `$${frTex(a * c + b * e, den)} ${qim < 0 ? '-' : '+'} ${frTex(Math.abs(b * c - a * e), den)}i$`,
    inputHint: 'חלק ממשי, חלק מדומה',
    hints: { direction: 'מחלקים מרוכבים בעזרת הצמוד של המכנה.', tool: 'כופלים מונה ומכנה ב-$\\bar{w}$: $w\\bar{w} = |w|^2$.', next: `הצמוד של המכנה: $${z(c, -e)}$.` },
    steps: [
      { title: 'כופלים בצמוד', tex: `\\frac{(${z(a, b)})(${z(c, -e)})}{${c}^2 + ${e}^2}` },
      { title: 'מפשטים', tex: `= \\frac{${a * c + b * e} ${b * c - a * e >= 0 ? '+' : '-'} ${Math.abs(b * c - a * e)}i}{${den}}` },
    ],
  };
}

export { shuffle };
