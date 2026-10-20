import { useRef, useState } from 'react';
import { CheckCircle2, Download, Eye, EyeOff, KeyRound, Monitor, Moon, Palette, ShieldCheck, Smartphone, Sun, Upload, UserRound } from 'lucide-react';
import { concepts, formulaSections, theorems } from '../data';
import { MODELS } from '../lib/ai';
import { navigate } from '../router';
import { exportState, importState, resetProgress, updateSettings, useStore, type Theme } from '../store';
import { Button, Callout, Card, PageHeader, Section, Segmented, cx } from '../components/ui';
import { ContentDisclaimer, GRADE_LABEL } from './Theorems';
import { IosInstallSteps, IosSeparateStorageNote, useInstallStatus } from '../components/InstallHint';

const LEVEL: Record<string, string> = { basic: 'בסיסית', standard: 'רגילה', advanced: 'מוגברת' };

export function SettingsScreen() {
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const [showKey, setShowKey] = useState(false);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const install = useInstallStatus();

  const download = () => {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `smart-math-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (f?: File) => {
    if (!f) return;
    const ok = importState(await f.text());
    setMsg(ok ? 'הנתונים יובאו בהצלחה.' : 'הקובץ לא תקין.');
  };
  const formulas = formulaSections.reduce((a, s) => a + s.items.length, 0);

  return (
    <div>
      <PageHeader title="הגדרות" />

      <Section title="הפרופיל שלי" icon={<UserRound className="h-5 w-5 text-brand-600" />} className="mt-0">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex-1">
            {profile ? (
              <>
                <div className="font-bold">כיתה {GRADE_LABEL[profile.grade]}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">{profile.units ? `${profile.units} יחידות לימוד` : `רמה ${LEVEL[profile.middleLevel ?? 'standard']}`}</div>
              </>
            ) : (
              'לא נבחר'
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/welcome')}>
            שינוי
          </Button>
        </Card>
        <label className="mt-2 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-night-card">
          <input type="checkbox" checked={settings.showAll} onChange={(e) => updateSettings({ showAll: e.target.checked })} className="h-5 w-5 accent-brand-600" />
          <span>
            <span className="block font-semibold">להציג תוכן מכל הרמות</span>
            <span className="block text-sm text-slate-600 dark:text-slate-400">ברירת המחדל: רק משפטים, מושגים ותרגילים שמתאימים לכיתה ולרמה שבחרתם.</span>
          </span>
        </label>
      </Section>

      <Section title="אפליקציה בטלפון" icon={<Smartphone className="h-5 w-5 text-sky-600" />}>
        <Card className="space-y-3 p-4 text-[15px]">
          {install.standalone ? (
            <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" /> האפליקציה מותקנת במכשיר.
            </div>
          ) : install.ios ? (
            <>
              <IosInstallSteps />
              <IosSeparateStorageNote />
            </>
          ) : install.canPrompt ? (
            <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={install.prompt}>
              התקנה במכשיר
            </Button>
          ) : (
            <p className="text-slate-600 dark:text-slate-300">בטלפון: פותחים את האתר בדפדפן ובוחרים ״הוספה למסך הבית״ (באייפון – מכפתור השיתוף ב-Safari).</p>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {install.ios && !install.standalone
              ? 'האפליקציה שבמסך הבית נשמרת במכשיר בנפרד, בפתיחה הראשונה שלה כשיש אינטרנט, ומאז עובדת גם בלי אינטרנט.'
              : install.offlineReady
                ? 'כל האפליקציה שמורה במכשיר ועובדת גם בלי אינטרנט. רק הפתרון עם Claude (צילום, הוכחות) צריך חיבור.'
                : 'אחרי הפתיחה הראשונה האפליקציה נשמרת במכשיר ועובדת גם בלי אינטרנט.'}
          </p>
        </Card>
      </Section>

      <Section title="מראה" icon={<Palette className="h-5 w-5 text-pink-500" />}>
        <Segmented<Theme>
          options={[
            { id: 'system', label: 'לפי המכשיר', icon: <Monitor className="h-4 w-4" /> },
            { id: 'light', label: 'בהיר', icon: <Sun className="h-4 w-4" /> },
            { id: 'dark', label: 'כהה', icon: <Moon className="h-4 w-4" /> },
          ]}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
      </Section>

      <Section title="פתרון עם Claude (לא חובה)" icon={<KeyRound className="h-5 w-5 text-amber-500" />}>
        <Card className="space-y-3 p-4">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            הפותר המובנה עובד בלי אינטרנט עבור משוואות, אי-שוויונות, נגזרות, חקירה, אינטגרלים ופישוט ביטויים. כדי לפתור שאלות מילוליות, הוכחות בגאומטריה ושאלות מצולמות – אפשר לחבר מפתח Claude API (מ-console.anthropic.com).
          </p>
          <div>
            <label htmlFor="api-key" className="text-sm font-semibold">
              מפתח API
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="api-key"
                dir="ltr"
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => updateSettings({ apiKey: e.target.value.trim() })}
                placeholder="sk-ant-..."
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-xl border border-black/10 bg-paper px-3 py-2.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night"
              />
              <Button variant="secondary" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'הסתרת המפתח' : 'הצגת המפתח'} icon={showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold">מודל</div>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateSettings({ model: m.id })}
                  className={cx(
                    'rounded-xl border p-3 text-start transition',
                    settings.model === m.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:bg-brand-500/10' : 'border-black/10 bg-white dark:border-night-line dark:bg-night-card',
                  )}
                >
                  <div className="font-semibold" dir="ltr">
                    {m.label}
                  </div>
                  <div className="text-xs text-slate-500">{m.note}</div>
                </button>
              ))}
            </div>
          </div>
          <Callout tone="info" icon={<ShieldCheck className="h-4 w-4" />}>
            המפתח נשמר רק בדפדפן הזה, לא מיוצא בגיבוי, ונשלח רק לשרתי Anthropic בזמן בקשה. אל תשתמשו במפתח במכשיר משותף. השימוש ב-API כרוך בתשלום לפי החשבון שלכם.
          </Callout>
          {settings.apiKey && (
            <Button size="sm" variant="ghost" onClick={() => updateSettings({ apiKey: '' })}>
              מחיקת המפתח
            </Button>
          )}
        </Card>
      </Section>

      <Section title="גיבוי ונתונים" icon={<Download className="h-5 w-5 text-emerald-600" />}>
        <Card className="flex flex-wrap gap-2 p-4">
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={download}>
            ייצוא התקדמות
          </Button>
          <Button variant="secondary" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => file.current?.click()}>
            ייבוא מקובץ
          </Button>
          <input ref={file} type="file" accept="application/json" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('לאפס את כל ההתקדמות והכרטיסיות?')) {
                resetProgress();
                setMsg('ההתקדמות אופסה.');
              }
            }}
          >
            איפוס התקדמות
          </Button>
          {msg && <p className="w-full text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}
        </Card>
      </Section>

      <Section title="על התוכן">
        <ContentDisclaimer />
        <Card className="mt-2 p-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          במאגר: {theorems.length} משפטים (מתוכם {theorems.filter((t) => t.status === 'official').length} מסומנים כמותרים לציטוט), {concepts.length} מושגים ו-{formulas} נוסחאות. כל משפט כולל ניסוח, תנאים, שרטוט, דוגמה פתורה וטעויות נפוצות. מצאתם טעות? כדאי לבדוק מול המורה ומול המסמכים הרשמיים – ולתקן בקובצי ה-JSON שבתיקייה <code dir="ltr">src/data</code>.
        </Card>
      </Section>
    </div>
  );
}
