import { useEffect } from 'react';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { isNativeApp } from './lib/native';
import { useRoute } from './router';
import { useStore } from './store';
import { Layout } from './components/Layout';
import { Onboarding } from './screens/Onboarding';
import { SolverScreen } from './screens/Solver';
import { TheoremsScreen, TheoremDetail } from './screens/Theorems';
import { FormulasScreen } from './screens/Formulas';
import { ConceptsScreen, ConceptDetail } from './screens/Concepts';
import { PracticeScreen } from './screens/Practice';
import { GeneratorScreen } from './screens/Generator';
import { FlashcardsScreen } from './screens/Flashcards';
import { ProgressScreen } from './screens/Progress';
import { SearchScreen } from './screens/Search';
import { SettingsScreen } from './screens/Settings';
import { Empty, Button } from './components/ui';
import { navigate } from './router';

function useThemeClass() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e0f1a' : '#6d28d9');
      // in the Android app the clock/battery icons sit on top of the page: light icons on the dark theme
      if (isNativeApp()) SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  useThemeClass();
  const profile = useStore((s) => s.profile);
  const { parts, query } = useRoute();
  const [section = 'solver', id, sub] = parts;

  if (!profile || section === 'welcome') return <Onboarding />;

  let screen;
  switch (section) {
    case 'solver':
      screen = <SolverScreen tab={query.get('tab') ?? 'solve'} initial={query.get('q') ?? ''} />;
      break;
    case 'theorems':
      screen = id ? <TheoremDetail id={id} /> : <TheoremsScreen />;
      break;
    case 'formulas':
      screen = <FormulasScreen />;
      break;
    case 'concepts':
      screen = id ? <ConceptDetail id={id} /> : <ConceptsScreen />;
      break;
    case 'practice':
      if (id === 'gen' && sub) screen = <GeneratorScreen topic={sub} />;
      else if (id === 'cards') screen = <FlashcardsScreen deck={query.get('deck') ?? 'theorems'} />;
      else screen = <PracticeScreen />;
      break;
    case 'progress':
      screen = <ProgressScreen />;
      break;
    case 'search':
      screen = <SearchScreen initial={query.get('q') ?? ''} />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    default:
      screen = (
        <Empty icon="🧭" title="הדף לא נמצא">
          <Button className="mt-3" onClick={() => navigate('/solver')}>
            חזרה לפותר
          </Button>
        </Empty>
      );
  }
  return (
    <Layout section={section}>
      <div key={parts.join('/')} className="pop-in">
        {screen}
      </div>
    </Layout>
  );
}
