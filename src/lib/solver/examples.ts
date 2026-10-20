import type { SolveMode } from './index';

/** Sample inputs shown as one-tap examples in the solver (each is covered by tests). */
export const EXAMPLES: Record<SolveMode, string[]> = {
  auto: ['3(x-2)+4=2x+7', 'x^2-5x+6=0', '2x+3y=7\nx-y=1', 'x^2-4>=0', '(x+1)/(x-2)=3', '(x+3)^2-9'],
  equation: ['x^4-5x^2+4=0', 'sqrt(x+2)=x', '2^(x+1)=32', 'log_2(x+3)=3', '5-2x>1', '(x-1)/(x+2)<=0'],
  derivative: ['f(x)=3x^4-2x^2+5', 'f(x)=(2x+1)^3', 'f(x)=sqrt(x)+1/x', 'f(x)=(x+1)/(x-1)', 'f(x)=x*sin(x)'],
  investigate: ['f(x)=x^3-3x', 'f(x)=x^4-2x^2', 'f(x)=(x^2+4)/(x^2-4)'],
  integral: ['3x^2+2x', '1/x', 'x^3-x'],
  tangent: ['f(x)=x^2-4x', 'f(x)=x^3', 'f(x)=1/x'],
  simplify: ['(x+3)^2-9', 'x^2-5x+6', '(x^2-4)/(x+2)', '2+3*4^2'],
};
