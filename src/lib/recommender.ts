import type { Theorem } from '../types';
import { theorems } from '../data';
import { normalizeHebrew } from './search';

export interface Tag {
  id: string;
  label: string;
  group: string;
  /** Substrings (normalized) or regular expressions (prefixed with "re:") that detect the tag in free text. */
  kw: string[];
}

export const GIVENS: Tag[] = [
  { id: 'intersecting-lines', label: 'ישרים נחתכים', group: 'ישרים וזוויות', kw: ['נחתכים', 'נחתכ', 'נפגשים בנקודה'] },
  { id: 'straight-angle', label: 'נקודות על ישר אחד', group: 'ישרים וזוויות', kw: ['על ישר אחד', 'זווית שטוחה', 'המשך הקטע'] },
  { id: 'parallel-lines', label: 'ישרים מקבילים', group: 'ישרים וזוויות', kw: ['מקבילים', 'מקביל ל', 'מקבילה', '∥', 're:\\|\\|'] },
  { id: 'transversal', label: 'ישר החותך שני ישרים', group: 'ישרים וזוויות', kw: ['ישר חותך', 'חותך את שני'] },
  { id: 'angle-measure', label: 'זוויות ידועות במעלות', group: 'ישרים וזוויות', kw: ['°', 'מעלות'] },
  { id: 'equal-angles', label: 'זוויות שוות', group: 'ישרים וזוויות', kw: ['זוויות שוות', 'שווה לזווית'] },
  { id: 'angle-30', label: 'זווית של 30° או 60°', group: 'ישרים וזוויות', kw: ['re:(^|[^0-9])(30|60)($|[^0-9])'] },
  { id: 'triangle', label: 'משולש', group: 'משולשים', kw: ['משולש'] },
  { id: 'two-triangles', label: 'שני משולשים', group: 'משולשים', kw: ['שני משולשים', 'המשולשים'] },
  { id: 'common-side', label: 'צלע משותפת', group: 'משולשים', kw: ['משותפת', 'משותף'] },
  { id: 'equal-sides', label: 'קטעים או צלעות שווים', group: 'משולשים', kw: ['re:[A-Z]{2}\\s*=\\s*[A-Z]{2}', 'צלעות שוות', 'קטעים שווים'] },
  { id: 'side-lengths', label: 'אורכי צלעות ידועים', group: 'משולשים', kw: ['אורך', 'ס"מ', 're:[A-Z]{2}\\s*=\\s*\\d'] },
  { id: 'isosceles', label: 'משולש שווה שוקיים', group: 'משולשים', kw: ['שווה שוקיים', 'שווה-שוקיים'] },
  { id: 'equilateral', label: 'משולש שווה צלעות', group: 'משולשים', kw: ['שווה צלעות', 'שווה-צלעות'] },
  { id: 'right-triangle', label: 'משולש ישר זווית', group: 'משולשים', kw: ['ישר זווית', 'ישר-זווית', 'יתר', 'ניצב'] },
  { id: 'right-angle', label: 'זווית ישרה', group: 'משולשים', kw: ['זווית ישרה', '90', '⊥'] },
  { id: 'exterior-angle', label: 'זווית חיצונית / המשך צלע', group: 'משולשים', kw: ['חיצונית', 'המשך', 'מאריכים', 'הארכת'] },
  { id: 'midpoint', label: 'אמצע קטע', group: 'קטעים מיוחדים', kw: ['אמצע', 'חוצה את הצלע', 'חוצה את הקטע'] },
  { id: 'two-midpoints', label: 'אמצעים של שתי צלעות', group: 'קטעים מיוחדים', kw: ['אמצעי', 'קטע אמצעים'] },
  { id: 'median', label: 'תיכון', group: 'קטעים מיוחדים', kw: ['תיכון'] },
  { id: 'altitude', label: 'גובה / אנך', group: 'קטעים מיוחדים', kw: ['גובה', 'אנך', 'מאונך', '⊥'] },
  { id: 'angle-bisector', label: 'חוצה זווית', group: 'קטעים מיוחדים', kw: ['חוצה זווית', 'חוצה את הזווית', 'חוצה את זווית', 'חוצי הזוויות'] },
  { id: 'perpendicular-bisector', label: 'אנך אמצעי', group: 'קטעים מיוחדים', kw: ['אנך אמצעי'] },
  { id: 'distance', label: 'מרחק מנקודה לישר', group: 'קטעים מיוחדים', kw: ['מרחק'] },
  { id: 'ratio', label: 'יחס או פרופורציה', group: 'קטעים מיוחדים', kw: ['יחס', 'פרופורצי', 're:\\d\\s*:\\s*\\d'] },
  { id: 'area', label: 'שטח', group: 'קטעים מיוחדים', kw: ['שטח'] },
  { id: 'polygon', label: 'מצולע', group: 'מרובעים ומצולעים', kw: ['מצולע', 'מחומש', 'משושה', 'מתומן'] },
  { id: 'quadrilateral', label: 'מרובע', group: 'מרובעים ומצולעים', kw: ['מרובע'] },
  { id: 'parallelogram', label: 'מקבילית', group: 'מרובעים ומצולעים', kw: ['מקבילית'] },
  { id: 'rectangle', label: 'מלבן', group: 'מרובעים ומצולעים', kw: ['מלבן'] },
  { id: 'rhombus', label: 'מעוין', group: 'מרובעים ומצולעים', kw: ['מעוין'] },
  { id: 'square', label: 'ריבוע', group: 'מרובעים ומצולעים', kw: ['ריבוע'] },
  { id: 'trapezoid', label: 'טרפז', group: 'מרובעים ומצולעים', kw: ['טרפז'] },
  { id: 'kite', label: 'דלתון', group: 'מרובעים ומצולעים', kw: ['דלתון'] },
  { id: 'diagonals', label: 'אלכסונים', group: 'מרובעים ומצולעים', kw: ['אלכסון'] },
  { id: 'circle', label: 'מעגל', group: 'מעגל', kw: ['מעגל'] },
  { id: 'radius', label: 'רדיוס', group: 'מעגל', kw: ['רדיוס'] },
  { id: 'diameter', label: 'קוטר', group: 'מעגל', kw: ['קוטר'] },
  { id: 'chord', label: 'מיתר', group: 'מעגל', kw: ['מיתר'] },
  { id: 'arc', label: 'קשת', group: 'מעגל', kw: ['קשת'] },
  { id: 'central-angle', label: 'זווית מרכזית', group: 'מעגל', kw: ['זווית מרכזית', 'מרכז המעגל'] },
  { id: 'inscribed-angle', label: 'זווית היקפית', group: 'מעגל', kw: ['היקפית', 'על המעגל'] },
  { id: 'tangent', label: 'משיק', group: 'מעגל', kw: ['משיק'] },
  { id: 'two-tangents', label: 'שני משיקים מאותה נקודה', group: 'מעגל', kw: ['שני משיקים', 'משיקים'] },
  { id: 'secant', label: 'חותך מנקודה מחוץ למעגל', group: 'מעגל', kw: ['חותכים', 'מחוץ למעגל'] },
  { id: 'cyclic-quad', label: 'מרובע חסום במעגל', group: 'מעגל', kw: ['חסום במעגל', 'בר חסימה', 'בר-חסימה'] },
  { id: 'tangential-quad', label: 'מרובע חוסם מעגל', group: 'מעגל', kw: ['חוסם מעגל'] },
  { id: 'inscribed-circle', label: 'מעגל חסום במצולע', group: 'מעגל', kw: ['מעגל חסום', 'חסום במשולש', 'חסום בו מעגל'] },
  { id: 'circumscribed-circle', label: 'מעגל חוסם', group: 'מעגל', kw: ['מעגל חוסם', 'חוסם את'] },
  { id: 'two-circles', label: 'שני מעגלים', group: 'מעגל', kw: ['שני מעגלים', 'מעגלים'] },
];

