import type { DiagramSpec, SolutionStep } from '../types';
import { Fraction, fmt, niceTex, sqrtFraction, surdTex } from './math/fraction';
import { evaluate, parse, variables } from './math/expr';

/** Guided calculators: each returns the full working, formula by formula. */

export class ToolError extends Error {}

export interface ToolResult {
  steps: SolutionStep[];
  answer: string;
  diagram?: DiagramSpec;
  notes?: string[];
}

const DEG = Math.PI / 180;
const st = (title: string, tex?: string, text?: string): SolutionStep => ({ title, tex, text });

/** Reads a number typed by the student ("3/4", "sqrt(2)", "-1.5"); empty → undefined. */
export function readNum(raw: string | undefined, name: string): number | undefined {
  const s = (raw ?? '').trim();
  if (!s) return undefined;
  try {
    const n = parse(s);
    if (variables(n).size) throw new Error();
    const v = evaluate(n);
    if (!Number.isFinite(v)) throw new Error();
    return v;
  } catch {
    throw new ToolError(`לא הצלחנו לקרוא את הערך של ${name}.`);
  }
}

const n2 = (x: number) => niceTex(x);
const n3 = (x: number) => fmt(x, 3);
const deg = (x: number) => `${fmt(x, 2)}^\\circ`;
const paren = (x: number) => (x < 0 ? `(${n2(x)})` : n2(x));

/** √(value) shown exactly when value is a simple rational (e.g. √50 = 5√2). */
function sqrtExact(v: number): string {
  const f = Fraction.fromDecimal(v);
  if (f.d <= 1000 && Math.abs(f.toNumber() - v) < 1e-9 && v >= 0) {
    const s = sqrtFraction(f);
    const t = surdTex(s);
    return s.r === 1 ? t : `${t} \\approx ${n3(Math.sqrt(v))}`;
  }
  return n3(Math.sqrt(v));
}

// ---------------------------------------------------------------- sequences

export function sequenceTool(kind: 'arith' | 'geo', a1Raw: string, dRaw: string, nRaw: string): ToolResult {
  const a1 = readNum(a1Raw, 'האיבר הראשון');
  const d = readNum(dRaw, kind === 'arith' ? 'ההפרש' : 'המנה');
  const n = readNum(nRaw, 'n');
  if (a1 === undefined || d === undefined || n === undefined) throw new ToolError('מלאו את כל השדות.');
  if (!Number.isInteger(n) || n < 1 || n > 10000) throw new ToolError('n צריך להיות מספר טבעי (1, 2, 3, …).');
  const steps: SolutionStep[] = [];
  const notes: string[] = [];
  let an: number;
  let sn: number;
  if (kind === 'arith') {
    an = a1 + (n - 1) * d;
    sn = (n / 2) * (2 * a1 + (n - 1) * d);
    steps.push(st('רושמים את הנתונים', `a_1 = ${n2(a1)},\\quad d = ${n2(d)},\\quad n = ${n}`));
    steps.push(st('האיבר הכללי בסדרה חשבונית (מדף הנוסחאות)', 'a_n = a_1 + (n-1)d'));
    steps.push(st('מציבים', `a_{${n}} = ${n2(a1)} + (${n}-1)\\cdot ${paren(d)} = ${n2(an)}`));
    steps.push(st('סכום n איברים ראשונים (מדף הנוסחאות)', 'S_n = \\frac{n}{2}\\left(2a_1 + (n-1)d\\right) = \\frac{n(a_1 + a_n)}{2}'));
    steps.push(st('מציבים', `S_{${n}} = \\frac{${n}\\left(${n2(a1)} + ${paren(an)}\\right)}{2} = ${n2(sn)}`));
    if (d === 0) notes.push('כש-$d = 0$ הסדרה קבועה: כל האיברים שווים.');
  } else {
    if (a1 === 0) throw new ToolError('בסדרה הנדסית האיבר הראשון שונה מאפס.');
    if (d === 0) throw new ToolError('בסדרה הנדסית המנה שונה מאפס.');
    an = a1 * d ** (n - 1);
    sn = d === 1 ? n * a1 : (a1 * (d ** n - 1)) / (d - 1);
    steps.push(st('רושמים את הנתונים', `a_1 = ${n2(a1)},\\quad q = ${n2(d)},\\quad n = ${n}`));
    steps.push(st('האיבר הכללי בסדרה הנדסית (מדף הנוסחאות)', 'a_n = a_1 \\cdot q^{n-1}'));
    steps.push(st('מציבים', `a_{${n}} = ${n2(a1)} \\cdot ${paren(d)}^{${n - 1}} = ${n2(an)}`));
    if (d === 1) {
      steps.push(st('כש-q = 1 כל האיברים שווים, ולכן', `S_{${n}} = n \\cdot a_1 = ${n} \\cdot ${paren(a1)} = ${n2(sn)}`));
    } else {
      steps.push(st('סכום n איברים ראשונים (מדף הנוסחאות)', 'S_n = \\frac{a_1\\left(q^n - 1\\right)}{q - 1}'));
      steps.push(st('מציבים', `S_{${n}} = \\frac{${n2(a1)}\\left(${paren(d)}^{${n}} - 1\\right)}{${n2(d)} - 1} = ${n2(sn)}`));
    }
    if (Math.abs(d) < 1) {
      const inf = a1 / (1 - d);
      steps.push(st('בונוס: הסדרה מתכנסת כי |q| < 1, וסכומה האינסופי', `S = \\frac{a_1}{1 - q} = \\frac{${n2(a1)}}{1 - ${paren(d)}} = ${n2(inf)}`));
    }
  }
  return { steps, answer: `$a_{${n}} = ${n2(an)}$, $S_{${n}} = ${n2(sn)}$`, notes };
}

