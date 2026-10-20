import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { concepts, diagrams, formulaSections, theorems, topics, conceptById, theoremById, diagramById, topicById } from '../src/data';
import { makeFrame, referencedPoints, resolvePoints } from '../src/lib/diagram';
import { tryParse } from '../src/lib/math/expr';
import { GIVENS, GOALS } from '../src/lib/recommender';

/** Extracts the $…$ / $$…$$ math segments of a rich-text string. */
function mathSegments(s: string): string[] {
  const out: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2]);
  return out;
}

function renderOk(tex: string): string | null {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'ignore', displayMode: false });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Hebrew letters may appear in math only inside \text{…}. */
function hebrewOutsideText(tex: string): boolean {
  const stripped = tex.replace(/\\text\{[^}]*\}/g, '');
  return /[֐-׿]/.test(stripped);
}

function checkRich(label: string, s: string | undefined, errors: string[]) {
  if (!s) return;
  if ((s.match(/\$/g) || []).length % 2 !== 0) errors.push(`${label}: unbalanced $ in "${s}"`);
  for (const seg of mathSegments(s)) {
    const err = renderOk(seg);
    if (err) errors.push(`${label}: KaTeX error in "${seg}": ${err}`);
    if (hebrewOutsideText(seg)) errors.push(`${label}: Hebrew outside \\text in "${seg}"`);
  }
}

