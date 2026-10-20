import { Fraction } from '../math/fraction';
import { type Node, parse, variables, ParseError, evaluate } from '../math/expr';
import type { Solution } from '../../types';
import { SolveError, type Rel } from './common';
import { solveEquation } from './equations';
import { solveSystem } from './systems';
import { solveInequality } from './inequalities';
import { derivativeSolution, investigateSolution, integralSolution, tangentSolution } from './calculus';
import { expressionSolution } from './expression';

export type SolveMode = 'auto' | 'equation' | 'derivative' | 'investigate' | 'integral' | 'tangent' | 'simplify';

export const SOLVE_MODES: { id: SolveMode; label: string; placeholder: string }[] = [
  { id: 'auto', label: 'זיהוי אוטומטי', placeholder: 'למשל: 3(x-2)+4=2x+7' },
  { id: 'equation', label: 'משוואה / אי-שוויון', placeholder: 'x^2-5x+6=0   או   2x-1>3' },
  { id: 'derivative', label: 'נגזרת', placeholder: 'f(x) = x^3 - 3x' },
  { id: 'investigate', label: 'חקירה וקיצון', placeholder: 'f(x) = x^3 - 3x' },
  { id: 'integral', label: 'אינטגרל', placeholder: '3x^2 + 2x' },
  { id: 'tangent', label: 'משיק לגרף', placeholder: 'f(x) = x^2 - 4x' },
  { id: 'simplify', label: 'פישוט ופירוק', placeholder: '(x+3)^2 - 9' },
];

export type SolveResult = { ok: true; solution: Solution } | { ok: false; error: string };

export interface SolveExtra {
  a?: string;
  b?: string;
  x0?: string;
}

const HEBREW = /[֐-׿]+/g;

function stripWords(s: string): string {
  return s
    .replace(/\bdx\b/g, ' ')
    .replace(/∫/g, ' ')
    .replace(HEBREW, ' ')
    .replace(/[?؟!]/g, ' ')
    .replace(/^[\s:.,-]+|[\s:.,]+$/g, '')
    .trim();
}

function stripFunctionPrefix(s: string): string {
  return s.replace(/^\s*(?:[fgh]\s*\(\s*x\s*\)|y)\s*=\s*/, '');
}

function num(s: string): Fraction {
  const n = parse(s.trim());
  if (variables(n).size) throw new SolveError(`"${s}" אינו מספר`);
  return Fraction.fromDecimal(evaluate(n));
}

function normRel(s: string): string {
  return s.replace(/<=|=</g, '≤').replace(/>=|=>/g, '≥').replace(/≦/g, '≤').replace(/≧/g, '≥');
}

function splitRelation(s: string): { L: string; R: string; rel: Rel } | null {
  const t = normRel(s);
  const m = t.match(/[=<>≤≥]/g);
  if (!m) return null;
  if (m.length > 1) throw new SolveError('יש יותר מסימן שוויון אחד. כדי לפתור מערכת, כתבו כל משוואה בשורה נפרדת.');
  const idx = t.search(/[=<>≤≥]/);
  const op = t[idx];
  const rel: Rel = op === '=' ? '=' : op === '<' ? '<' : op === '>' ? '>' : op === '≤' ? '\\le' : '\\ge';
  return { L: t.slice(0, idx), R: t.slice(idx + 1), rel };
}

function singleVar(...nodes: Node[]): string {
  const vs = new Set<string>();
  nodes.forEach((n) => variables(n, vs));
  if (vs.size > 1) throw new SolveError(`יש כמה משתנים (${[...vs].join(', ')}). למשוואה אחת צריך נעלם אחד; למערכת – כתבו שתי משוואות בשורות נפרדות.`);
  return vs.size ? [...vs][0] : 'x';
}

