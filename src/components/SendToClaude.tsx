import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, KeyRound, Send } from 'lucide-react';
import type { AiImage } from '../lib/ai';
import { buildClaudePrompt, claudeUrl, copyPrompt, sendToClaude, type HandoffMode, type HandoffResult } from '../lib/claudeHandoff';
import { navigate } from '../router';
import { useStore } from '../store';
import { ImagePicker } from './aiViews';
import { Button, Callout } from './ui';

const INTRO: Record<HandoffMode, string> = {
  solve: 'צלמו את השאלה. נכין ל-Claude הנחיה של מורה – רמזים קודם, פתרון מלא רק כשתבקשו, וציטוט משפטים כמו בבגרות.',
  check: 'צלמו את הפתרון שלכם. נבקש מ-Claude לסמן את הטעות הראשונה ולתת רמז – בלי לפתור במקומכם.',
  theorem: 'צלמו את השאלה. נבקש מ-Claude להציע משפטים שמתאימים לנתונים, ומה צריך לבדוק לפני שמצטטים אותם – בלי לפתור.',
};

function statusText(r: HandoffResult, image: boolean): string {
  const paste = r.copied ? 'הדביקו את ההנחיה (היא כבר הועתקה): לחיצה ארוכה ← הדבקה' : 'העתיקו את ההנחיה בכפתור למטה והדביקו אותה';
  if (r.outcome === 'shared') return image ? `נשלח. אם ב-Claude מופיעה רק התמונה – ${paste}.` : 'נשלח ל-Claude.';
  if (r.outcome === 'opened') return image ? `נפתח Claude. ${paste}, וצרפו את התמונה בכפתור הצירוף.` : 'נפתח Claude עם ההנחיה.';
  return `הדפדפן לא פתח חלון חדש. פתחו את Claude בכפתור למטה, ${paste}${image ? ' וצרפו את התמונה' : ''}.`;
}

/**
 * Without an API key: hand the photo and a teacher prompt to the Claude app, so the student's own
 * Claude subscription answers it (no extra cost).
 * `text`, `problem` and `work` are what the student typed elsewhere on the screen; they are shown
 * and can be left out, so nothing is sent without the student seeing it.
 */
export function SendToClaude({ mode, text = '', problem = '', work = '', withText }: { mode: HandoffMode; text?: string; problem?: string; work?: string; withText?: boolean }) {
  const profile = useStore((s) => s.profile);
  const [image, setImage] = useState<AiImage | null>(null);
  // null until the student edits the field, so a seeded question can still be cleared completely
  const [own, setOwn] = useState<string | null>(null);
  const [attach, setAttach] = useState(true);
  const [result, setResult] = useState<HandoffResult | null>(null);
  const [busy, setBusy] = useState(false);
  const question = withText ? (own ?? text) : attach ? text : '';
  const typedAbove = !withText && !!(text.trim() || problem.trim() || work.trim());
  const typed = { text: question, problem: !withText && attach ? problem : '', work: !withText && attach ? work : '' };
  const ready = !!image || !!(typed.text.trim() || typed.problem.trim() || typed.work.trim());

  const prompts = () => {
    const base = { ...typed, profile, hasImage: !!image };
    return { full: buildClaudePrompt(mode, base), short: buildClaudePrompt(mode, { ...base, theoremList: false }) };
  };
  const send = async () => {
    setBusy(true);
    try {
      const { full, short } = prompts();
      const r = await sendToClaude(full, image, short);
      setResult(r.outcome === 'cancelled' ? null : r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <img src="./icon-192.png" alt="" className="mt-0.5 h-7 w-7 rounded-lg" />
        <div>
          <div className="font-bold">שליחה ל-Claude, עם המנוי שלכם</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{INTRO[mode]} בחלון השיתוף בוחרים ב-<b>Claude</b>.</p>
        </div>
      </div>
      {withText && (
        <textarea
          rows={2}
          value={question}
          onChange={(e) => setOwn(e.target.value)}
          placeholder="אפשר גם להקליד את השאלה, או להוסיף הערה לתמונה"
          className="w-full resize-y rounded-xl border border-black/10 bg-paper px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night"
        />
      )}
      {typedAbove && (
        <label className="flex items-start gap-2 rounded-xl bg-black/[0.03] p-2.5 text-sm dark:bg-white/5">
          <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span className="min-w-0">
            <span className="block font-semibold">לצרף גם את מה שכתבתם למעלה</span>
            <span dir="auto" className="block truncate text-slate-500">
              {[problem, text, work.replace(/\n/g, ' ; ')].filter((x) => x.trim()).join(' | ')}
            </span>
          </span>
        </label>
      )}
      <ImagePicker image={image} onChange={setImage} />
      <Button onClick={send} loading={busy} disabled={!ready} icon={<Send className="h-4 w-4" />}>
        שליחה ל-Claude
      </Button>
      {result && (
        <Callout tone={result.outcome === 'blocked' ? 'warn' : 'good'} icon={<CheckCircle2 className="h-4 w-4" />}>
          {statusText(result, !!image)}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => copyPrompt(prompts().full)}>
              העתקת ההנחיה
            </Button>
            <a
              href={claudeUrl(prompts().short, !!image)}
              target="_blank"
              rel="noopener"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold dark:border-night-line dark:bg-night-card"
            >
              <ExternalLink className="h-4 w-4" /> פתיחת claude.ai
            </a>
          </div>
        </Callout>
      )}
      <button type="button" onClick={() => navigate('/settings')} className="flex items-center gap-1.5 text-xs text-slate-500 underline-offset-2 hover:underline">
        <KeyRound className="h-3.5 w-3.5" /> יש לכם מפתח Claude API? אפשר לפתור בתוך האפליקציה עצמה
      </button>
    </div>
  );
}
