import { useSyncExternalStore } from 'react';
import type { Profile, Theorem, Concept } from './types';
import { review, newCard, today, type CardState, type Rating } from './lib/srs';
import { DEFAULT_MODEL } from './lib/ai';

export type Theme = 'system' | 'light' | 'dark';

export interface TopicStat {
  attempts: number;
  correct: number;
  /** Last results, 1 = correct, 0 = wrong (most recent last). */
  recent: number[];
  hints: number;
  lastAt: number;
}

export interface AppState {
  version: 1;
  profile: Profile | null;
  settings: {
    theme: Theme;
    apiKey: string;
    model: string;
    showAll: boolean;
  };
  progress: {
    topics: Record<string, TopicStat>;
    days: string[];
    solverUses: number;
    checks: number;
    viewed: string[];
  };
  srs: Record<string, CardState>;
  bookmarks: string[];
}

const KEY = 'smart-math:v1';

const initial: AppState = {
  version: 1,
  profile: null,
  settings: { theme: 'system', apiKey: '', model: DEFAULT_MODEL, showAll: false },
  progress: { topics: {}, days: [], solverUses: 0, checks: 0, viewed: [] },
  srs: {},
  bookmarks: [],
};

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const s = JSON.parse(raw) as Partial<AppState>;
    return {
      ...initial,
      ...s,
      settings: { ...initial.settings, ...(s.settings ?? {}) },
      progress: { ...initial.progress, ...(s.progress ?? {}) },
    };
  } catch {
    return initial;
  }
}

let state: AppState = typeof localStorage === 'undefined' ? initial : load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable (private mode) – the app keeps working in memory */
  }
}

export function getState(): AppState {
  return state;
}

export function setState(fn: (s: AppState) => AppState) {
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(initial),
  );
}

// ---------- actions ----------

export function setProfile(profile: Profile) {
  setState((s) => ({ ...s, profile }));
}

export function updateSettings(patch: Partial<AppState['settings']>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function markActive(s: AppState): AppState['progress'] {
  const day = dayKey();
  const days = s.progress.days.includes(day) ? s.progress.days : [...s.progress.days, day].slice(-400);
  return { ...s.progress, days };
}

export function recordAttempt(topic: string, correct: boolean, hintsUsed = 0) {
  setState((s) => {
    const prev = s.progress.topics[topic] ?? { attempts: 0, correct: 0, recent: [], hints: 0, lastAt: 0 };
    const stat: TopicStat = {
      attempts: prev.attempts + 1,
      correct: prev.correct + (correct ? 1 : 0),
      recent: [...prev.recent, correct ? 1 : 0].slice(-12),
      hints: prev.hints + hintsUsed,
      lastAt: Date.now(),
    };
    const progress = markActive(s);
    return { ...s, progress: { ...progress, topics: { ...progress.topics, [topic]: stat } } };
  });
}

export function recordSolverUse(kind: 'solve' | 'check') {
  setState((s) => {
    const progress = markActive(s);
    return {
      ...s,
      progress: kind === 'solve' ? { ...progress, solverUses: progress.solverUses + 1 } : { ...progress, checks: progress.checks + 1 },
    };
  });
}

export function recordView(id: string) {
  setState((s) => {
    if (s.progress.viewed[s.progress.viewed.length - 1] === id) return s;
    const viewed = [...s.progress.viewed.filter((v) => v !== id), id].slice(-30);
    return { ...s, progress: { ...s.progress, viewed } };
  });
}

export function toggleBookmark(id: string) {
  setState((s) => ({
    ...s,
    bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter((b) => b !== id) : [...s.bookmarks, id],
  }));
}

export function rateCard(cardId: string, rating: Rating) {
  setState((s) => {
    const card = s.srs[cardId] ?? newCard();
    const progress = markActive(s);
    return { ...s, progress, srs: { ...s.srs, [cardId]: review(card, rating, today()) } };
  });
}

export function resetProgress() {
  setState((s) => ({ ...s, progress: initial.progress, srs: {} }));
}

export function importState(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as AppState;
    if (parsed.version !== 1) return false;
    setState(() => ({ ...initial, ...parsed, settings: { ...initial.settings, ...parsed.settings } }));
    return true;
  } catch {
    return false;
  }
}

export function exportState(): string {
  const { settings, ...rest } = state;
  // never export the API key
  return JSON.stringify({ ...rest, settings: { ...settings, apiKey: '' } }, null, 2);
}

// ---------- profile filtering ----------

/** Is the item part of the student's curriculum (grade for middle school, study units for high school)? */
export function isRelevant(item: Pick<Theorem | Concept, 'grades' | 'units'>, profile: Profile | null): boolean {
  if (!profile) return true;
  if (profile.grade <= 9) return item.grades.some((g) => g <= profile.grade);
  return profile.units ? item.units.includes(profile.units) : true;
}

export function defaultDifficulty(profile: Profile | null): 1 | 2 | 3 {
  if (!profile) return 2;
  if (profile.grade <= 9) return profile.middleLevel === 'basic' ? 1 : profile.middleLevel === 'advanced' ? 3 : 2;
  return profile.units === 3 ? 1 : profile.units === 5 ? 3 : 2;
}
