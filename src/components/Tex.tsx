import katex from 'katex';
import { Fragment, memo, useMemo } from 'react';

const cache = new Map<string, string>();

function render(tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  let html = cache.get(key);
  if (html === undefined) {
    html = katex.renderToString(tex, { throwOnError: false, strict: 'ignore', displayMode: display, output: 'html' });
    if (cache.size > 2000) cache.clear();
    cache.set(key, html);
  }
  return html;
}

export const Tex = memo(function Tex({ tex, display = false, className = '' }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => render(tex, display), [tex, display]);
  if (display) return <div dir="ltr" className={`math-display ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
  return <span dir="ltr" className={`math-inline ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

const TOKEN = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$|\*\*[^*]+\*\*|\n)/g;

/** Hebrew text with $inline$ / $$display$$ math, **bold** and line breaks. */
export const Rich = memo(function Rich({ text, className = '' }: { text: string; className?: string }) {
  const parts = useMemo(() => text.split(TOKEN).filter((p) => p !== ''), [text]);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p === '\n') return <br key={i} />;
        if (p.startsWith('$$') && p.endsWith('$$') && p.length > 4) return <Tex key={i} tex={p.slice(2, -2)} display />;
        if (p.startsWith('$') && p.endsWith('$') && p.length > 2) return <Tex key={i} tex={p.slice(1, -1)} />;
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </span>
  );
});
