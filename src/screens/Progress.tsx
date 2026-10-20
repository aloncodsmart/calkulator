import { useMemo, type ReactNode } from 'react';
import { BarChart3, CalendarDays, Clock, Flame, Layers, Pencil, Target, Trophy, Wand2 } from 'lucide-react';
import { conceptById, getTopic, theoremById, topics } from '../data';
import { GENERATORS } from '../lib/generators';
import { navigate } from '../router';
import { isRelevant, resetProgress, useStore } from '../store';
import { Button, Card, Empty, PageHeader, ProgressBar, Section, TopicIcon, cx } from '../components/ui';
import { buildDeck, DECKS } from './Flashcards';
import { strength, strengthLabel } from './Practice';
import { GRADE_LABEL } from './Theorems';

const LEVEL: Record<string, string> = { basic: 'רמה בסיסית', standard: 'רמה רגילה', advanced: 'רמה מוגברת' };

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function streakOf(days: string[]): number {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1); // today not done yet – the streak is still alive
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function ProgressScreen() {
  const state = useStore((s) => s);
  const { profile, progress, srs, bookmarks } = state;
  const showAll = state.settings.showAll;
  const stats = progress.topics;
  const attempts = Object.values(stats).reduce((a, s) => a + s.attempts, 0);
  const correct = Object.values(stats).reduce((a, s) => a + s.correct, 0);
  const streak = streakOf(progress.days);

  const relevantTopics = topics.filter((t) => GENERATORS[t.id]?.length && (showAll || isRelevant(t, profile)));
  const practiced = relevantTopics
    .map((t) => ({ t, v: strength(stats[t.id]), st: stats[t.id] }))
    .filter((x) => x.v !== null)
    .sort((a, b) => (b.v ?? 0) - (a.v ?? 0));
  const strong = practiced.filter((x) => (x.v ?? 0) >= 0.8);
  const weak = practiced.filter((x) => (x.v ?? 0) < 0.55).reverse();
  const mid = practiced.filter((x) => (x.v ?? 0) >= 0.55 && (x.v ?? 0) < 0.8);
  const untouched = relevantTopics.filter((t) => !stats[t.id]);

  const decks = useMemo(() => DECKS.filter((d) => d.id !== 'saved').map((d) => ({ ...d, info: buildDeck(d.id, profile, showAll, srs, bookmarks) })), [profile, showAll, srs, bookmarks]);
  const dueTotal = decks.reduce((a, d) => a + d.info.dueCount, 0);

  const recs: { icon: ReactNode; title: string; text: string; go: string }[] = [];
  weak.slice(0, 2).forEach((w) => recs.push({ icon: <Target className="h-5 w-5 text-rose-500" />, title: `לחזק: ${w.t.name}`, text: 'כמה תרגילים קלים עם רמזים יעזרו לבנות ביטחון.', go: `/practice/gen/${w.t.id}` }));
  if (dueTotal > 0) recs.push({ icon: <Layers className="h-5 w-5 text-brand-600" />, title: `${dueTotal} כרטיסיות לחזרה`, text: 'חזרה קצרה היום שומרת את מה שכבר למדתם.', go: '/practice/cards' });
  untouched.slice(0, 2).forEach((t) => recs.push({ icon: <Wand2 className="h-5 w-5 text-sky-600" />, title: `להתחיל: ${t.name}`, text: t.description, go: `/practice/gen/${t.id}` }));

  const last28 = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    return { key: dayKey(d), on: progress.days.includes(dayKey(d)) };
  });

  const viewed = [...progress.viewed]
    .reverse()
    .map((v) => {
      const [kind, id] = v.split(':');
      if (kind === 'th') {
        const t = theoremById.get(id);
        return t && { id: v, label: t.name, go: `/theorems/${id}` };
      }
      const c = conceptById.get(id);
      return c && { id: v, label: c.term, go: `/concepts/${id}` };
    })
    .filter((x): x is { id: string; label: string; go: string } => !!x)
    .slice(0, 8);

  return (
    <div>
      <PageHeader title="ההתקדמות שלי" subtitle="הכול נשמר רק במכשיר שלך." />
      {profile && (
        <Card tone="brand" className="flex items-center gap-3 p-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-extrabold text-brand-700 shadow-sm dark:bg-night-card dark:text-brand-300">{GRADE_LABEL[profile.grade]}</span>
          <div className="flex-1">
            <div className="font-bold">כיתה {GRADE_LABEL[profile.grade]}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">{profile.units ? `${profile.units} יחידות לימוד` : LEVEL[profile.middleLevel ?? 'standard']}</div>
          </div>
          <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate('/welcome')}>
            שינוי
          </Button>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile icon={<Flame className="h-5 w-5 text-orange-500" />} value={streak} label={streak === 1 ? 'יום ברצף' : 'ימים ברצף'} />
        <StatTile icon={<Trophy className="h-5 w-5 text-amber-500" />} value={attempts} label="תרגילים" />
        <StatTile icon={<BarChart3 className="h-5 w-5 text-emerald-500" />} value={attempts ? `${Math.round((correct / attempts) * 100)}%` : '—'} label="הצלחה בניסיון הראשון" />
        <StatTile icon={<Wand2 className="h-5 w-5 text-brand-500" />} value={progress.solverUses + progress.checks} label="פתרונות ובדיקות" />
      </div>

      <Section title="28 הימים האחרונים" icon={<CalendarDays className="h-5 w-5 text-sky-600" />}>
        <div className="grid grid-cols-14 gap-1" dir="ltr">
          {last28.map((d) => (
            <div key={d.key} title={d.key} className={cx('aspect-square rounded-md', d.on ? 'bg-brand-500' : 'bg-black/5 dark:bg-white/10')} />
          ))}
        </div>
      </Section>

      {recs.length > 0 && (
        <Section title="מה כדאי לעשות עכשיו" icon={<Target className="h-5 w-5 text-rose-500" />}>
          <div className="space-y-2">
            {recs.slice(0, 4).map((r) => (
              <Card key={r.title} className="flex items-center gap-3 p-3.5" onClick={() => navigate(r.go)}>
                {r.icon}
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{r.title}</div>
                  <div className="truncate text-sm text-slate-600 dark:text-slate-400">{r.text}</div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title="נושאים חזקים ונושאים לחיזוק" icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}>
        {practiced.length === 0 ? (
          <Empty icon="🌱" title="עוד אין נתונים">
            פתרו כמה תרגילים במחולל התרגילים, ונראה כאן איפה אתם חזקים ומה כדאי לחזק.
            <div className="mt-3">
              <Button size="sm" onClick={() => navigate('/practice')}>
                לתרגול
              </Button>
            </div>
          </Empty>
        ) : (
          <div className="space-y-3">
            <TopicGroup title="💪 חזקים" items={strong} />
            <TopicGroup title="📈 בדרך הנכונה" items={mid} />
            <TopicGroup title="🎯 כדאי לחזק" items={weak} />
          </div>
        )}
      </Section>

      <Section title="כרטיסיות" icon={<Layers className="h-5 w-5 text-brand-600" />}>
        <Card className="divide-y divide-black/5 dark:divide-night-line">
          {decks.map((d) => (
            <button key={d.id} type="button" onClick={() => navigate(`/practice/cards?deck=${d.id}`)} className="flex w-full items-center gap-3 p-3 text-start">
              <span className="w-20 font-semibold">{d.label}</span>
              <ProgressBar value={d.info.cards.length ? d.info.mastered / d.info.cards.length : 0} className="flex-1" color="bg-emerald-500" />
              <span className="w-28 text-end text-xs text-slate-500">
                {d.info.mastered} נלמדו · {d.info.learning} בלמידה
              </span>
            </button>
          ))}
        </Card>
      </Section>

      {viewed.length > 0 && (
        <Section title="נצפו לאחרונה" icon={<Clock className="h-5 w-5 text-slate-500" />}>
          <div className="flex flex-wrap gap-1.5">
            {viewed.map((v) => (
              <button key={v.id} type="button" onClick={() => navigate(v.go)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm dark:border-night-line dark:bg-night-card">
                {v.label}
              </button>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-8 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('לאפס את כל ההתקדמות והכרטיסיות? הפעולה לא ניתנת לביטול.')) resetProgress();
          }}
        >
          איפוס התקדמות
        </Button>
      </div>
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return (
    <Card className="p-3">
      {icon}
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </Card>
  );
}

function TopicGroup({ title, items }: { title: string; items: { t: { id: string; name: string }; v: number | null; st: { attempts: number; correct: number } | undefined }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-sm font-bold">{title}</div>
      <Card className="divide-y divide-black/5 dark:divide-night-line">
        {items.map(({ t, v, st }) => {
          const s = strengthLabel(v);
          return (
            <button key={t.id} type="button" onClick={() => navigate(`/practice/gen/${t.id}`)} className="flex w-full items-center gap-3 p-3 text-start">
              <TopicIcon topicId={t.id} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{getTopic(t.id)?.name}</div>
                <ProgressBar value={v ?? 0} color={s.color} className="mt-1" />
              </div>
              <span className="w-14 text-end text-xs text-slate-500">
                {st?.correct}/{st?.attempts}
              </span>
            </button>
          );
        })}
      </Card>
    </div>
  );
}
