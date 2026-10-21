import type { Profile } from '../types';
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
  if (p.grade <= 9) return ` אני בכיתה ${GRADE[p.grade]}, ברמה ${LEVEL[p.middleLevel ?? 'standard']}.`;
  return ` אני בכיתה ${GRADE[p.grade]}, ${p.units} יחידות לימוד.`;
}

const COMMON =
  'כתוב בעברית פשוטה, עם המונחים המדויקים של תוכנית הלימודים. בגאומטריה צטט משפטים בניסוח המקובל בבגרות, ואם משתמשים בטענה שאינה ברשימת המשפטים שמותר לצטט בלי הוכחה – אמור שצריך להוכיח אותה. אם משהו בתמונה לא ברור, אמור זאת ואל תנחש.';

export function buildClaudePrompt(mode: HandoffMode, input: { text?: string; problem?: string; work?: string; profile: Profile | null; hasImage: boolean }): string {
  const intro = `אתה מורה סבלני למתמטיקה לפי תוכנית הלימודים של משרד החינוך.${profileText(input.profile)}`;
  const where = input.hasImage ? 'בתמונה המצורפת' : 'למטה';
  const parts: string[] = [intro];
  if (mode === 'solve') {
    parts.push(
      `${where} יש שאלה. אני רוצה להבין, לא להעתיק: אל תיתן מיד את הפתרון. תן רמז 1 (כיוון כללי) וחכה לתשובה שלי. אם אבקש עוד – רמז 2 (איזה משפט או נוסחה מתאימים ולמה), אחר כך רמז 3 (הצעד הבא), ורק אז פתרון מלא צעד אחר צעד. בהוכחה בגאומטריה כתוב טבלה של "טענה | נימוק".`,
    );
  } else if (mode === 'check') {
    parts.push(
      `${where} יש הפתרון שלי. אל תפתור במקומי. עבור על הפתרון שורה אחר שורה, סמן את השורה הראשונה שבה יש טעות, הסבר איזה כלל או משפט הופר, ותן רמז אחד שיעזור לי לתקן לבד. בגאומטריה בדוק גם שכל נימוק הוא משפט שמותר לצטט ושתנאיו התקיימו.`,
    );
  } else {
    parts.push(
      `${where} יש נתונים של שאלה. אל תפתור אותה. הצע עד 5 משפטים מתוכנית הלימודים שיכולים לעזור, ולכל אחד: למה הוא מתאים לנתונים ומה צריך לבדוק או להוכיח לפני שמצטטים אותו.`,
    );
  }
  parts.push(COMMON);
  if (input.problem?.trim()) parts.push(`השאלה: ${input.problem.trim()}`);
  if (input.text?.trim()) parts.push(`${mode === 'theorem' ? 'הנתונים' : 'השאלה'}: ${input.text.trim()}`);
  if (input.work?.trim()) parts.push(`הפתרון שלי:\n${input.work.trim()}`);
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

export type HandoffResult = 'shared' | 'opened' | 'cancelled';

/**
 * Opens the share sheet with the photo and the prompt (pick "Claude"). The prompt is also put on
 * the clipboard, because some apps keep only the picture. Without a share sheet, claude.ai opens.
 */
export async function sendToClaude(prompt: string, image: AiImage | null): Promise<HandoffResult> {
  // Safari allows the share sheet and new tabs only directly inside a tap, so nothing is awaited before them;
  // the clipboard copy runs alongside.
  const copied = copy(prompt);
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
      return 'shared';
    }
    const file = image ? imageFile(image) : null;
    if (file ? navigator.canShare?.({ files: [file] }) : navigator.share) {
      await navigator.share(file ? { files: [file], text: prompt } : { text: prompt });
      return 'shared';
    }
  } catch (e) {
    // the student closed the share sheet
    if ((e as Error).name === 'AbortError' || /cancel/i.test((e as Error).message)) return 'cancelled';
  } finally {
    await copied;
  }
  const url = image ? 'https://claude.ai/new' : `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
  // inside the Android app, navigating to an outside address opens it in the browser
  if (isNativeApp()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
  return 'opened';
}
