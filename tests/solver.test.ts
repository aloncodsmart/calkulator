import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { solveProblem, type SolveMode } from '../src/lib/solver';
import { EXAMPLES } from '../src/lib/solver/examples';
import type { Solution } from '../src/types';

function texErrors(sol: Solution): string[] {
  const errs: string[] = [];
  const check = (tex?: string) => {
    if (!tex) return;
    try {
      katex.renderToString(tex, { throwOnError: true, strict: 'ignore', displayMode: true });
    } catch (e) {
      errs.push(`${tex} → ${(e as Error).message}`);
    }
  };
  const rich = (s?: string) => {
    if (!s) return;
    for (const m of s.matchAll(/\$([^$]+)\$/g)) check(m[1]);
  };
  check(sol.problemTex);
  sol.steps.forEach((s) => {
    check(s.tex);
    rich(s.text);
    rich(s.title);
  });
  rich(sol.answer);
  rich(sol.hints.direction);
  rich(sol.hints.tool);
  rich(sol.hints.next);
  sol.notes?.forEach(rich);
  return errs;
}

function solve(input: string, mode: SolveMode = 'auto', extra = {}): Solution {
  const r = solveProblem(input, mode, extra);
  if (!r.ok) throw new Error(`${input}: ${r.error}`);
  expect(texErrors(r.solution), input).toEqual([]);
  expect(r.solution.hints.direction && r.solution.hints.tool && r.solution.hints.next).toBeTruthy();
  return r.solution;
}

describe('equations', () => {
  it('linear', () => {
    const s = solve('3(x-2)+4=2x+7');
    expect(s.kind).toBe('linear');
    expect(s.answer).toContain('x = 9');
    expect(solve('x/2 + 1/3 = 2').answer).toContain('\\frac{10}{3}');
    expect(solve('5 - 2x = 11').answer).toContain('x = -3');
  });
  it('quadratic by formula, factor and square root', () => {
    const s = solve('x^2-5x+6=0');
    expect(s.kind).toBe('quadratic');
    expect(s.answer).toMatch(/x_\{1\} = 2.*x_\{2\} = 3/);
    expect(solve('2x^2 = 3x + 5').answer).toMatch(/-1.*\\frac\{5\}\{2\}/);
    expect(solve('x^2 - 2 = 0').answer).toContain('\\sqrt{2}');
    expect(solve('x^2 + 4x = 0').answer).toMatch(/-4.*0/);
    expect(solve('x^2 + x + 1 = 0').answer).toContain('אין פתרון');
    expect(solve('x^2 - 4x + 1 = 0').answer).toContain('\\sqrt{3}');
  });
  it('higher degree', () => {
    expect(solve('x^4 - 5x^2 + 4 = 0').answer).toMatch(/-2.*-1.*1.*2/);
    expect(solve('x^3 - 6x^2 + 11x - 6 = 0').answer).toMatch(/1.*2.*3/);
    expect(solve('x^3 = 4x').answer).toMatch(/-2.*0.*2/);
  });
  it('rational equations reject excluded values', () => {
    const s = solve('(x+1)/(x-2) = 3');
    expect(s.kind).toBe('rational');
    expect(s.answer).toContain('\\frac{7}{2}');
    const t = solve('x^2/(x-1) = 1/(x-1)');
    expect(t.answer).toContain('-1');
    expect(t.answer).not.toMatch(/= 1\$/);
  });
  it('sqrt, exponential and log equations', () => {
    const s = solve('sqrt(x+2) = x');
    expect(s.answer).toContain('x = 2');
    expect(s.answer).not.toContain('-1');
    expect(solve('2^(x+1) = 32').answer).toContain('x = 4');
    expect(solve('4^x = 8^(x-1)').answer).toContain('x = 3');
    expect(solve('log_2(x+3) = 3').answer).toContain('x = 5');
  });
  it('systems', () => {
    const s = solve('2x+3y=7\nx-y=1');
    expect(s.answer).toContain('x = 2');
    expect(s.answer).toContain('y = 1');
    const e = solve('3x + 2y = 12\n5x - 3y = 1');
    expect(e.answer).toContain('x = 2');
    expect(e.answer).toContain('y = 3');
    expect(solve('x+y=2, 2x+2y=5').answer).toContain('אין פתרון');
    const m = solve('y = x^2\ny = x + 2');
    expect(m.answer).toContain('(-1, 1)');
    expect(m.answer).toContain('(2, 4)');
  });
});

