import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Bot, Calculator, CheckCircle2, CircleAlert, ClipboardCheck, Keyboard, ScanSearch, Sparkles, Wand2, XCircle } from 'lucide-react';
import type { Solution } from '../types';
import { SOLVE_MODES, solveProblem, type SolveMode, type SolveResult } from '../lib/solver';
import { EXAMPLES } from '../lib/solver/examples';
import { tryParse, toTex } from '../lib/math/expr';
import { checkSolution, type CheckResult } from '../lib/checker';
import { GIVENS, GOALS, detectTags, recommend, tagLabel, type Tag } from '../lib/recommender';
import { aiCheck, aiRecommend, aiSolve, type AiCheck, type AiImage, type AiRecommendation, type AiSolution } from '../lib/ai';
import { theoremById } from '../data';
import { ToolError, rightTriangleTool, sequenceTool, triangleTool, twoPointsTool, type ToolResult } from '../lib/tools';
import { navigate } from '../router';
import { isRelevant, recordSolverUse, useStore } from '../store';
import { Diagram } from '../components/Diagram';
import { HintLadder, MathKeyboard, ProofTable, StepsView } from '../components/learning';
import { AiBadge, AiCheckView, AiSolutionView, ApiKeyNotice, ImagePicker, useAiSettings, useTask } from '../components/aiViews';
import { Rich, Tex } from '../components/Tex';
import { Button, Callout, Card, Chip, Section, Segmented, StatusBadge, TopicBadge, cx } from '../components/ui';

type Tab = 'solve' | 'finder' | 'check' | 'tools';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'solve', label: 'פתרון', icon: <Wand2 className="h-4 w-4" /> },
  { id: 'finder', label: 'איזה משפט?', icon: <ScanSearch className="h-4 w-4" /> },
  { id: 'check', label: 'בדיקה', icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: 'tools', label: 'כלים', icon: <Calculator className="h-4 w-4" /> },
];

