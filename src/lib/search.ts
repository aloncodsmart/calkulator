import type { Concept, DiagramShape, Formula, FormulaSection, Theorem } from '../types';
import { concepts, diagramById, formulaSections, theorems } from '../data';

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Lower-case, strip niqqud, unify final letters, quotes and dashes. */
export function normalizeHebrew(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[״“”]/g, '"')
    .replace(/[׳‘’]/g, "'")
    .replace(/[-–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIXES = ['וה', 'שה', 'מה', 'בה', 'לה', 'כה', 'ה', 'ו', 'ב', 'ל', 'מ', 'ש', 'כ'];

/** A token plus its variants without common one/two-letter prefixes and plural suffixes. */
export function tokenVariants(token: string): string[] {
  const out = new Set([token]);
  for (const p of PREFIXES) if (token.startsWith(p) && token.length - p.length >= 3) out.add(token.slice(p.length));
  for (const t of [...out]) {
    for (const suf of ['ימ', 'ות', 'יימ']) if (t.endsWith(suf) && t.length - suf.length >= 3) out.add(t.slice(0, -suf.length));
  }
  return [...out];
}

export type SearchHit =
  | { kind: 'theorem'; item: Theorem; score: number }
  | { kind: 'concept'; item: Concept; score: number }
  | { kind: 'formula'; item: Formula; section: FormulaSection; score: number };

interface Field {
  text: string;
  weight: number;
}

function scoreFields(query: string, tokens: string[][], title: string, fields: Field[]): number {
  const t = normalizeHebrew(title);
  let score = 0;
  if (t === query) score += 120;
  else if (t.startsWith(query)) score += 70;
  else if (t.includes(query)) score += 45;
  let allTokens = true;
  for (const variants of tokens) {
    let best = 0;
    if (variants.some((v) => t.includes(v))) best = 18;
    for (const f of fields) if (variants.some((v) => f.text.includes(v))) best = Math.max(best, f.weight);
    if (!best) allTokens = false;
    score += best;
  }
  if (!allTokens) score *= 0.35;
  return score;
}

export function search(raw: string, opts: { topic?: string; shape?: DiagramShape } = {}): SearchHit[] {
  const query = normalizeHebrew(raw);
  const tokens = query ? query.split(' ').filter(Boolean).map(tokenVariants) : [];
  const hits: SearchHit[] = [];
  const shapeOk = (diagramId: string) => !opts.shape || diagramById.get(diagramId)?.shape === opts.shape;
  for (const th of theorems) {
    if (opts.topic && th.topic !== opts.topic) continue;
    if (!shapeOk(th.diagram)) continue;
    const score = query
      ? scoreFields(query, tokens, th.name, [
          { text: normalizeHebrew(th.keywords.join(' ')), weight: 14 },
          { text: normalizeHebrew(th.citation), weight: 9 },
          { text: normalizeHebrew(th.statement), weight: 6 },
          { text: normalizeHebrew(th.useWhen), weight: 3 },
        ])
      : 1;
    if (score > 0) hits.push({ kind: 'theorem', item: th, score: score + 2 });
  }
  for (const c of concepts) {
    if (opts.topic && c.topic !== opts.topic) continue;
    if (!shapeOk(c.diagram)) continue;
    const score = query
      ? scoreFields(query, tokens, c.term, [
          { text: normalizeHebrew((c.aliases ?? []).join(' ')), weight: 16 },
          { text: normalizeHebrew(c.simple), weight: 6 },
          { text: normalizeHebrew(c.formal), weight: 4 },
        ])
      : 1;
    if (score > 0) hits.push({ kind: 'concept', item: c, score });
  }
  if (!opts.shape) {
    for (const s of formulaSections) {
      if (opts.topic && s.topic !== opts.topic) continue;
      for (const f of s.items) {
        const score = query
          ? scoreFields(query, tokens, f.name, [
              { text: normalizeHebrew(s.title), weight: 8 },
              { text: normalizeHebrew(f.note ?? ''), weight: 3 },
            ])
          : 0;
        if (score > 0) hits.push({ kind: 'formula', item: f, section: s, score: score - 1 });
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}
