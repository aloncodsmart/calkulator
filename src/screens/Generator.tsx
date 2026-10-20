import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Flame, RefreshCw, Send, XCircle } from 'lucide-react';
import { getTopic } from '../data';
import { GENERATORS, checkAnswer, generate, type Difficulty, type Exercise } from '../lib/generators';
import { defaultDifficulty, recordAttempt, useStore } from '../store';
import { Diagram } from '../components/Diagram';
import { HintLadder, MathKeyboard, ProofTable, StepsView } from '../components/learning';
import { Rich } from '../components/Tex';
import { Button, Callout, Card, Chip, Empty, PageHeader, Segmented, cx } from '../components/ui';

const DIFF: { id: string; label: string }[] = [
  { id: '1', label: 'קל' },
  { id: '2', label: 'בינוני' },
  { id: '3', label: 'מאתגר' },
];

const PRAISE = ['מצוין!', 'כל הכבוד!', 'יפה מאוד!', 'בדיוק!', 'אלופים!'];

export function GeneratorScreen({ topic }: { topic: string }) {
  const profile = useStore((s) => s.profile);
  const t = getTopic(topic);
  const gens = GENERATORS[topic] ?? [];
  const [genId, setGenId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty(profile));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [streak, setStreak] = useState(0);
  const ex = useMemo<Exercise | null>(() => {
    if (!gens.length) return null;
    try {
      return generate(topic, difficulty, seed, genId || undefined);
    } catch {
      return null;
    }
  }, [topic, difficulty, seed, genId, gens.length]);

  if (!t || !gens.length) return <Empty icon="🧩" title="אין מחולל לנושא הזה עדיין" />;
  const next = () => setSeed(Math.floor(Math.random() * 1e9));

  return (
    <div>
      <PageHeader
        backTo="/practice"
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden>{t.icon}</span>
            {t.name}
          </span>
        }
        actions={
          streak > 1 ? (
            <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-sm font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
              <Flame className="h-4 w-4" />
              {streak}
            </span>
          ) : undefined
        }
      />
      {gens.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <Chip active={!genId} onClick={() => setGenId('')}>
            מעורב
          </Chip>
          {gens.map((g) => (
            <Chip key={g.id} active={genId === g.id} onClick={() => setGenId(g.id)}>
              {g.name}
            </Chip>
          ))}
        </div>
      )}
      <Segmented options={DIFF} value={String(difficulty)} onChange={(v) => setDifficulty(Number(v) as Difficulty)} />
      <div className="mt-4">
        {ex ? (
          <ExerciseView
            key={`${seed}-${difficulty}-${genId}`}
            ex={ex}
            onNext={next}
            onResult={(ok) => setStreak((s) => (ok ? s + 1 : 0))}
          />
        ) : (
          <Callout tone="bad" title="לא הצלחנו ליצור תרגיל">
            <Button size="sm" className="mt-2" onClick={next}>
              לנסות שוב
            </Button>
          </Callout>
        )}
      </div>
    </div>
  );
}