describe('content data', () => {
  it('ids are unique', () => {
    for (const arr of [topics, theorems, concepts, diagrams, formulaSections] as { id: string }[][]) {
      const ids = arr.map((x) => x.id);
      const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      expect(dup, 'duplicate ids').toEqual([]);
    }
  });

  it('has a large dictionary and a full theorem list', () => {
    expect(concepts.length).toBeGreaterThanOrEqual(300);
    expect(theorems.length).toBeGreaterThanOrEqual(100);
  });

  it('theorems are complete and consistent', () => {
    const errors: string[] = [];
    for (const t of theorems) {
      const L = `theorem ${t.id}`;
      for (const f of ['name', 'statement', 'citation', 'useWhen', 'diagram'] as const) if (!t[f]) errors.push(`${L}: missing ${f}`);
      if (!t.conditions.length) errors.push(`${L}: no conditions`);
      if (!t.mistakes.length) errors.push(`${L}: no mistakes`);
      if (!t.example?.steps?.length) errors.push(`${L}: no example steps`);
      if (!['official', 'formula-sheet', 'needs-proof'].includes(t.status)) errors.push(`${L}: bad status`);
      if (!topicById.has(t.topic)) errors.push(`${L}: unknown topic ${t.topic}`);
      if (!diagramById.has(t.diagram)) errors.push(`${L}: unknown diagram ${t.diagram}`);
      if (t.example.diagram && !diagramById.has(t.example.diagram)) errors.push(`${L}: unknown example diagram`);
      if (t.converse?.id && !theoremById.has(t.converse.id)) errors.push(`${L}: unknown converse ${t.converse.id}`);
      for (const r of t.related) if (!conceptById.has(r)) errors.push(`${L}: unknown related concept ${r}`);
      for (const s of t.example.steps) if (s.ref && !theoremById.has(s.ref)) errors.push(`${L}: unknown step ref ${s.ref}`);
      for (const g of t.givens) if (!GIVENS.some((x) => x.id === g)) errors.push(`${L}: unknown given ${g}`);
      for (const g of t.goals) if (!GOALS.some((x) => x.id === g)) errors.push(`${L}: unknown goal ${g}`);
      if (!t.grades.length || !t.units.length) errors.push(`${L}: missing tags`);
      checkRich(L, t.statement, errors);
      checkRich(L, t.example.problem, errors);
      checkRich(L, t.example.answer, errors);
      checkRich(L, t.note, errors);
      checkRich(L, t.useWhen, errors);
      checkRich(L, t.converse?.statement, errors);
      t.conditions.forEach((c) => checkRich(L, c, errors));
      t.mistakes.forEach((c) => checkRich(L, c, errors));
      t.example.steps.forEach((s) => {
        checkRich(L, s.claim, errors);
        checkRich(L, s.reason, errors);
      });
      if (t.formal) {
        const err = renderOk(t.formal);
        if (err) errors.push(`${L}: formal KaTeX error: ${err}`);
        if (hebrewOutsideText(t.formal)) errors.push(`${L}: Hebrew outside \\text in formal`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('a step that cites a theorem uses that theorem\'s citation wording', () => {
    const errors: string[] = [];
    for (const t of theorems)
      for (const s of t.example.steps) {
        if (!s.ref) continue;
        const cited = theoremById.get(s.ref)!;
        if (!s.reason.includes(cited.citation)) errors.push(`${t.id}: step cites ${s.ref} but reason "${s.reason}" ≠ "${cited.citation}"`);
      }
    expect(errors).toEqual([]);
  });

  it('concepts are complete and consistent', () => {
    const errors: string[] = [];
    for (const c of concepts) {
      const L = `concept ${c.id}`;
      if (!c.term || !c.simple || !c.formal) errors.push(`${L}: missing text`);
      if (!diagramById.has(c.diagram)) errors.push(`${L}: unknown diagram ${c.diagram}`);
      if (!topicById.has(c.topic)) errors.push(`${L}: unknown topic ${c.topic}`);
      if (!c.related.length) errors.push(`${L}: no related concepts`);
      for (const r of c.related) if (!conceptById.has(r)) errors.push(`${L}: unknown related ${r}`);
      if (c.related.includes(c.id)) errors.push(`${L}: relates to itself`);
      checkRich(L, c.simple, errors);
      checkRich(L, c.formal, errors);
      checkRich(L, c.example, errors);
    }
    expect(errors).toEqual([]);
  });

  it('every formula renders with KaTeX', () => {
    const errors: string[] = [];
    for (const s of formulaSections) {
      if (!topicById.has(s.topic)) errors.push(`section ${s.id}: unknown topic`);
      for (const f of s.items) {
        const err = renderOk(f.tex);
        if (err) errors.push(`formula ${f.id}: ${err}`);
        if (hebrewOutsideText(f.tex)) errors.push(`formula ${f.id}: Hebrew outside \\text`);
        checkRich(`formula ${f.id}`, f.note, errors);
        checkRich(`formula ${f.id}`, f.name, errors);
        if (!f.units.length) errors.push(`formula ${f.id}: no units`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('every diagram resolves and fits in its view box', () => {
    const errors: string[] = [];
    for (const d of diagrams) {
      try {
        const pts = resolvePoints(d);
        const frame = makeFrame(d);
        for (const name of referencedPoints(d)) if (!pts[name]) errors.push(`diagram ${d.id}: unknown point ${name}`);
        for (const [name, p] of Object.entries(pts)) {
          const v = frame.toView(p);
          if (!Number.isFinite(v[0]) || !Number.isFinite(v[1])) errors.push(`diagram ${d.id}: point ${name} is not finite`);
          else if (v[0] < -2 || v[0] > frame.width + 2 || v[1] < -2 || v[1] > frame.height + 2)
            errors.push(`diagram ${d.id}: point ${name} outside view (${v[0].toFixed(0)}, ${v[1].toFixed(0)})`);
        }
        for (const el of d.elements) {
          if ((el.t === 'fn' || el.t === 'area') && !tryParse(el.f)) errors.push(`diagram ${d.id}: cannot parse ${el.f}`);
          if (el.t === 'area' && el.g && !tryParse(el.g)) errors.push(`diagram ${d.id}: cannot parse ${el.g}`);
          if (['axes', 'fn', 'area', 'vline', 'hline'].includes(el.t) && !d.window) errors.push(`diagram ${d.id}: ${el.t} needs a window`);
          if (el.t === 'circle' && !el.through) {
            const o = frame.toView(pts[el.o]);
            const r = (el.r ?? 50) * frame.scale;
            if (o[0] - r < -2 || o[0] + r > frame.width + 2 || o[1] - r < -2 || o[1] + r > frame.height + 2)
              errors.push(`diagram ${d.id}: circle around ${el.o} leaves the view`);
          }
          if (el.t === 'circle' && el.through) {
            const o = frame.toView(pts[el.o]);
            const t = frame.toView(pts[el.through]);
            const r = Math.hypot(o[0] - t[0], o[1] - t[1]);
            if (o[0] - r < -2 || o[0] + r > frame.width + 2 || o[1] - r < -2 || o[1] + r > frame.height + 2)
              errors.push(`diagram ${d.id}: circle around ${el.o} leaves the view`);
          }
        }
      } catch (e) {
        errors.push(`diagram ${d.id}: ${(e as Error).message}`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('every diagram is used by some theorem or concept', () => {
    const used = new Set([...theorems.map((t) => t.diagram), ...concepts.map((c) => c.diagram)]);
    const unused = diagrams.map((d) => d.id).filter((id) => !used.has(id));
    expect(unused).toEqual([]);
  });
});
