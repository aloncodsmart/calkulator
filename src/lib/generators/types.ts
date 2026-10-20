import type { DiagramSpec, Hints, ProofStep, SolutionStep } from '../../types';
import { parse, evaluate, variables, equivalent } from '../math/expr';

export type Difficulty = 1 | 2 | 3;

export type AnswerSpec =
  /** One or more numbers (any order), e.g. roots. */
  | { kind: 'numbers'; values: number[]; tol?: number; count?: number }
  /** An algebraic expression equivalent to `expr`; `product` requires a factored form. */
  | { kind: 'expression'; expr: string; vars: string[]; product?: boolean }
  | { kind: 'choice'; options: string[]; correct: number };

export interface Exercise {
  id: string;
  topic: string;
  difficulty: Difficulty;
  /** Rich text (Hebrew with $…$). */
  question: string;
  diagram?: DiagramSpec | string;
  answer: AnswerSpec;
  answerDisplay: string;
  inputHint?: string;
  hints: Hints;
  steps?: SolutionStep[];
  proof?: ProofStep[];
}

export type Rng = () => number;

export function makeRng(seed = Date.now() % 2147483647): Rng {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const int = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export const nonZero = (rng: Rng, a: number, b: number) => {
  let x = 0;
  while (x === 0) x = int(rng, a, b);
  return x;
};
export const shuffle = <T,>(rng: Rng, arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Signed coefficient formatting for building LaTeX / input strings: (2,'x',true) → "2x", (-1,'x',false) → "- x". */
export function term(c: number, v: string, first = false): string {
  if (c === 0) return '';
  const sign = c < 0 ? '-' : first ? '' : '+';
  const abs = Math.abs(c);
  const body = v ? `${abs === 1 ? '' : abs}${v}` : `${abs}`;
  return first ? `${sign}${body}` : ` ${sign} ${body}`;
}

/** Polynomial ax^2 + bx + c as LaTeX. */
export function polyTex(coefs: number[], v = 'x'): string {
  const deg = coefs.length - 1;
  let out = '';
  coefs.forEach((c, i) => {
    const p = deg - i;
    const vv = p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`;
    out += term(c, vv, out === '');
  });
  return out || '0';
}

function parseNumber(s: string): number | null {
  try {
    const n = parse(s.replace(/,/g, '.').trim());
    if (variables(n).size) return null;
    const v = evaluate(n);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export type CheckOutcome = { correct: boolean; message?: string };

export function checkAnswer(spec: AnswerSpec, input: string | number): CheckOutcome {
  if (spec.kind === 'choice') return { correct: input === spec.correct };
  const raw = String(input).trim();
  if (!raw) return { correct: false, message: 'כתבו תשובה.' };
  if (spec.kind === 'numbers') {
    // separators: comma, semicolon, the word "או"; labels like "x1 =" are ignored
    let parts = raw
      .replace(/[a-zA-Z]_?\d?\s*=/g, ' ')
      .replace(/או|and/g, ',')
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 1 && /\s/.test(parts[0])) {
      const ws = parts[0].split(/\s+/);
      if (ws.length > 1 && ws.every((p) => parseNumber(p) !== null)) parts = ws;
    }
    const values = parts.map(parseNumber);
    if (values.some((v) => v === null)) return { correct: false, message: 'לא הצלחנו לקרוא את התשובה. כתבו מספרים (אפשר שברים כמו 7/2), מופרדים בפסיק.' };
    const got = (values as number[]).sort((a, b) => a - b);
    const want = [...spec.values].sort((a, b) => a - b);
    const tol = spec.tol ?? 1e-6;
    if (got.length !== want.length) {
      return { correct: false, message: want.length > got.length ? `חסרים ערכים: צריך ${want.length} תשובות.` : `יש יותר מדי ערכים: צריך ${want.length}.` };
    }
    const ok = got.every((g, i) => Math.abs(g - want[i]) <= tol * Math.max(1, Math.abs(want[i])));
    return { correct: ok };
  }
  try {
    const n = parse(raw);
    const target = parse(spec.expr);
    const ok = equivalent(n, target, spec.vars);
    if (ok && spec.product && n.k !== 'mul' && n.k !== 'pow' && !(n.k === 'neg' && (n.a.k === 'mul' || n.a.k === 'pow')))
      return { correct: false, message: 'הביטוי שווה, אבל ביקשנו לכתוב אותו כמכפלה (מפורק לגורמים).' };
    return { correct: ok };
  } catch {
    return { correct: false, message: 'לא הצלחנו לקרוא את הביטוי.' };
  }
}