export function SolverScreen({ tab, initial }: { tab: string; initial: string }) {
  const t: Tab = tab === 'finder' || tab === 'check' || tab === 'tools' ? tab : 'solve';
  const profile = useStore((s) => s.profile);
  const greeting = profile && profile.grade <= 9 ? 'מה פותרים היום?' : 'על מה עובדים היום?';
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">{greeting}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">כתבו תרגיל, תארו נתונים או בדקו את הפתרון שלכם. נתחיל ברמזים – כדי שתבינו לבד.</p>
      </div>
      <Segmented options={TABS} value={t} onChange={(v) => navigate(`/solver?tab=${v}`)} />
      <div className="mt-4">
        <div hidden={t !== 'solve'}>
          <SolveTab initial={initial} />
        </div>
        <div hidden={t !== 'finder'}>
          <FinderTab />
        </div>
        <div hidden={t !== 'check'}>
          <CheckTab />
        </div>
        <div hidden={t !== 'tools'}>
          <ToolsTab />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- solve


const REL_TEX: Record<string, string> = { '=': ' = ', '<': ' < ', '>': ' > ', '≤': ' \\le ', '≥': ' \\ge ', ',': ',\\quad ' };

/** Live LaTeX preview of what the student typed (null when it can't be read yet). */
function previewTex(raw: string): string | null {
  const lines = raw
    .split('\n')
    .map((l) =>
      l
        .replace(/[֐-׿]+/g, ' ')
        .replace(/[:?]/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  if (!lines.length) return null;
  const out: string[] = [];
  for (const line of lines) {
    const parts = line.replace(/<=|=</g, '≤').replace(/>=|=>/g, '≥').split(/([=<>≤≥,])/);
    let tex = '';
    for (const p of parts) {
      if (REL_TEX[p]) {
        tex += REL_TEX[p];
        continue;
      }
      const s = p.trim();
      if (!s) return null;
      if (/^[fgh]\(x\)$|^y$/.test(s.replace(/\s/g, ''))) {
        tex += s.replace(/\s/g, '');
        continue;
      }
      const n = tryParse(s);
      if (!n) return null;
      tex += toTex(n);
    }
    out.push(tex);
  }
  return out.length > 1 ? `\\begin{gathered}${out.join(' \\\\ ')}\\end{gathered}` : out[0];
}

function SolveTab({ initial }: { initial: string }) {
  const [mode, setMode] = useState<SolveMode>('auto');
  const [text, setText] = useState(initial);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [x0, setX0] = useState('');
  const [kb, setKb] = useState(true);
  const [result, setResult] = useState<SolveResult | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => previewTex(text), [text]);
  const modeInfo = SOLVE_MODES.find((m) => m.id === mode)!;

  const solve = (input = text, tangentAt = x0) => {
    const r = solveProblem(input, mode, { a, b, x0: tangentAt });
    setResult(r);
    if (r.ok) recordSolverUse('solve');
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SOLVE_MODES.map((m) => (
            <Chip
              key={m.id}
              active={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setResult(null);
              }}
            >
              {m.label}
            </Chip>
          ))}
        </div>
        <label htmlFor="solve-input" className="sr-only">
          התרגיל
        </label>
        <textarea
          id="solve-input"
          ref={ref}
          dir="ltr"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) solve();
          }}
          placeholder={modeInfo.placeholder.replace(/^למשל:\s*/, '')}
          className="w-full resize-y rounded-xl border border-black/10 bg-paper px-3 py-2.5 font-mono text-lg outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night"
        />
        {mode === 'integral' && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span>גבולות (לא חובה):</span>
            <span>מ-</span>
            <input dir="ltr" value={a} onChange={(e) => setA(e.target.value)} className="w-16 rounded-lg border border-black/10 bg-paper px-2 py-1 dark:border-night-line dark:bg-night" aria-label="גבול תחתון" />
            <span>עד</span>
            <input dir="ltr" value={b} onChange={(e) => setB(e.target.value)} className="w-16 rounded-lg border border-black/10 bg-paper px-2 py-1 dark:border-night-line dark:bg-night" aria-label="גבול עליון" />
          </div>
        )}
        {mode === 'tangent' && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span>נקודת ההשקה:</span>
            <Tex tex="x_0 =" />
            <input dir="ltr" value={x0} onChange={(e) => setX0(e.target.value)} className="w-20 rounded-lg border border-black/10 bg-paper px-2 py-1 dark:border-night-line dark:bg-night" aria-label="שיעור x של נקודת ההשקה" />
          </div>
        )}
        <div className="mt-2 min-h-8 text-slate-700 dark:text-slate-200">
          {preview ? (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-xs text-slate-500">כך הבנו:</span>
              <Tex tex={preview} />
            </div>
          ) : text.trim() ? (
            <span className="text-xs text-slate-500">כתבו בעזרת המקלדת למטה: ^ לחזקה, sqrt( לשורש, / לשבר.</span>
          ) : null}
        </div>
        {kb && (
          <div className="mt-2">
            <MathKeyboard target={ref} onChange={setText} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => solve()} disabled={!text.trim()} icon={<Sparkles className="h-4 w-4" />}>
            פתרון צעד אחר צעד
          </Button>
          <Button variant="ghost" size="sm" icon={<Keyboard className="h-4 w-4" />} onClick={() => setKb(!kb)}>
            {kb ? 'הסתרת מקלדת' : 'מקלדת מתמטית'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">דוגמאות:</span>
          {EXAMPLES[mode].map((ex) => (
            <button
              key={ex}
              type="button"
              dir="ltr"
              onClick={() => {
                const at = mode === 'tangent' && !x0 ? '1' : x0;
                setText(ex);
                setX0(at);
                solve(ex, at);
              }}
              className="rounded-lg bg-black/5 px-2 py-1 font-mono text-xs text-slate-700 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-300"
            >
              {ex.replace('\n', ' ; ')}
            </button>
          ))}
        </div>
      </Card>

      {result && !result.ok && (
        <Callout tone="bad" icon={<CircleAlert className="h-4 w-4" />} title="לא הצלחנו לפתור">
          <Rich text={result.error} />
          <div className="mt-1 text-sm">שאלה מילולית או גאומטרית? אפשר לשאול את Claude למטה.</div>
        </Callout>
      )}
      {result?.ok && <LocalSolutionView sol={result.solution} />}

      <AiSolvePanel seed={result && !result.ok ? text : ''} />
    </div>
  );
}

export function LocalSolutionView({ sol }: { sol: Solution }) {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TopicBadge topicId={sol.topic} />
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{sol.title}</span>
        </div>
        {sol.problemTex && <Tex tex={sol.problemTex} display className="text-lg" />}
        {sol.diagram && (
          <div className="mx-auto mt-2 max-w-sm">
            <Diagram spec={sol.diagram} />
          </div>
        )}
      </Card>
      <HintLadder hints={sol.hints}>
        <div className="space-y-3">
          {sol.proof ? <ProofTable steps={sol.proof} /> : <StepsView steps={sol.steps} />}
          <Callout tone="good" icon={<CheckCircle2 className="h-4 w-4" />} title="תשובה">
            <Rich text={sol.answer} />
          </Callout>
          {sol.notes && sol.notes.length > 0 && (
            <Callout tone="info" title="כדאי לשים לב">
              <ul className="list-disc space-y-1 ps-5">
                {sol.notes.map((n, i) => (
                  <li key={i}>
                    <Rich text={n} />
                  </li>
                ))}
              </ul>
            </Callout>
          )}
        </div>
      </HintLadder>
    </div>
  );
}

