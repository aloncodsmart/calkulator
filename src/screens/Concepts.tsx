import { useEffect, useMemo, useState } from 'react';
import { BookOpen, GraduationCap, Link2, Search, Smile } from 'lucide-react';
import type { Concept } from '../types';
import { conceptById, concepts, conceptsLinkingTo, getTopic, theoremById, theoremsForConcept, topics } from '../data';
import { normalizeHebrew, search } from '../lib/search';
import { navigate } from '../router';
import { isRelevant, recordView, useStore } from '../store';
import { Diagram } from '../components/Diagram';
import { Rich } from '../components/Tex';
import { Card, Chip, Empty, PageHeader, Section, StatusBadge, TopicBadge } from '../components/ui';

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

function firstLetter(term: string): string {
  const ch = term.trim().match(/[א-ת]/)?.[0];
  if (!ch) return '#';
  return FINALS[ch] ?? ch;
}

export function ConceptsScreen() {
  const profile = useStore((s) => s.profile);
  const showAll = useStore((s) => s.settings.showAll);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const relevant = useMemo(() => concepts.filter((c) => showAll || isRelevant(c, profile)), [profile, showAll]);
  const topicIds = useMemo(() => topics.filter((t) => relevant.some((c) => c.topic === t.id)).map((t) => t.id), [relevant]);

  const list = useMemo(() => {
    if (q.trim())
      return search(q, { topic: topic || undefined })
        .filter((h) => h.kind === 'concept')
        .map((h) => h.item as Concept)
        .filter((c) => relevant.includes(c));
    return relevant.filter((c) => !topic || c.topic === topic).sort((a, b) => normalizeHebrew(a.term).localeCompare(normalizeHebrew(b.term), 'he'));
  }, [q, topic, relevant]);

  const groups = useMemo(() => {
    if (q.trim()) return [['', list]] as [string, Concept[]][];
    const m = new Map<string, Concept[]>();
    for (const c of list) {
      const l = firstLetter(c.term);
      m.set(l, [...(m.get(l) ?? []), c]);
    }
    return [...m.entries()];
  }, [list, q]);

  return (
    <div>
      <PageHeader title="מילון מושגים" subtitle={`${relevant.length} מושגים – הסבר פשוט, הגדרה מדויקת ושרטוט לכל אחד.`} />
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש מושג: אנך אמצעי, נגזרת, שכיח…"
          className="w-full rounded-xl border border-black/10 bg-white py-2.5 pe-3 ps-9 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night-card"
          aria-label="חיפוש מושג"
        />
      </div>
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Chip active={!topic} onClick={() => setTopic('')}>
          הכול
        </Chip>
        {topicIds.map((id) => {
          const t = getTopic(id)!;
          return (
            <Chip key={id} active={topic === id} onClick={() => setTopic(topic === id ? '' : id)}>
              <span aria-hidden>{t.icon}</span>
              {t.name}
            </Chip>
          );
        })}
      </div>
      {!q.trim() && groups.length > 1 && (
        <nav className="mt-3 flex flex-wrap gap-1" aria-label="אינדקס אלפביתי">
          {groups.map(([l]) => (
            <button
              key={l}
              type="button"
              onClick={() => document.getElementById(`letter-${l}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="h-8 w-8 rounded-lg bg-white text-sm font-bold text-brand-700 shadow-sm dark:bg-night-card dark:text-brand-300"
            >
              {l}
            </button>
          ))}
        </nav>
      )}
      {list.length === 0 ? (
        <div className="mt-6">
          <Empty icon="📖" title="לא מצאנו את המושג">
            נסו ניסוח אחר, או חפשו בכל האפליקציה בעזרת כפתור החיפוש למעלה.
          </Empty>
        </div>
      ) : (
        groups.map(([l, items]) => (
          <div key={l || 'res'} id={`letter-${l}`} className="scroll-mt-16">
            <Section title={l || `${items.length} תוצאות`}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((c) => (
                  <Card key={c.id} className="p-3" onClick={() => navigate(`/concepts/${c.id}`)}>
                    <div className="flex gap-3">
                      <div className="h-14 w-16 shrink-0 rounded-lg bg-paper p-0.5 dark:bg-night">
                        <Diagram id={c.diagram} thumb />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold">{c.term}</div>
                        <div className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                          <Rich text={c.simple} />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          </div>
        ))
      )}
    </div>
  );
}

export function ConceptDetail({ id }: { id: string }) {
  const c = conceptById.get(id);
  useEffect(() => {
    if (c) recordView(`co:${c.id}`);
  }, [c]);
  if (!c) return <Empty icon="🤔" title="המושג לא נמצא" />;
  const relatedConcepts = c.related.map((r) => conceptById.get(r)).filter((x): x is Concept => !!x);
  const relatedTheorems = [...new Set([...c.related.map((r) => theoremById.get(r)).filter(Boolean), ...theoremsForConcept(c.id)])];
  const backlinks = conceptsLinkingTo(c.id).filter((x) => !c.related.includes(x.id)).slice(0, 8);
  return (
    <article>
      <PageHeader backTo="/concepts" title={c.term} subtitle={c.aliases?.length ? `נקרא גם: ${c.aliases.join(', ')}` : undefined} />
      <div className="-mt-2 mb-3">
        <TopicBadge topicId={c.topic} />
      </div>
      <Card className="overflow-hidden">
        <div className="bg-paper p-3 dark:bg-night">
          <div className="mx-auto max-w-sm">
            <Diagram id={c.diagram} title={c.term} />
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-sky-700 dark:text-sky-300">
              <Smile className="h-4 w-4" /> בפשטות
            </div>
            <p className="text-lg leading-relaxed">
              <Rich text={c.simple} />
            </p>
          </div>
          <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-500/10">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-brand-700 dark:text-brand-300">
              <GraduationCap className="h-4 w-4" /> הגדרה מדויקת
            </div>
            <p className="leading-relaxed">
              <Rich text={c.formal} />
            </p>
          </div>
          {c.example && (
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                <BookOpen className="h-4 w-4" /> דוגמה
              </div>
              <p className="leading-relaxed">
                <Rich text={c.example} />
              </p>
            </div>
          )}
        </div>
      </Card>
      {relatedConcepts.length > 0 && (
        <Section title="מושגים קשורים" icon={<Link2 className="h-5 w-5 text-brand-600" />}>
          <div className="flex flex-wrap gap-1.5">
            {relatedConcepts.map((r) => (
              <Chip key={r.id} onClick={() => navigate(`/concepts/${r.id}`)}>
                {r.term}
              </Chip>
            ))}
          </div>
        </Section>
      )}
      {relatedTheorems.length > 0 && (
        <Section title="משפטים שמשתמשים במושג">
          <div className="space-y-2">
            {relatedTheorems.map((t) => (
              <Card key={t!.id} className="flex items-center gap-2 p-3" onClick={() => navigate(`/theorems/${t!.id}`)}>
                <span className="flex-1 font-semibold">{t!.name}</span>
                <StatusBadge status={t!.status} short />
              </Card>
            ))}
          </div>
        </Section>
      )}
      {backlinks.length > 0 && (
        <Section title="מופיע גם ב…">
          <div className="flex flex-wrap gap-1.5">
            {backlinks.map((r) => (
              <Chip key={r.id} onClick={() => navigate(`/concepts/${r.id}`)}>
                {r.term}
              </Chip>
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}
