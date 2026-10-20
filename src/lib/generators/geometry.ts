import { getDiagram, theoremById } from '../../data';
import type { DiagramElement, DiagramSpec, ProofStep } from '../../types';
import { type Exercise, type Difficulty, type Rng, int, pick, shuffle } from './types';

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Clones a diagram, sets angle labels (in order of the angle elements), adds segment labels and removes formula texts. */
function labeled(id: string, angleLabels: (string | null)[] = [], segLabels: Record<string, string> = {}, keepText = false): DiagramSpec {
  const base = getDiagram(id);
  if (!base) throw new Error(`missing diagram ${id}`);
  const spec: DiagramSpec = JSON.parse(JSON.stringify(base));
  spec.id = `${id}-ex`;
  let ai = 0;
  const elements: DiagramElement[] = [];
  for (const el of spec.elements) {
    if (el.t === 'text' && !keepText) continue;
    if (el.t === 'seglabel') continue;
    if (el.t === 'angle') {
      const lbl = angleLabels[ai++];
      if (lbl === null) continue;
      elements.push({ ...el, label: lbl ?? undefined });
      continue;
    }
    elements.push(el);
  }
  for (const [seg, s] of Object.entries(segLabels)) {
    const [a, b] = seg.split('-');
    elements.push({ t: 'seglabel', p: [a, b], s });
  }
  spec.elements = elements;
  return spec;
}

/** A proof step citing a theorem by id, using its official citation wording. */
function cite(claim: string, theoremId: string, extra = ''): ProofStep {
  const t = theoremById.get(theoremId);
  if (!t) throw new Error(`unknown theorem ${theoremId}`);
  return { claim, reason: `${t.citation}${extra}`, ref: theoremId };
}
const given = (claim: string): ProofStep => ({ claim, reason: 'נתון' });
const calc = (claim: string, reason = 'חישוב'): ProofStep => ({ claim, reason });

function geo(
  topic: string,
  d: Difficulty,
  question: string,
  diagram: DiagramSpec | string,
  values: number[],
  answerDisplay: string,
  proof: ProofStep[],
  hints: Exercise['hints'],
  tol?: number,
): Exercise {
  return {
    id: uid(topic),
    topic,
    difficulty: d,
    question,
    diagram,
    answer: { kind: 'numbers', values, tol },
    answerDisplay,
    proof,
    hints,
  };
}

const deg = (x: number) => `${x}^\\circ`;

export function parallelAngles(rng: Rng, d: Difficulty): Exercise {
  const a = int(rng, 35, 80);
  const kind = pick(rng, d === 1 ? ['corresponding', 'alternate'] : ['corresponding', 'alternate', 'co-interior']) as 'corresponding' | 'alternate' | 'co-interior';
  const ans = kind === 'co-interior' ? 180 - a : a;
  const thm = kind === 'corresponding' ? 'corresponding-angles' : kind === 'alternate' ? 'alternate-angles' : 'co-interior-angles';
  const name = kind === 'corresponding' ? 'מתאימות' : kind === 'alternate' ? 'מתחלפות' : 'חד-צדדיות';
  return geo(
    'angles',
    d,
    `בשרטוט $a \\parallel b$, והישר החותך יוצר בנקודה $A$ זווית של $${deg(a)}$. מצאו את הזווית $x$ בנקודה $B$.`,
    labeled(kind, [deg(a), 'x']),
    [ans],
    `$x = ${deg(ans)}$`,
    [given('a \\parallel b'), cite(kind === 'co-interior' ? `x + ${deg(a)} = 180^\\circ` : `x = ${deg(a)}`, thm), ...(kind === 'co-interior' ? [calc(`x = ${deg(ans)}`)] : [])].map((s) => ({ ...s, claim: `$${s.claim}$` })),
    {
      direction: 'יש שני ישרים מקבילים וחותך. מחפשים קשר בין שתי הזוויות.',
      tool: `הזוויות הן ${name}. ${kind === 'co-interior' ? 'בין מקבילים סכומן 180°.' : 'בין מקבילים הן שוות.'}`,
      next: 'זהו את סוג זוג הזוויות לפי המיקום שלהן ביחס לחותך ולמקבילים.',
    },
  );
}

export function verticalAngles(rng: Rng, d: Difficulty): Exercise {
  const x = int(rng, 8, 25);
  const p = int(rng, 2, 4),
    q = p + int(rng, 1, 3);
  const angle = q * x - int(rng, 5, 20);
  const c1 = angle - p * x;
  const c2 = angle - q * x;
  if (angle <= 20 || angle >= 160) return verticalAngles(rng, d);
  const e1 = `${p}x ${c1 >= 0 ? '+' : '-'} ${Math.abs(c1)}^\\circ`;
  const e2 = `${q}x ${c2 >= 0 ? '+' : '-'} ${Math.abs(c2)}^\\circ`;
  const other = 180 - angle;
  return geo(
    'angles',
    d,
    `שני ישרים נחתכים. שתי זוויות קודקודיות הן $${e1}$ ו-$${e2}$. מצאו את $x$ ואת הזווית הצמודה להן.`,
    labeled('vertical', ['α', 'α', 'β', 'β']),
    [x, other],
    `$x = ${x}$, הזוויות הן $${deg(angle)}$ והזווית הצמודה $${deg(other)}$`,
    [
      cite(`$${e1} = ${e2}$`, 'vertical-angles'),
      calc(`$x = ${x}$`, 'פתרון המשוואה'),
      calc(`$\\alpha = ${deg(angle)}$`, 'הצבה'),
      cite(`$\\beta = 180^\\circ - ${deg(angle)} = ${deg(other)}$`, 'adjacent-angles'),
    ],
    { direction: 'שתי הזוויות קודקודיות. מה ידוע על זוויות קודקודיות?', tool: 'זוויות קודקודיות שוות, וסכום זוויות צמודות 180°.', next: `השוו: $${e1} = ${e2}$.` },
  );
}