function AiSolvePanel({ seed }: { seed: string }) {
  const ai = useAiSettings();
  const profile = useStore((s) => s.profile);
  const [text, setText] = useState('');
  const [image, setImage] = useState<AiImage | null>(null);
  const task = useTask<AiSolution>();
  const value = text || seed;
  const go = () =>
    task.run(async (signal) => {
      const r = await aiSolve(ai, value, profile, image ?? undefined, signal);
      recordSolverUse('solve');
      return r;
    });
  return (
    <Section title="שאלה מילולית, גאומטריה או צילום" icon={<Bot className="h-5 w-5 text-brand-600" />}>
      <Card className="p-4">
        {!ai.enabled ? (
          <ApiKeyNotice what="לפתור שאלות מילוליות, הוכחות בגאומטריה ושאלות מצולמות" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <AiBadge /> מתאים להוכחות (טענה | נימוק), לשאלות מילוליות ולתמונות של דף עבודה.
            </div>
            <textarea
              rows={3}
              value={value}
              onChange={(e) => setText(e.target.value)}
              placeholder="למשל: במשולש ABC, AB=AC ו-AD חוצה את זווית A. הוכיחו ש-AD ⊥ BC."
              className="w-full resize-y rounded-xl border border-black/10 bg-paper px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night"
            />
            <ImagePicker image={image} onChange={setImage} />
            <div className="flex gap-2">
              <Button onClick={go} loading={task.loading} disabled={!value.trim() && !image} icon={<Sparkles className="h-4 w-4" />}>
                {task.loading ? 'Claude חושב…' : 'פתרון עם Claude'}
              </Button>
              {task.loading && (
                <Button variant="ghost" onClick={task.cancel}>
                  ביטול
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
      {task.error && (
        <Callout tone="bad" className="mt-3" title="משהו השתבש">
          {task.error}
        </Callout>
      )}
      {task.data && (
        <div className="mt-3">
          <AiSolutionView sol={task.data} />
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- which theorem fits?

function groupTags(tags: Tag[]): [string, Tag[]][] {
  const m = new Map<string, Tag[]>();
  for (const t of tags) m.set(t.group, [...(m.get(t.group) ?? []), t]);
  return [...m.entries()];
}

function FinderTab() {
  const [text, setText] = useState('');
  const [manual, setManual] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const detected = useMemo(() => detectTags(text), [text]);
  const detectedSet = useMemo(() => new Set([...detected.givens, ...detected.goals]), [detected]);
  const active = (id: string) => (manual.has(id) || detectedSet.has(id)) && !removed.has(id);
  const toggle = (id: string) => {
    const m = new Set(manual);
    const r = new Set(removed);
    if (active(id)) {
      m.delete(id);
      if (detectedSet.has(id)) r.add(id);
    } else {
      r.delete(id);
      m.add(id);
    }
    setManual(m);
    setRemoved(r);
  };
  const givens = GIVENS.filter((g) => active(g.id)).map((g) => g.id);
  const goals = GOALS.filter((g) => active(g.id)).map((g) => g.id);
  const profile = useStore((s) => s.profile);
  const showAll = useStore((s) => s.settings.showAll);
  const recs = useMemo(
    () => (givens.length || goals.length || text.trim() ? recommend(givens, goals, text, 40).filter((r) => showAll || isRelevant(r.theorem, profile)).slice(0, 8) : []),
    [givens.join(), goals.join(), text, profile, showAll], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const groups = groupTags(GIVENS);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <label htmlFor="finder-text" className="font-bold">
          מה נתון בשאלה?
        </label>
        <p className="text-sm text-slate-600 dark:text-slate-400">כתבו במילים שלכם, או סמנו את הנתונים למטה. נציע משפטים שמתאימים – ונגיד מה צריך לבדוק לפני שמצטטים.</p>
        <textarea
          id="finder-text"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="למשל: במשולש שווה שוקיים AB=AC, AD תיכון לבסיס. צריך להוכיח ש-AD מאונך ל-BC."
          className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-paper px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night"
        />
        <div className="mt-3">
          <div className="mb-1.5 text-sm font-bold">מה צריך להוכיח או למצוא?</div>
          <div className="flex flex-wrap gap-1.5">
            {GOALS.map((g) => (
              <Chip key={g.id} active={active(g.id)} onClick={() => toggle(g.id)}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="text-sm font-bold">נתונים</div>
          {groups.map(([group, tags]) => {
            const count = tags.filter((t) => active(t.id)).length;
            const open = openGroup === group || count > 0;
            return (
              <div key={group} className="rounded-xl border border-black/5 dark:border-night-line">
                <button type="button" onClick={() => setOpenGroup(openGroup === group ? null : group)} className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold">
                  <span>
                    {group}
                    {count > 0 && <span className="ms-2 rounded-full bg-brand-600 px-1.5 text-xs text-white">{count}</span>}
                  </span>
                  <span className="text-slate-400">{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                    {tags.map((t) => (
                      <Chip key={t.id} active={active(t.id)} onClick={() => toggle(t.id)}>
                        {t.label}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {recs.length > 0 ? (
        <Section title="משפטים שכדאי לבדוק" icon={<ScanSearch className="h-5 w-5 text-brand-600" />}>
          <div className="space-y-2.5">
            {recs.map((r, i) => (
              <Card key={r.theorem.id} className="p-3.5" onClick={() => navigate(`/theorems/${r.theorem.id}`)}>
                <div className="flex gap-3">
                  <div className="hidden h-20 w-24 shrink-0 sm:block">
                    <Diagram id={r.theorem.diagram} thumb />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', i === 0 ? 'bg-brand-600 text-white' : 'bg-black/5 dark:bg-white/10')}>{i + 1}</span>
                      <span className="font-bold">{r.theorem.name}</span>
                      <StatusBadge status={r.theorem.status} short />
                    </div>
                    <div className="mt-1 line-clamp-3 text-[15px] text-slate-700 dark:text-slate-300">
                      <Rich text={r.theorem.statement} />
                    </div>
                    {(r.matchedGivens.length > 0 || r.matchedGoals.length > 0) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {[...r.matchedGivens, ...r.matchedGoals].map((id) => (
                          <span key={id} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                            ✓ {tagLabel(id)}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.theorem.conditions[0] && (
                      <div className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">
                        לפני שמצטטים: <Rich text={r.theorem.conditions[0]} />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">ההצעות מבוססות על התאמה בין הנתונים לתנאי המשפטים. משפט מתאים רק אם כל התנאים שלו מתקיימים בשאלה.</p>
        </Section>
      ) : (
        <Callout tone="info">סמנו לפחות נתון אחד או כתבו תיאור, ונציע משפטים מתאימים.</Callout>
      )}

      <AiFinderPanel text={text} />
    </div>
  );
}

function AiFinderPanel({ text }: { text: string }) {
  const ai = useAiSettings();
  const profile = useStore((s) => s.profile);
  const [image, setImage] = useState<AiImage | null>(null);
  const task = useTask<AiRecommendation>();
  if (!ai.enabled) return null;
  return (
    <Section title="שאלו את Claude איזה משפט מתאים" icon={<Bot className="h-5 w-5 text-brand-600" />}>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">Claude יקרא את התיאור שכתבתם למעלה (או צילום של השאלה) ויציע משפטים מהמאגר – בלי לפתור.</p>
        <ImagePicker image={image} onChange={setImage} />
        <Button onClick={() => task.run((signal) => aiRecommend(ai, text, profile, image ?? undefined, signal))} loading={task.loading} disabled={!text.trim() && !image} icon={<Sparkles className="h-4 w-4" />}>
          הצעת משפטים
        </Button>
      </Card>
      {task.error && (
        <Callout tone="bad" className="mt-3" title="משהו השתבש">
          {task.error}
        </Callout>
      )}
      {task.data && (
        <div className="mt-3 space-y-2.5">
          {task.data.suggestions.map((s) => {
            const th = theoremById.get(s.theoremId)!;
            return (
              <Card key={s.theoremId} className="p-3.5" onClick={() => navigate(`/theorems/${th.id}`)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{th.name}</span>
                  <StatusBadge status={th.status} short />
                  <AiBadge />
                </div>
                <div className="mt-1 text-[15px]">
                  <Rich text={s.why} />
                </div>
                {s.check && (
                  <div className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                    צריך לבדוק: <Rich text={s.check} />
                  </div>
                )}
              </Card>
            );
          })}
          {task.data.note && (
            <Callout tone="info">
              <Rich text={task.data.note} />
            </Callout>
          )}
          <p className="text-xs text-slate-500">ההצעות נוצרו בעזרת בינה מלאכותית. רק משפטים מהמאגר מוצגים.</p>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- check my solution

const CHECK_EXAMPLE = { problem: '3(x-2)+4=2x+7', work: '3x-6+4=2x+7\n3x-2=2x+7\n3x-2x=7-2\nx=5' };

function CheckTab() {
  const [problem, setProblem] = useState('');
  const [work, setWork] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const workRef = useRef<HTMLTextAreaElement>(null);
  const check = (p = problem, w = work) => {
    setResult(checkSolution(p, w));
    recordSolverUse('check');
  };
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div>
          <label htmlFor="check-problem" className="font-bold">
            התרגיל
          </label>
          <input
            id="check-problem"
            dir="ltr"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="3(x-2)+4=2x+7"
            className="mt-1 w-full rounded-xl border border-black/10 bg-paper px-3 py-2.5 font-mono text-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night"
          />
        </div>
        <div>
          <label htmlFor="check-work" className="font-bold">
            הפתרון שלי – שורה אחר שורה
          </label>
          <textarea
            id="check-work"
            ref={workRef}
            dir="ltr"
            rows={5}
            value={work}
            onChange={(e) => setWork(e.target.value)}
            placeholder={'3x-6+4=2x+7\n3x-2=2x+7\n...'}
            className="mt-1 w-full resize-y rounded-xl border border-black/10 bg-paper px-3 py-2.5 font-mono text-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-night-line dark:bg-night"
          />
        </div>
        <MathKeyboard target={workRef} onChange={setWork} compact />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => check()} disabled={!problem.trim() || !work.trim()} icon={<ClipboardCheck className="h-4 w-4" />}>
            בדיקה
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProblem(CHECK_EXAMPLE.problem);
              setWork(CHECK_EXAMPLE.work);
              check(CHECK_EXAMPLE.problem, CHECK_EXAMPLE.work);
            }}
          >
            הראו לי דוגמה
          </Button>
        </div>
        <p className="text-xs text-slate-500">הבדיקה מסמנת את השורה הראשונה שבה משהו השתבש ומסבירה למה – בלי לפתור במקומכם. עובד על משוואות, אי-שוויונות פשוטים ופישוט ביטויים במשתנה אחד.</p>
      </Card>
      {result && <CheckResultView result={result} />}
      <AiCheckPanel problem={problem} work={work} />
    </div>
  );
}

function CheckResultView({ result }: { result: CheckResult }) {
  const ok = result.firstError === undefined && result.finalCorrect !== false && result.kind !== 'unknown';
  return (
    <div className="space-y-2">
      <Callout tone={ok ? 'good' : result.kind === 'unknown' ? 'info' : 'warn'} title={ok ? 'נראה מצוין' : result.kind === 'unknown' ? 'לא ניתן לבדוק אוטומטית' : 'כמעט!'}>
        {result.summary}
      </Callout>
      <ol className="space-y-1.5">
        {result.lines.map((l) => (
          <li
            key={l.index}
            className={cx(
              'rounded-2xl border p-3',
              l.status === 'error'
                ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-300/40 dark:border-rose-500/40 dark:bg-rose-500/10'
                : l.status === 'unparsed'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                  : 'border-black/5 bg-white dark:border-night-line dark:bg-night-card',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs text-slate-500">{l.index + 1}</span>
              {l.status === 'ok' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
              {l.status === 'error' && <XCircle className="h-4 w-4 shrink-0 text-rose-600" />}
              {l.status === 'unparsed' && <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />}
              {l.status === 'start' && <ArrowLeft className="h-4 w-4 shrink-0 text-slate-400" />}
              <div className="min-w-0 overflow-x-auto">{l.tex ? <Tex tex={l.tex} /> : <span dir="ltr" className="font-mono">{l.raw}</span>}</div>
            </div>
            {l.message && (
              <div className="ms-7 mt-1 text-sm text-slate-700 dark:text-slate-200">
                <Rich text={l.message} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AiCheckPanel({ problem, work }: { problem: string; work: string }) {
  const ai = useAiSettings();
  const profile = useStore((s) => s.profile);
  const [image, setImage] = useState<AiImage | null>(null);
  const task = useTask<AiCheck>();
  return (
    <Section title="בדיקה של הוכחה, שאלה מילולית או צילום" icon={<Bot className="h-5 w-5 text-brand-600" />}>
      <Card className="space-y-3 p-4">
        {!ai.enabled ? (
          <ApiKeyNotice what="לבדוק הוכחות בגאומטריה ופתרונות בכתב יד" />
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">צלמו את הפתרון שלכם (או כתבו אותו למעלה). Claude יסמן את הטעות הראשונה ויסביר – בלי לפתור במקומכם.</p>
            <ImagePicker image={image} onChange={setImage} />
            <Button onClick={() => task.run((signal) => aiCheck(ai, problem, work, profile, image ?? undefined, signal))} loading={task.loading} disabled={!work.trim() && !image} icon={<Sparkles className="h-4 w-4" />}>
              בדיקה עם Claude
            </Button>
          </>
        )}
      </Card>
      {task.error && (
        <Callout tone="bad" className="mt-3" title="משהו השתבש">
          {task.error}
        </Callout>
      )}
      {task.data && (
        <div className="mt-3">
          <AiCheckView check={task.data} />
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- guided tools

type ToolId = 'sequence' | 'right' | 'triangle' | 'points';

const TOOLS: { id: ToolId; label: string; desc: string }[] = [
  { id: 'sequence', label: 'סדרות', desc: 'איבר כללי וסכום בסדרה חשבונית או הנדסית.' },
  { id: 'right', label: 'משולש ישר זווית', desc: 'מלאו שני נתונים (שתי צלעות, או צלע וזווית) ונמצא את כל השאר. הזווית הישרה ב-C, והזווית α ב-A, מול הניצב a.' },
  { id: 'triangle', label: 'סינוסים וקוסינוסים', desc: 'כל משולש: מלאו שלושה נתונים, לפחות אחד מהם צלע. α מול a, β מול b, γ מול c (במעלות).' },
  { id: 'points', label: 'שתי נקודות', desc: 'מרחק, אמצע קטע, שיפוע ומשוואת הישר שעובר דרך שתי נקודות.' },
];

function NumField({ label, value, onChange, tex }: { label: string; value: string; onChange: (v: string) => void; tex?: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-paper px-2.5 py-1.5 focus-within:border-brand-500 dark:border-night-line dark:bg-night">
      <span className="shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">{tex ? <Tex tex={label} /> : label}</span>
      <input dir="ltr" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 bg-transparent py-1 font-mono text-lg outline-none" />
    </label>
  );
}

function ToolsTab() {
  const [tool, setTool] = useState<ToolId>('sequence');
  const [v, setV] = useState<Record<string, string>>({ kind: 'arith' });
  const [res, setRes] = useState<{ ok: true; r: ToolResult } | { ok: false; error: string } | null>(null);
  const set = (k: string) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const info = TOOLS.find((x) => x.id === tool)!;
  const run = () => {
    try {
      let r: ToolResult;
      if (tool === 'sequence') r = sequenceTool(v.kind === 'geo' ? 'geo' : 'arith', v.a1, v.d, v.n);
      else if (tool === 'right') r = rightTriangleTool(v.ra, v.rb, v.rc, v.ralpha);
      else if (tool === 'triangle') r = triangleTool({ a: v.ta ?? '', b: v.tb ?? '', c: v.tc ?? '', A: v.tA ?? '', B: v.tB ?? '', C: v.tC ?? '' });
      else r = twoPointsTool(v.x1, v.y1, v.x2, v.y2);
      setRes({ ok: true, r });
      recordSolverUse('solve');
    } catch (e) {
      setRes({ ok: false, error: e instanceof ToolError ? e.message : 'משהו השתבש בחישוב.' });
    }
  };
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TOOLS.map((x) => (
          <Chip
            key={x.id}
            active={tool === x.id}
            onClick={() => {
              setTool(x.id);
              setRes(null);
            }}
          >
            {x.label}
          </Chip>
        ))}
      </div>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">{info.desc}</p>
        {tool === 'sequence' && (
          <>
            <Segmented
              options={[
                { id: 'arith', label: 'חשבונית' },
                { id: 'geo', label: 'הנדסית' },
              ]}
              value={v.kind === 'geo' ? 'geo' : 'arith'}
              onChange={set('kind')}
            />
            <div className="grid grid-cols-3 gap-2">
              <NumField label="a_1" tex value={v.a1 ?? ''} onChange={set('a1')} />
              <NumField label={v.kind === 'geo' ? 'q' : 'd'} tex value={v.d ?? ''} onChange={set('d')} />
              <NumField label="n" tex value={v.n ?? ''} onChange={set('n')} />
            </div>
          </>
        )}
        {tool === 'right' && (
          <div className="grid grid-cols-2 gap-2">
            <NumField label="a" tex value={v.ra ?? ''} onChange={set('ra')} />
            <NumField label="b" tex value={v.rb ?? ''} onChange={set('rb')} />
            <NumField label="c" tex value={v.rc ?? ''} onChange={set('rc')} />
            <NumField label={'\\alpha^\\circ'} tex value={v.ralpha ?? ''} onChange={set('ralpha')} />
          </div>
        )}
        {tool === 'triangle' && (
          <div className="grid grid-cols-3 gap-2">
            <NumField label="a" tex value={v.ta ?? ''} onChange={set('ta')} />
            <NumField label="b" tex value={v.tb ?? ''} onChange={set('tb')} />
            <NumField label="c" tex value={v.tc ?? ''} onChange={set('tc')} />
            <NumField label={'\\alpha^\\circ'} tex value={v.tA ?? ''} onChange={set('tA')} />
            <NumField label={'\\beta^\\circ'} tex value={v.tB ?? ''} onChange={set('tB')} />
            <NumField label={'\\gamma^\\circ'} tex value={v.tC ?? ''} onChange={set('tC')} />
          </div>
        )}
        {tool === 'points' && (
          <div className="grid grid-cols-2 gap-2" dir="ltr">
            <NumField label="x_1" tex value={v.x1 ?? ''} onChange={set('x1')} />
            <NumField label="y_1" tex value={v.y1 ?? ''} onChange={set('y1')} />
            <NumField label="x_2" tex value={v.x2 ?? ''} onChange={set('x2')} />
            <NumField label="y_2" tex value={v.y2 ?? ''} onChange={set('y2')} />
          </div>
        )}
        <Button onClick={run} icon={<Calculator className="h-4 w-4" />}>
          חישוב עם הסבר
        </Button>
      </Card>
      {res && !res.ok && (
        <Callout tone="bad" icon={<CircleAlert className="h-4 w-4" />} title="לא ניתן לחשב">
          {res.error}
        </Callout>
      )}
      {res?.ok && (
        <div className="space-y-3">
          {res.r.diagram && (
            <Card className="p-3">
              <div className="mx-auto max-w-sm">
                <Diagram spec={res.r.diagram} />
              </div>
            </Card>
          )}
          <StepsView steps={res.r.steps} />
          <Callout tone="good" icon={<CheckCircle2 className="h-4 w-4" />} title="תוצאה">
            <Rich text={res.r.answer} />
          </Callout>
          {res.r.notes && res.r.notes.length > 0 && (
            <Callout tone="info" title="כדאי לשים לב">
              <ul className="list-disc space-y-1 ps-5">
                {res.r.notes.map((n, i) => (
                  <li key={i}>
                    <Rich text={n} />
                  </li>
                ))}
              </ul>
            </Callout>
          )}
        </div>
      )}
    </div>
  );
}
