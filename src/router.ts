import { useEffect, useState } from 'react';

function current(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/solver';
}

/** Minimal hash router (works on any static host). */
export function useRoute(): { path: string; parts: string[]; query: URLSearchParams } {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const on = () => {
      setPath(current());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [p, q = ''] = path.split('?');
  return { path: p, parts: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (current() === path) return;
  if (opts.replace) window.location.replace(`#${path}`);
  else window.location.hash = path;
}

export function back(fallback: string) {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}