function ExerciseView({ ex, onNext, onResult }: { ex: Exercise; onNext: () => void; onResult: (correct: boolean) => void }) {
  const [input, setInput] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message?: string } | null>(null);
  const [tries, setTries] = useState(0);
  const [hints, setHints] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const solved = feedback?.correct === true;

  const record = (correct: boolean) => {
    if (recorded) return;
    setRecorded(true);
    recordAttempt(ex.topic, correct, hints);
    onResult(correct);
  };

  const submit = (value: string | number) => {
    const r = checkAnswer(ex.answer, value);
    if (!r.correct && r.message && ex.answer.kind !== 'choice' && /לא הצלחנו לקרוא|כתבו תשובה/.test(r.message)) {
      setFeedback(r);
      return; // unreadable input does not count as an attempt
    }
    setFeedback(r);
    setTries((n) => n + 1);
    // the first real attempt decides the score (hints reduce nothing, but are tracked)
    if (!recorded) record(r.correct && !revealed);
  };

  const diagram = typeof ex.diagram === 'string' ? <Diagram id={ex.diagram} /> : ex.diagram ? <Diagram spec={ex.diagram} /> : null;

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="mb-2 text-xs font-semibold text-slate-500">{['', 'רמה קלה', 'רמה בינונית', 'רמה מאתגרת'][ex.difficulty]}</div>
        <div className="text-lg leading-relaxed">
          <Rich text={ex.question} />
        </div>
        {diagram && <div className="mx-auto mt-3 max-w-sm rounded-xl bg-paper p-2 dark:bg-night">{diagram}</div>}

        <div className="mt-4">
          {ex.answer.kind === 'choice' ? (
            <div className="grid grid-cols-1 gap-2">
              {ex.answer.options.map((o, i) => {
                const correct = ex.answer.kind === 'choice' && i === ex.answer.correct;
                const picked = choice === i;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={solved}
                    onClick={() => {
                      setChoice(i);
                      submit(i);
                    }}
                    className={cx(
                      'rounded-xl border p-3 text-start transition',
                      picked && feedback
                        ? feedback.correct
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                          : 'border-rose-400 bg-rose-50 dark:bg-rose-500/10'
                        : solved && correct
                          ? 'border-emerald-500'
                          : 'border-black/10 bg-white hover:border-brand-400 dark:border-night-line dark:bg-night-card',
                    )}
                  >
                    <Rich text={o} />
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
            >
              <label htmlFor="answer" className="mb-1 block text-sm font-semibold">
                התשובה שלך
              </label>
              <div className="flex gap-2">
                <input
                  id="answer"
                  ref={ref}
                  dir="ltr"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={solved}
                  autoComplete="off"
                  placeholder={ex.answer.kind === 'numbers' ? ((ex.answer.count ?? ex.answer.values.length) > 1 ? '2, -3' : '7/2') : ex.answer.kind === 'expression' ? (ex.answer.product ? '(x-2)(x+3)' : '3x^2-2x+1') : ''}
                  className="min-w-0 flex-1 rounded-xl border border-black/10 bg-paper px-3 py-2.5 font-mono text-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night"
                />
                <Button type="submit" disabled={solved || !input.trim()} icon={<Send className="h-4 w-4" />}>
                  בדיקה
                </Button>
              </div>
              {ex.inputHint && <p className="mt-1 text-xs text-slate-500">{ex.inputHint}</p>}
              {!solved && (
                <div className="mt-2">
                  <MathKeyboard target={ref} onChange={setInput} compact />
                </div>
              )}
            </form>
          )}
        </div>

        {feedback && (
          <div
            className={cx(
              'pop-in mt-3 flex items-start gap-2 rounded-xl p-3',
              feedback.correct ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100' : 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100',
            )}
            role="status"
          >
            {feedback.correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            <div>
              <div className="font-bold">{feedback.correct ? PRAISE[tries % PRAISE.length] : tries > 1 ? 'עדיין לא. נסו רמז?' : 'לא בדיוק – נסו שוב.'}</div>
              {feedback.message && <div className="text-sm">{feedback.message}</div>}
            </div>
          </div>
        )}
      </Card>

      <HintLadder
        hints={ex.hints}
        onHintUsed={(n) => setHints(Math.min(3, n))}
        onReveal={() => {
          setRevealed(true);
          if (!recorded) record(false);
        }}
      >
        <div className="space-y-3">
          {ex.proof ? <ProofTable steps={ex.proof} /> : ex.steps ? <StepsView steps={ex.steps} /> : null}
          <Callout tone="good" title="התשובה">
            <Rich text={ex.answerDisplay} />
          </Callout>
        </div>
      </HintLadder>

      <Button size="lg" variant={solved || revealed ? 'primary' : 'secondary'} className="w-full" icon={<RefreshCw className="h-4 w-4" />} onClick={onNext}>
        תרגיל חדש
      </Button>
    </div>
  );
}
