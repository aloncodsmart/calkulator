import { useState } from 'react';
import { CheckCircle2, KeyRound, Send } from 'lucide-react';
import type { AiImage } from '../lib/ai';
import { buildClaudePrompt, sendToClaude, type HandoffMode, type HandoffResult } from '../lib/claudeHandoff';
import { navigate } from '../router';
import { useStore } from '../store';
import { ImagePicker } from './aiViews';
import { Button, Callout } from './ui';

const INTRO: Record<HandoffMode, string> = {
  solve: 'צלמו את השאלה. נכין ל-Claude הנחיה של מורה – רמזים קודם, פתרון מלא רק כשתבקשו, וציטוט משפטים כמו בבגרות.',
  check: 'צלמו את הפתרון שלכם. נבקש מ-Claude לסמן את הטעות הראשונה ולתת רמז – בלי לפתור במקומכם.',
  theorem: 'צלמו את השאלה. נבקש מ-Claude להציע משפטים שמתאימים לנתונים, ומה צריך לבדוק לפני שמצטטים אותם – בלי לפתור.',
};

const DONE: Record<HandoffResult, string> = {
  shared: 'נשלח. אם ב-Claude מופיעה רק התמונה – הדביקו את ההנחיה (היא כבר הועתקה): לחיצה ארוכה ← הדבקה.',
  opened: 'נפתח Claude. ההנחיה כבר הועתקה – הדביקו אותה, וצרפו את התמונה בכפתור הצירוף.',
  cancelled: '',
};

/**
 * Without an API key: hand the photo and a teacher prompt to the Claude app, so the student's own
 * Claude subscription answers it (no extra cost).
 */
export function SendToClaude({ mode, text = '', problem = '', work = '', withText }: { mode: HandoffMode; text?: string; problem?: string; work?: string; withText?: boolean }) {
  const profile = useStore((s) => s.profile);
  const [image, setImage] = useState<AiImage | null>(null);
  const [own, setOwn] = useState('');
  const [status, setStatus] = useState<HandoffResult | null>(null);
  const [busy, setBusy] = useState(false);
  const question = own || text;
  const ready = !!image || !!question.trim() || !!work.trim();

  const send = async () => {
    setBusy(true);
    try {
      const prompt = buildClaudePrompt(mode, { text: question, problem, work, profile, hasImage: !!image });
      setStatus(await sendToClaude(prompt, image));
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
      <ImagePicker image={image} onChange={setImage} />
      <Button onClick={send} loading={busy} disabled={!ready} icon={<Send className="h-4 w-4" />}>
        שליחה ל-Claude
      </Button>
      {status && status !== 'cancelled' && (
        <Callout tone="good" icon={<CheckCircle2 className="h-4 w-4" />}>
          {DONE[status]}
        </Callout>
      )}
      <button type="button" onClick={() => navigate('/settings')} className="flex items-center gap-1.5 text-xs text-slate-500 underline-offset-2 hover:underline">
        <KeyRound className="h-3.5 w-3.5" /> יש לכם מפתח Claude API? אפשר לפתור בתוך האפליקציה עצמה
      </button>
    </div>
  );
}
