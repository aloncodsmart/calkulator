import { describe, expect, it } from 'vitest';
import { buildClaudePrompt } from '../src/lib/claudeHandoff';

describe('Claude handoff prompt', () => {
  const profile = { grade: 11 as const, units: 5 as const };
  it('solve: hints before the full solution, fitted to the student', () => {
    const p = buildClaudePrompt('solve', { profile, hasImage: true });
    expect(p).toContain('י״א, 5 יחידות');
    expect(p).toContain('בתמונה המצורפת');
    expect(p).toContain('רמז 1');
    expect(p.indexOf('רמז 1')).toBeLessThan(p.indexOf('פתרון מלא'));
    expect(p).toContain('טענה | נימוק');
    expect(p).toContain('צריך להוכיח');
  });
  it('check: never solves for the student and includes their work', () => {
    const p = buildClaudePrompt('check', { problem: '2x+3=11', work: '2x=14\nx=7', profile: null, hasImage: false });
    expect(p).toContain('אל תפתור במקומי');
    expect(p).toContain('השאלה: 2x+3=11');
    expect(p).toContain('הפתרון שלי:\n2x=14\nx=7');
    expect(p).not.toContain('בכיתה');
  });
  it('theorem: suggests theorems without solving; middle-school level wording', () => {
    const p = buildClaudePrompt('theorem', { text: 'AB=AC, AD תיכון', profile: { grade: 8, middleLevel: 'advanced' }, hasImage: false });
    expect(p).toContain('אל תפתור אותה');
    expect(p).toContain('הנתונים: AB=AC, AD תיכון');
    expect(p).toContain('ח׳, ברמה מוגברת');
  });
});