export function triangleAngles(rng: Rng, d: Difficulty): Exercise {
  if (d === 1 || rng() < 0.4) {
    const A = int(rng, 30, 80),
      B = int(rng, 30, 160 - A);
    const C = 180 - A - B;
    return geo(
      'triangles',
      d,
      `במשולש $ABC$: $\\angle A = ${deg(A)}$ ו-$\\angle B = ${deg(B)}$. מצאו את $\\angle C$.`,
      labeled('triangle-sum', [deg(A), deg(B), '?']),
      [C],
      `$\\angle C = ${deg(C)}$`,
      [cite(`$${deg(A)} + ${deg(B)} + \\angle C = 180^\\circ$`, 'triangle-angle-sum'), calc(`$\\angle C = ${deg(C)}$`)],
      { direction: 'ידועות שתי זוויות במשולש.', tool: 'סכום הזוויות במשולש הוא 180°.', next: `חשבו: $180^\\circ - ${A}^\\circ - ${B}^\\circ$.` },
    );
  }
  const A = int(rng, 30, 70),
    B = int(rng, 30, 70);
  return geo(
    'triangles',
    d,
    `במשולש $ABC$ מאריכים את $BC$ עד $D$. נתון $\\angle A = ${deg(A)}$ ו-$\\angle B = ${deg(B)}$. מצאו את $\\angle ACD$.`,
    labeled('exterior-angle', [deg(A), deg(B), '?']),
    [A + B],
    `$\\angle ACD = ${deg(A + B)}$`,
    [cite(`$\\angle ACD = \\angle A + \\angle B$`, 'exterior-angle'), calc(`$\\angle ACD = ${deg(A)} + ${deg(B)} = ${deg(A + B)}$`)],
    { direction: 'הזווית $ACD$ היא זווית חיצונית למשולש.', tool: 'זווית חיצונית שווה לסכום שתי הזוויות הפנימיות שאינן צמודות לה.', next: 'אילו שתי זוויות פנימיות אינן צמודות ל-$\\angle ACD$?' },
  );
}

export function isoscelesAngles(rng: Rng, d: Difficulty): Exercise {
  if (d === 1 || rng() < 0.5) {
    const apex = 2 * int(rng, 10, 70);
    const base = (180 - apex) / 2;
    return geo(
      'isosceles',
      d,
      `במשולש $ABC$ נתון $AB = AC$ ו-$\\angle A = ${deg(apex)}$. מצאו את $\\angle B$.`,
      labeled('isosceles', ['?', null]),
      [base],
      `$\\angle B = ${deg(base)}$`,
      [
        given('$AB = AC$'),
        cite('$\\angle B = \\angle C$', 'isosceles-base-angles'),
        cite(`$${deg(apex)} + 2\\angle B = 180^\\circ$`, 'triangle-angle-sum'),
        calc(`$\\angle B = ${deg(base)}$`),
      ],
      { direction: 'המשולש שווה שוקיים. מה ידוע על זוויות הבסיס?', tool: 'במשולש שווה שוקיים זוויות הבסיס שוות, וסכום הזוויות הוא 180°.', next: 'סמנו את זוויות הבסיס ב-$x$ וכתבו משוואה.' },
    );
  }
  const base = int(rng, 25, 80);
  return geo(
    'isosceles',
    d,
    `במשולש $ABC$ נתון $AB = AC$ ו-$\\angle B = ${deg(base)}$. מצאו את $\\angle A$.`,
    labeled('isosceles', [deg(base), null]),
    [180 - 2 * base],
    `$\\angle A = ${deg(180 - 2 * base)}$`,
    [given('$AB = AC$'), cite(`$\\angle C = \\angle B = ${deg(base)}$`, 'isosceles-base-angles'), cite(`$\\angle A = 180^\\circ - 2\\cdot${deg(base)} = ${deg(180 - 2 * base)}$`, 'triangle-angle-sum')],
    { direction: 'המשולש שווה שוקיים.', tool: 'זוויות הבסיס שוות, וסכום הזוויות הוא 180°.', next: 'מה גודל $\\angle C$?' },
  );
}

const TRIPLES = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [6, 8, 10],
  [9, 12, 15],
  [20, 21, 29],
];

