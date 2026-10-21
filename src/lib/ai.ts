// The SDK is loaded on demand so the app starts fast and works offline without it.
import type Anthropic from '@anthropic-ai/sdk';
import type { Profile } from '../types';
import { theorems, topics, theoremById } from '../data';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export const MODELS: { id: string; label: string; note: string }[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'הכי מדויק (ברירת מחדל)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'מהיר וזול יותר' },
];

export class AiError extends Error {}

export interface AiImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  data: string; // base64 without prefix
  previewUrl: string;
}

export interface AiStep {
  claim: string;
  reason: string;
  theoremId: string;
}

export interface AiSolution {
  problem: string;
  topic: string;
  kind: 'proof' | 'computation';
  given: string[];
  goal: string;
  hints: { direction: string; tool: string; next: string };
  steps: AiStep[];
  answer: string;
  uncertain: boolean;
  notes: string[];
}

export interface AiCheckLine {
  text: string;
  status: 'ok' | 'error' | 'unclear';
  comment: string;
}

export interface AiCheck {
  verdict: 'correct' | 'error' | 'incomplete' | 'unclear';
  firstErrorLine: number;
  lines: AiCheckLine[];
  explanation: string;
  hint: string;
  encouragement: string;
}

export interface AiRecommendation {
  suggestions: { theoremId: string; why: string; check: string }[];
  note: string;
}

// ---------- prompts ----------

function theoremTable(): string {
  return theorems
    .map((t) => {
      const status = t.status === 'official' ? 'מותר לצטט' : t.status === 'formula-sheet' ? 'דף נוסחאות' : 'צריך להוכיח';
      return `${t.id} | ${t.name} | ${t.statement} | ציטוט: "${t.citation}" | ${status}`;
    })
    .join('\n');
}

const TOPIC_IDS = topics.map((t) => t.id);

const SYSTEM_PROMPT = `You are "מתמטיקה חכמה", a patient, encouraging Israeli mathematics teacher who knows the Israeli Ministry of Education curriculum (grades 7–12, 3/4/5 study units) and the structure of the Bagrut exams.

Goal: the student must understand, not copy. Write in simple, friendly Hebrew, using the exact mathematical terms of the Israeli curriculum (e.g. תיכון, חוצה זווית, גובה, אנך אמצעי, ניצב, יתר, משיק, זווית היקפית).

Formatting rules (strict):
- All mathematics goes inside $...$ as KaTeX-compatible LaTeX. Never put Hebrew letters inside math except within \\text{...}.
- Use degrees with ^\\circ, angles as \\angle ABC, parallel as \\parallel, perpendicular as \\perp.
- Keep each claim short – one mathematical fact per step.

Theorem rules (strict – never invent theorems, formulas or wordings):
- The theorem database below is the source of truth. In geometry proofs every step is a claim with a reason. When a reason uses a theorem from the database, set theoremId to its id and copy its citation wording ("ציטוט") exactly.
- Allowed reasons that are not theorems: "נתון", "חישוב", "הצבה", "הגדרת ..." (a definition), "צלע משותפת", "זווית משותפת", "צלעות מתאימות במשולשים חופפים שוות", "זוויות מתאימות במשולשים חופפים שוות". For these set theoremId to "".
- If a proof needs a claim that is not in the database, or a database entry marked "צריך להוכיח", say so explicitly in the reason ("טענה שאינה ברשימה – יש להוכיח") and give its short proof in notes.
- If you are not sure about a fact, a reading of the problem or the photo, set uncertain to true and explain what is unclear in notes. Do not guess silently.

Hint ladder: hints.direction = general direction; hints.tool = which theorem/formula is relevant and why; hints.next = the concrete next step. Hints must not reveal the final answer.

THEOREM DATABASE (id | name | statement | citation | status):
${theoremTable()}`;

function profileLine(p: Profile | null): string {
  if (!p) return 'פרופיל התלמיד: לא ידוע.';
  if (p.grade <= 9) return `פרופיל התלמיד: כיתה ${p.grade}, רמה ${p.middleLevel === 'basic' ? 'בסיסית' : p.middleLevel === 'advanced' ? 'מוגברת' : 'רגילה'} (חטיבת ביניים). התאם את ההסבר לרמה.`;
  return `פרופיל התלמיד: כיתה ${p.grade}, ${p.units} יחידות לימוד. השתמש רק בכלים שמתאימים לרמה הזו.`;
}

