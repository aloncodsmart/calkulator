import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Bookmark, BookmarkCheck, BookOpenCheck, ChevronLeft, ChevronRight, Copy, Info, Lightbulb, ListChecks, PenLine, Search, Sigma } from 'lucide-react';
import type { Theorem, TheoremStatus } from '../types';
import { conceptById, getTopic, theoremById, theorems, topics } from '../data';
import { search } from '../lib/search';
import { navigate } from '../router';
import { isRelevant, recordView, toggleBookmark, useStore } from '../store';
import { Diagram } from '../components/Diagram';
import { ProofTable } from '../components/learning';
import { Rich, Tex } from '../components/Tex';
import { Button, Callout, Card, Chip, Empty, PageHeader, Section, Segmented, StatusBadge, TopicBadge, cx } from '../components/ui';

export function ContentDisclaimer({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  return (
    <Callout tone="warn" icon={<Info className="h-4 w-4" />} title="על הניסוחים במאגר">
      {open ? (
        <>
          לא צורף לאפליקציה קובץ רשמי של משרד החינוך, ולכן הניסוחים כאן הם הניסוחים המקובלים בתוכנית הלימודים ובספרי הלימוד. לכל משפט מסומן הסטטוס שלו:
          <span className="mx-1 inline-flex flex-wrap gap-1 align-middle">
            <StatusBadge status="official" /> <StatusBadge status="formula-sheet" /> <StatusBadge status="needs-proof" />
          </span>
          . כשיש ספק אם משפט נמצא ברשימה, כתבנו זאת במפורש בדף המשפט. לפני בחינה – השוו לרשימה העדכנית של הפיקוח על המתמטיקה (מפמ״ר).
        </>
      ) : (
        <button type="button" className="underline" onClick={() => setOpen(true)}>
          קראו לפני שמשתמשים במאגר בבחינה
        </button>
      )}
    </Callout>
  );
}

const STATUS_FILTERS: { id: 'all' | TheoremStatus | 'saved'; label: string }[] = [
  { id: 'all', label: 'הכול' },
  { id: 'official', label: 'מותר לצטט' },
  { id: 'needs-proof', label: 'צריך להוכיח' },
  { id: 'formula-sheet', label: 'בדף הנוסחאות' },
  { id: 'saved', label: 'שמורים' },
];

export function TheoremsScreen() {
  const profile = useStore((s) => s.profile);
  const showAll = useStore((s) => s.settings.showAll);
  const bookmarks = useStore((s) => s.bookmarks);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string>('');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]['id']>('all');

  const relevant = useMemo(() => theorems.filter((t) => showAll || isRelevant(t, profile)), [profile, showAll]);
  const topicIds = useMemo(() => topics.filter((t) => relevant.some((th) => th.topic === t.id)).map((t) => t.id), [relevant]);
  const list = useMemo(() => {
    let items: Theorem[] = q.trim()
      ? search(q, { topic: topic || undefined })
          .filter((h) => h.kind === 'theorem')
          .map((h) => h.item as Theorem)
          .filter((t) => relevant.includes(t))
      : relevant.filter((t) => !topic || t.topic === topic);
    if (status === 'saved') items = items.filter((t) => bookmarks.includes(t.id));
    else if (status !== 'all') items = items.filter((t) => t.status === status);
    return items;
  }, [q, topic, status, relevant, bookmarks]);

  const grouped = useMemo(() => {
    if (q.trim()) return [['', list]] as [string, Theorem[]][];
    const m = new Map<string, Theorem[]>();
    for (const t of list) m.set(t.topic, [...(m.get(t.topic) ?? []), t]);
    return [...m.entries()];
  }, [list, q]);

  const hidden = theorems.length - relevant.length;
  return (
    <div>
      <PageHeader title="משפטים" subtitle={`${relevant.length} משפטים שמתאימים לרמה שלך – עם תנאים, שרטוט, דוגמה וטעויות נפוצות.`} />
      <Segmented
        options={[
          { id: 'theorems', label: 'משפטים', icon: <BookOpenCheck className="h-4 w-4" /> },
          { id: 'formulas', label: 'דף נוסחאות', icon: <Sigma className="h-4 w-4" /> },
        ]}
        value="theorems"
        onChange={(v) => v === 'formulas' && navigate('/formulas')}
      />
      <div className="mt-4">
        <ContentDisclaimer compact />
      </div>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש: תיכון ליתר, זווית היקפית, תאלס…"
          className="w-full rounded-xl border border-black/10 bg-white py-2.5 pe-3 ps-9 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night-card"
          aria-label="חיפוש משפט"
        />
      </div>
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Chip active={!topic} onClick={() => setTopic('')}>
          כל הנושאים
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
      <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {STATUS_FILTERS.map((s) => (
          <Chip key={s.id} active={status === s.id} onClick={() => setStatus(s.id)} className="text-xs">
            {s.label}
          </Chip>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mt-6">
          <Empty icon="🔎" title="לא נמצאו משפטים">
            נסו מילה אחרת או הסירו סינון.
          </Empty>
        </div>
      ) : (
        grouped.map(([tid, items]) => (
          <Section key={tid || 'results'} title={tid ? getTopic(tid)?.name : `${items.length} תוצאות`} icon={tid ? <span aria-hidden>{getTopic(tid)?.icon}</span> : undefined}>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {items.map((t) => (
                <TheoremCard key={t.id} t={t} saved={bookmarks.includes(t.id)} />
              ))}
            </div>
          </Section>
        ))
      )}
      {hidden > 0 && !showAll && (
        <p className="mt-6 text-center text-xs text-slate-500">
          {hidden} משפטים נוספים שייכים לרמות אחרות.{' '}
          <button type="button" className="underline" onClick={() => navigate('/settings')}>
            להצגת הכול
          </button>
        </p>
      )}
    </div>
  );
}

function TheoremCard({ t, saved }: { t: Theorem; saved: boolean }) {
  return (
    <Card className="p-3" onClick={() => navigate(`/theorems/${t.id}`)}>
      <div className="flex gap-3">
        <div className="h-20 w-24 shrink-0 rounded-xl bg-paper p-1 dark:bg-night">
          <Diagram id={t.diagram} thumb />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <div className="flex-1 font-bold leading-snug">{t.name}</div>
            {saved && <BookmarkCheck className="h-4 w-4 shrink-0 text-brand-600" />}
          </div>
          <div className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
            <Rich text={t.statement} />
          </div>
          <div className="mt-1.5">
            <StatusBadge status={t.status} short />
          </div>
        </div>
      </div>
    </Card>
  );
}

const STATUS_TEXT: Record<TheoremStatus, string> = {
  official: 'משפט מהרשימה של משפטים שמותר לצטט בבחינת הבגרות בלי להוכיח. בעמודת הנימוק כותבים את שם המשפט או את הניסוח הקצר שלו.',
  'formula-sheet': 'מופיע בדף הנוסחאות של הבגרות – מותר להשתמש בו ישירות, בלי להוכיח.',
  'needs-proof': 'טענה נכונה, אבל היא לא ברשימת המשפטים שמותר לצטט. אם משתמשים בה בבחינה – צריך להוכיח אותה (או להגיע לתוצאה בדרך אחרת).',
};

export function TheoremDetail({ id }: { id: string }) {
  const t = theoremById.get(id);
  const saved = useStore((s) => s.bookmarks.includes(id));
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (t) recordView(`th:${t.id}`);
  }, [t]);
  if (!t) return <Empty icon="🤔" title="המשפט לא נמצא" />;

  const siblings = theorems.filter((x) => x.topic === t.topic);
  const idx = siblings.indexOf(t);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  const converse = t.converse?.id ? theoremById.get(t.converse.id) : undefined;
  const related = t.related.map((r) => conceptById.get(r) ?? theoremById.get(r)).filter(Boolean);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  };

  return (
    <article>
      <PageHeader
        backTo="/theorems"
        title={t.name}
        actions={
          <button
            type="button"
            onClick={() => toggleBookmark(t.id)}
            aria-pressed={saved}
            aria-label={saved ? 'הסרה מהשמורים' : 'שמירה לחזרה'}
            className={cx('rounded-xl p-2 transition', saved ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5')}
          >
            {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          </button>
        }
      />
      <div className="-mt-2 mb-3 flex flex-wrap gap-1.5">
        <TopicBadge topicId={t.topic} />
        <StatusBadge status={t.status} />
      </div>

      <Card className="overflow-hidden">
        <div className="bg-paper p-3 dark:bg-night">
          <div className="mx-auto max-w-md">
            <Diagram id={t.diagram} title={t.name} />
          </div>
        </div>
        <div className="p-4">
          <div className="text-lg leading-relaxed">
            <Rich text={t.statement} />
          </div>
          {t.formal && (
            <div className="mt-2 rounded-xl bg-brand-50 px-3 py-1 dark:bg-brand-500/10">
              <Tex tex={t.formal} display />
            </div>
          )}
        </div>
      </Card>

      <div
        className={cx(
          'mt-3 rounded-2xl border p-3 text-sm',
          t.status === 'needs-proof' ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10',
        )}
      >
        {STATUS_TEXT[t.status]}
      </div>

      <Section title="מה כותבים בעמודת הנימוק" icon={<PenLine className="h-5 w-5 text-brand-600" />}>
        <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-white p-3 dark:border-brand-500/40 dark:bg-night-card">
          <div className="flex-1 font-semibold">
            <Rich text={t.citation} />
          </div>
          <Button size="sm" variant="soft" icon={<Copy className="h-4 w-4" />} onClick={copy}>
            {copied ? 'הועתק' : 'העתקה'}
          </Button>
        </div>
      </Section>

      <Section title="תנאים לשימוש – מה צריך להראות קודם" icon={<ListChecks className="h-5 w-5 text-emerald-600" />}>
        <ul className="space-y-1.5">
          {t.conditions.map((c, i) => (
            <li key={i} className="flex gap-2 rounded-xl bg-white p-2.5 dark:bg-night-card">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <Rich text={c} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="מתי לחשוב על המשפט הזה?" icon={<Lightbulb className="h-5 w-5 text-amber-500" />}>
        <p className="leading-relaxed">
          <Rich text={t.useWhen} />
        </p>
      </Section>

      <Section title="דוגמה פתורה" icon={<BookOpenCheck className="h-5 w-5 text-sky-600" />}>
        <Card className="p-4">
          <div className="leading-relaxed">
            <Rich text={t.example.problem} />
          </div>
          {t.example.diagram && t.example.diagram !== t.diagram && (
            <div className="mx-auto mt-2 max-w-xs">
              <Diagram id={t.example.diagram} />
            </div>
          )}
          <div className="mt-3">
            <ProofTable steps={t.example.steps} compact />
          </div>
          {t.example.answer && (
            <div className="mt-3 rounded-xl bg-emerald-50 p-2.5 font-semibold text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
              <Rich text={t.example.answer} />
            </div>
          )}
        </Card>
      </Section>

      <Section title="טעויות נפוצות" icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}>
        <ul className="space-y-1.5">
          {t.mistakes.map((m, i) => (
            <li key={i} className="flex gap-2 rounded-xl border border-rose-100 bg-rose-50/60 p-2.5 dark:border-rose-500/20 dark:bg-rose-500/5">
              <span className="mt-0.5 text-rose-500">✗</span>
              <Rich text={m} />
            </li>
          ))}
        </ul>
      </Section>

      {t.converse && (
        <Section title="המשפט ההפוך" icon={<ArrowLeftRight className="h-5 w-5 text-violet-600" />}>
          {converse ? (
            <Card className="p-3.5" onClick={() => navigate(`/theorems/${converse.id}`)}>
              <div className="flex items-center gap-2 font-bold">
                {converse.name} <StatusBadge status={converse.status} short />
              </div>
              <div className="mt-1 text-[15px] text-slate-700 dark:text-slate-300">
                <Rich text={converse.statement} />
              </div>
            </Card>
          ) : (
            <Card className="p-3.5">
              <Rich text={t.converse.statement ?? ''} />
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">המשפט ההפוך אינו מופיע במאגר כמשפט נפרד – אם משתמשים בו בבחינה, יש לבדוק אם הוא ברשימה או להוכיח אותו.</p>
            </Card>
          )}
        </Section>
      )}

      {t.note && (
        <Callout tone="info" className="mt-5" icon={<Info className="h-4 w-4" />} title="הערה">
          <Rich text={t.note} />
        </Callout>
      )}

      {related.length > 0 && (
        <Section title="מושגים ומשפטים קשורים">
          <div className="flex flex-wrap gap-1.5">
            {related.map((r) =>
              'term' in r! ? (
                <Chip key={r.id} onClick={() => navigate(`/concepts/${r.id}`)}>
                  {r.term}
                </Chip>
              ) : (
                <Chip key={r!.id} onClick={() => navigate(`/theorems/${r!.id}`)}>
                  📘 {(r as Theorem).name}
                </Chip>
              ),
            )}
          </div>
        </Section>
      )}

      <Section title="תגיות">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <TopicBadge topicId={t.topic} />
          <span className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">כיתות: {t.grades.map((g) => GRADE_LABEL[g]).join(', ')}</span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">{t.units.length ? `${t.units.join('/')} יח״ל` : 'חטיבת ביניים'}</span>
          {t.keywords.slice(0, 6).map((k) => (
            <span key={k} className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">
              #{k}
            </span>
          ))}
        </div>
      </Section>

      <div className="mt-6 flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={!prev} onClick={() => prev && navigate(`/theorems/${prev.id}`)} icon={<ChevronRight className="h-4 w-4" />}>
          הקודם
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => navigate('/practice/cards?deck=theorems')}>
          כרטיסיות
        </Button>
        <Button variant="secondary" className="flex-1 flex-row-reverse" disabled={!next} onClick={() => next && navigate(`/theorems/${next.id}`)} icon={<ChevronLeft className="h-4 w-4" />}>
          הבא
        </Button>
      </div>
    </article>
  );
}

export const GRADE_LABEL: Record<number, string> = { 7: 'ז׳', 8: 'ח׳', 9: 'ט׳', 10: 'י׳', 11: 'י״א', 12: 'י״ב' };
