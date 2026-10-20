import { niceTex } from './math/fraction';
import { type Node, parse, toTex, variables, equivalent, compile, evaluate } from './math/expr';
import { toPoly, toRational, denominators, polyRoots, rootValue, numericRoots, Poly } from './math/poly';

export type LineStatus = 'ok' | 'error' | 'unparsed' | 'start';

export interface LineCheck {
  index: number;
  raw: string;
  tex?: string;
  status: LineStatus;
  message?: string;
}

export interface CheckResult {
  lines: LineCheck[];
  firstError?: number;
  summary: string;
  finalCorrect?: boolean;
  kind: 'equation' | 'expression' | 'unknown';
}

type SolSet = { all: true } | { all: false; values: number[] };

interface ParsedLine {
  raw: string;
  tex: string;
  kind: 'equation' | 'expression' | 'answer';
  L?: Node;
  R?: Node;
  expr?: Node;
  set?: SolSet;
}

const HEB = /[֐-׿]+/g;

function normalize(line: string): string {
  return line
    .replace(/(^|\s)(?:או|וגם)(?=\s|$)/g, ' , ')
    .replace(HEB, ' ')
    .replace(/[⇒⇐→]|=>|<=>|⟹/g, ' ')
    .replace(/([a-z])_?[12]\s*=/g, '$1 =')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();
}