export function pythagorasEx(rng: Rng, d: Difficulty): Exercise {
  const [a, b, c] = pick(rng, TRIPLES).map((x) => x * (d === 1 ? 1 : pick(rng, [1, 2])));
  if (d === 1 || rng() < 0.5)
    return geo(
      'right-triangle',
      d,
      `במשולש ישר זווית הניצבים הם $${a}$ ו-$${b}$. מצאו את היתר.`,
      labeled('pythagoras', [], { 'C-B': String(a), 'C-A': String(b), 'A-B': 'c' }),
      [c],
      `$c = ${c}$`,
      [given(`$\\angle C = 90^\\circ$`), cite(`$c^2 = ${a}^2 + ${b}^2 = ${c * c}$`, 'pythagoras'), calc(`$c = ${c}$`, 'אורך חיובי')],
      { direction: 'משולש ישר זווית, ידועים שני ניצבים.', tool: 'משפט פיתגורס: $a^2 + b^2 = c^2$.', next: `חשבו $${a}^2 + ${b}^2$.` },
    );
  return geo(
    'right-triangle',
    d,
    `במשולש ישר זווית היתר הוא $${c}$ וניצב אחד הוא $${a}$. מצאו את הניצב השני.`,
    labeled('pythagoras', [], { 'C-B': String(a), 'C-A': 'b', 'A-B': String(c) }),
    [b],
    `$b = ${b}$`,
    [cite(`$${a}^2 + b^2 = ${c}^2$`, 'pythagoras'), calc(`$b^2 = ${c * c} - ${a * a} = ${b * b}$`), calc(`$b = ${b}$`, 'אורך חיובי')],
    { direction: 'ידועים היתר וניצב.', tool: 'משפט פיתגורס, כשהיתר בצד הנפרד: $c^2 = a^2 + b^2$.', next: `$b^2 = ${c}^2 - ${a}^2$.` },
  );
}

export function rightTriangleSpecial(rng: Rng, d: Difficulty): Exercise {
  if (rng() < 0.5) {
    const hyp = 2 * int(rng, 3, 15);
    return geo(
      'right-triangle',
      d,
      `במשולש $ABC$ $\\angle C = 90^\\circ$, ו-$M$ אמצע היתר $AB$. נתון $AB = ${hyp}$. מצאו את $CM$.`,
      labeled('median-hypotenuse', []),
      [hyp / 2],
      `$CM = ${hyp / 2}$`,
      [given('$\\angle C = 90^\\circ,\\ AM = MB$'), cite(`$CM = \\tfrac12 AB = ${hyp / 2}$`, 'median-hypotenuse')],
      { direction: 'יש משולש ישר זווית ותיכון ליתר.', tool: 'במשולש ישר זווית התיכון ליתר שווה למחצית היתר.', next: 'חשבו חצי מהיתר.' },
    );
  }
  const hyp = 2 * int(rng, 3, 15);
  return geo(
    'right-triangle',
    d,
    `במשולש $ABC$ $\\angle C = 90^\\circ$, $\\angle B = 30^\\circ$ ו-$AB = ${hyp}$. מצאו את $AC$.`,
    labeled('thirty-sixty', ['30°', null]),
    [hyp / 2],
    `$AC = ${hyp / 2}$`,
    [given('$\\angle C = 90^\\circ,\\ \\angle B = 30^\\circ$'), cite(`$AC = \\tfrac12 AB = ${hyp / 2}$`, 'thirty-sixty-ninety')],
    { direction: 'משולש ישר זווית עם זווית של 30°.', tool: 'הניצב שמול זווית של 30° שווה למחצית היתר.', next: 'איזה ניצב נמצא מול הזווית של 30°?' },
  );
}

export function midsegmentEx(rng: Rng, d: Difficulty): Exercise {
  const bc = 2 * int(rng, 3, 15);
  if (d === 1 || rng() < 0.5)
    return geo(
      'triangles',
      d,
      `ב-$\\triangle ABC$ הנקודות $D$ ו-$E$ הן אמצעי $AB$ ו-$AC$, ו-$BC = ${bc}$. מצאו את $DE$.`,
      labeled('midsegment', [], { 'B-C': String(bc) }),
      [bc / 2],
      `$DE = ${bc / 2}$`,
      [given('$AD = DB,\\ AE = EC$'), cite(`$DE = \\tfrac12 BC = ${bc / 2}$`, 'midsegment-triangle')],
      { direction: 'יש שתי נקודות אמצע של צלעות.', tool: 'קטע אמצעים במשולש מקביל לצלע השלישית ושווה למחציתה.', next: 'חשבו חצי מ-$BC$.' },
    );
  const de = int(rng, 3, 12);
  return geo(
    'triangles',
    d,
    `ב-$\\triangle ABC$, $D$ אמצע $AB$, ודרכו עובר ישר המקביל ל-$BC$ וחותך את $AC$ ב-$E$. נתון $DE = ${de}$. מצאו את $BC$.`,
    labeled('midline-converse', [], { 'D-E': String(de) }),
    [2 * de],
    `$BC = ${2 * de}$`,
    [
      given('$AD = DB,\\ DE \\parallel BC$'),
      cite('$AE = EC$', 'midline-converse-triangle'),
      cite(`$BC = 2\\cdot DE = ${2 * de}$`, 'midsegment-triangle'),
    ],
    { direction: 'קודם צריך להוכיח ש-$E$ היא אמצע.', tool: 'ישר מאמצע צלע ומקביל לצלע אחרת חוצה את הצלע השלישית. אחר כך – קטע אמצעים.', next: 'מה אפשר להסיק על הנקודה $E$?' },
  );
}

