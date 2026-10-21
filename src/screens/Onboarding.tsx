import { useRef, useState } from 'react';
import { ArrowLeft, Check, Upload } from 'lucide-react';
import type { Grade, MiddleLevel, Profile, Units } from '../types';
import { importState, setProfile, useStore } from '../store';
import { navigate } from '../router';
import { Button, cx } from '../components/ui';
import { isStandalone } from '../components/InstallHint';
import { isNativeApp } from '../lib/native';

const GRADES: { g: Grade; label: string }[] = [
  { g: 7, label: 'ז׳' },
  { g: 8, label: 'ח׳' },
  { g: 9, label: 'ט׳' },
  { g: 10, label: 'י׳' },
  { g: 11, label: 'י״א' },
  { g: 12, label: 'י״ב' },
];

const MIDDLE: { id: MiddleLevel; label: string; desc: string }[] = [
  { id: 'basic', label: 'בסיסית', desc: 'מתחילים לאט ובונים ביטחון' },
  { id: 'standard', label: 'רגילה', desc: 'התוכנית הרגילה של הכיתה' },
  { id: 'advanced', label: 'מוגברת', desc: 'הקבצה מתקדמת ואתגרים' },
];

const UNITS: { u: Units; label: string; desc: string }[] = [
  { u: 3, label: '3 יח״ל', desc: 'אלגברה, פונקציות, סטטיסטיקה והסתברות, טריגונומטריה וחשבון דיפרנציאלי' },
  { u: 4, label: '4 יח״ל', desc: 'כולל גאומטריה אוקלידית, גאומטריה אנליטית ומשפטים להוכחות' },
  { u: 5, label: '5 יח״ל', desc: 'כולל וקטורים, מספרים מרוכבים וחדו״א מורחב' },
];

export function Onboarding() {
  const existing = useStore((s) => s.profile);
  const [grade, setGrade] = useState<Grade | null>(existing?.grade ?? null);
  const [units, setUnits] = useState<Units | null>(existing?.units ?? null);
  const [level, setLevel] = useState<MiddleLevel | null>(existing?.middleLevel ?? null);
  const high = grade !== null && grade >= 10;
  const ready = grade !== null && (high ? units !== null : level !== null);

  const file = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const restore = async (f?: File) => {
    if (!f) return;
    if (importState(await f.text())) navigate('/solver', { replace: true });
    else setImportError('הקובץ לא תקין. בחרו את קובץ הגיבוי שייצאתם בהגדרות.');
  };

  const finish = () => {
    if (!ready || grade === null) return;
    const p: Profile = high ? { grade, units: units! } : { grade, middleLevel: level! };
    setProfile(p);
    navigate('/solver', { replace: true });
  };

  return (
    <div className="safe-top safe-x min-h-dvh bg-gradient-to-b from-brand-50 via-paper to-paper dark:from-brand-500/10 dark:via-night dark:to-night">
      <div className="mx-auto max-w-xl px-5 pb-10 pt-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-sky-500 text-white shadow-lg shadow-brand-600/30">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
              <path d="M4 18 L12 5 L20 18 Z" />
              <circle cx="12" cy="13.5" r="2.6" stroke="#fde68a" />
            </svg>
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              ברוכים הבאים ל<span className="bg-gradient-to-l from-brand-600 to-sky-500 bg-clip-text text-transparent">מתמטיקה חכמה</span>
            </h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">עוזר שיעורי בית שמלמד איך לפתור, ולא רק נותן תשובות.</p>
          </div>
        </div>

        <h2 className="mb-2 font-bold">באיזו כיתה את/ה?</h2>
        <div className="grid grid-cols-6 gap-2">
          {GRADES.map(({ g, label }) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(g)}
              className={cx(
                'h-14 rounded-2xl border text-lg font-bold transition',
                grade === g ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/30' : 'border-black/10 bg-white hover:border-brand-300 dark:border-night-line dark:bg-night-card',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {grade !== null && (
          <div className="pop-in mt-6">
            <h2 className="mb-2 font-bold">{high ? 'כמה יחידות לימוד?' : 'באיזו רמה?'}</h2>
            <div className="space-y-2">
              {high
                ? UNITS.map((o) => <Option key={o.u} active={units === o.u} onClick={() => setUnits(o.u)} label={o.label} desc={o.desc} />)
                : MIDDLE.map((o) => <Option key={o.id} active={level === o.id} onClick={() => setLevel(o.id)} label={o.label} desc={o.desc} />)}
            </div>
          </div>
        )}

        <Button size="lg" className="mt-8 w-full" disabled={!ready} onClick={finish} icon={<ArrowLeft className="h-5 w-5" />}>
          יאללה, מתחילים
        </Button>
        <p className="mt-3 text-center text-xs text-slate-500">אפשר לשנות את הבחירה בכל רגע בהגדרות. ההתקדמות נשמרת רק במכשיר שלך.</p>
        {!existing && isStandalone() && (
          <div className="mt-6 text-center">
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
            <Button variant="ghost" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => file.current?.click()}>
              {isNativeApp() ? 'יש לכם התקדמות מהאתר? ייבוא מקובץ גיבוי' : 'יש לכם התקדמות מ-Safari? ייבוא מקובץ גיבוי'}
            </Button>
            {importError && <p className="mt-1 text-sm text-rose-600">{importError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Option({ active, onClick, label, desc }: { active: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition',
        active ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:bg-brand-500/10' : 'border-black/10 bg-white hover:border-brand-300 dark:border-night-line dark:bg-night-card',
      )}
    >
      <span className={cx('flex h-6 w-6 items-center justify-center rounded-full border-2', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600')}>
        {active && <Check className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-lg font-bold">{label}</span>
        <span className="block text-sm text-slate-600 dark:text-slate-400">{desc}</span>
      </span>
    </button>
  );
}
