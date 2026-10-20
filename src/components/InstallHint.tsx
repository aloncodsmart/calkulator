import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { Button } from './ui';

const DISMISS_KEY = 'smart-math:install-hint-dismissed';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac with a touch screen
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/** Install state of the app on this device. */
export function useInstallStatus() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    navigator.serviceWorker?.ready.then(() => setOfflineReady(true)).catch(() => {});
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  return {
    ios: isIos(),
    standalone: isStandalone(),
    offlineReady,
    canPrompt: !!deferred,
    prompt: async () => {
      await deferred?.prompt();
      setDeferred(null);
    },
  };
}

export function IosInstallSteps() {
  return (
    <ol className="space-y-1.5">
      <li className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>
        <span>
          פותחים את האתר ב-<b>Safari</b> ולוחצים על כפתור השיתוף <Share className="inline h-4 w-4 align-[-2px]" aria-label="שיתוף" />
        </span>
      </li>
      <li className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>
        <span>
          בוחרים <b>״הוספה למסך הבית״</b> <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden />
        </span>
      </li>
      <li className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">3</span>
        <span>
          לוחצים <b>״הוסף״</b> – והאפליקציה מופיעה במסך הבית עם אייקון.
        </span>
      </li>
      <li className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">4</span>
        <span>
          פותחים אותה מהאייקון <b>פעם אחת כשיש אינטרנט</b> – מאותו רגע היא עובדת גם בלי אינטרנט.
        </span>
      </li>
    </ol>
  );
}

/** On iPhone the home-screen app has its own storage, separate from Safari. */
export function IosSeparateStorageNote() {
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400">
      שימו לב: האפליקציה במסך הבית נפרדת מ-Safari ומתחילה ריקה. כדי להעביר את ההתקדמות: הגדרות ← ״ייצוא התקדמות״ כאן, ואז ״ייבוא מקובץ״ באפליקציה. את מפתח ה-API מדביקים בה מחדש.
    </p>
  );
}

/** A dismissible card that explains how to put the app on the home screen (shown only in the browser). */
export function InstallHint() {
  const status = useInstallStatus();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (dismissed || status.standalone || (!status.ios && !status.canPrompt)) return null;
  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable – hide for this visit only */
    }
  };
  return (
    <div className="pop-in relative mb-4 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-sky-50 p-4 pe-10 text-[15px] dark:border-brand-500/30 dark:from-brand-500/10 dark:to-sky-500/5">
      <button type="button" onClick={close} aria-label="סגירה" className="absolute end-2 top-2 rounded-full p-1.5 text-slate-500 hover:bg-black/5">
        <X className="h-4 w-4" />
      </button>
      <div className="mb-2 flex items-center gap-2 font-bold">
        <img src="./apple-touch-icon.png" alt="" className="h-8 w-8 rounded-lg" />
        התקינו את מתמטיקה חכמה כאפליקציה
      </div>
      {status.ios ? (
        <div className="space-y-2">
          <IosInstallSteps />
          <IosSeparateStorageNote />
        </div>
      ) : (
        <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={status.prompt}>
          התקנה במכשיר
        </Button>
      )}
    </div>
  );
}