export function quadrilateralEx(rng: Rng, d: Difficulty): Exercise {
  const kind = pick(rng, d === 1 ? ['para', 'trap'] : ['para', 'rhombus', 'trap']);
  if (kind === 'para') {
    const A = int(rng, 40, 85);
    return geo(
      'quadrilaterals',
      d,
      `במקבילית $ABCD$ נתון $\\angle A = ${deg(A)}$. מצאו את $\\angle B$ ואת $\\angle C$.`,
      labeled('parallelogram-angles', [deg(A), null, '?', null]),
      [180 - A, A],
      `$\\angle B = ${deg(180 - A)},\\ \\angle C = ${deg(A)}$`,
      [
        given('$AD \\parallel BC$'),
        cite(`$\\angle B = 180^\\circ - ${deg(A)} = ${deg(180 - A)}$`, 'co-interior-angles'),
        cite(`$\\angle C = \\angle A = ${deg(A)}$`, 'parallelogram-opposite-angles'),
      ],
      { direction: 'במקבילית יש זוגות של צלעות מקבילות.', tool: 'זוויות נגדיות במקבילית שוות; זוויות סמוכות משלימות ל-180° (חד-צדדיות).', next: 'אילו זוויות נגדיות ואילו סמוכות?' },
    );
  }
  if (kind === 'rhombus') {
    const [a, b, c] = pick(rng, [
      [3, 4, 5],
      [5, 12, 13],
      [6, 8, 10],
      [8, 15, 17],
    ]);
    return geo(
      'quadrilaterals',
      d,
      `אורכי האלכסונים במעוין הם $${2 * a}$ ו-$${2 * b}$. מצאו את אורך הצלע.`,
      labeled('rhombus', []),
      [c],
      `$${c}$`,
      [
        cite(`$AO = ${a},\\ BO = ${b}$`, 'parallelogram-diagonals', ' (מעוין הוא מקבילית)'),
        cite('$\\angle AOB = 90^\\circ$', 'rhombus-diagonals-perpendicular'),
        cite(`$AB^2 = ${a}^2 + ${b}^2 = ${c * c} \\Rightarrow AB = ${c}$`, 'pythagoras'),
      ],
      { direction: 'האלכסונים במעוין יוצרים ארבעה משולשים ישרי זווית.', tool: 'האלכסונים במעוין חוצים זה את זה ומאונכים. אחר כך – פיתגורס.', next: 'מהם אורכי חצאי האלכסונים?' },
    );
  }
  const a = int(rng, 4, 12),
    b = a + 2 * int(rng, 1, 5);
  return geo(
    'quadrilaterals',
    d,
    `בסיסי טרפז הם $${a}$ ו-$${b}$. מצאו את אורך קטע האמצעים.`,
    labeled('trapezoid-midsegment', []),
    [(a + b) / 2],
    `$${(a + b) / 2}$`,
    [cite(`$EF = \\frac{${a} + ${b}}{2} = ${(a + b) / 2}$`, 'trapezoid-midsegment')],
    { direction: 'מחפשים קטע אמצעים בטרפז.', tool: 'קטע האמצעים בטרפז שווה למחצית סכום הבסיסים.', next: `חשבו $\\frac{${a} + ${b}}{2}$.` },
  );
}

export function similarityEx(rng: Rng, d: Difficulty): Exercise {
  const ad = int(rng, 2, 6),
    db = int(rng, 2, 8);
  const ab = ad + db;
  const bc = ab * int(rng, 1, 3);
  const de = (ad * bc) / ab;
  if (d < 3)
    return geo(
      'similarity',
      d,
      `ב-$\\triangle ABC$, $DE \\parallel BC$ ($D$ על $AB$, $E$ על $AC$). נתון $AD = ${ad}$, $DB = ${db}$, $BC = ${bc}$. מצאו את $DE$.`,
      labeled('thales-triangle', [], { 'A-D': String(ad), 'D-B': String(db), 'B-C': String(bc) }),
      [de],
      `$DE = ${Math.round(de * 1000) / 1000}$`,
      [given('$DE \\parallel BC$'), cite(`$\\frac{AD}{AB} = \\frac{DE}{BC}$`, 'thales-extended'), calc(`$\\frac{${ad}}{${ab}} = \\frac{DE}{${bc}} \\Rightarrow DE = ${Math.round(de * 1000) / 1000}$`, 'הצבה ופתרון')],
      { direction: 'ישר מקביל לצלע במשולש יוצר משולש דומה.', tool: 'משפט תאלס המורחב: $\\frac{AD}{AB} = \\frac{AE}{AC} = \\frac{DE}{BC}$.', next: `שימו לב: $AB = ${ad} + ${db}$.` },
      0.001,
    );
  const k = ab / ad;
  const s1 = int(rng, 2, 10);
  return geo(
    'similarity',
    d,
    `ב-$\\triangle ABC$, $DE \\parallel BC$, ו-$AD : AB = ${ad} : ${ab}$. שטח $\\triangle ADE$ הוא $${s1}$. מצאו את שטח $\\triangle ABC$.`,
    labeled('thales-triangle', []),
    [s1 * k * k],
    `$${Math.round(s1 * k * k * 1000) / 1000}$`,
    [
      cite('$\\triangle ADE \\sim \\triangle ABC$', 'similarity-aa', ' (זווית משותפת וזוויות מתאימות בין מקבילים)'),
      calc(`$k = \\frac{AB}{AD} = \\frac{${ab}}{${ad}}$`, 'יחס הדמיון'),
      cite(`$\\frac{S_{ABC}}{S_{ADE}} = k^2$`, 'similar-area-ratio'),
      calc(`$S_{ABC} = ${s1}\\cdot\\left(\\frac{${ab}}{${ad}}\\right)^2 = ${Math.round(s1 * k * k * 1000) / 1000}$`),
    ],
    { direction: 'המשולשים דומים. מה היחס בין השטחים?', tool: 'היחס בין שטחי משולשים דומים שווה לריבוע יחס הדמיון.', next: 'מצאו את יחס הדמיון $k = \\frac{AB}{AD}$.' },
    0.001,
  );
}

