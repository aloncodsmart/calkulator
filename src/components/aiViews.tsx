import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, Camera, CheckCircle2, CircleHelp, ImagePlus, Sparkles, X, XCircle } from 'lucide-react';
import type { AiCheck, AiImage, AiSolution } from '../lib/ai';
import { AiError, fileToImage } from '../lib/ai';
import { useStore } from '../store';
import { HintLadder, ProofTable, StepsView } from './learning';
import { Rich } from './Tex';
import { Button, Callout, cx } from './ui';

/** Runs an async task with loading/error state and cancellation. */
export function useTask<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<T | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const run = useCallback(async (fn: (signal: AbortSignal) => Promise<T>) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fn(c.signal);
      if (!c.signal.aborted) setData(res);
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof AiError ? e.message : (e as Error).message || 'שגיאה לא צפויה.');
    } finally {
      if (ctrl.current === c) setLoading(false);
    }
  }, []);
  const cancel = useCallback(() => {
    ctrl.current?.abort();
    setLoading(false);
  }, []);
  const reset = useCallback(() => {
    setData(null);
    setError('');
  }, []);
  return { loading, error, data, run, cancel, reset };
}

export function useAiSettings() {
  const apiKey = useStore((s) => s.settings.apiKey);
  const model = useStore((s) => s.settings.model);
  return { apiKey, model, enabled: apiKey.trim().length > 0 };
}

/** Pick a photo from the camera or gallery; shows a preview. */
export function ImagePicker({ image, onChange }: { image: AiImage | null; onChange: (img: AiImage | null) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const onFile = async (f?: File) => {
    if (!f) return;
    setErr('');
    try {
      onChange(await fileToImage(f));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={gal} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {image ? (
        <div className="relative inline-block">
          <img src={image.previewUrl} alt="התמונה שנבחרה" className="max-h-48 rounded-xl border border-black/10 dark:border-night-line" />
          <button type="button" onClick={() => onChange(null)} aria-label="הסרת התמונה" className="absolute -top-2 -start-2 rounded-full bg-rose-600 p-1 text-white shadow">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => cam.current?.click()}>
            צילום
          </Button>
          <Button size="sm" variant="secondary" icon={<ImagePlus className="h-4 w-4" />} onClick={() => gal.current?.click()}>
            תמונה מהגלריה
          </Button>
        </div>
      )}
      {err && <p className="mt-1 text-sm text-rose-600">{err}</p>}
    </div>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-l from-brand-600 to-sky-500 px-2 py-0.5 text-xs font-semibold text-white">
      <Sparkles className="h-3 w-3" />
      Claude
    </span>
  );
}

const AI_DISCLAIMER = 'הפתרון נוצר בעזרת בינה מלאכותית ועלול לטעות – בדקו כל שלב. נימוקים מקושרים נבדקו שהם משפטים מהמאגר של האפליקציה.';

export function AiSolutionView({ sol }: { sol: AiSolution }) {
  const proof = sol.kind === 'proof';
  return (
    <div className="space-y-3">
      {sol.uncertain && (
        <Callout tone="warn" icon={<AlertTriangle className="h-4 w-4" />} title="שימו לב: חלק מהפתרון לא ודאי">
          {sol.notes.length ? <Rich text={sol.notes[0]} /> : 'ייתכן שחלק מהשאלה לא נקרא נכון. בדקו את הנתונים.'}
        </Callout>
      )}
      <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-night-line dark:bg-night-card">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500">
          <Bot className="h-4 w-4" /> השאלה כפי שהבנו אותה <AiBadge />
        </div>
        <Rich text={sol.problem} />
        {sol.given.length > 0 && (
          <div className="mt-3">
            <div className="text-sm font-bold">נתון:</div>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {sol.given.map((g, i) => (
                <li key={i}>
                  <Rich text={g} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {sol.goal && (
          <div className="mt-2">
            <span className="text-sm font-bold">{proof ? 'צריך להוכיח: ' : 'צריך למצוא: '}</span>
            <Rich text={sol.goal} />
          </div>
        )}
      </div>
      <HintLadder hints={sol.hints}>
        <div className="space-y-3">
          {proof ? (
            <ProofTable steps={sol.steps.map((s) => ({ claim: s.claim, reason: s.reason, ref: s.theoremId || undefined }))} />
          ) : (
            <StepsView steps={sol.steps.map((s) => ({ title: s.claim, text: s.reason }))} />
          )}
          <Callout tone="good" icon={<CheckCircle2 className="h-4 w-4" />} title="תשובה">
            <Rich text={sol.answer} />
          </Callout>
          {sol.notes.length > (sol.uncertain ? 1 : 0) && (
            <Callout tone="info" title="הערות">
              <ul className="list-disc space-y-1 ps-5">
                {sol.notes.slice(sol.uncertain ? 1 : 0).map((n, i) => (
                  <li key={i}>
                    <Rich text={n} />
                  </li>
                ))}
              </ul>
            </Callout>
          )}
        </div>
      </HintLadder>
      <p className="text-xs text-slate-500">{AI_DISCLAIMER}</p>
    </div>
  );
}

const VERDICT: Record<AiCheck['verdict'], { label: string; tone: 'good' | 'bad' | 'warn' | 'info' }> = {
  correct: { label: 'הפתרון נכון!', tone: 'good' },
  error: { label: 'יש טעות בפתרון', tone: 'bad' },
  incomplete: { label: 'הפתרון לא הושלם', tone: 'warn' },
  unclear: { label: 'לא הצלחנו לקרוא את הפתרון בבירור', tone: 'info' },
};

export function AiCheckView({ check }: { check: AiCheck }) {
  const v = VERDICT[check.verdict];
  return (
    <div className="space-y-3">
      <Callout tone={v.tone} title={v.label} icon={check.verdict === 'correct' ? <CheckCircle2 className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}>
        {check.encouragement && <Rich text={check.encouragement} />}
      </Callout>
      <ol className="space-y-2">
        {check.lines.map((l, i) => (
          <li
            key={i}
            className={cx(
              'rounded-2xl border p-3',
              l.status === 'error'
                ? 'border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10'
                : l.status === 'ok'
                  ? 'border-black/5 bg-white dark:border-night-line dark:bg-night-card'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
            )}
          >
            <div className="flex items-start gap-2">
              {l.status === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : l.status === 'error' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
              <div className="min-w-0">
                <Rich text={l.text} />
                {l.comment && (
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    <Rich text={l.comment} />
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {check.explanation && (
        <Callout tone="info" title="מה הבעיה?">
          <Rich text={check.explanation} />
        </Callout>
      )}
      {check.hint && (
        <Callout tone="brand" title="רמז לתיקון">
          <Rich text={check.hint} />
        </Callout>
      )}
      <p className="text-xs text-slate-500">הבדיקה נעשתה בעזרת בינה מלאכותית ועלולה לטעות.</p>
    </div>
  );
}