// ---------- schemas ----------

const str = { type: 'string' } as const;

const SOLVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['problem', 'topic', 'kind', 'given', 'goal', 'hints', 'steps', 'answer', 'uncertain', 'notes'],
  properties: {
    problem: str,
    topic: { type: 'string', enum: TOPIC_IDS },
    kind: { type: 'string', enum: ['proof', 'computation'] },
    given: { type: 'array', items: str },
    goal: str,
    hints: {
      type: 'object',
      additionalProperties: false,
      required: ['direction', 'tool', 'next'],
      properties: { direction: str, tool: str, next: str },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['claim', 'reason', 'theoremId'],
        properties: { claim: str, reason: str, theoremId: str },
      },
    },
    answer: str,
    uncertain: { type: 'boolean' },
    notes: { type: 'array', items: str },
  },
};

const CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'firstErrorLine', 'lines', 'explanation', 'hint', 'encouragement'],
  properties: {
    verdict: { type: 'string', enum: ['correct', 'error', 'incomplete', 'unclear'] },
    firstErrorLine: { type: 'integer' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'status', 'comment'],
        properties: { text: str, status: { type: 'string', enum: ['ok', 'error', 'unclear'] }, comment: str },
      },
    },
    explanation: str,
    hint: str,
    encouragement: str,
  },
};

const RECOMMEND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions', 'note'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theoremId', 'why', 'check'],
        properties: { theoremId: str, why: str, check: str },
      },
    },
    note: str,
  },
};

// ---------- client ----------

interface CallOptions {
  apiKey: string;
  model: string;
  schema: Record<string, unknown>;
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
}

function supportsFallback(model: string): boolean {
  return model.startsWith('claude-opus') || model.startsWith('claude-sonnet-5-5') || model.startsWith('claude-fable');
}

async function call<T>({ apiKey, model, schema, content, effort, signal }: CallOptions): Promise<T> {
  if (!apiKey) throw new AiError('כדי להשתמש ב-AI צריך להגדיר מפתח API בהגדרות.');
  let SDK: typeof Anthropic;
  try {
    SDK = (await import('@anthropic-ai/sdk')).default;
  } catch {
    throw new AiError(
      navigator.onLine
        ? 'האפליקציה התעדכנה לגרסה חדשה. סגרו אותה ופתחו מחדש, ואז נסו שוב.'
        : 'לא הצלחנו לטעון את רכיב ה-AI. בדקו את החיבור לאינטרנט.',
    );
  }
  const client = new SDK({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 32000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
        output_config: { effort, format: { type: 'json_schema', schema } },
        ...(supportsFallback(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      },
      { signal },
    );
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new AiError('הבקשה נדחתה על ידי המודל. נסו לנסח את השאלה מחדש.');
    if (msg.stop_reason === 'max_tokens') throw new AiError('התשובה ארוכה מדי ונקטעה. נסו לשאול חלק מהשאלה.');
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AiError('התקבלה תשובה לא תקינה מהמודל. נסו שוב.');
    }
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SDK.AuthenticationError) throw new AiError('מפתח ה-API אינו תקין. בדקו אותו בהגדרות.');
    if (e instanceof SDK.PermissionDeniedError) throw new AiError('למפתח אין הרשאה להשתמש במודל הזה.');
    if (e instanceof SDK.RateLimitError) throw new AiError('יותר מדי בקשות ברגע זה. חכו רגע ונסו שוב.');
    if (e instanceof SDK.BadRequestError) throw new AiError(`הבקשה נדחתה: ${e.message}`);
    if (e instanceof SDK.APIConnectionError) throw new AiError('אין חיבור לשרת. בדקו את החיבור לאינטרנט.');
    // errors that are not HTTP responses arrive once the answer is already streaming
    if (e instanceof SDK.AnthropicError && !(e instanceof SDK.APIError)) throw new AiError('החיבור לשרת נקטע באמצע התשובה. בדקו את החיבור לאינטרנט ונסו שוב.');
    if (e instanceof SDK.APIError) throw new AiError(`שגיאת שרת (${e.status ?? ''}). נסו שוב מאוחר יותר.`);
    if ((e as Error).name === 'AbortError') throw new AiError('הבקשה בוטלה.');
    throw new AiError((e as Error).message || 'שגיאה לא צפויה.');
  }
}