export function circleAngles(rng: Rng, d: Difficulty): Exercise {
  const kind = pick(rng, d === 1 ? ['central', 'cyclic'] : ['central', 'cyclic', 'diameter']);
  if (kind === 'central') {
    const c = 2 * int(rng, 25, 85);
    return geo(
      'circle',
      d,
      `במעגל שמרכזו $O$, $\\angle AOB = ${deg(c)}$, והנקודה $C$ על הקשת הגדולה. מצאו את $\\angle ACB$.`,
      labeled('circle-central-inscribed', ['?', deg(c)]),
      [c / 2],
      `$\\angle ACB = ${deg(c / 2)}$`,
      [cite(`$\\angle ACB = \\tfrac12\\angle AOB = ${deg(c / 2)}$`, 'inscribed-central')],
      { direction: 'יש זווית מרכזית וזווית היקפית על אותה קשת.', tool: 'זווית היקפית שווה למחצית הזווית המרכזית הנשענת על אותה קשת.', next: 'על איזו קשת נשענות שתי הזוויות?' },
    );
  }
  if (kind === 'cyclic') {
    const A = int(rng, 55, 125);
    return geo(
      'circle',
      d,
      `המרובע $ABCD$ חסום במעגל, ו-$\\angle A = ${deg(A)}$. מצאו את $\\angle C$.`,
      labeled('cyclic-quad', [deg(A), '?']),
      [180 - A],
      `$\\angle C = ${deg(180 - A)}$`,
      [cite(`$\\angle A + \\angle C = 180^\\circ$`, 'cyclic-quad-opposite'), calc(`$\\angle C = ${deg(180 - A)}$`)],
      { direction: 'המרובע חסום במעגל.', tool: 'במרובע החסום במעגל סכום זוויות נגדיות 180°.', next: 'איזו זווית נגדית ל-$\\angle A$?' },
    );
  }
  const [a, b, c] = pick(rng, TRIPLES);
  return geo(
    'circle',
    d,
    `$AB$ קוטר במעגל שרדיוסו $${c / 2}$, ו-$C$ נקודה על המעגל כך ש-$AC = ${a}$. מצאו את $BC$.`,
    labeled('inscribed-diameter', [], { 'A-C': String(a) }),
    [b],
    `$BC = ${b}$`,
    [cite('$\\angle ACB = 90^\\circ$', 'inscribed-diameter'), calc(`$AB = 2\\cdot ${c / 2} = ${c}$`, 'קוטר הוא פעמיים רדיוס'), cite(`$BC^2 = ${c}^2 - ${a}^2 = ${b * b} \\Rightarrow BC = ${b}$`, 'pythagoras')],
    { direction: 'יש קוטר ונקודה על המעגל.', tool: 'זווית היקפית הנשענת על קוטר היא ישרה. אחר כך – פיתגורס.', next: 'מה אפשר לומר על $\\angle ACB$?' },
  );
}

export function tangentsEx(rng: Rng, d: Difficulty): Exercise {
  const kind = pick(rng, d === 1 ? ['radius', 'chords'] : ['radius', 'chords', 'secant', 'two']);
  if (kind === 'radius') {
    const [a, b, c] = pick(rng, TRIPLES);
    return geo(
      'tangents',
      d,
      `$PA$ משיק למעגל שמרכזו $O$ ($A$ נקודת ההשקה). רדיוס המעגל $${a}$ ו-$PO = ${c}$. מצאו את $PA$.`,
      'two-tangents',
      [b],
      `$PA = ${b}$`,
      [cite('$\\angle OAP = 90^\\circ$', 'tangent-radius'), cite(`$PA^2 = ${c}^2 - ${a}^2 = ${b * b} \\Rightarrow PA = ${b}$`, 'pythagoras')],
      { direction: 'חברו את המרכז לנקודת ההשקה.', tool: 'משיק מאונך לרדיוס בנקודת ההשקה, ואז פיתגורס.', next: 'איזו זווית ישרה נוצרת?' },
    );
  }
  if (kind === 'chords') {
    const a = int(rng, 2, 8),
      b = int(rng, 2, 9),
      c = pick(rng, [1, 2, 3, 4, 6].filter((x) => (a * b) % x === 0));
    return geo(
      'tangents',
      d,
      `המיתרים $AB$ ו-$CD$ נחתכים בנקודה $E$. נתון $AE = ${a}$, $EB = ${b}$, $CE = ${c}$. מצאו את $ED$.`,
      labeled('intersecting-chords', [], { 'A-E': String(a), 'E-B': String(b), 'C-E': String(c) }),
      [(a * b) / c],
      `$ED = ${(a * b) / c}$`,
      [cite(`$${a}\\cdot ${b} = ${c}\\cdot ED$`, 'intersecting-chords'), calc(`$ED = ${(a * b) / c}$`)],
      { direction: 'שני מיתרים נחתכים בתוך המעגל.', tool: 'מכפלת קטעי מיתר אחד שווה למכפלת קטעי המיתר השני.', next: `$AE\\cdot EB = CE\\cdot ED$.` },
    );
  }
  if (kind === 'secant') {
    const outer = int(rng, 1, 4);
    const j = int(rng, 2, 4);
    const whole = outer * j * j;
    const pt = outer * j;
    return geo(
      'tangents',
      d,
      `מהנקודה $P$ יוצאים משיק $PT$ וחותך $PBA$. נתון $PB = ${outer}$ ו-$PA = ${whole}$. מצאו את $PT$.`,
      'tangent-secant',
      [pt],
      `$PT = ${pt}$`,
      [cite(`$PT^2 = ${whole}\\cdot ${outer} = ${whole * outer}$`, 'tangent-secant'), calc(`$PT = ${pt}$`, 'אורך חיובי')],
      { direction: 'יש משיק וחותך מאותה נקודה.', tool: 'ריבוע המשיק שווה למכפלת החותך בחלקו החיצוני.', next: '$PT^2 = PA \\cdot PB$.' },
    );
  }
  const P = 2 * int(rng, 15, 65);
  return geo(
    'tangents',
    d,
    `$PA$ ו-$PB$ משיקים למעגל. $\\angle APB = ${deg(P)}$. מצאו את $\\angle PAB$.`,
    'two-tangents',
    [(180 - P) / 2],
    `$\\angle PAB = ${deg((180 - P) / 2)}$`,
    [cite('$PA = PB$', 'two-tangents-equal'), cite('$\\angle PAB = \\angle PBA$', 'isosceles-base-angles'), cite(`$\\angle PAB = \\frac{180^\\circ - ${deg(P)}}{2} = ${deg((180 - P) / 2)}$`, 'triangle-angle-sum')],
    { direction: 'יש שני משיקים מאותה נקודה.', tool: 'שני משיקים מנקודה שווים, ולכן המשולש $PAB$ שווה שוקיים.', next: 'מה ידוע על $PA$ ו-$PB$?' },
  );
}