/** Parses "x = 2, x = -3", "x = 2, -3", "x1 = 2 x2 = 3" as an answer set. */
function parseAnswer(s: string, v: string): number[] | null {
  const parts = s
    .split(/[,;]|\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const vals: number[] = [];
  for (const p of parts) {
    const m = p.match(/^(?:[a-z]\s*=\s*)?(.+)$/);
    if (!m) return null;
    if (p.includes('=') && !p.trim().startsWith(v)) return null;
    try {
      const n = parse(m[1]);
      if (variables(n).size) return null;
      vals.push(evaluate(n));
    } catch {
      return null;
    }
  }
  return vals;
}

function solutionSet(L: Node, R: Node, v: string): SolSet {
  const RL = toRational(L, v);
  const RR = toRational(R, v);
  if (RL && RR) {
    const N = RL.num.mul(RR.den).sub(RR.num.mul(RL.den));
    const excluded = [...denominators(L, v), ...denominators(R, v)].flatMap((d) => polyRoots(d).map(rootValue));
    if (N.isZero()) return { all: true };
    const vals = polyRoots(N)
      .map(rootValue)
      .filter((x) => !excluded.some((e) => Math.abs(e - x) < 1e-7));
    return { all: false, values: vals };
  }
  const f = compile({ k: 'sub', a: L, b: R }, v);
  const vals = numericRoots(f, -60, 60, 24000).filter((x) => Math.abs(f(x)) < 1e-6);
  return { all: false, values: vals };
}

function sameSet(a: SolSet, b: SolSet): boolean {
  if (a.all || b.all) return a.all === b.all;
  if (a.values.length !== b.values.length) return false;
  const sa = [...a.values].sort((x, y) => x - y);
  const sb = [...b.values].sort((x, y) => x - y);
  return sa.every((x, i) => Math.abs(x - sb[i]) < 1e-6 * Math.max(1, Math.abs(x)));
}

const fmtSet = (s: SolSet) => (s.all ? 'כל המספרים' : s.values.length ? s.values.map((x) => `$${niceTex(Math.round(x * 1000) / 1000)}$`).join(', ') : 'אין פתרון');

function diagnose(prev: ParsedLine, cur: ParsedLine, v: string): string {
  const ps = prev.set!,
    cs = cur.set!;
  if (!ps.all && !cs.all) {
    const lost = ps.values.filter((x) => !cs.values.some((y) => Math.abs(x - y) < 1e-6));
    const extra = cs.values.filter((x) => !ps.values.some((y) => Math.abs(x - y) < 1e-6));
    if (cur.kind === 'answer') {
      if (extra.length && !lost.length)
        return `הערך ${extra.map((x) => `$${v} = ${niceTex(Math.round(x * 1000) / 1000)}$`).join(', ')} אינו מקיים את המשוואה שבשורה הקודמת. הציבו אותו ובדקו.`;
      if (lost.length && !extra.length) return `חסר פתרון: למשוואה יש ${ps.values.length} פתרונות, ורשמת רק ${cs.values.length}. בדקו אם שכחתם את $\\pm$ או גורם אחד מהמכפלה.`;
      return 'התשובה אינה מקיימת את המשוואה. הציבו את הערך שקיבלתם בשורה הקודמת ובדקו.';
    }
    if (lost.length && !extra.length)
      return `במעבר הזה "נעלם" פתרון (${lost.map((x) => `$${v} = ${niceTex(Math.round(x * 1000) / 1000)}$`).join(', ')}). אולי חילקתם בביטוי שמכיל את $${v}$? במקום לחלק, כדאי להוציא גורם משותף.`;
    if (extra.length && !lost.length)
      return 'במעבר הזה נוסף פתרון שלא היה קודם. זה קורה כשמעלים בריבוע או כופלים בביטוי שעלול להתאפס. אם זה המהלך שעשיתם, בדקו בסוף כל פתרון במשוואה המקורית; אם לא – חפשו טעות חישוב.';
  }
  // polynomial-level diagnosis
  const pl = prev.L && toPoly(prev.L, v),
    pr = prev.R && toPoly(prev.R, v);
  const cl = cur.L && toPoly(cur.L, v),
    cr = cur.R && toPoly(cur.R, v);
  if (pl && pr && cl && cr) {
    const Dp = pl.sub(pr);
    const Dc = cl.sub(cr);
    const leftSame = pl.equals(cl);
    const rightSame = pr.equals(cr);
    if (leftSame && !rightSame) return 'אגף שמאל לא השתנה, אבל אגף ימין אינו שווה לאגף ימין בשורה הקודמת. בדקו את הפישוט או את פתיחת הסוגריים באגף ימין.';
    if (rightSame && !leftSame) return 'אגף ימין לא השתנה, אבל אגף שמאל אינו שווה לאגף שמאל בשורה הקודמת. בדקו את הפישוט או את פתיחת הסוגריים באגף שמאל.';
    const E = Dp.sub(Dc);
    if (E.c.filter((c) => !c.isZero()).length === 1) {
      const half = E.scale(0.5);
      return `נראה שהעברתם את האיבר $${half.toTex(v)}$ (או $${half.neg().toTex(v)}$) לאגף השני בלי להחליף את הסימן שלו. איבר שעובר אגף מחליף סימן.`;
    }
    // multiplied/divided only part of the terms?
    for (const k of [2, 3, 4, 5, 10, -1, -2, 0.5]) {
      const scaled = Dp.scale(k);
      const diff = scaled.sub(Dc);
      if (diff.c.filter((c) => !c.isZero()).length === 1)
        return `נראה שכפלתם (או חילקתם) את המשוואה ב-$${niceTex(k)}$, אבל לא את כל האיברים. כשכופלים משוואה, כופלים כל איבר בשני האגפים.`;
    }
  }
  return `המשוואה בשורה הזו אינה שקולה לשורה הקודמת: לשורה הקודמת יש פתרונות ${fmtSet(ps)}, ולשורה הזו ${fmtSet(cs)}. בדקו את החישוב במעבר הזה.`;
}

function expressionDiagnosis(prev: Node, cur: Node, v: string): string {
  const P = toPoly(prev, v);
  const C = toPoly(cur, v);
  if (P && C) {
    const E = P.sub(C);
    const terms = E.c.map((c, i) => ({ c, i })).filter((t) => !t.c.isZero());
    if (terms.length === 1) {
      const t = new Poly(E.c);
      const sq = /\^\s*\{?2/.test(toTex(prev)) || /\)\s*\^/.test(toTex(prev));
      return `ההפרש בין השורה הזו לקודמת הוא $${t.toTex(v)}$. ${sq ? 'אם פתחתם ריבוע, זכרו: $(a+b)^2 = a^2 + 2ab + b^2$ – לא שוכחים את האיבר האמצעי.' : 'בדקו סימנים ופתיחת סוגריים.'}`;
    }
    if (P.equals(C.neg())) return 'השורה הזו שווה לקודמת עם סימן הפוך. כנראה טעות בסימן (למשל מינוס לפני סוגריים).';
  }
  return 'הביטוי בשורה הזו אינו שווה לביטוי בשורה הקודמת. בדקו את פתיחת הסוגריים ואת הסימנים.';
}

export function checkSolution(problem: string, work: string): CheckResult {
  const rawLines = [problem, ...work.split('\n')].map((l) => l.trim()).filter(Boolean);
  const lines: LineCheck[] = [];
  const parsed: (ParsedLine | null)[] = [];
  const vars = new Set<string>();
  for (const raw of rawLines) {
    const s = normalize(raw);
    try {
      const rel = s.match(/=/g)?.length ?? 0;
      if (rel === 0) {
        const expr = parse(s);
        variables(expr, vars);
        parsed.push({ raw, tex: toTex(expr), kind: 'expression', expr });
      } else if (rel === 1 || /,/.test(s)) {
        const idx = s.indexOf('=');
        const left = s.slice(0, idx).trim();
        const right = s.slice(idx + 1).trim();
        if (/^[a-z]$/.test(left) && !/[a-z]/.test(right.replace(/[a-z]\s*=/g, '').replace(/sqrt|pi|e\b/g, ''))) {
          const vals = parseAnswer(s, left);
          if (vals) {
            vars.add(left);
            parsed.push({ raw, tex: `${left} = ${vals.map((x) => niceTex(Math.round(x * 1000) / 1000)).join(',\\ ')}`, kind: 'answer', set: { all: false, values: vals } });
            continue;
          }
        }
        if (rel !== 1) throw new Error('multi');
        const L = parse(left);
        const R = parse(right);
        variables(L, vars);
        variables(R, vars);
        parsed.push({ raw, tex: `${toTex(L)} = ${toTex(R)}`, kind: 'equation', L, R });
      } else throw new Error('multi');
    } catch {
      parsed.push(null);
    }
  }
  const v = vars.has('x') ? 'x' : [...vars][0] ?? 'x';
  if (vars.size > 1) {
    return {
      lines: rawLines.map((raw, i) => ({ index: i, raw, status: i === 0 ? 'start' : 'unparsed' })),
      summary: 'יש כאן יותר ממשתנה אחד. הבדיקה האוטומטית תומכת כרגע בתרגילים במשתנה אחד (משוואות או פישוט ביטויים). לבדיקת מערכות או גאומטריה השתמשו בבדיקה עם AI.',
      kind: 'unknown',
    };
  }
  const kinds = parsed.filter(Boolean).map((p) => p!.kind);
  const kind: CheckResult['kind'] = kinds.includes('equation') ? 'equation' : kinds.length ? 'expression' : 'unknown';
  for (const p of parsed) if (p && p.kind === 'equation') p.set = solutionSet(p.L!, p.R!, v);
  let firstError: number | undefined;
  let prev: ParsedLine | null = null;
  parsed.forEach((p, i) => {
    const raw = rawLines[i];
    if (!p) {
      lines.push({ index: i, raw, status: 'unparsed', message: 'לא הצלחנו לקרוא את השורה הזו. כתבו ביטוי או משוואה אחת בכל שורה.' });
      return;
    }
    if (!prev) {
      lines.push({ index: i, raw, tex: p.tex, status: 'start' });
      prev = p;
      return;
    }
    let ok = true;
    let message: string | undefined;
    if (p.kind === 'expression' && prev.kind === 'expression') {
      ok = equivalent(prev.expr!, p.expr!, [v]);
      if (!ok) message = expressionDiagnosis(prev.expr!, p.expr!, v);
    } else if (p.set && prev.set) {
      ok = sameSet(prev.set, p.set);
      if (!ok) message = diagnose(prev, p, v);
    } else {
      lines.push({ index: i, raw, tex: p.tex, status: 'unparsed', message: 'אי אפשר להשוות שורה מסוג זה לשורה הקודמת.' });
      return;
    }
    if (!ok && firstError === undefined) firstError = i;
    lines.push({ index: i, raw, tex: p.tex, status: ok ? 'ok' : 'error', message });
    if (ok) prev = p;
    else prev = p; // continue checking relative to the student's own line
  });
  const firstSet = parsed.find((p) => p?.set)?.set;
  const last = [...parsed].reverse().find((p) => p);
  const finalCorrect = firstSet && last?.set ? sameSet(firstSet, last.set) : undefined;
  let summary: string;
  if (firstError === undefined) {
    summary =
      finalCorrect === false
        ? 'כל מעבר נראה תקין, אבל התשובה הסופית עדיין לא נכונה. בדקו את השורה האחרונה.'
        : last?.kind === 'answer'
          ? 'כל הכבוד! כל המעברים שקולים, והתשובה נכונה. ✓'
          : 'כל המעברים עד כה תקינים. המשיכו! ✓';
  } else summary = `נמצאה בעיה בשורה ${firstError + 1}. קראו את ההסבר, תקנו את השורה ונסו שוב. אתם קרובים!`;
  return { lines, firstError, summary, finalCorrect, kind };
}