export function detectMode(raw: string): SolveMode {
  const relations = raw.split(/\n|;/).filter((l) => /[=<>≤≥]/.test(l));
  if (relations.length >= 2) return 'equation';
  if (/∫|אינטגרל|קדומה/.test(raw)) return 'integral';
  if (/משיק/.test(raw)) return 'tangent';
  if (/קיצון|חקור|חקרו|חקירה|עלייה|ירידה|עולה|יורדת/.test(raw)) return 'investigate';
  if (/נגזרת|גזור|גזרו|גזירה|'\s*\(\s*x\s*\)/.test(raw)) return 'derivative';
  if (/פרק|פירוק|פשט|פשטו|צמצם|צמצמו|פתח|פתחו/.test(raw)) return 'simplify';
  if (/^\s*(?:[fgh]\s*\(\s*x\s*\)|y)\s*=/.test(raw)) return 'investigate';
  if (/[=<>≤≥]/.test(raw)) return 'equation';
  return 'simplify';
}

function parseBounds(raw: string): [string, string] | null {
  const m =
    raw.match(/∫\s*_\s*\{?\s*(-?[\d./]+)\s*\}?\s*\^\s*\{?\s*(-?[\d./]+)\s*\}?/) ??
    raw.match(/מ\s*-?\s*(-?[\d./]+)\s*עד\s*-?\s*(-?[\d./]+)/) ??
    raw.match(/בין\s*(-?[\d./]+)\s*(?:ל|ו|עד)\s*-?\s*(-?[\d./]+)/);
  return m ? [m[1], m[2]] : null;
}

export function solveProblem(raw: string, mode: SolveMode = 'auto', extra: SolveExtra = {}): SolveResult {
  try {
    if (!raw.trim()) throw new SolveError('כתבו תרגיל.');
    const m = mode === 'auto' ? detectMode(raw) : mode;
    switch (m) {
      case 'equation': {
        const lines = raw
          .split(/\n|;/)
          .map((l) => l.trim())
          .filter(Boolean);
        let parts = lines;
        if (lines.length === 1) {
          const byComma = lines[0].split(',').map((x) => x.trim());
          if (byComma.length === 2 && byComma.every((p) => /=/.test(p))) parts = byComma;
        }
        if (parts.length >= 2) {
          const eqs = parts.map((p) => {
            const r = splitRelation(stripWords(p));
            if (!r || r.rel !== '=') throw new SolveError('במערכת כל שורה צריכה להיות משוואה (עם =).');
            return { L: parse(r.L), R: parse(r.R) };
          });
          return { ok: true, solution: solveSystem(eqs) };
        }
        const r = splitRelation(stripWords(parts[0]));
        if (!r) return solveProblem(raw, 'simplify');
        const L = parse(r.L);
        const R = parse(r.R);
        const v = singleVar(L, R);
        if (r.rel === '=') return { ok: true, solution: solveEquation(L, R, v) };
        return { ok: true, solution: solveInequality(L, R, r.rel, v) };
      }
      case 'derivative':
      case 'investigate': {
        const f = parse(stripFunctionPrefix(stripWords(raw)));
        const v = singleVar(f);
        return { ok: true, solution: m === 'derivative' ? derivativeSolution(f, v) : investigateSolution(f, v) };
      }
      case 'integral': {
        const b = extra.a !== undefined && extra.b !== undefined && extra.a !== '' && extra.b !== '' ? [extra.a, extra.b] : parseBounds(raw);
        let body = raw.replace(/∫\s*_\s*\{?\s*-?[\d./]+\s*\}?\s*\^\s*\{?\s*-?[\d./]+\s*\}?/, '');
        body = body.replace(/(מ\s*-?\s*-?[\d./]+\s*עד\s*-?\s*-?[\d./]+)|(בין\s*-?[\d./]+\s*(?:ל|ו|עד)\s*-?\s*-?[\d./]+)/, '');
        const f = parse(stripFunctionPrefix(stripWords(body)));
        const v = singleVar(f);
        return { ok: true, solution: integralSolution(f, v, b ? [num(b[0]), num(b[1])] : undefined) };
      }
      case 'tangent': {
        let x0 = extra.x0;
        let body = raw;
        if (!x0) {
          const mm = raw.match(/(?:x|איקס)\s*=\s*(-?[\d./]+)\s*$/) ?? raw.match(/בנקודה\s*(?:ש\s*-?\s*)?(?:x\s*=\s*)?(-?[\d./]+)/);
          if (mm) {
            x0 = mm[1];
            body = raw.replace(mm[0], '');
          }
        }
        if (!x0) throw new SolveError('כתבו גם את שיעור ה-x של נקודת ההשקה (למשל: x=2).');
        body = body.replace(/,\s*$/, '');
        const f = parse(stripFunctionPrefix(stripWords(body).replace(/,\s*$/, '')));
        const v = singleVar(f);
        return { ok: true, solution: tangentSolution(f, num(x0), v) };
      }
      case 'simplify': {
        const n = parse(stripFunctionPrefix(stripWords(raw)));
        return { ok: true, solution: expressionSolution(n) };
      }
      default:
        throw new SolveError('סוג תרגיל לא מוכר.');
    }
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: `לא הצלחנו לקרוא את הביטוי: ${e.message}` };
    if (e instanceof SolveError) return { ok: false, error: e.message };
    return { ok: false, error: (e as Error).message || 'אירעה שגיאה בפתרון.' };
  }
}