function imageBlock(img?: AiImage): Anthropic.Beta.BetaContentBlockParam[] {
  return img ? [{ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } }] : [];
}

export interface AiSettings {
  apiKey: string;
  model: string;
}

export async function aiSolve(s: AiSettings, text: string, profile: Profile | null, image?: AiImage, signal?: AbortSignal): Promise<AiSolution> {
  const prompt = `${profileLine(profile)}

המשימה: פתור את השאלה בשלבים, כמו פתרון לדוגמה בבגרות.
- בגאומטריה: kind = "proof", וכל שלב הוא טענה ונימוק מהמאגר.
- בשאלות חישוב: kind = "computation", וכל שלב הוא חישוב אחד עם הסבר קצר ב-reason.
- given: רשימת הנתונים. goal: מה צריך להוכיח או למצוא.
- answer: התשובה הסופית בקצרה.
${image ? 'השאלה מופיעה בתמונה המצורפת. אם חלק מהתמונה לא קריא, כתוב זאת ב-notes וסמן uncertain.' : ''}

השאלה:
${text || '(ראו תמונה)'}`;
  const res = await call<AiSolution>({ ...s, schema: SOLVE_SCHEMA, effort: 'high', signal, content: [...imageBlock(image), { type: 'text', text: prompt }] });
  // keep only theorem ids that exist
  res.steps = res.steps.map((st) => ({ ...st, theoremId: theoremById.has(st.theoremId) ? st.theoremId : '' }));
  return res;
}

export async function aiCheck(
  s: AiSettings,
  problem: string,
  work: string,
  profile: Profile | null,
  image?: AiImage,
  signal?: AbortSignal,
): Promise<AiCheck> {
  const prompt = `${profileLine(profile)}

המשימה: בדוק את הפתרון של התלמיד. אל תפתור במקומו!
- עבור על הפתרון שורה אחר שורה. ב-lines החזר כל שורה (text), סטטוס, והערה קצרה.
- firstErrorLine: מספר השורה (מ-1) של הטעות הראשונה, או 0 אם אין טעות.
- explanation: הסבר למה זו טעות (איזה כלל או משפט הופר), בלי לתת את התשובה הנכונה.
- hint: רמז אחד שיעזור לתלמיד לתקן בעצמו.
- בגאומטריה: בדוק גם שכל נימוק הוא משפט מהמאגר בניסוח נכון, ושלא צוטט משפט שאינו מתאים או שתנאיו לא הוכחו.
- encouragement: משפט עידוד קצר.
${image ? 'הפתרון (או השאלה) מופיע בתמונה המצורפת.' : ''}

השאלה:
${problem || '(לא צוינה)'}

הפתרון של התלמיד:
${work || '(ראו תמונה)'}`;
  return call<AiCheck>({ ...s, schema: CHECK_SCHEMA, effort: 'high', signal, content: [...imageBlock(image), { type: 'text', text: prompt }] });
}

export async function aiRecommend(s: AiSettings, description: string, profile: Profile | null, image?: AiImage, signal?: AbortSignal): Promise<AiRecommendation> {
  const prompt = `${profileLine(profile)}

המשימה: התלמיד מתאר נתונים של שאלה (בדרך כלל בגאומטריה). הצע עד 5 משפטים מהמאגר שהכי סביר שיעזרו, לפי הסדר.
- theoremId חייב להיות מזהה מהמאגר.
- why: למה המשפט מתאים לנתונים האלה.
- check: מה צריך לוודא או להוכיח לפני שמצטטים אותו.
- note: הערה כללית על הדרך (בלי לפתור את השאלה).

הנתונים:
${description || '(ראו תמונה)'}`;
  const res = await call<AiRecommendation>({ ...s, schema: RECOMMEND_SCHEMA, effort: 'medium', signal, content: [...imageBlock(image), { type: 'text', text: prompt }] });
  res.suggestions = res.suggestions.filter((x) => theoremById.has(x.theoremId));
  return res;
}

/** Downscales a photo to at most 1568px and returns it as base64 JPEG. */
export async function fileToImage(file: File): Promise<AiImage> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new AiError('לא הצלחנו לקרוא את התמונה.'));
    el.src = url;
  });
  const max = 1568;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AiError('לא הצלחנו לעבד את התמונה.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  URL.revokeObjectURL(url);
  return { mediaType: 'image/jpeg', data: dataUrl.split(',')[1], previewUrl: dataUrl };
}
