import { useMemo, useState } from 'react';
import { ExternalLink, PartyPopper, RotateCcw } from 'lucide-react';
import type { Profile } from '../types';
import { concepts, formulaSections, theorems } from '../data';
import { mastery, previewIntervals, newCard, today, RATING_LABELS, type CardState, type Rating } from '../lib/srs';
import { navigate } from '../router';
import { isRelevant, rateCard, useStore } from '../store';
import { Diagram } from '../components/Diagram';
import { Rich, Tex } from '../components/Tex';
import { Button, Card, PageHeader, ProgressBar, Segmented, StatusBadge, TopicBadge, cx } from '../components/ui';

export type DeckId = 'theorems' | 'concepts' | 'formulas' | 'saved';

export const DECKS: { id: DeckId; label: string }[] = [
  { id: 'theorems', label: 'משפטים' },
  { id: 'concepts', label: 'מושגים' },
  { id: 'formulas', label: 'נוסחאות' },
  { id: 'saved', label: 'שמורים' },
];

const NEW_PER_SESSION = 10;

interface FlashCard {
  id: string;
  kind: 'theorem' | 'concept' | 'formula';
  title: string;
  topic?: string;
  diagram?: string;
  prompt: string;
  backText?: string;
  backTex?: string;
  backNote?: string;
  status?: 'official' | 'formula-sheet' | 'needs-proof';
  link?: string;
}

function allCards(deck: DeckId, profile: Profile | null, showAll: boolean, bookmarks: string[]): FlashCard[] {
  const th = theorems.filter((t) => (deck === 'saved' ? bookmarks.includes(t.id) : showAll || isRelevant(t, profile)));
  const co = concepts.filter((c) => (deck === 'saved' ? bookmarks.includes(c.id) : showAll || isRelevant(c, profile)));
  const theoremCards = (): FlashCard[] =>
    th.map((t) => ({
      id: `th:${t.id}`,
      kind: 'theorem',
      title: t.name,
      topic: t.topic,
      diagram: t.diagram,
      prompt: 'מה אומר המשפט? ומה צריך להראות לפני שמצטטים אותו?',
      backText: t.statement,
      backTex: t.formal,
      backNote: `**נימוק:** ${t.citation}`,
      status: t.status,
      link: `/theorems/${t.id}`,
    }));
  const conceptCards = (): FlashCard[] =>
    co.map((c) => ({
      id: `co:${c.id}`,
      kind: 'concept',
      title: c.term,
      topic: c.topic,
      diagram: c.diagram,
      prompt: 'מה הפירוש של המושג?',
      backText: c.simple,
      backNote: c.formal,
      link: `/concepts/${c.id}`,
    }));
  if (deck === 'theorems') return theoremCards();
  if (deck === 'concepts') return conceptCards();
  if (deck === 'saved') return [...theoremCards(), ...conceptCards()];
  const units = profile?.units ?? (profile && profile.grade <= 9 ? 3 : 4);
  return formulaSections.flatMap((s) =>
    s.items
      .filter((f) => showAll || f.units.includes(units))
      .map((f) => ({
        id: `fo:${f.id}`,
        kind: 'formula' as const,
        title: f.name,
        topic: s.topic,
        prompt: `איך נראית הנוסחה? (${s.title})`,
        backTex: f.tex,
        backNote: f.note,
      })),
  );
}

export function buildDeck(deck: DeckId | string, profile: Profile | null, showAll: boolean, srs: Record<string, CardState>, bookmarks: string[]) {
  const d = (DECKS.some((x) => x.id === deck) ? deck : 'theorems') as DeckId;
  const cards = allCards(d, profile, showAll, bookmarks);
  const day = today();
  const due = cards.filter((c) => srs[c.id] && srs[c.id].due <= day).sort((a, b) => srs[a.id].due - srs[b.id].due);
  const fresh = cards.filter((c) => !srs[c.id]).slice(0, NEW_PER_SESSION);
  const mastered = cards.filter((c) => mastery(srs[c.id]) >= 1).length;
  const learning = cards.filter((c) => srs[c.id] && mastery(srs[c.id]) < 1).length;
  return { deck: d, cards, queue: [...due, ...fresh], dueCount: due.length, newCount: fresh.length, mastered, learning };
}

function fmtInterval(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'מחר';
  if (days < 30) return `${days} ימים`;
  const m = Math.round(days / 30);
  return m === 1 ? 'חודש' : `${m} חודשים`;
}