export function chordDistanceEx(rng: Rng, d: Difficulty): Exercise {
  const [a, b, c] = pick(rng, TRIPLES);
  return geo(
    'circle',
    d,
    `במעגל שרדיוסו $${c}$, המרחק של המיתר $AB$ מהמרכז הוא $${a}$. מצאו את אורך המיתר.`,
    'perpendicular-chord',
    [2 * b],
    `$AB = ${2 * b}$`,
    [cite('$AM = MB$', 'perpendicular-from-center'), cite(`$AM^2 = ${c}^2 - ${a}^2 = ${b * b} \\Rightarrow AM = ${b}$`, 'pythagoras'), calc(`$AB = 2\\cdot ${b} = ${2 * b}$`)],
    { direction: 'מורידים אנך מהמרכז למיתר.', tool: 'האנך מהמרכז למיתר חוצה אותו. אחר כך – פיתגורס במשולש שבו היתר הוא רדיוס.', next: 'שרטטו רדיוס לקצה המיתר.' },
  );
}

export function mediansEx(rng: Rng, d: Difficulty): Exercise {
  const ad = 3 * int(rng, 2, 10);
  return geo(
    'loci',
    d,
    `ב-$\\triangle ABC$ התיכונים $AD$ ו-$BE$ נחתכים ב-$G$. נתון $AD = ${ad}$. מצאו את $AG$ ואת $GD$.`,
    labeled('medians', []),
    [(2 * ad) / 3, ad / 3],
    `$AG = ${(2 * ad) / 3},\\ GD = ${ad / 3}$`,
    [cite('$AG : GD = 2 : 1$', 'medians-concurrent'), calc(`$AG = \\tfrac23\\cdot ${ad} = ${(2 * ad) / 3},\\ GD = ${ad / 3}$`)],
    { direction: 'נקודת מפגש התיכונים מחלקת אותם ביחס קבוע.', tool: 'התיכונים נפגשים בנקודה המחלקת כל תיכון ביחס 2:1 מהקודקוד.', next: 'חלקו את $AD$ לשלושה חלקים שווים.' },
  );
}

export function congruenceChoice(rng: Rng, d: Difficulty): Exercise {
  const items = [
    { id: 'congruence-sas', label: 'צ.ז.צ' },
    { id: 'congruence-asa', label: 'ז.צ.ז' },
    { id: 'congruence-sss', label: 'צ.צ.צ' },
    { id: 'congruence-ssa', label: 'צ.צ.ז' },
  ];
  const target = pick(rng, items);
  const options = shuffle(rng, items.map((i) => i.label));
  const t = theoremById.get(target.id)!;
  return {
    id: uid('cong'),
    topic: 'congruence',
    difficulty: d,
    question: 'לפי הסימונים בשרטוט (סימונים זהים = רכיבים שווים), איזה משפט חפיפה מתאים?',
    diagram: labeled(target.id, []),
    answer: { kind: 'choice', options, correct: options.indexOf(target.label) },
    answerDisplay: `${target.label} – ${t.statement}`,
    hints: { direction: 'ספרו כמה צלעות וכמה זוויות מסומנות כשוות.', tool: 'בדקו אם הזווית נמצאת בין שתי הצלעות, ליד הצלע, או מול צלע.', next: 'מה מיקום הזווית ביחס לצלעות המסומנות?' },
    proof: [{ claim: target.label, reason: t.citation, ref: target.id }],
  };
}

