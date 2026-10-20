import { useState } from 'react';
import { BookOpenCheck, Sigma } from 'lucide-react';
import type { Units } from '../types';
import { formulaSections } from '../data';
import { navigate } from '../router';
import { useStore } from '../store';
import { Rich, Tex } from '../components/Tex';
import { Callout, Card, PageHeader, Section, Segmented } from '../components/ui';

export function FormulasScreen() {
  const profile = useStore((s) => s.profile);
  const [units, setUnits] = useState<Units>(profile?.units ?? (profile && profile.grade <= 9 ? 3 : 4));
  const sections = formulaSections.map((s) => ({ ...s, items: s.items.filter((f) => f.units.includes(units)) })).filter((s) => s.items.length);
  return (
    <div>
      <PageHeader title="דף נוסחאות" subtitle="הנוסחאות מסודרות לפי נושאים, כמו בדף הנוסחאות של הבגרות." />
      <Segmented
        options={[
          { id: 'theorems', label: 'משפטים', icon: <BookOpenCheck className="h-4 w-4" /> },
          { id: 'formulas', label: 'דף נוסחאות', icon: <Sigma className="h-4 w-4" /> },
        ]}
        value="formulas"
        onChange={(v) => v === 'theorems' && navigate('/theorems')}
      />
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm font-semibold">רמה:</span>
        <div className="flex-1">
          <Segmented
            options={([3, 4, 5] as Units[]).map((u) => ({ id: String(u), label: `${u} יח״ל` }))}
            value={String(units)}
            onChange={(v) => setUnits(Number(v) as Units)}
          />
        </div>
      </div>
      <Callout tone="info" className="mt-3">
        נוסחה המסומנת <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">לא בדף</span> שימושית מאוד, אבל ככל הידוע לנו היא לא מודפסת בדף הנוסחאות הרשמי – כדאי לזכור אותה או לדעת לפתח אותה. דף הנוסחאות הרשמי מתעדכן מעת לעת; בבחינה קובע הדף שמחולק בה.
      </Callout>
      <nav className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label="קפיצה לנושא">
        {sections.map((s) => (
          <a key={s.id} href={`#/formulas`} onClick={(e) => {
            e.preventDefault();
            document.getElementById(`f-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }} className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm dark:border-night-line dark:bg-night-card">
            <span aria-hidden>{s.icon}</span> {s.title}
          </a>
        ))}
      </nav>
      {sections.map((s) => (
        <div key={s.id} id={`f-${s.id}`} className="scroll-mt-16">
          <Section title={s.title} icon={<span aria-hidden>{s.icon}</span>}>
            <Card className="divide-y divide-black/5 dark:divide-night-line">
              {s.items.map((f) => (
                <div key={f.id} className="p-3.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {f.name}
                    {f.extra && <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">לא בדף</span>}
                  </div>
                  <Tex tex={f.tex} display />
                  {f.note && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      <Rich text={f.note} />
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </Section>
        </div>
      ))}
    </div>
  );
}
