import type { ReactNode } from 'react';
import { BookOpen, Dumbbell, Library, Moon, Search, Settings, Sparkles, Sun, SunMoon, TrendingUp } from 'lucide-react';
import { navigate } from '../router';
import { updateSettings, useStore, type Theme } from '../store';
import { cx } from './ui';

const TABS = [
  { id: 'solver', label: 'פותר', icon: Sparkles, match: ['solver'] },
  { id: 'theorems', label: 'משפטים', icon: BookOpen, match: ['theorems', 'formulas'] },
  { id: 'concepts', label: 'מושגים', icon: Library, match: ['concepts'] },
  { id: 'practice', label: 'תרגול', icon: Dumbbell, match: ['practice'] },
  { id: 'progress', label: 'התקדמות', icon: TrendingUp, match: ['progress'] },
];

const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<Theme, string> = { system: 'ערכת צבע: לפי המכשיר', light: 'ערכת צבע: בהירה', dark: 'ערכת צבע: כהה' };

export function Layout({ section, children }: { section: string; children: ReactNode }) {
  const theme = useStore((s) => s.settings.theme);
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : SunMoon;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-paper/85 backdrop-blur-md dark:border-night-line dark:bg-night/85">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <button type="button" onClick={() => navigate('/solver')} className="flex items-center gap-2" aria-label="מתמטיקה חכמה – דף הבית">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-sky-500 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
                <path d="M4 18 L12 5 L20 18 Z" />
                <circle cx="12" cy="13.5" r="2.6" stroke="#fde68a" />
              </svg>
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              מתמטיקה <span className="bg-gradient-to-l from-brand-600 to-sky-500 bg-clip-text text-transparent">חכמה</span>
            </span>
          </button>
          <div className="ms-auto flex items-center gap-1">
            <IconBtn label="חיפוש" active={section === 'search'} onClick={() => navigate('/search')}>
              <Search className="h-5 w-5" />
            </IconBtn>
            <IconBtn label={THEME_LABEL[theme]} onClick={() => updateSettings({ theme: NEXT_THEME[theme] })}>
              <ThemeIcon className="h-5 w-5" />
            </IconBtn>
            <IconBtn label="הגדרות" active={section === 'settings'} onClick={() => navigate('/settings')}>
              <Settings className="h-5 w-5" />
            </IconBtn>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">{children}</main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/90 backdrop-blur-md dark:border-night-line dark:bg-night-card/90" aria-label="ניווט ראשי">
        <div className="mx-auto grid max-w-3xl grid-cols-5 px-2 pt-1.5">
          {TABS.map((t) => {
            const active = t.match.includes(section);
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/${t.id}`)}
                aria-current={active ? 'page' : undefined}
                className={cx('flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11.5px] font-semibold transition', active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400')}
              >
                <span className={cx('flex h-8 w-12 items-center justify-center rounded-full transition', active && 'bg-brand-100 dark:bg-brand-500/20')}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function IconBtn({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx('rounded-xl p-2 text-slate-600 transition hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/5', active && 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300')}
    >
      {children}
    </button>
  );
}