// ---------------------------------------------------------------- right triangle

function rightTriangleDiagram(a: number, b: number, alpha: number): DiagramSpec {
  const s = Math.min(210 / b, 140 / a);
  const C: [number, number] = [70, 195];
  return {
    id: 'tool-right-triangle',
    shape: 'right-triangle',
    points: { C, A: [C[0] + b * s, C[1]], B: [C[0], C[1] - a * s] },
    lpos: { C: 'sw', A: 'se', B: 'nw' },
    elements: [
      { t: 'poly', p: ['A', 'B', 'C'], fill: 'accent' },
      { t: 'right', p: ['A', 'C', 'B'] },
      { t: 'angle', p: ['B', 'A', 'C'], label: `${fmt(alpha, 1)}°`, r: 30 },
      { t: 'seglabel', p: ['C', 'B'], s: `a = ${fmt(a, 2)}` },
      { t: 'seglabel', p: ['A', 'C'], s: `b = ${fmt(b, 2)}` },
      { t: 'seglabel', p: ['A', 'B'], s: `c = ${fmt(Math.hypot(a, b), 2)}` },
      { t: 'pts', p: ['A', 'B', 'C'] },
    ],
  };
}

/**
 * Right triangle ABC with the right angle at C: a = BC and b = AC are the legs, c = AB is the hypotenuse,
 * α is the angle at A (opposite a). Any two values, at least one of them a side.
 */
