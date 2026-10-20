import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { ToolError, rightTriangleTool, sequenceTool, triangleTool, twoPointsTool, type ToolResult } from '../src/lib/tools';

function renders(r: ToolResult) {
  const texts = [r.answer, ...(r.notes ?? []), ...r.steps.flatMap((s) => [s.title, s.text ?? ''])];
  for (const t of texts) for (const m of t.matchAll(/\$([^$]+)\$/g)) katex.renderToString(m[1], { throwOnError: true, strict: 'ignore' });
  for (const s of r.steps) if (s.tex) katex.renderToString(s.tex, { throwOnError: true, strict: 'ignore', displayMode: true });
}

const tri = (o: Partial<Record<'a' | 'b' | 'c' | 'A' | 'B' | 'C', string>>) => triangleTool({ a: '', b: '', c: '', A: '', B: '', C: '', ...o });

describe('sequences', () => {
  it('arithmetic', () => {
    const r = sequenceTool('arith', '3', '4', '10');
    renders(r);
    expect(r.answer).toContain('a_{10} = 39');
    expect(r.answer).toContain('S_{10} = 210');
  });
  it('geometric with convergent sum', () => {
    const r = sequenceTool('geo', '8', '1/2', '4');
    renders(r);
    expect(r.answer).toContain('a_{4} = 1$');
    expect(r.answer).toContain('S_{4} = 15');
    expect(r.steps.some((s) => s.tex?.includes('= 16'))).toBe(true);
  });
  it('rejects bad n', () => {
    expect(() => sequenceTool('arith', '1', '1', '2.5')).toThrow(ToolError);
  });
});

describe('right triangle', () => {
  it('two legs', () => {
    const r = rightTriangleTool('3', '4', '', '');
    renders(r);
    expect(r.answer).toContain('c \\approx 5$');
    expect(r.answer).toContain('36.87');
  });
  it('leg and hypotenuse with exact root', () => {
    const r = rightTriangleTool('1', '', '2', '');
    renders(r);
    expect(r.steps.some((s) => s.tex?.includes('\\sqrt{3}'))).toBe(true);
    expect(r.answer).toContain('\\alpha \\approx 30^\\circ');
  });
  it('hypotenuse and angle', () => {
    const r = rightTriangleTool('', '', '10', '30');
    renders(r);
    expect(r.answer).toContain('a \\approx 5$');
    expect(r.answer).toContain('8.66');
  });
  it('validates input', () => {
    expect(() => rightTriangleTool('5', '', '3', '')).toThrow(ToolError);
    expect(() => rightTriangleTool('', '', '', '30')).toThrow(ToolError);
    expect(() => rightTriangleTool('1', '2', '3', '')).toThrow(ToolError);
  });
});

describe('law of sines and cosines', () => {
  it('SSS', () => {
    const r = tri({ a: '3', b: '4', c: '5' });
    renders(r);
    expect(r.answer).toContain('\\gamma \\approx 90^\\circ');
  });
  it('SAS', () => {
    const r = tri({ b: '5', c: '8', A: '60' });
    renders(r);
    expect(r.answer).toContain('a \\approx 7$');
  });
  it('AAS', () => {
    const r = tri({ a: '10', A: '30', B: '90' });
    renders(r);
    expect(r.answer).toContain('b \\approx 20$');
    expect(r.answer).toContain('\\gamma \\approx 60^\\circ');
  });
  it('SSA ambiguous case gives two triangles', () => {
    const r = tri({ a: '6', b: '8', A: '40' });
    renders(r);
    expect(r.answer).toContain('משולש 2');
    expect(r.answer).toContain('58.99');
    expect(r.answer).toContain('121.01');
  });
  it('SSA with no triangle', () => {
    expect(() => tri({ a: '2', b: '8', A: '60' })).toThrow(ToolError);
  });
  it('rejects impossible input', () => {
    expect(() => tri({ a: '1', b: '2', c: '5' })).toThrow(ToolError);
    expect(() => tri({ A: '50', B: '60', C: '70' })).toThrow(ToolError);
  });
});

describe('two points', () => {
  it('distance, midpoint and line', () => {
    const r = twoPointsTool('1', '2', '4', '6');
    renders(r);
    expect(r.answer).toContain('AB = 5');
    expect(r.answer).toContain('\\frac{5}{2}');
    expect(r.answer).toContain('y = \\frac{4}{3}x + \\frac{2}{3}');
  });
  it('vertical line and exact root', () => {
    const r = twoPointsTool('2', '1', '2', '-3');
    renders(r);
    expect(r.answer).toContain('x = 2');
    const s = twoPointsTool('0', '0', '1', '1');
    expect(s.answer).toContain('\\sqrt{2}');
    expect(s.answer).toContain('y = x');
  });
});
