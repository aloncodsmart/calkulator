import { describe, expect, it } from 'vitest';
import { evaluate, parse, toTex, equivalent } from '../src/lib/math/expr';
import { polyRoots, rootValue, toPoly, toRational, toPowerSum, Poly } from '../src/lib/math/poly';

const ev = (s: string, x = 0) => evaluate(parse(s), { x });

describe('parser', () => {
  it('handles implicit multiplication and precedence', () => {
    expect(ev('2x+3', 2)).toBe(7);
    expect(ev('3(x-2)+4', 5)).toBe(13);
    expect(ev('(x+1)(x-1)', 3)).toBe(8);
    expect(ev('-x^2', 3)).toBe(-9);
    expect(ev('2^3^2')).toBe(512);
    expect(ev('x²+1', 3)).toBe(10);
    expect(ev('√(16)')).toBe(4);
    expect(ev('6÷2·3')).toBe(9);
    expect(ev('|x-5|', 2)).toBe(3);
    expect(ev('2|x|+1', -3)).toBe(7);
    expect(ev('log_2(8)')).toBeCloseTo(3);
    expect(ev('log(100)')).toBeCloseTo(2);
    expect(ev('ln(e)')).toBeCloseTo(1);
    expect(ev('sin(pi/2)')).toBeCloseTo(1);
    expect(ev('2πx', 1)).toBeCloseTo(2 * Math.PI);
    expect(ev('x/2+1/3', 1)).toBeCloseTo(5 / 6);
    expect(ev('sinx', Math.PI / 2)).toBeCloseTo(1);
  });
  it('produces readable tex', () => {
    expect(toTex(parse('2x+3'))).toBe('2x + 3');
    expect(toTex(parse('3(x-2)'))).toBe('3\\left(x - 2\\right)');
    expect(toTex(parse('x^2/4'))).toBe('\\frac{x^{2}}{4}');
    expect(toTex(parse('sqrt(x+1)'))).toBe('\\sqrt{x + 1}');
  });
  it('equivalence', () => {
    expect(equivalent(parse('(x+1)^2'), parse('x^2+2x+1'))).toBe(true);
    expect(equivalent(parse('(x+1)^2'), parse('x^2+1'))).toBe(false);
  });
});

describe('polynomials', () => {
  it('converts and finds roots', () => {
    const p = toPoly(parse('(x-1)(x-2)(x+3)'))!;
    expect(p.deg).toBe(3);
    expect(polyRoots(p).map(rootValue)).toEqual([-3, 1, 2]);
    const q = toPoly(parse('x^2-2'))!;
    expect(polyRoots(q).map(rootValue).map((v) => +v.toFixed(6))).toEqual([-1.414214, 1.414214]);
    const b = toPoly(parse('x^4-5x^2+4'))!;
    expect(polyRoots(b).map(rootValue)).toEqual([-2, -1, 1, 2]);
    expect(new Poly([1, -3, 2]).toTex()).toBe('2x^{2} - 3x + 1');
  });
  it('rational functions', () => {
    const r = toRational(parse('(x+1)/(x-2) - 3'))!;
    expect(r.num.toTex()).toBe('-2x + 7');
    expect(r.den.toTex()).toBe('x - 2');
  });
  it('power sums', () => {
    const s = toPowerSum(parse('3sqrt(x) + 2/x^2 - x^3'))!;
    expect(s.toTex()).toBe('-x^{3} + 3\\sqrt{x} + \\frac{2}{x^{2}}');
    expect(s.derivative().toTex()).toBe('-3x^{2} + \\frac{3}{2}x^{-\\frac{1}{2}} - \\frac{4}{x^{3}}'.replace('\\frac{3}{2}x^{-\\frac{1}{2}}', '\\frac{3}{2\\sqrt{x}}'));
  });
});