export function rightTriangleTool(aRaw: string, bRaw: string, cRaw: string, alphaRaw: string): ToolResult {
  let a = readNum(aRaw, 'a');
  let b = readNum(bRaw, 'b');
  let c = readNum(cRaw, 'c');
  let alpha = readNum(alphaRaw, 'α');
  const known = [a, b, c, alpha].filter((x) => x !== undefined).length;
  if (known !== 2) throw new ToolError('מלאו בדיוק שני נתונים: שתי צלעות, או צלע וזווית.');
  if (alpha === undefined && [a, b, c].filter((x) => x !== undefined).length < 2) throw new ToolError('צריך לפחות צלע אחת.');
  if ([a, b, c].some((x) => x !== undefined && x <= 0)) throw new ToolError('אורכי צלעות חייבים להיות חיוביים.');
  if (alpha !== undefined && (alpha <= 0 || alpha >= 90)) throw new ToolError('זווית חדה במשולש ישר זווית היא בין 0° ל-90°.');
  const steps: SolutionStep[] = [st('מסמנים', '\\angle C = 90^\\circ,\\quad a = BC,\\ b = AC \\text{ (ניצבים)},\\quad c = AB \\text{ (יתר)}', 'הזווית $\\alpha$ נמצאת בקודקוד $A$, מול הניצב $a$ וליד הניצב $b$.')];
  if (alpha === undefined) {
    if (a !== undefined && b !== undefined) {
      c = Math.hypot(a, b);
      steps.push(st('משפט פיתגורס', `c^2 = a^2 + b^2 = ${n2(a)}^2 + ${n2(b)}^2 = ${n2(a * a + b * b)}`));
      steps.push(st('מוציאים שורש (אורך חיובי)', `c = ${sqrtExact(a * a + b * b)}`));
      alpha = Math.atan(a / b) / DEG;
      steps.push(st('טנגנס = ניצב מול / ניצב ליד', `\\tan\\alpha = \\frac{a}{b} = \\frac{${n2(a)}}{${n2(b)}} \\ \\Rightarrow\\ \\alpha = ${deg(alpha)}`));
    } else {
      const leg = (a ?? b)!;
      if (c! <= leg) throw new ToolError('היתר חייב להיות ארוך מכל אחד מהניצבים.');
      const other = Math.sqrt(c! * c! - leg * leg);
      const name = a !== undefined ? 'b' : 'a';
      steps.push(st('משפט פיתגורס', `${name}^2 = c^2 - ${name === 'b' ? 'a' : 'b'}^2 = ${n2(c!)}^2 - ${n2(leg)}^2 = ${n2(c! * c! - leg * leg)}`));
      steps.push(st('מוציאים שורש', `${name} = ${sqrtExact(c! * c! - leg * leg)}`));
      if (a !== undefined) {
        b = other;
        alpha = Math.asin(a / c!) / DEG;
        steps.push(st('סינוס = ניצב מול / יתר', `\\sin\\alpha = \\frac{a}{c} = \\frac{${n2(a)}}{${n2(c!)}} \\ \\Rightarrow\\ \\alpha = ${deg(alpha)}`));
      } else {
        a = other;
        alpha = Math.acos(b! / c!) / DEG;
        steps.push(st('קוסינוס = ניצב ליד / יתר', `\\cos\\alpha = \\frac{b}{c} = \\frac{${n2(b!)}}{${n2(c!)}} \\ \\Rightarrow\\ \\alpha = ${deg(alpha)}`));
      }
    }
  } else {
    const r = alpha * DEG;
    if (a !== undefined) {
      c = a / Math.sin(r);
      b = a / Math.tan(r);
      steps.push(st('סינוס = ניצב מול / יתר', `\\sin\\alpha = \\frac{a}{c} \\ \\Rightarrow\\ c = \\frac{a}{\\sin\\alpha} = \\frac{${n2(a)}}{\\sin ${deg(alpha)}} \\approx ${n3(c)}`));
      steps.push(st('טנגנס = ניצב מול / ניצב ליד', `\\tan\\alpha = \\frac{a}{b} \\ \\Rightarrow\\ b = \\frac{a}{\\tan\\alpha} = \\frac{${n2(a)}}{\\tan ${deg(alpha)}} \\approx ${n3(b)}`));
    } else if (b !== undefined) {
      a = b * Math.tan(r);
      c = b / Math.cos(r);
      steps.push(st('טנגנס = ניצב מול / ניצב ליד', `a = b\\tan\\alpha = ${n2(b)} \\cdot \\tan ${deg(alpha)} \\approx ${n3(a)}`));
      steps.push(st('קוסינוס = ניצב ליד / יתר', `c = \\frac{b}{\\cos\\alpha} = \\frac{${n2(b)}}{\\cos ${deg(alpha)}} \\approx ${n3(c)}`));
    } else {
      a = c! * Math.sin(r);
      b = c! * Math.cos(r);
      steps.push(st('סינוס = ניצב מול / יתר', `a = c\\sin\\alpha = ${n2(c!)} \\cdot \\sin ${deg(alpha)} \\approx ${n3(a)}`));
      steps.push(st('קוסינוס = ניצב ליד / יתר', `b = c\\cos\\alpha = ${n2(c!)} \\cdot \\cos ${deg(alpha)} \\approx ${n3(b)}`));
    }
  }
  const beta = 90 - alpha!;
  steps.push(st('סכום הזוויות החדות במשולש ישר זווית הוא 90°', `\\beta = 90^\\circ - \\alpha = ${deg(beta)}`));
  const area = (a! * b!) / 2;
  steps.push(st('בונוס: שטח המשולש = מכפלת הניצבים חלקי 2', `S = \\frac{a \\cdot b}{2} \\approx ${n3(area)}`));
  return {
    steps,
    answer: `$a \\approx ${n3(a!)}$, $b \\approx ${n3(b!)}$, $c \\approx ${n3(c!)}$, $\\alpha \\approx ${deg(alpha!)}$, $\\beta \\approx ${deg(beta)}$`,
    diagram: rightTriangleDiagram(a!, b!, alpha!),
  };
}