export const GOALS: Tag[] = [
  { id: 'prove-equal-angles', label: 'להוכיח שזוויות שוות', group: 'מה צריך?', kw: [] },
  { id: 'prove-equal-segments', label: 'להוכיח שקטעים שווים', group: 'מה צריך?', kw: [] },
  { id: 'prove-parallel', label: 'להוכיח מקבילות', group: 'מה צריך?', kw: [] },
  { id: 'prove-perpendicular', label: 'להוכיח ניצבות', group: 'מה צריך?', kw: [] },
  { id: 'prove-right-angle', label: 'להוכיח זווית ישרה', group: 'מה צריך?', kw: [] },
  { id: 'prove-congruent', label: 'להוכיח חפיפה', group: 'מה צריך?', kw: [] },
  { id: 'prove-similar', label: 'להוכיח דמיון', group: 'מה צריך?', kw: [] },
  { id: 'prove-isosceles', label: 'להוכיח משולש שווה שוקיים', group: 'מה צריך?', kw: [] },
  { id: 'prove-quad-type', label: 'להוכיח סוג מרובע', group: 'מה צריך?', kw: [] },
  { id: 'prove-midpoint', label: 'להוכיח שנקודה היא אמצע', group: 'מה צריך?', kw: [] },
  { id: 'prove-cyclic', label: 'להוכיח שמרובע בר-חסימה', group: 'מה צריך?', kw: [] },
  { id: 'prove-tangent', label: 'להוכיח שישר משיק', group: 'מה צריך?', kw: [] },
  { id: 'prove-collinear', label: 'להוכיח שישר עובר בנקודה', group: 'מה צריך?', kw: [] },
  { id: 'find-angle', label: 'למצוא זווית', group: 'מה צריך?', kw: [] },
  { id: 'find-length', label: 'למצוא אורך', group: 'מה צריך?', kw: [] },
  { id: 'find-ratio', label: 'למצוא יחס', group: 'מה צריך?', kw: [] },
  { id: 'find-area', label: 'למצוא שטח', group: 'מה צריך?', kw: [] },
  { id: 'compare', label: 'להשוות צלעות או זוויות', group: 'מה צריך?', kw: [] },
];

