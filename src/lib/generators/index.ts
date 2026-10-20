import { type Exercise, type Difficulty, type Rng, makeRng } from './types';
import * as A from './algebra';
import * as G from './geometry';
import * as O from './other';

export * from './types';

interface Gen {
  id: string;
  name: string;
  fn: (rng: Rng, d: Difficulty) => Exercise;
}

/** Exercise generators per topic. */
export const GENERATORS: Record<string, Gen[]> = {
  angles: [
    { id: 'parallel', name: 'זוויות בין מקבילים', fn: G.parallelAngles },
    { id: 'vertical', name: 'זוויות קודקודיות וצמודות', fn: G.verticalAngles },
  ],
  triangles: [
    { id: 'tri-angles', name: 'זוויות במשולש', fn: G.triangleAngles },
    { id: 'midsegment', name: 'קטע אמצעים', fn: G.midsegmentEx },
  ],
  congruence: [{ id: 'cong', name: 'זיהוי משפט חפיפה', fn: G.congruenceChoice }],
  isosceles: [{ id: 'iso', name: 'משולש שווה שוקיים', fn: G.isoscelesAngles }],
  loci: [{ id: 'medians', name: 'מפגש התיכונים', fn: G.mediansEx }],
  'right-triangle': [
    { id: 'pyth', name: 'משפט פיתגורס', fn: G.pythagorasEx },
    { id: 'special', name: 'תיכון ליתר וזווית 30°', fn: G.rightTriangleSpecial },
  ],
  quadrilaterals: [{ id: 'quads', name: 'מרובעים', fn: G.quadrilateralEx }],
  similarity: [{ id: 'sim', name: 'דמיון ותאלס', fn: G.similarityEx }],
  circle: [
    { id: 'circ-angles', name: 'זוויות במעגל', fn: G.circleAngles },
    { id: 'chord', name: 'מיתר ומרחקו מהמרכז', fn: G.chordDistanceEx },
  ],
  tangents: [{ id: 'tang', name: 'משיקים וחותכים', fn: G.tangentsEx }],
  'area-volume': [{ id: 'area', name: 'שטחים ונפחים', fn: G.areaVolumeEx }],
  algebra: [
    { id: 'expand', name: 'פתיחת סוגריים', fn: A.expandExpression },
    { id: 'factor', name: 'פירוק לגורמים', fn: A.factorExpression },
  ],
  powers: [
    { id: 'pow', name: 'חוקי חזקות', fn: A.powerRules },
    { id: 'log', name: 'לוגריתמים ומשוואות מעריכיות', fn: A.logarithms },
  ],
  equations: [
    { id: 'linear', name: 'משוואה ממעלה ראשונה', fn: A.linearEquation },
    { id: 'quadratic', name: 'משוואה ריבועית', fn: A.quadraticEquation },
    { id: 'system', name: 'מערכת משוואות', fn: A.systemEquations },
    { id: 'rational', name: 'משוואה עם שברים', fn: A.rationalEquation },
  ],
  inequalities: [
    { id: 'lin-ineq', name: 'אי-שוויון ממעלה ראשונה', fn: A.linearInequality },
    { id: 'quad-ineq', name: 'אי-שוויון ריבועי', fn: A.quadraticInequality },
  ],
  functions: [{ id: 'vertex', name: 'קודקוד פרבולה', fn: A.parabolaVertex }],
  derivatives: [
    { id: 'dval', name: 'ערך הנגזרת בנקודה', fn: A.derivativeAtPoint },
    { id: 'extremum', name: 'נקודות קיצון', fn: A.extremumPoints },
    { id: 'tangent', name: 'משוואת משיק', fn: A.tangentLine },
  ],
  integrals: [{ id: 'definite', name: 'אינטגרל מסוים', fn: A.definiteIntegral }],
  trigonometry: [
    { id: 'right-trig', name: 'טריגונומטריה במשולש ישר זווית', fn: G.rightTriangleTrig },
    { id: 'laws', name: 'משפט הסינוסים והקוסינוסים', fn: G.lawOfSinesCosines },
  ],
  analytic: [
    { id: 'line', name: 'משוואת ישר', fn: A.lineThroughPoints },
    { id: 'points', name: 'מרחק, אמצע ומעגל', fn: O.analyticEx },
  ],
  sequences: [
    { id: 'arith', name: 'סדרה חשבונית', fn: A.arithmeticSequence },
    { id: 'geo', name: 'סדרה הנדסית', fn: A.geometricSequence },
  ],
  probability: [
    { id: 'prob', name: 'הסתברות', fn: O.probabilityBasic },
    { id: 'cond', name: 'הסתברות מותנית', fn: O.conditionalProbability },
  ],
  statistics: [
    { id: 'stat', name: 'ממוצע, חציון וסטיית תקן', fn: O.statisticsEx },
    { id: 'normal', name: 'התפלגות נורמלית', fn: O.normalDistributionEx },
  ],
  growth: [{ id: 'growth', name: 'גדילה ודעיכה', fn: A.growthDecay }],
  vectors: [{ id: 'vectors', name: 'וקטורים', fn: O.vectorsEx }],
  complex: [{ id: 'complex', name: 'מספרים מרוכבים', fn: O.complexEx }],
};

export function generate(topic: string, difficulty: Difficulty, seed?: number, genId?: string): Exercise {
  const gens = GENERATORS[topic];
  if (!gens?.length) throw new Error(`no generator for ${topic}`);
  const rng = makeRng(seed);
  const gen = genId ? (gens.find((g) => g.id === genId) ?? gens[0]) : gens[Math.floor(rng() * gens.length)];
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return gen.fn(rng, difficulty);
    } catch (e) {
      if (attempt === 4) throw e;
    }
  }
  throw new Error('generation failed');
}