// ---------------------------------------------------------------- law of sines / cosines

type Tri = { a?: number; b?: number; c?: number; A?: number; B?: number; C?: number };
const SIDES = ['a', 'b', 'c'] as const;
const ANG: Record<(typeof SIDES)[number], 'A' | 'B' | 'C'> = { a: 'A', b: 'B', c: 'C' };
const GREEK: Record<'A' | 'B' | 'C', string> = { A: '\\alpha', B: '\\beta', C: '\\gamma' };

function full(t: Tri): Required<Tri> | null {
  return SIDES.every((s) => t[s] !== undefined) && (['A', 'B', 'C'] as const).every((k) => t[k] !== undefined) ? (t as Required<Tri>) : null;
}

/** Any triangle: a, b, c sides and α, β, γ the opposite angles (degrees). Three values, at least one side. */
export function triangleTool(raw: { a: string; b: string; c: string; A: string; B: string; C: string }): ToolResult {
  const t: Tri = {
    a: readNum(raw.a, 'a'),
    b: readNum(raw.b, 'b'),
    c: readNum(raw.c, 'c'),
    A: readNum(raw.A, 'α'),
    B: readNum(raw.B, 'β'),
    C: readNum(raw.C, 'γ'),
  };
  const sides = SIDES.filter((s) => t[s] !== undefined);
  const angles = (['A', 'B', 'C'] as const).filter((k) => t[k] !== undefined);
  if (sides.length + angles.length !== 3) throw new ToolError('מלאו בדיוק שלושה נתונים (לפחות אחד מהם צלע).');
  if (!sides.length) throw new ToolError('שלוש זוויות קובעות רק את צורת המשולש – צריך לפחות צלע אחת.');
  if (sides.some((s) => t[s]! <= 0)) throw new ToolError('אורכי צלעות חייבים להיות חיוביים.');
  if (angles.some((k) => t[k]! <= 0 || t[k]! >= 180)) throw new ToolError('זווית במשולש היא בין 0° ל-180°.');
  if (angles.reduce((s, k) => s + t[k]!, 0) >= 180) throw new ToolError('סכום הזוויות במשולש הוא 180°, ולכן סכום הזוויות הנתונות חייב להיות קטן מ-180°.');

  const steps: SolutionStep[] = [st('מסמנים', 'a, b, c \\text{ – צלעות;}\\quad \\alpha, \\beta, \\gamma \\text{ – הזוויות שמולן}')];
  const notes: string[] = [];
  const cosLawSide = (s: (typeof SIDES)[number]) => {
    const [p, q] = SIDES.filter((x) => x !== s);
    const k = ANG[s];
    const v = Math.sqrt(t[p]! ** 2 + t[q]! ** 2 - 2 * t[p]! * t[q]! * Math.cos(t[k]! * DEG));
    steps.push(st('משפט הקוסינוסים – מוצאים את הצלע שמול הזווית הידועה', `\\begin{aligned}${s}^2 &= ${p}^2 + ${q}^2 - 2${p}${q}\\cos${GREEK[k]} \\\\ &= ${n2(t[p]!)}^2 + ${n2(t[q]!)}^2 - 2\\cdot${n2(t[p]!)}\\cdot${n2(t[q]!)}\\cos ${deg(t[k]!)}\\end{aligned}`, `$${s} \\approx ${n3(v)}$`));
    t[s] = v;
  };
  const cosLawAngle = (s: (typeof SIDES)[number]) => {
    const [p, q] = SIDES.filter((x) => x !== s);
    const k = ANG[s];
    const cos = (t[p]! ** 2 + t[q]! ** 2 - t[s]! ** 2) / (2 * t[p]! * t[q]!);
    const v = Math.acos(Math.max(-1, Math.min(1, cos))) / DEG;
    steps.push(st(`משפט הקוסינוסים – מוצאים את ${GREEK[k] === '\\alpha' ? 'α' : GREEK[k] === '\\beta' ? 'β' : 'γ'}`, `\\begin{aligned}\\cos${GREEK[k]} &= \\frac{${p}^2 + ${q}^2 - ${s}^2}{2${p}${q}} \\\\ &= \\frac{${n2(t[p]!)}^2 + ${n2(t[q]!)}^2 - ${n2(t[s]!)}^2}{2\\cdot${n2(t[p]!)}\\cdot${n2(t[q]!)}} \\approx ${fmt(cos, 4)}\\end{aligned}`, `$${GREEK[k]} \\approx ${deg(v)}$`));
    t[k] = v;
  };
  const angleSum = () => {
    const miss = (['A', 'B', 'C'] as const).find((k) => t[k] === undefined);
    if (!miss) return;
    const others = (['A', 'B', 'C'] as const).filter((k) => k !== miss);
    t[miss] = 180 - t[others[0]]! - t[others[1]]!;
    steps.push(st('סכום הזוויות במשולש הוא 180°', `${GREEK[miss]} = 180^\\circ - ${deg(t[others[0]]!)} - ${deg(t[others[1]]!)} = ${deg(t[miss]!)}`));
  };
  const sineLawSides = () => {
    const ref = SIDES.find((s) => t[s] !== undefined && t[ANG[s]] !== undefined)!;
    const ratio = t[ref]! / Math.sin(t[ANG[ref]]! * DEG);
    steps.push(st('משפט הסינוסים – מחשבים את היחס הקבוע', `\\frac{${ref}}{\\sin${GREEK[ANG[ref]]}} = \\frac{${n2(t[ref]!)}}{\\sin ${deg(t[ANG[ref]]!)}} \\approx ${n3(ratio)} \\ (= 2R)`));
    for (const s of SIDES) {
      if (t[s] !== undefined) continue;
      t[s] = ratio * Math.sin(t[ANG[s]]! * DEG);
      steps.push(st(`מוצאים את ${s}`, `${s} = 2R\\cdot\\sin${GREEK[ANG[s]]} \\approx ${n3(ratio)}\\cdot\\sin ${deg(t[ANG[s]]!)} \\approx ${n3(t[s]!)}`));
    }
  };

  let second: Required<Tri> | null = null;
  if (sides.length === 3) {
    const [x, y, z] = [t.a!, t.b!, t.c!].sort((p, q) => p - q);
    if (x + y <= z) throw new ToolError('הצלעות לא מקיימות את אי-שוויון המשולש (סכום שתי צלעות גדול מהשלישית), ולכן אין משולש כזה.');
    steps.push(st('שלוש צלעות ידועות (צ.צ.צ) – משתמשים במשפט הקוסינוסים'));
    cosLawAngle('a');
    cosLawAngle('b');
    angleSum();
  } else if (angles.length >= 2) {
    steps.push(st('שתי זוויות וצלע – משלימים את הזווית השלישית ואז משפט הסינוסים'));
    angleSum();
    sineLawSides();
  } else {
    // two sides + one angle
    const k = angles[0];
    const opposite = SIDES.find((s) => ANG[s] === k)!;
    if (t[opposite] === undefined) {
      steps.push(st('שתי צלעות והזווית שביניהן (צ.ז.צ) – משפט הקוסינוסים'));
      cosLawSide(opposite);
      const [p] = SIDES.filter((s) => s !== opposite);
      cosLawAngle(p);
      angleSum();
    } else {
      // SSA – the ambiguous case
      const other = sides.find((s) => s !== opposite)!;
      const sinX = (t[other]! * Math.sin(t[k]! * DEG)) / t[opposite]!;
      steps.push(st('שתי צלעות וזווית שאינה ביניהן – משפט הסינוסים', `\\begin{aligned}\\sin${GREEK[ANG[other]]} &= \\frac{${other}\\sin${GREEK[k]}}{${opposite}} \\\\ &= \\frac{${n2(t[other]!)}\\cdot\\sin ${deg(t[k]!)}}{${n2(t[opposite]!)}} \\approx ${fmt(sinX, 4)}\\end{aligned}`));
      if (sinX > 1 + 1e-12) throw new ToolError('מתקבל סינוס גדול מ-1 – אין משולש עם הנתונים האלה.');
      const x1 = Math.asin(Math.min(1, sinX)) / DEG;
      const x2 = 180 - x1;
      const k2 = ANG[other];
      t[k2] = x1;
      steps.push(st('פתרון ראשון של המשוואה', `${GREEK[k2]} \\approx ${deg(x1)}`));
      if (Math.abs(x2 - x1) > 1e-9 && x2 + t[k]! < 180) {
        // complete the second triangle (same givens, obtuse angle instead)
        const s2: Tri = { ...t, [k2]: x2 };
        const missA = (['A', 'B', 'C'] as const).find((q) => s2[q] === undefined)!;
        s2[missA] = 180 - (['A', 'B', 'C'] as const).filter((q) => q !== missA).reduce((acc, q) => acc + s2[q]!, 0);
        const ratio = s2[opposite]! / Math.sin(s2[k]! * DEG);
        for (const sd of SIDES) if (s2[sd] === undefined) s2[sd] = ratio * Math.sin(s2[ANG[sd]]! * DEG);
        second = s2 as Required<Tri>;
        steps.push(st('שימו לב: גם הזווית הקהה מתאימה', `${GREEK[k2]} \\approx 180^\\circ - ${deg(x1)} = ${deg(x2)}`, 'יש **שני משולשים** שמתאימים לנתונים (המקרה הדו-משמעי). נמשיך עם הראשון, והשני מופיע בסוף.'));
      } else if (Math.abs(x2 - x1) > 1e-9) {
        steps.push(st('הזווית הקהה נפסלת', `${deg(x2)} + ${deg(t[k]!)} \\ge 180^\\circ`, 'לכן יש משולש אחד בלבד.'));
      }
      angleSum();
      sineLawSides();
    }
  }
  const r = full(t)!;
  const area = 0.5 * r.a * r.b * Math.sin(r.C * DEG);
  steps.push(st('בונוס: שטח המשולש', `S = \\frac{1}{2}ab\\sin\\gamma \\approx ${n3(area)}`));
  const fmtTri = (x: Required<Tri>) => `$a \\approx ${n3(x.a)}$, $b \\approx ${n3(x.b)}$, $c \\approx ${n3(x.c)}$, $\\alpha \\approx ${deg(x.A)}$, $\\beta \\approx ${deg(x.B)}$, $\\gamma \\approx ${deg(x.C)}$`;
  let answer = fmtTri(r);
  if (second) {
    steps.push(st('המשולש השני', `\\begin{gathered}a \\approx ${n3(second.a)},\\ b \\approx ${n3(second.b)},\\ c \\approx ${n3(second.c)} \\\\ \\alpha \\approx ${deg(second.A)},\\ \\beta \\approx ${deg(second.B)},\\ \\gamma \\approx ${deg(second.C)}\\end{gathered}`));
    answer = `משולש 1: ${answer}\nמשולש 2: ${fmtTri(second)}`;
    notes.push('במקרה של שתי צלעות וזווית שאינה ביניהן ייתכנו שני משולשים, משולש אחד או אף משולש. תמיד בדקו גם את הזווית הקהה $180^\\circ - x$.');
  }
  notes.push('הערכים מעוגלים. בבחינה כדאי להשאיר דיוק של שתי ספרות אחרי הנקודה לפחות עד התשובה הסופית.');
  return { steps, answer, notes };
}

