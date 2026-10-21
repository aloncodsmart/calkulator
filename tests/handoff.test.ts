import { describe, expect, it } from 'vitest';
import { buildClaudePrompt, citableList, claudeUrl } from '../src/lib/claudeHandoff';

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
    // reads the photo back first, keeps to the student's level, and grounds citations in the app's list
    expect(p.indexOf('איך קראת את השאלה')).toBeLessThan(p.indexOf('רמז 1'));
    expect(p).toContain('רק בכלים ובמשפטים שנלמדים');
    expect(p).toContain('• זווית היקפית שווה למחצית הזווית המרכזית');
  });
  it('the theorem list follows the level and can be left out', () => {
    expect(citableList({ grade: 12, units: 3 })).not.toContain('צלעות נגדיות');
    expect(citableList({ grade: 11, units: 5 }).split('\n').length).toBeGreaterThan(80);
    expect(buildClaudePrompt('solve', { profile: { grade: 11, units: 5 }, hasImage: true, theoremList: false })).not.toContain('•');
  });
  it('claude.ai link carries the prompt only when it fits', () => {
    expect(claudeUrl('שאלה', false)).toMatch(/^https:\/\/claude\.ai\/new\?q=/);
    expect(claudeUrl('שאלה', true)).toBe('https://claude.ai/new');
    expect(claudeUrl('א'.repeat(2000), false)).toBe('https://claude.ai/new');
  });
  it('check: never solves for the student and includes their work', () => {
    const p = buildClaudePrompt('check', { problem: '2x+3=11', work: '2x=14\nx=7', profile: null, hasImage: false });
    expect(p).toContain('למטה נמצא הפתרון שלי');
    expect(p).toContain('אל תפתור במקומי');
    expect(p).not.toContain('איך קראת');
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
