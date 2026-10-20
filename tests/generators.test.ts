import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { GENERATORS, generate, checkAnswer, type Difficulty } from '../src/lib/generators';
import { checkSolution } from '../src/lib/checker';
import { theoremById, topicById } from '../src/data';
import { resolvePoints } from '../src/lib/diagram';
import { getDiagram } from '../src/data';

function richErrors(s: string | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  if ((s.match(/\$/g) || []).length % 2) out.push(`unbalanced $: ${s}`);
  for (const m of s.matchAll(/\$([^$]+)\$/g)) {
    try {
      katex.renderToString(m[1], { throwOnError: true, strict: 'ignore' });
    } catch (e) {
      out.push(`${m[1]} → ${(e as Error).message}`);
    }
  }
  return out;
}
function texErrors(tex: string | undefined): string[] {
  if (!tex) return [];
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'ignore', displayMode: true });
    return [];
  } catch (e) {
    return [`${tex} → ${(e as Error).message}`];
  }
}

describe('exercise generators', () => {
  it('cover every topic', () => {
    for (const t of topicById.keys()) expect(GENERATORS[t]?.length, t).toBeGreaterThan(0);
  });

  for (const [topic, gens] of Object.entries(GENERATORS)) {
    for (const g of gens) {
      it(`${topic}/${g.id} produces valid, self-consistent exercises`, () => {
        const errors: string[] = [];
        for (const d of [1, 2, 3] as Difficulty[]) {
          for (let seed = 1; seed <= 20; seed++) {
            const ex = generate(topic, d, seed * 7919 + d, g.id);
            const L = `${topic}/${g.id} d${d} s${seed}`;
            errors.push(...richErrors(ex.question).map((e) => `${L} question: ${e}`));
            errors.push(...richErrors(ex.answerDisplay).map((e) => `${L} answer: ${e}`));
            for (const h of Object.values(ex.hints)) errors.push(...richErrors(h).map((e) => `${L} hint: ${e}`));
            ex.steps?.forEach((s) => {
              errors.push(...texErrors(s.tex).map((e) => `${L} step: ${e}`));
              errors.push(...richErrors(s.text).map((e) => `${L} step text: ${e}`));
              errors.push(...richErrors(s.title).map((e) => `${L} step title: ${e}`));
            });
            ex.proof?.forEach((p) => {
              errors.push(...richErrors(p.claim).map((e) => `${L} proof: ${e}`));
              if (p.ref && !theoremById.has(p.ref)) errors.push(`${L}: unknown theorem ${p.ref}`);
            });
            if (ex.answer.kind === 'choice') {
              ex.answer.options.forEach((o) => errors.push(...richErrors(o).map((e) => `${L} option: ${e}`)));
              if (ex.answer.correct < 0) errors.push(`${L}: correct option missing`);
              if (!checkAnswer(ex.answer, ex.answer.correct).correct) errors.push(`${L}: own choice rejected`);
            } else if (ex.answer.kind === 'numbers') {
              if (ex.answer.values.some((v) => !Number.isFinite(v))) errors.push(`${L}: non-finite answer`);
              if (!checkAnswer(ex.answer, ex.answer.values.map((v) => String(v)).join(', ')).correct) errors.push(`${L}: own answer rejected ${ex.answer.values}`);
            } else if (!checkAnswer(ex.answer, ex.answer.expr).correct) errors.push(`${L}: own expression rejected`);
            if (ex.diagram) {
              const spec = typeof ex.diagram === 'string' ? getDiagram(ex.diagram) : ex.diagram;
              if (!spec) errors.push(`${L}: unknown diagram ${ex.diagram}`);
              else
                try {
                  resolvePoints(spec);
                } catch (e) {
                  errors.push(`${L}: diagram ${(e as Error).message}`);
                }
            }
          }
        }
        expect(errors.slice(0, 15)).toEqual([]);
      });
    }
  }
});

describe('answer checking', () => {
  it('accepts fractions, roots and any order', () => {
    expect(checkAnswer({ kind: 'numbers', values: [3.5, -2] }, '-2, 7/2').correct).toBe(true);
    expect(checkAnswer({ kind: 'numbers', values: [Math.SQRT2] }, '√2').correct).toBe(true);
    expect(checkAnswer({ kind: 'numbers', values: [2, 3] }, 'x1=3 x2=2').correct).toBe(true);
    expect(checkAnswer({ kind: 'numbers', values: [2, 3] }, '2').correct).toBe(false);
    expect(checkAnswer({ kind: 'expression', expr: '(x-2)*(x-3)', vars: ['x'], product: true }, '(x-3)(x-2)').correct).toBe(true);
    expect(checkAnswer({ kind: 'expression', expr: '(x-2)*(x-3)', vars: ['x'], product: true }, 'x^2-5x+6').correct).toBe(false);
  });
});

describe('solution checker', () => {
  it('accepts a correct solution', () => {
    const r = checkSolution('3(x-2)+4=2x+7', '3x-6+4=2x+7\n3x-2=2x+7\nx=9');
    expect(r.firstError).toBeUndefined();
    expect(r.finalCorrect).toBe(true);
  });
  it('finds a sign error when moving terms', () => {
    const r = checkSolution('3x-2=2x+7', '3x-2x=7-2\nx=5');
    expect(r.firstError).toBe(1);
    expect(r.lines[1].message).toContain('בלי להחליף');
  });
  it('finds a lost root after dividing by x', () => {
    const r = checkSolution('x^2=4x', 'x=4');
    expect(r.firstError).toBe(1);
    expect(r.lines[1].message).toContain('חסר פתרון');
    const r2 = checkSolution('x^2=4x', 'x=4\n');
    expect(r2.finalCorrect).toBe(false);
    const r3 = checkSolution('x^3=4x', 'x^2=4\nx=2, x=-2');
    expect(r3.lines[1].message).toContain('חילקתם');
  });
  it('explains a missing middle term', () => {
    const r = checkSolution('(x+3)^2', 'x^2+9');
    expect(r.firstError).toBe(1);
    expect(r.lines[1].message).toContain('האיבר האמצעי');
  });
  it('flags a one-sided simplification error', () => {
    const r = checkSolution('2(x+1)=x+5', '2x+1=x+5');
    expect(r.firstError).toBe(1);
    expect(r.lines[1].message).toContain('אגף שמאל');
  });
});