// ---------------------------------------------------------------- two points

export function twoPointsTool(x1Raw: string, y1Raw: string, x2Raw: string, y2Raw: string): ToolResult {
  const x1 = readNum(x1Raw, 'x₁');
  const y1 = readNum(y1Raw, 'y₁');
  const x2 = readNum(x2Raw, 'x₂');
  const y2 = readNum(y2Raw, 'y₂');
  if ([x1, y1, x2, y2].some((v) => v === undefined)) throw new ToolError('מלאו את שיעורי שתי הנקודות.');
  const [X1, Y1, X2, Y2] = [x1!, y1!, x2!, y2!];
  if (X1 === X2 && Y1 === Y2) throw new ToolError('אלה אותה נקודה – בחרו שתי נקודות שונות.');
  const dx = X2 - X1;
  const dy = Y2 - Y1;
  const d2 = dx * dx + dy * dy;
  const mx = (X1 + X2) / 2;
  const my = (Y1 + Y2) / 2;
  const steps: SolutionStep[] = [
    st('הנקודות', `A(${n2(X1)},\\ ${n2(Y1)}),\\qquad B(${n2(X2)},\\ ${n2(Y2)})`),
    st('מרחק בין שתי נקודות (מדף הנוסחאות)', 'AB = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}'),
    st('מציבים', `AB = \\sqrt{${paren(dx)}^2 + ${paren(dy)}^2} = \\sqrt{${n2(d2)}} = ${sqrtExact(d2)}`),
    st('אמצע הקטע', `M\\left(\\frac{x_1 + x_2}{2},\\ \\frac{y_1 + y_2}{2}\\right) = M\\left(${n2(mx)},\\ ${n2(my)}\\right)`),
  ];
  let lineTex: string;
  let slopeTex: string;
  if (dx === 0) {
    slopeTex = '\\text{לא מוגדר}';
    lineTex = `x = ${n2(X1)}`;
    steps.push(st('שיפוע', `x_1 = x_2 = ${n2(X1)}`, 'שיעורי ה-$x$ שווים, ולכן הישר מאונך לציר ה-$x$ ואין לו שיפוע.'));
    steps.push(st('משוואת הישר', lineTex));
  } else {
    const m = dy / dx;
    const b = Y1 - m * X1;
    slopeTex = n2(m);
    steps.push(st('שיפוע הישר', `m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${n2(dy)}}{${n2(dx)}} = ${n2(m)}`));
    steps.push(st('משוואת ישר לפי נקודה ושיפוע', 'y - y_1 = m(x - x_1)'));
    steps.push(st('מציבים את הנקודה A ואת השיפוע', `y - ${paren(Y1)} = ${paren(m)}\\left(x - ${paren(X1)}\\right)`));
    const mPart = m === 0 ? '' : m === 1 ? 'x' : m === -1 ? '-x' : `${n2(m)}x`;
    const bPart = b === 0 ? (mPart ? '' : '0') : `${mPart && b > 0 ? ' + ' : mPart ? ' - ' : ''}${n2(mPart ? Math.abs(b) : b)}`;
    lineTex = `y = ${mPart}${bPart}`;
    steps.push(st('מסדרים', lineTex));
    if (m !== 0) steps.push(st('בונוס: שיפוע ישר מאונך', `m_\\perp = -\\frac{1}{m} = ${n2(-1 / m)}`, 'מכפלת השיפועים של ישרים מאונכים היא $-1$.'));
  }
  const pad = 1.5;
  const xs = [X1, X2, 0];
  const ys = [Y1, Y2, 0];
  let w: [number, number, number, number] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
  // keep a pleasant aspect ratio
  const spanX = w[1] - w[0];
  const spanY = w[3] - w[2];
  if (spanY < spanX * 0.6) {
    const c = (w[2] + w[3]) / 2;
    w = [w[0], w[1], c - spanX * 0.3, c + spanX * 0.3];
  } else if (spanX < spanY * 1.2) {
    const c = (w[0] + w[1]) / 2;
    w = [c - spanY * 0.6, c + spanY * 0.6, w[2], w[3]];
  }
  const diagram: DiagramSpec = {
    id: 'tool-two-points',
    shape: 'coordinate',
    window: w,
    points: { A: [X1, Y1], B: [X2, Y2], M: [mx, my] },
    lpos: { A: 'nw', B: 'nw', M: 'se' },
    elements: [
      { t: 'axes', grid: spanX < 30 && spanY < 30 },
      { t: 'line', p: ['A', 'B'], c: 'accent', ext: 400 },
      { t: 'seg', p: ['A', 'B'], c: 'main', w: 2.6 },
      { t: 'pts', p: ['A', 'B'] },
      { t: 'pts', p: ['M'], c: 'accent2' },
    ],
  };
  return {
    steps,
    answer: `$AB = ${sqrtExact(d2)}$, $M\\left(${n2(mx)},\\ ${n2(my)}\\right)$, $m = ${slopeTex}$, $${lineTex}$`,
    diagram,
  };
}