export const tagLabel = (id: string): string => GIVENS.find((g) => g.id === id)?.label ?? GOALS.find((g) => g.id === id)?.label ?? id;

function matches(text: string, kw: string): boolean {
  if (kw.startsWith('re:')) return new RegExp(kw.slice(3)).test(text);
  return text.includes(normalizeHebrew(kw));
}

/** Detects givens and goals in a free-text problem description. */
export function detectTags(raw: string): { givens: string[]; goals: string[] } {
  const text = normalizeHebrew(raw);
  const rawUpper = raw;
  const givens = GIVENS.filter((g) => g.kw.some((k) => (k.startsWith('re:') ? matches(rawUpper, k) : matches(text, k)))).map((g) => g.id);
  // Split the text at the word "prove/find" so goal detection looks at what follows it.
  const goals = new Set<string>();
  const proveIdx = text.search(/הוכ|הראו|הראה|להראות/);
  const findIdx = text.search(/מצא|חשב|כמה|מהו|מהי|מה ה/);
  const tail = proveIdx >= 0 ? text.slice(proveIdx) : '';
  const ftail = findIdx >= 0 ? text.slice(findIdx) : '';
  // Hebrew patterns are normalized the same way as the text (final letters, dashes).
  const has = (pattern: string, s: string) => new RegExp(normalizeHebrew(pattern)).test(s);
  if (tail) {
    if (has('מקביל|∥', tail)) goals.add('prove-parallel');
    if (has('מאונ|ניצב|⊥', tail)) goals.add('prove-perpendicular');
    if (has('ישרה|90', tail)) goals.add('prove-right-angle');
    if (has('חופפ', tail)) goals.add('prove-congruent');
    if (has('דומים|דומה|דמיון', tail)) goals.add('prove-similar');
    if (has('שווה שוקיים', tail)) goals.add('prove-isosceles');
    if (has('(הוא|היא) (מקבילית|מלבן|מעוין|ריבוע|טרפז|דלתון)', tail)) goals.add('prove-quad-type');
    if (has('אמצע', tail)) goals.add('prove-midpoint');
    if (has('בר.חסימה|חסום במעגל|לחסום', tail)) goals.add('prove-cyclic');
    if (has('משיק', tail)) goals.add('prove-tangent');
    if (has('∢|זווית|זוויות', tail) && has('שוו|=', tail)) goals.add('prove-equal-angles');
    const rawTail = raw.slice(Math.max(0, raw.search(/הוכ|הראו|הראה|להראות/)));
    if (/[A-Za-z]{2}\s*=\s*[A-Za-z]{2}/.test(rawTail) && !has('∢|זווית', tail)) goals.add('prove-equal-segments');
    if (has('עובר|על ישר אחד', tail)) goals.add('prove-collinear');
  }
  if (ftail) {
    if (has('זווית|∢', ftail)) goals.add('find-angle');
    if (has('אורך|צלע|רדיוס|קוטר|גובה|היקף', ftail)) goals.add('find-length');
    if (has('יחס', ftail)) goals.add('find-ratio');
    if (has('שטח', ftail)) goals.add('find-area');
  }
  return { givens, goals: [...goals] };
}

export interface Recommendation {
  theorem: Theorem;
  score: number;
  matchedGivens: string[];
  matchedGoals: string[];
  matchedKeywords: string[];
}

export function recommend(givens: string[], goals: string[], freeText = '', limit = 8): Recommendation[] {
  const text = normalizeHebrew(freeText);
  const out: Recommendation[] = [];
  for (const t of theorems) {
    const mg = t.givens.filter((g) => givens.includes(g));
    const mgo = t.goals.filter((g) => goals.includes(g));
    const mk = text ? t.keywords.filter((k) => k.length > 2 && text.includes(normalizeHebrew(k))) : [];
    if (!mg.length && !mk.length) continue;
    let score = 3 * mg.length + 2.5 * mgo.length + 1.5 * mk.length;
    // reward theorems whose required givens are mostly present
    score += (2 * mg.length) / Math.max(1, t.givens.length);
    if (t.status === 'official') score += 0.4;
    if (goals.length && !mgo.length) score -= 1.5;
    out.push({ theorem: t, score, matchedGivens: mg, matchedGoals: mgo, matchedKeywords: mk });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
