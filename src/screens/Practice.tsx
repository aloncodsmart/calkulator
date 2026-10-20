import { useMemo } from 'react';
import { ChevronLeft, Layers, Sparkles } from 'lucide-react';
import { topics } from '../data';
import { GENERATORS } from '../lib/generators';
import { navigate } from '../router';
import { isRelevant, useStore, type TopicStat } from '../store';
import { Card, PageHeader, ProgressBar, Section, TopicIcon, COLOR } from '../components/ui';
import { buildDeck, DECKS } from './Flashcards';

/** 0..1 strength estimate from recent answers (weights recent results more). */
export function strength(stat: TopicStat | undefined): number | null {
  if (!stat || stat.attempts === 0) return null;
  const r = stat.recent;
  if (!r.length) return stat.correct / stat.attempts;
  let w = 0;
  let sum = 0;
  r.forEach((v, i) => {
    const wt = 1 + i / r.length;
    w += wt;
    sum += v * wt;
  });
  return sum / w;
}

export function strengthLabel(v: number | null): { label: string; color: string } {
  if (v === null) return { label: 'עוד לא תרגלת', color: 'bg-slate-300 dark:bg-slate-600' };
  if (v >= 0.8) return { label: 'חזק', color: 'bg-emerald-500' };
  if (v >= 0.55) return { label: 'בדרך הנכונה', color: 'bg-amber-500' };
  return { label: 'כדאי לחזק', color: 'bg-rose-500' };
}

export function PracticeScreen() {
  const profile = useStore((s) => s.profile);
  const showAll = useStore((s) => s.settings.showAll);
  const stats = useStore((s) => s.progress.topics);
  const srs = useStore((s) => s.srs);
  const bookmarks = useStore((s) => s.bookmarks);
  const list = topics.filter((t) => GENERATORS[t.id]?.length && (showAll || isRelevant(t, profile)));
  const due = useMemo(() => DECKS.map((d) => ({ ...d, n: buildDeck(d.id, profile, showAll, srs, bookmarks).queue.length })), [profile, showAll, srs, bookmarks]);
  const totalDue = due.reduce((a, d) => a + d.n, 0);

  return (
    <div>
      <PageHeader title="תרגול" subtitle="תרגילים חדשים בכל פעם, עם רמזים ופתרון מלא – וכרטיסיות לחזרה חכמה." />
      <Card tone="brand" className="p-4">
        <button type="button" onClick={() => navigate('/practice/cards?deck=theorems')} className="flex w-full items-center gap-3 text-start">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <Layers className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <div className="text-lg font-bold">כרטיסיות חזרה</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">{totalDue > 0 ? `${totalDue} כרטיסיות מחכות לך היום` : 'אין כרטיסיות לחזרה היום – כל הכבוד!'}</div>
          </div>
          <ChevronLeft className="h-5 w-5 text-slate-400" />
        </button>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {due.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => navigate(`/practice/cards?deck=${d.id}`)}
              className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-brand-800 shadow-sm dark:bg-white/10 dark:text-brand-200"
            >
              {d.label} · {d.n}
            </button>
          ))}
        </div>
      </Card>

      <Section title="מחולל תרגילים לפי נושא" icon={<Sparkles className="h-5 w-5 text-brand-600" />}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {list.map((t) => {
            const st = stats[t.id];
            const v = strength(st);
            const s = strengthLabel(v);
            return (
              <Card key={t.id} className="p-3.5" onClick={() => navigate(`/practice/gen/${t.id}`)}>
                <div className="flex items-center gap-3">
                  <TopicIcon topicId={t.id} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{t.name}</div>
                    <div className="truncate text-xs text-slate-500">{GENERATORS[t.id].map((g) => g.name).join(' · ')}</div>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <ProgressBar value={v ?? 0} color={v === null ? COLOR[t.color].solid : s.color} className="flex-1" />
                  <span className="w-24 text-end text-xs text-slate-500">{st ? `${st.correct}/${st.attempts} · ${s.label}` : s.label}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
