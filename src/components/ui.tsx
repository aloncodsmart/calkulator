import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { ColorKey, TheoremStatus } from '../types';
import { getTopic } from '../data';
import { back } from '../router';

export const COLOR: Record<ColorKey, { soft: string; text: string; ring: string; solid: string }> = {
  sky: { soft: 'bg-sky-100 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-300 dark:ring-sky-500/40', solid: 'bg-sky-500' },
  violet: { soft: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-300 dark:ring-violet-500/40', solid: 'bg-violet-500' },
  emerald: { soft: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-300 dark:ring-emerald-500/40', solid: 'bg-emerald-500' },
  amber: { soft: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-300 dark:ring-amber-500/40', solid: 'bg-amber-500' },
  rose: { soft: 'bg-rose-100 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-300 dark:ring-rose-500/40', solid: 'bg-rose-500' },
  orange: { soft: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', ring: 'ring-orange-300 dark:ring-orange-500/40', solid: 'bg-orange-500' },
  teal: { soft: 'bg-teal-100 dark:bg-teal-500/15', text: 'text-teal-700 dark:text-teal-300', ring: 'ring-teal-300 dark:ring-teal-500/40', solid: 'bg-teal-500' },
  fuchsia: { soft: 'bg-fuchsia-100 dark:bg-fuchsia-500/15', text: 'text-fuchsia-700 dark:text-fuchsia-300', ring: 'ring-fuchsia-300 dark:ring-fuchsia-500/40', solid: 'bg-fuchsia-500' },
  lime: { soft: 'bg-lime-100 dark:bg-lime-500/15', text: 'text-lime-700 dark:text-lime-300', ring: 'ring-lime-300 dark:ring-lime-500/40', solid: 'bg-lime-500' },
  pink: { soft: 'bg-pink-100 dark:bg-pink-500/15', text: 'text-pink-700 dark:text-pink-300', ring: 'ring-pink-300 dark:ring-pink-500/40', solid: 'bg-pink-500' },
  indigo: { soft: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300', ring: 'ring-indigo-300 dark:ring-indigo-500/40', solid: 'bg-indigo-500' },
  cyan: { soft: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-300', ring: 'ring-cyan-300 dark:ring-cyan-500/40', solid: 'bg-cyan-500' },
};

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className = '', onClick, tone }: { children: ReactNode; className?: string; onClick?: () => void; tone?: 'plain' | 'brand' }) {
  const base = cx(
    'min-w-0 rounded-2xl border shadow-sm',
    tone === 'brand'
      ? 'border-brand-200 bg-gradient-to-br from-brand-50 to-sky-50 dark:border-brand-500/30 dark:from-brand-500/10 dark:to-sky-500/5'
      : 'border-black/5 bg-white dark:border-night-line dark:bg-night-card',
    onClick && 'cursor-pointer text-start transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
    className,
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cx(base, 'block w-full')}>
        {children}
      </button>
    );
  return <div className={base}>{children}</div>;
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700 disabled:bg-brand-300 dark:disabled:bg-brand-900',
  secondary: 'border border-black/10 bg-white text-ink hover:bg-brand-50 dark:border-night-line dark:bg-night-card dark:text-white dark:hover:bg-white/5',
  ghost: 'text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/5',
  soft: 'bg-brand-100 text-brand-800 hover:bg-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; loading?: boolean }) {
  const sz = size === 'sm' ? 'h-9 px-3 text-sm' : size === 'lg' ? 'h-12 px-5 text-base' : 'h-11 px-4 text-[15px]';
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed', sz, BTN[variant], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Chip({ active, onClick, children, className = '' }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
          : 'border-black/10 bg-white text-slate-700 hover:border-brand-300 dark:border-night-line dark:bg-night-card dark:text-slate-200',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-black/5 p-1 dark:bg-white/5" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition',
            value === o.id ? 'bg-white text-brand-700 shadow-sm dark:bg-brand-500/25 dark:text-white' : 'text-slate-600 hover:text-ink dark:text-slate-400 dark:hover:text-white',
          )}
        >
          {o.icon && <span className="hidden sm:inline-flex">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const STATUS: Record<TheoremStatus, { label: string; cls: string }> = {
  official: { label: 'מותר לצטט בבגרות', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  'formula-sheet': { label: 'בדף הנוסחאות', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300' },
  'needs-proof': { label: 'צריך להוכיח', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
};

export function StatusBadge({ status, short }: { status: TheoremStatus; short?: boolean }) {
  const s = STATUS[status];
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', s.cls)}>{short && status === 'official' ? 'מותר לצטט' : s.label}</span>;
}

export function TopicBadge({ topicId, className = '' }: { topicId: string; className?: string }) {
  const t = getTopic(topicId);
  if (!t) return null;
  const c = COLOR[t.color];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', c.soft, c.text, className)}>
      <span aria-hidden>{t.icon}</span>
      {t.name}
    </span>
  );
}

export function TopicIcon({ topicId, size = 'md' }: { topicId: string; size?: 'sm' | 'md' | 'lg' }) {
  const t = getTopic(topicId);
  if (!t) return null;
  const c = COLOR[t.color];
  const sz = size === 'sm' ? 'h-8 w-8 text-base' : size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-xl';
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-xl', c.soft, c.text, sz)} aria-hidden>
      {t.icon}
    </span>
  );
}

export function PageHeader({ title, subtitle, backTo, actions }: { title: ReactNode; subtitle?: ReactNode; backTo?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {backTo && (
        <button type="button" onClick={() => back(backTo)} aria-label="חזרה" className="mt-0.5 rounded-xl p-2 text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/5">
          <ArrowRight className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Section({ title, icon, children, className = '' }: { title: ReactNode; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mt-5', className)}>
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

const TONE = {
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100',
  warn: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
  bad: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
  brand: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100',
};

export function Callout({ tone = 'info', title, icon, children, className = '' }: { tone?: keyof typeof TONE; title?: ReactNode; icon?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl border p-3.5 text-[15px] leading-relaxed', TONE[tone], className)}>
      {(title || icon) && (
        <div className="mb-1 flex items-center gap-2 font-bold">
          {icon}
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center dark:border-night-line">
      <div className="mb-2 text-3xl">{icon}</div>
      <div className="font-bold">{title}</div>
      {children && <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, className = '', color = 'bg-brand-500' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10', className)}>
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