export function rightTriangleTrig(rng: Rng, d: Difficulty): Exercise {
  const alpha = pick(rng, [20, 25, 30, 35, 40, 50, 55, 60, 65]);
  const c = int(rng, 5, 20);
  const r = (x: number) => Math.round(x * 100) / 100;
  const rad = (alpha * Math.PI) / 180;
  const kind = pick(rng, d === 1 ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);
  if (kind === 'tan') {
    const b = c;
    const a = b * Math.tan(rad);
    return {
      id: uid('trig'),
      topic: 'trigonometry',
      difficulty: d,
      question: `במשולש ישר זווית, הזווית החדה $\\alpha = ${deg(alpha)}$ והניצב שליד $\\alpha$ הוא $${b}$. מצאו את הניצב שמול $\\alpha$ (עגלו לשתי ספרות).`,
      diagram: 'right-trig',
      answer: { kind: 'numbers', values: [a], tol: 0.003 },
      answerDisplay: `$a = ${b}\\cdot\\tan${deg(alpha)} \\approx ${r(a)}$`,
      hints: { direction: 'ידועים ניצב ליד הזווית, ומחפשים ניצב מול.', tool: '$\\tan\\alpha = \\frac{\\text{מול}}{\\text{ליד}}$.', next: `$a = ${b}\\cdot\\tan ${deg(alpha)}$.` },
      steps: [{ title: 'טנגנס', tex: `\\tan ${deg(alpha)} = \\frac{a}{${b}} \\Rightarrow a = ${b}\\tan ${deg(alpha)} \\approx ${r(a)}` }],
    };
  }
  const val = kind === 'sin' ? c * Math.sin(rad) : c * Math.cos(rad);
  const which = kind === 'sin' ? 'שמול' : 'שליד';
  return {
    id: uid('trig'),
    topic: 'trigonometry',
    difficulty: d,
    question: `במשולש ישר זווית היתר הוא $${c}$ והזווית החדה $\\alpha = ${deg(alpha)}$. מצאו את הניצב ${which} $\\alpha$ (עגלו לשתי ספרות).`,
    diagram: 'right-trig',
    answer: { kind: 'numbers', values: [val], tol: 0.003 },
    answerDisplay: `$${r(val)}$`,
    hints: {
      direction: `ידוע היתר, ומחפשים את הניצב ${which} הזווית.`,
      tool: kind === 'sin' ? '$\\sin\\alpha = \\frac{\\text{מול}}{\\text{יתר}}$.' : '$\\cos\\alpha = \\frac{\\text{ליד}}{\\text{יתר}}$.',
      next: `הניצב $= ${c}\\cdot\\${kind} ${deg(alpha)}$.`,
    },
    steps: [{ title: kind === 'sin' ? 'סינוס' : 'קוסינוס', tex: `\\${kind} ${deg(alpha)} = \\frac{x}{${c}} \\Rightarrow x = ${c}\\${kind} ${deg(alpha)} \\approx ${r(val)}` }],
  };
}

export function lawOfSinesCosines(rng: Rng, d: Difficulty): Exercise {
  const r = (x: number) => Math.round(x * 100) / 100;
  if (rng() < 0.5) {
    const a = int(rng, 4, 12),
      b = int(rng, 4, 12),
      g = pick(rng, [40, 60, 75, 110, 120]);
    const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos((g * Math.PI) / 180));
    return {
      id: uid('cos'),
      topic: 'trigonometry',
      difficulty: d,
      question: `במשולש $a = ${a}$, $b = ${b}$, והזווית ביניהן $\\gamma = ${deg(g)}$. מצאו את $c$ (עגלו לשתי ספרות).`,
      diagram: 'cosine-law',
      answer: { kind: 'numbers', values: [c], tol: 0.003 },
      answerDisplay: `$c \\approx ${r(c)}$`,
      hints: { direction: 'ידועות שתי צלעות והזווית שביניהן.', tool: 'משפט הקוסינוסים: $c^2 = a^2 + b^2 - 2ab\\cos\\gamma$.', next: `$c^2 = ${a}^2 + ${b}^2 - 2\\cdot${a}\\cdot${b}\\cos ${deg(g)}$.` },
      proof: [{ claim: `$c^2 = ${a}^2 + ${b}^2 - 2\\cdot${a}\\cdot${b}\\cos ${deg(g)} \\approx ${r(c * c)}$`, reason: 'משפט הקוסינוסים', ref: 'cosine-law' }, { claim: `$c \\approx ${r(c)}$`, reason: 'הוצאת שורש' }],
    };
  }
  const alpha = pick(rng, [30, 45, 60, 50]),
    beta = pick(rng, [40, 70, 80]);
  const a = int(rng, 5, 15);
  const b = (a * Math.sin((beta * Math.PI) / 180)) / Math.sin((alpha * Math.PI) / 180);
  return {
    id: uid('sin'),
    topic: 'trigonometry',
    difficulty: d,
    question: `במשולש $\\alpha = ${deg(alpha)}$, $\\beta = ${deg(beta)}$ והצלע שמול $\\alpha$ היא $a = ${a}$. מצאו את $b$ (עגלו לשתי ספרות).`,
    diagram: 'sine-law',
    answer: { kind: 'numbers', values: [b], tol: 0.003 },
    answerDisplay: `$b \\approx ${r(b)}$`,
    hints: { direction: 'ידועים זוג "צלע וזווית שמולה", ועוד זווית.', tool: 'משפט הסינוסים: $\\frac{a}{\\sin\\alpha} = \\frac{b}{\\sin\\beta}$.', next: `$b = \\frac{${a}\\sin ${deg(beta)}}{\\sin ${deg(alpha)}}$.` },
    proof: [{ claim: `$\\frac{${a}}{\\sin ${deg(alpha)}} = \\frac{b}{\\sin ${deg(beta)}}$`, reason: 'משפט הסינוסים', ref: 'sine-law' }, { claim: `$b \\approx ${r(b)}$`, reason: 'חישוב' }],
  };
}

