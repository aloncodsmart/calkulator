import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/rubik';
import 'katex/dist/katex.min.css';
import './index.css';
import { App } from './App';

// Store the app on the device so it opens without internet (see offlineServiceWorker in vite.config.ts).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // a home-screen app is usually resumed rather than reopened, so look for a new version on resume
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* not available (e.g. private browsing) – the app still works online */
      });
    // ask the browser not to evict saved progress when space runs low
    navigator.storage?.persist?.().catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
