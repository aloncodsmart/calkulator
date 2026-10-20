import { useEffect, useMemo, useRef, useState } from 'react';
import { Search as SearchIcon, Shapes, X } from 'lucide-react';
import type { DiagramShape } from '../types';
import { diagrams, getTopic, topics } from '../data';
import { search, type SearchHit } from '../lib/search';
import { navigate } from '../router';
import { Diagram } from '../components/Diagram';
import { Rich, Tex } from '../components/Tex';
import { Card, Chip, Empty, PageHeader, Section, StatusBadge, TopicBadge, cx } from '../components/ui';

const SHAPES: { id: DiagramShape; label: string; sample?: string }[] = [
  { id: 'angles', label: 'זוויות' },
  { id: 'parallel', label: 'ישרים מקבילים' },
  { id: 'triangle', label: 'משולש' },
  { id: 'right-triangle', label: 'משולש ישר זווית' },
  { id: 'similar', label: 'משולשים דומים' },
  { id: 'quadrilateral', label: 'מרובע' },
  { id: 'polygon', label: 'מצולע' },
  { id: 'circle', label: 'מעגל' },
  { id: 'tangent', label: 'משיקים' },
  { id: 'graph', label: 'גרף פונקציה' },
  { id: 'coordinate', label: 'מערכת צירים' },
  { id: 'number-line', label: 'ישר מספרים' },
  { id: 'solid', label: 'גוף במרחב' },
  { id: 'vector', label: 'וקטורים' },
  { id: 'complex-plane', label: 'מישור מרוכב' },
  { id: 'venn', label: 'דיאגרמת ון' },
  { id: 'tree', label: 'עץ הסתברות' },
  { id: 'chart', label: 'דיאגרמה סטטיסטית' },
];

export function SearchScreen({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [topic, setTopic] = useState('');
  const [shape, setShape] = useState<DiagramShape | ''>('');
  const [showShapes, setShowShapes] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const samples = useMemo(() => {
    const m = new Map<DiagramShape, string>();
    for (const d of diagrams) if (!m.has(d.shape)) m.set(d.shape, d.id);
    return m;
  }, []);
  const shapes = SHAPES.filter((s) => samples.has(s.id));

  const active = q.trim() || topic || shape;
  const hits = useMemo(() => (active ? search(q, { topic: topic || undefined, shape: shape || undefined }) : []), [q, topic, shape, active]);
  const groups: { kind: SearchHit['kind']; title: string; items: SearchHit[] }[] = [
    { kind: 'theorem', title: 'משפטים', items: hits.filter((h) => h.kind === 'theorem') },
    { kind: 'concept', title: 'מושגים', items: hits.filter((h) => h.kind === 'concept') },
    { kind: 'formula', title: 'נוסחאות', items: hits.filter((h) => h.kind === 'formula') },
  ];

  return (
    <div>
      <PageHeader title="חיפוש חכם" subtitle="חפשו במילים, לפי נושא – או לפי צורת השרטוט שיש לכם בשאלה." />
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="למשל: זווית בין משיק למיתר, נגזרת של מנה…"
          className="w-full rounded-2xl border border-black/10 bg-white py-3 pe-10 ps-10 text-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night-card"
          aria-label="חיפוש"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="ניקוי" className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Chip active={showShapes || !!shape} onClick={() => setShowShapes(!showShapes)}>
          <Shapes className="h-4 w-4" /> חיפוש לפי שרטוט{shape && `: ${SHAPES.find((s) => s.id === shape)?.label}`}
        </Chip>
        {topics.map((t) => (
          <Chip key={t.id} active={topic === t.id} onClick={() => setTopic(topic === t.id ? '' : t.id)}>
            <span aria-hidden>{t.icon}</span>
            {t.name}
          </Chip>
        ))}
      </div>
      {showShapes && (
        <div className="pop-in mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {shapes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setShape(shape === s.id ? '' : s.id);
                setShowShapes(false);
              }}
              className={cx(
                'rounded-xl border bg-white p-1.5 text-xs font-semibold transition dark:bg-night-card',
                shape === s.id ? 'border-brand-600 ring-2 ring-brand-600/30' : 'border-black/10 hover:border-brand-300 dark:border-night-line',
              )}
            >
              <div className="h-14">
                <Diagram id={samples.get(s.id)} thumb />
              </div>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {!active ? (
        <div className="mt-6">
          <Empty icon="🔍" title="מה מחפשים?">
            אפשר לכתוב חלק ממילה, בלי ניקוד, עם או בלי אותיות שימוש (״והמשיק״ ימצא ״משיק״).
          </Empty>
        </div>
      ) : hits.length === 0 ? (
        <div className="mt-6">
          <Empty icon="🤷" title="לא נמצאו תוצאות">
            נסו מילה אחרת או הסירו סינון.
          </Empty>
        </div>
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <Section key={g.kind} title={`${g.title} (${g.items.length})`}>
              <div className="space-y-2">
                {g.items.slice(0, 30).map((h) => (
                  <HitCard key={`${h.kind}:${h.item.id}`} hit={h} />
                ))}
              </div>
            </Section>
          ))
      )}
    </div>
  );
}

function HitCard({ hit }: { hit: SearchHit }) {
  if (hit.kind === 'formula') {
    return (
      <Card className="p-3" onClick={() => navigate('/formulas')}>
        <div className="flex items-center gap-2 text-sm font-bold">
          {hit.item.name}
          <span className="text-xs font-normal text-slate-500">· {hit.section.title}</span>
        </div>
        <Tex tex={hit.item.tex} display />
      </Card>
    );
  }
  const isTh = hit.kind === 'theorem';
  const item = hit.item;
  const title = isTh ? hit.item.name : hit.item.term;
  const text = isTh ? hit.item.statement : hit.item.simple;
  return (
    <Card className="p-3" onClick={() => navigate(isTh ? `/theorems/${item.id}` : `/concepts/${item.id}`)}>
      <div className="flex gap-3">
        <div className="h-14 w-16 shrink-0">
          <Diagram id={item.diagram} thumb />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{title}</span>
            {isTh ? <StatusBadge status={hit.item.status} short /> : getTopic(item.topic) && <TopicBadge topicId={item.topic} />}
          </div>
          <div className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
            <Rich text={text} />
          </div>
        </div>
      </div>
    </Card>
  );
}
