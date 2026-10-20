import { useState, type ReactNode, type RefObject } from 'react';
import { Compass, Eye, Footprints, Lightbulb, Lock } from 'lucide-react';
import type { Hints, ProofStep, SolutionStep } from '../types';
import { theoremById } from '../data';
import { navigate } from '../router';
import { Rich, Tex } from './Tex';
import { Button, StatusBadge, cx } from './ui';

/** Hint ladder: direction → relevant tool → next step → full solution. */
export function HintLadder({ hints, onReveal, children, onHintUsed }: { hints: Hints; onReveal?: () => void; children: ReactNode; onHintUsed?: (level: number) => void }) {
  const [level, setLevel] = useState(0);
  const items = [
    { icon: <Compass className="h-4 w-4" />, title: 'רמז 1: כיוון כללי', text: hints.direction, color: 'text-sky-700 dark:text-sky-300' },
    { icon: <Lightbulb className="h-4 w-4" />, title: 'רמז 2: איזה משפט או כלל מתאים', text: hints.tool, color: 'text-amber-700 dark:text-amber-300' },
    { icon: <Footprints className="h-4 w-4" />, title: 'רמז 3: הצעד הבא', text: hints.next, color: 'text-emerald-700 dark:text-emerald-300' },
  ];
  const step = (n: number) => {
    setLevel(n);
    onHintUsed?.(n);
    if (n === 4) onReveal?.();
  };
  return (
    <div className="space-y-2.5">
      {items.map((it, i) =>
        level > i ? (
          <div key={i} className="pop-in rounded-2xl border border-black/5 bg-white p-3.5 dark:border-night-line dark:bg-night-card">
            <div className={cx('mb-1 flex items-center gap-1.5 text-sm font-bold', it.color)}>
              {it.icon}
              {it.title}
            </div>
            <div className="leading-relaxed">
              <Rich text={it.text} />
            </div>
          </div>
        ) : null,
      )}
      {level < 4 && (
        <div className="flex flex-wrap gap-2">
          {level < 3 && (
            <Button variant="soft" icon={<Lightbulb className="h-4 w-4" />} onClick={() => step(level + 1)}>
              {level === 0 ? 'תנו לי רמז' : 'רמז נוסף'}
            </Button>
          )}
          <Button variant={level === 3 ? 'primary' : 'ghost'} icon={level === 3 ? <Eye className="h-4 w-4" /> : <Lock className="h-4 w-4" />} onClick={() => step(4)}>
            {level === 3 ? 'הצגת פתרון מלא' : 'דילוג לפתרון'}
          </Button>
        </div>
      )}
      {level >= 4 && <div className="pop-in">{children}</div>}
    </div>
  );
}

export function StepsView({ steps }: { steps: SolutionStep[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="rounded-2xl border border-black/5 bg-white p-3.5 dark:border-night-line dark:bg-night-card">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                <Rich text={s.title} />
              </div>
              {s.tex && <Tex tex={s.tex} display />}
              {s.text && (
                <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                  <Rich text={s.text} />
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Bagrut-style proof table: claim | reason, with links to cited theorems. */
export function ProofTable({ steps, compact }: { steps: ProofStep[]; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-night-line dark:bg-night-card">
      <div className="grid grid-cols-[2rem_1fr_1.15fr] bg-brand-50 text-sm font-bold text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
        <div className="px-2 py-2 text-center">#</div>
        <div className="border-s border-black/5 px-3 py-2 dark:border-night-line">טענה</div>
        <div className="border-s border-black/5 px-3 py-2 dark:border-night-line">נימוק</div>
      </div>
      {steps.map((s, i) => {
        const th = s.ref ? theoremById.get(s.ref) : undefined;
        return (
          <div key={i} className="grid grid-cols-[2rem_1fr_1.15fr] border-t border-black/5 text-[15px] dark:border-night-line">
            <div className="px-2 py-2.5 text-center text-sm text-slate-500">{i + 1}</div>
            <div className="border-s border-black/5 px-3 py-2.5 dark:border-night-line">
              <Rich text={s.claim} />
            </div>
            <div className={cx('border-s border-black/5 px-3 py-2.5 dark:border-night-line', compact ? 'text-sm' : '')}>
              {th ? (
                <button type="button" onClick={() => navigate(`/theorems/${th.id}`)} className="text-start text-brand-700 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-600 dark:text-brand-300">
                  <Rich text={s.reason} />
                </button>
              ) : (
                <Rich text={s.reason} />
              )}
              {th && th.status !== 'official' && (
                <div className="mt-1">
                  <StatusBadge status={th.status} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const KEYS: { label: string; insert: string; tex?: string }[] = [
  { label: 'x', insert: 'x' },
  { label: 'y', insert: 'y' },
  { label: 'x²', insert: '^2', tex: 'x^2' },
  { label: 'xⁿ', insert: '^', tex: 'x^n' },
  { label: '√', insert: 'sqrt(', tex: '\\sqrt{\\ }' },
  { label: '/', insert: '/', tex: '\\frac{a}{b}' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: '=', insert: '=' },
  { label: '<', insert: '<' },
  { label: '>', insert: '>' },
  { label: '≤', insert: '<=' },
  { label: '≥', insert: '>=' },
  { label: 'π', insert: 'pi' },
  { label: 'sin', insert: 'sin(' },
  { label: 'cos', insert: 'cos(' },
  { label: 'log', insert: 'log_2(' },
  { label: 'ln', insert: 'ln(' },
  { label: '|x|', insert: '|' },
  { label: '↵', insert: '\n' },
];

/** Inserts math symbols into a text field at the cursor (mobile friendly). */
export function MathKeyboard({ target, onChange, compact }: { target: RefObject<HTMLTextAreaElement | HTMLInputElement | null>; onChange: (v: string) => void; compact?: boolean }) {
  const insert = (s: string) => {
    const el = target.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + s + el.value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + s.length;
      el.setSelectionRange(pos, pos);
    });
  };
  const keys = compact ? KEYS.filter((k) => !['sin', 'cos', 'log', 'ln', '|x|', '↵', '<', '>', '≤', '≥'].includes(k.label)) : KEYS;
  return (
    <div dir="ltr" className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
      {keys.map((k) => (
        <button
          key={k.label}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insert(k.insert)}
          className="h-10 rounded-xl border border-black/10 bg-white text-[15px] font-semibold text-slate-700 shadow-sm active:scale-95 dark:border-night-line dark:bg-night-card dark:text-slate-100"
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
