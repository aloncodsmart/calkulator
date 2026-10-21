import type { Profile } from '../types';
import { theorems } from '../data';
import { isRelevant } from '../store';
import type { AiImage } from './ai';
import { isNativeApp } from './native';

/**
 * Without an API key, a photographed question is handed to the Claude app (the student's own
 * subscription) together with a teacher prompt that keeps the app's rules: hints before the
 * solution, Bagrut citation wording, and saying so when unsure.
 */
export type HandoffMode = 'solve' | 'check' | 'theorem';

const GRADE: Record<number, string> = { 7: 'ז׳', 8: 'ח׳', 9: 'ט׳', 10: 'י׳', 11: 'י״א', 12: 'י״ב' };
const LEVEL: Record<string, string> = { basic: 'בסיסית', standard: 'רגילה', advanced: 'מוגברת' };

function profileText(p: Profile | null): string {
  if (!p) return '';
  const who = p.grade <= 9 ? `אני בכיתה ${GRADE[p.grade]}, ברמה ${LEVEL[p.middleLevel ?? 'standard']}.` : `אני בכיתה ${GRADE[p.grade]}, ${p.units} יחידות לימוד.`;
  return ` ${who} השתמש רק בכלים ובמשפטים שנלמדים בכיתה וברמה שלי.`;
}

const COMMON =
  'כתוב בעברית פשוטה, עם המונחים המדויקים של תוכנית הלימודים. בגאומטריה צטט משפטים בניסוח של הרשימה שבסוף, ואם משתמשים בטענה שאינה ברשימה – אמור במפורש שצריך להוכיח אותה. אם משהו לא ברור, אמור זאת ואל תנחש.';

/** The citable theorems and formula-sheet results for the student's level, in the app's citation wording. */
export function citableList(profile: Profile | null): string {
  return theorems
    .filter((t) => t.status !== 'needs-proof' && isRelevant(t, profile))
    .map((t) => `• ${t.citation}`)
    .join('\n');
}

export function buildClaudePrompt(
  mode: HandoffMode,
  input: { text?: string; problem?: string; work?: string; profile: Profile | null; hasImage: boolean; theoremList?: boolean },
): string {
  const intro = `אתה מורה סבלני למתמטיקה לפי תוכנית הלימודים של משרד החינוך.${profileText(input.profile)}`;
  const where = input.hasImage ? 'בתמונה המצורפת' : 'למטה';
  // a misread photo goes unnoticed unless Claude first says how it read it
  const readBack = input.hasImage ? ' קודם כתוב בקצרה איך קראת את השאלה מהתמונה – מה נתון ומה צריך – כדי שאוכל לוודא שהבנת נכון.' : '';
  const parts: string[] = [intro];
  if (mode === 'solve') {
    parts.push(
      `${where} יש שאלה. אני רוצה להבין, לא להעתיק: אל תיתן מיד את הפתרון.${readBack} אחר כך תן רמז 1 (כיוון כללי) וחכה לתשובה שלי. אם אבקש עוד – רמז 2 (איזה משפט או נוסחה מתאימים ולמה), אחר כך רמז 3 (הצעד הבא), ורק אז פתרון מלא צעד אחר צעד. בהוכחה בגאומטריה כתוב טבלה של "טענה | נימוק".`,
    );
  } else if (mode === 'check') {
    parts.push(
      `${where} נמצא הפתרון שלי. אל תפתור במקומי.${readBack} עבור על הפתרון שורה אחר שורה, סמן את השורה הראשונה שבה יש טעות, הסבר איזה כלל או משפט הופר, ותן רמז אחד שיעזור לי לתקן לבד. בגאומטריה בדוק גם שכל נימוק הוא משפט שמותר לצטט ושתנאיו התקיימו.`,
    );
  } else {
    parts.push(
      `${where} יש נתונים של שאלה. אל תפתור אותה.${readBack} הצע עד 5 משפטים מתוכנית הלימודים שיכולים לעזור, ולכל אחד: למה הוא מתאים לנתונים ומה צריך לבדוק או להוכיח לפני שמצטטים אותו.`,
    );
  }
  parts.push(COMMON);
  if (input.problem?.trim()) parts.push(`השאלה: ${input.problem.trim()}`);
  if (input.text?.trim()) parts.push(`${mode === 'theorem' ? 'הנתונים' : 'השאלה'}: ${input.text.trim()}`);
  if (input.work?.trim()) parts.push(`הפתרון שלי:\n${input.work.trim()}`);
  const list = input.theoremList === false ? '' : citableList(input.profile);
  if (list) parts.push(`משפטים ונוסחאות שמותר להשתמש בהם בלי הוכחה (בניסוח לעמודת הנימוק):\n${list}`);
  return parts.join('\n\n');
}

function imageFile(img: AiImage): File {
  const bin = atob(img.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], 'question.jpg', { type: img.mediaType });
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type HandoffOutcome = 'shared' | 'opened' | 'blocked' | 'cancelled';
export interface HandoffResult {
  outcome: HandoffOutcome;
  /** Whether the prompt also made it onto the clipboard. */
  copied: boolean;
}

/** Copies the prompt again (from a tap, so the browser allows it). */
export const copyPrompt = copy;

/** claude.ai with the prompt filled in when it fits in an address; otherwise an empty chat. */
export function claudeUrl(shortPrompt: string, image: boolean): string {
  const q = encodeURIComponent(shortPrompt);
  return image || q.length > 6000 ? 'https://claude.ai/new' : `https://claude.ai/new?q=${q}`;
}

/**
 * Opens the share sheet with the photo and the prompt (pick "Claude"). The prompt is also put on
 * the clipboard, because some apps keep only the picture. Without a share sheet, claude.ai opens
 * (with `shortPrompt`, the prompt without the theorem list, so the address stays short).
 */
export async function sendToClaude(prompt: string, image: AiImage | null, shortPrompt = prompt): Promise<HandoffResult> {
  // Safari allows the share sheet and new tabs only directly inside a tap, so nothing is awaited before them;
  // the clipboard copy runs alongside.
  const copying = copy(prompt);
  let outcome: HandoffOutcome | null = null;
  try {
    if (isNativeApp()) {
      const { Share } = await import('@capacitor/share');
      let files: string[] | undefined;
      if (image) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { uri } = await Filesystem.writeFile({ path: 'question.jpg', data: image.data, directory: Directory.Cache });
        files = [uri];
      }
      await Share.share({ text: prompt, files, dialogTitle: 'שליחה ל-Claude' });
      outcome = 'shared';
    } else {
      const file = image ? imageFile(image) : null;
      if (file ? navigator.canShare?.({ files: [file] }) : navigator.share) {
        await navigator.share(file ? { files: [file], text: prompt } : { text: prompt });
        outcome = 'shared';
      }
    }
  } catch (e) {
    // the student closed the share sheet
    if ((e as Error).name === 'AbortError' || /cancel/i.test((e as Error).message)) outcome = 'cancelled';
  }
  if (!outcome) {
    const url = claudeUrl(shortPrompt, !!image);
    if (isNativeApp()) {
      // inside the Android app, navigating to an outside address opens it in the browser
      window.location.href = url;
      outcome = 'opened';
    } else {
      const w = window.open(url, '_blank');
      if (w) w.opener = null;
      outcome = w ? 'opened' : 'blocked';
    }
  }
  return { outcome, copied: await copying };
}