export function areaVolumeEx(rng: Rng, d: Difficulty): Exercise {
  const kind = pick(rng, ['trap', 'circle', 'box', 'cyl']);
  const r = (x: number) => Math.round(x * 100) / 100;
  if (kind === 'trap') {
    const a = int(rng, 4, 12),
      b = a + int(rng, 2, 8),
      h = int(rng, 3, 9);
    return {
      id: uid('area'),
      topic: 'area-volume',
      difficulty: d,
      question: `בסיסי טרפז הם $${a}$ ו-$${b}$, וגובהו $${h}$. מצאו את שטחו.`,
      diagram: 'c-trapezoid',
      answer: { kind: 'numbers', values: [((a + b) * h) / 2] },
      answerDisplay: `$S = \\frac{(${a} + ${b})\\cdot ${h}}{2} = ${((a + b) * h) / 2}$`,
      hints: { direction: 'יש נוסחה לשטח טרפז.', tool: '$S = \\frac{(a + b)h}{2}$.', next: 'הציבו את הבסיסים ואת הגובה.' },
      steps: [{ title: 'נוסחת שטח טרפז', tex: `S = \\frac{(${a} + ${b})\\cdot ${h}}{2} = ${((a + b) * h) / 2}` }],
    };
  }
  if (kind === 'circle') {
    const R = int(rng, 2, 12);
    return {
      id: uid('area'),
      topic: 'area-volume',
      difficulty: d,
      question: `מצאו את שטח העיגול שרדיוסו $${R}$ (עגלו לשתי ספרות, $\\pi \\approx 3.14159$).`,
      diagram: 'c-disk',
      answer: { kind: 'numbers', values: [Math.PI * R * R], tol: 0.002 },
      answerDisplay: `$S = \\pi\\cdot ${R}^2 = ${R * R}\\pi \\approx ${r(Math.PI * R * R)}$`,
      hints: { direction: 'שטח עיגול תלוי ברדיוס.', tool: '$S = \\pi r^2$.', next: `$S = \\pi\\cdot ${R}^2$.` },
      steps: [{ title: 'נוסחת שטח עיגול', tex: `S = \\pi r^2 = ${R * R}\\pi \\approx ${r(Math.PI * R * R)}` }],
    };
  }
  if (kind === 'box') {
    const a = int(rng, 2, 9),
      b = int(rng, 2, 9),
      c = int(rng, 2, 9);
    const diag = Math.sqrt(a * a + b * b + c * c);
    if (d < 3)
      return {
        id: uid('vol'),
        topic: 'area-volume',
        difficulty: d,
        question: `מידות תיבה: $${a}\\times${b}\\times${c}$. מצאו את נפחה.`,
        diagram: 'c-box',
        answer: { kind: 'numbers', values: [a * b * c] },
        answerDisplay: `$V = ${a * b * c}$`,
        hints: { direction: 'נפח תיבה = שטח הבסיס כפול הגובה.', tool: '$V = a\\cdot b\\cdot c$.', next: 'כפלו את שלוש המידות.' },
        steps: [{ title: 'נפח תיבה', tex: `V = ${a}\\cdot ${b}\\cdot ${c} = ${a * b * c}` }],
      };
    return {
      id: uid('vol'),
      topic: 'area-volume',
      difficulty: d,
      question: `מידות תיבה: $${a}\\times${b}\\times${c}$. מצאו את אורך האלכסון של התיבה (עגלו לשתי ספרות).`,
      diagram: 'c-box',
      answer: { kind: 'numbers', values: [diag], tol: 0.003 },
      answerDisplay: `$d = \\sqrt{${a}^2 + ${b}^2 + ${c}^2} \\approx ${r(diag)}$`,
      hints: { direction: 'האלכסון של התיבה הוא יתר במשולש ישר זווית.', tool: 'פעמיים פיתגורס: $d^2 = a^2 + b^2 + c^2$.', next: 'מצאו קודם את אלכסון הבסיס.' },
      proof: [
        { claim: `$\\text{אלכסון בסיס}^2 = ${a}^2 + ${b}^2 = ${a * a + b * b}$`, reason: 'משפט פיתגורס', ref: 'pythagoras' },
        { claim: `$d^2 = ${a * a + b * b} + ${c}^2 = ${a * a + b * b + c * c} \\Rightarrow d \\approx ${r(diag)}$`, reason: 'משפט פיתגורס', ref: 'pythagoras' },
      ],
    };
  }
  const R = int(rng, 2, 8),
    h = int(rng, 3, 12);
  return {
    id: uid('vol'),
    topic: 'area-volume',
    difficulty: d,
    question: `מצאו את נפח הגליל שרדיוס בסיסו $${R}$ וגובהו $${h}$ (עגלו לשתי ספרות).`,
    diagram: 'c-cylinder',
    answer: { kind: 'numbers', values: [Math.PI * R * R * h], tol: 0.002 },
    answerDisplay: `$V = \\pi\\cdot ${R}^2\\cdot ${h} = ${R * R * h}\\pi \\approx ${r(Math.PI * R * R * h)}$`,
    hints: { direction: 'נפח גליל = שטח הבסיס כפול הגובה.', tool: '$V = \\pi r^2 h$.', next: `$V = \\pi\\cdot ${R}^2 \\cdot ${h}$.` },
    steps: [{ title: 'נפח גליל', tex: `V = \\pi r^2 h = ${R * R * h}\\pi \\approx ${r(Math.PI * R * R * h)}` }],
  };
}