describe('inequalities', () => {
  it('linear with sign flip', () => {
    const s = solve('5 - 2x > 1');
    expect(s.answer).toContain('x < 2');
    expect(s.steps.some((st) => st.title.includes('הופכים'))).toBe(true);
  });
  it('quadratic and rational', () => {
    expect(solve('x^2 - 5x + 6 < 0').answer).toContain('2 < x < 3');
    expect(solve('x^2 - 4 >= 0').answer).toMatch(/x \\le -2.*x \\ge 2/);
    expect(solve('(x-1)/(x+2) <= 0').answer).toContain('-2 < x \\le 1');
    expect(solve('(x-1)^2 <= 0').answer).toContain('x = 1');
  });
});

describe('calculus', () => {
  it('derivatives', () => {
    expect(solve('f(x) = 3x^4 - 2x^2 + 5', 'derivative').answer).toContain('12x^{3} - 4x');
    expect(solve('f(x) = sqrt(x) + 1/x', 'derivative').answer).toContain('\\frac{1}{2\\sqrt{x}}');
    expect(solve('f(x) = (x+1)/(x-1)', 'derivative').answer).toContain('-2');
    expect(solve('f(x) = (2x+1)^3', 'derivative').answer).toContain('6\\left(2x + 1\\right)^{2}');
    solve('f(x) = x*sin(x)', 'derivative');
  });
  it('investigation finds extrema', () => {
    const s = solve('f(x) = x^3 - 3x', 'investigate');
    expect(s.answer).toContain('מקסימום $\\left(-1,\\ 2\\right)$');
    expect(s.answer).toContain('מינימום $\\left(1,\\ -2\\right)$');
    const r = solve('f(x) = (x^2+4)/(x^2-4)', 'investigate');
    expect(r.answer).toContain('מקסימום $\\left(0,\\ -1\\right)$');
  });
  it('integrals', () => {
    expect(solve('3x^2 + 2x', 'integral').answer).toContain('x^{3} + x^{2} + C');
    expect(solve('3x^2 + 2x', 'integral', { a: '0', b: '2' }).answer).toContain('12');
    expect(solve('∫_0^3 (x^2 - 1) dx').answer).toContain('6');
    expect(solve('1/x', 'integral').answer).toContain('\\ln|x|');
    const signed = solve('x', 'integral', { a: '-1', b: '1' });
    expect(signed.answer).toContain('0');
    expect(signed.notes?.join(' ')).toContain('השטח');
  });
  it('tangent line', () => {
    const s = solve('f(x) = x^2 - 4x', 'tangent', { x0: '3' });
    expect(s.answer).toContain('y = 2x - 9');
  });
});

describe('expressions and auto mode', () => {
  it('simplifies and factors', () => {
    expect(solve('(x+3)^2 - 9').answer).toContain('x\\left(x + 6\\right)');
    expect(solve('x^2 - 5x + 6', 'simplify').answer).toContain('\\left(x - 2\\right)\\left(x - 3\\right)');
    expect(solve('(x^2-4)/(x+2)').answer).toContain('x - 2');
    expect(solve('2+3*4^2').answer).toContain('50');
  });
  it('auto-detects intent from Hebrew words', () => {
    expect(solve('גזור את f(x)=x^2').kind).toBe('derivative');
    expect(solve('מצא את נקודות הקיצון של f(x)=x^3-3x').kind).toBe('investigation');
    expect(solve('פתור: 2x+3=11').answer).toContain('x = 4');
  });
  it('reports friendly errors', () => {
    const r = solveProblem('2x+=3');
    expect(r.ok).toBe(false);
    const m = solveProblem('x + y = 3');
    expect(m.ok).toBe(false);
  });
});

describe('solver screen examples', () => {
  it('every one-tap example solves and renders', () => {
    for (const [mode, list] of Object.entries(EXAMPLES) as [SolveMode, string[]][]) {
      for (const ex of list) solve(ex, mode, mode === 'tangent' ? { x0: '1' } : {});
    }
  });
});