export function FlashcardsScreen({ deck }: { deck: string }) {
  const profile = useStore((s) => s.profile);
  const showAll = useStore((s) => s.settings.showAll);
  const bookmarks = useStore((s) => s.bookmarks);
  const srs = useStore((s) => s.srs);
  // the session queue is fixed when the deck opens; ratings update the store
  const [sessionKey, setSessionKey] = useState(0);
  const info = useMemo(() => buildDeck(deck, profile, showAll, srs, bookmarks), [deck, profile, showAll, bookmarks, sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [queue, setQueue] = useState(info.queue);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [lastKey, setLastKey] = useState(`${deck}:${sessionKey}`);
  if (lastKey !== `${deck}:${sessionKey}`) {
    setLastKey(`${deck}:${sessionKey}`);
    setQueue(info.queue);
    setPos(0);
    setFlipped(false);
    setDone(0);
  }

  const card = queue[pos];
  const state = card ? (srs[card.id] ?? newCard()) : undefined;
  const preview = state ? previewIntervals(state) : undefined;

  const rate = (r: Rating) => {
    if (!card) return;
    rateCard(card.id, r);
    setDone((n) => n + 1);
    setFlipped(false);
    if (r === 0) setQueue((q) => [...q, card]); // see it again in this session
    setPos((p) => p + 1);
  };

  return (
    <div>
      <PageHeader backTo="/practice" title="כרטיסיות חזרה" subtitle="חזרה מרווחת: כרטיסייה שאתם יודעים טוב תחזור בעוד זמן רב, וכרטיסייה קשה – בקרוב." />
      <Segmented options={DECKS} value={info.deck} onChange={(v) => navigate(`/practice/cards?deck=${v}`)} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <Stat n={info.dueCount} label="לחזרה היום" />
        <Stat n={info.newCount} label="חדשות" />
        <Stat n={`${info.mastered}/${info.cards.length}`} label="נלמדו היטב" />
      </div>

      {card ? (
        <div className="mt-4">
          <ProgressBar value={pos / queue.length} className="mb-3" />
          <div className="flip">
            <div className={cx('flip-inner', flipped && 'flipped')}>
              <button type="button" className="flip-face block w-full" onClick={() => setFlipped(true)} aria-label="הפיכת הכרטיסייה">
                <Card className="flex min-h-80 flex-col items-center justify-center p-5 text-center">
                  {card.topic && <TopicBadge topicId={card.topic} />}
                  {card.diagram && (
                    <div className="mt-3 h-36 w-48">
                      <Diagram id={card.diagram} thumb />
                    </div>
                  )}
                  <div className="mt-3 text-2xl font-extrabold">{card.title}</div>
                  <div className="mt-2 text-sm text-slate-500">{card.prompt}</div>
                  <div className="mt-5 text-xs font-semibold text-brand-600">הקישו כדי להפוך</div>
                </Card>
              </button>
              <div className="flip-face flip-back">
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{card.title}</span>
                    {card.status && <StatusBadge status={card.status} short />}
                  </div>
                  <div className="mt-3 flex-1 space-y-2 overflow-y-auto leading-relaxed">
                    {card.backText && (
                      <p className="text-lg">
                        <Rich text={card.backText} />
                      </p>
                    )}
                    {card.backTex && <Tex tex={card.backTex} display />}
                    {card.backNote && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        <Rich text={card.backNote} />
                      </p>
                    )}
                  </div>
                  {card.link && (
                    <button type="button" onClick={() => navigate(card.link!)} className="mt-2 inline-flex items-center gap-1 self-start text-sm text-brand-700 underline dark:text-brand-300">
                      <ExternalLink className="h-3.5 w-3.5" /> לדף המלא
                    </button>
                  )}
                </Card>
              </div>
            </div>
          </div>
          {flipped ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {([0, 1, 2, 3] as Rating[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => rate(r)}
                  className={cx(
                    'flex flex-col items-center rounded-xl py-2 font-bold text-white shadow-sm active:scale-95',
                    r === 0 ? 'bg-rose-500' : r === 1 ? 'bg-amber-500' : r === 2 ? 'bg-emerald-500' : 'bg-sky-500',
                  )}
                >
                  {RATING_LABELS[r]}
                  <span className="text-[11px] font-medium opacity-90">{fmtInterval(preview![r])}</span>
                </button>
              ))}
            </div>
          ) : (
            <Button size="lg" className="mt-3 w-full" onClick={() => setFlipped(true)}>
              הצגת התשובה
            </Button>
          )}
          <p className="mt-2 text-center text-xs text-slate-500">
            כרטיסייה {pos + 1} מתוך {queue.length}
          </p>
        </div>
      ) : (
        <Card className="mt-4 p-6 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-brand-600" />
          <div className="mt-2 text-xl font-bold">{done > 0 ? `סיימתם ${done} כרטיסיות!` : info.deck === 'saved' && info.cards.length === 0 ? 'עוד אין כרטיסיות שמורות' : 'אין כרטיסיות לחזרה כרגע'}</div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {info.deck === 'saved' && info.cards.length === 0 ? 'שמרו משפטים בעזרת כפתור הסימנייה בדף המשפט.' : 'כרטיסיות חדשות יחכו לכם בפעם הבאה. החזרה מחר תחזק את הזיכרון.'}
          </p>
          <Button variant="soft" className="mt-4" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setSessionKey((k) => k + 1)}>
            סבב נוסף
          </Button>
        </Card>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-xl bg-white p-2 shadow-sm dark:bg-night-card">
      <div className="text-lg font-extrabold text-brand-700 dark:text-brand-300">{n}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
