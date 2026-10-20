// ---------- Profile & curriculum ----------

export type Units = 3 | 4 | 5;
export type Grade = 7 | 8 | 9 | 10 | 11 | 12;
export type MiddleLevel = 'basic' | 'standard' | 'advanced';

export interface Profile {
  grade: Grade;
  /** High school (grades 10-12): number of study units. */
  units?: Units;
  /** Middle school (grades 7-9): track level. */
  middleLevel?: MiddleLevel;
}

export type Area =
  | 'geometry'
  | 'algebra'
  | 'functions'
  | 'calculus'
  | 'trigonometry'
  | 'analytic'
  | 'sequences'
  | 'probability'
  | 'vectors'
  | 'complex'
  | 'growth';

export type ColorKey =
  | 'sky'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'orange'
  | 'teal'
  | 'fuchsia'
  | 'lime'
  | 'pink'
  | 'indigo'
  | 'cyan';

export interface Topic {
  id: string;
  name: string;
  area: Area;
  icon: string;
  color: ColorKey;
  grades: Grade[];
  units: Units[];
  description: string;
}

/** Content that can be filtered by the student's profile. */
export interface Tagged {
  topic: string;
  grades: Grade[];
  units: Units[];
}

// ---------- Theorems ----------

/**
 * official      – appears in the Ministry of Education list of theorems that may be cited without proof.
 * formula-sheet – appears in the matriculation formula sheet and may be used directly.
 * needs-proof   – a true claim that is NOT on the list: if used in an exam it must be proven.
 */
export type TheoremStatus = 'official' | 'formula-sheet' | 'needs-proof';

export interface ProofStep {
  claim: string;
  reason: string;
  /** Id of the theorem cited in the reason, when there is one. */
  ref?: string;
}

export interface WorkedExample {
  problem: string;
  /** Optional diagram for the example (defaults to the theorem diagram). */
  diagram?: string;
  steps: ProofStep[];
  answer?: string;
}

export interface Theorem extends Tagged {
  id: string;
  name: string;
  statement: string;
  /** Symbolic form (LaTeX, no $ delimiters). */
  formal?: string;
  /** The short wording to write in the "reason" column of an exam proof. */
  citation: string;
  /** What must be shown before the theorem may be cited. */
  conditions: string[];
  /** When to think about this theorem (used by "which theorem fits?"). */
  useWhen: string;
  diagram: string;
  example: WorkedExample;
  mistakes: string[];
  converse?: { id?: string; statement?: string };
  status: TheoremStatus;
  keywords: string[];
  /** Ids from the givens vocabulary (src/lib/recommender.ts). */
  givens: string[];
  /** Ids of goals this theorem helps to prove. */
  goals: string[];
  related: string[];
  /** Explicit uncertainty or remarks about the formulation / list membership. */
  note?: string;
}

// ---------- Concepts ----------

export interface Concept extends Tagged {
  id: string;
  term: string;
  aliases?: string[];
  simple: string;
  formal: string;
  diagram: string;
  example?: string;
  related: string[];
}

// ---------- Formula sheet ----------

export interface Formula {
  id: string;
  name: string;
  tex: string;
  note?: string;
  units: Units[];
  /** True when the formula is useful but (to our knowledge) not printed on the official sheet. */
  extra?: boolean;
}

export interface FormulaSection {
  id: string;
  title: string;
  topic: string;
  icon: string;
  items: Formula[];
}

// ---------- Diagrams ----------

export type PointDef =
  | [number, number]
  | { mid: [string, string] }
  /** [cx, cy, r, degrees] – angle measured counter-clockwise as seen on screen. */
  | { polar: [number, number, number, number] }
  /** [centerPoint, r, degrees]. */
  | { on: [string, number, number] }
  /** Foot of the perpendicular from P to line AB: [P, A, B]. */
  | { foot: [string, string, string] }
  /** A + t·(B − A): [A, B, t]. */
  | { along: [string, string, number] }
  /** Intersection of lines AB and CD. */
  | { inter: [string, string, string, string] }
  /** Rotate P around C by degrees (counter-clockwise on screen): [P, C, deg]. */
  | { rot: [string, string, number] }
  /** A + C − B (completes parallelogram ABCD from A, B, C): [A, B, C]. */
  | { add: [string, string, string] }
  /** Tangency point from external point P to circle (O, r); side ±1: [P, O, r, side]. */
  | { tan: [string, string, number, number] }
  /** Reflection of P across line AB: [P, A, B]. */
  | { refl: [string, string, string] }
  /** Triangle centers of triangle ABC. */
  | { incenter: [string, string, string] }
  | { circumcenter: [string, string, string] }
  | { orthocenter: [string, string, string] }
  | { centroid: [string, string, string] }
  /** Second intersection of line PA with the circle centered O through A: [P, A, O]. */
  | { chordx: [string, string, string] };

export type DColor = 'main' | 'accent' | 'accent2' | 'good' | 'warn' | 'muted';
export type Compass = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'c';

export type DiagramElement =
  | { t: 'seg'; p: [string, string]; c?: DColor; dash?: boolean; w?: number; ext?: number }
  | { t: 'line'; p: [string, string]; c?: DColor; dash?: boolean; w?: number; ext?: number }
  | { t: 'ray'; p: [string, string]; c?: DColor; dash?: boolean; w?: number; ext?: number }
  | { t: 'poly'; p: string[]; c?: DColor; fill?: DColor; dash?: boolean; w?: number }
  | { t: 'path'; p: string[]; c?: DColor; dash?: boolean; w?: number }
  | {
      t: 'circle';
      o: string;
      r?: number;
      through?: string;
      c?: DColor;
      fill?: DColor;
      dash?: boolean;
      w?: number;
    }
  /** Axis-aligned ellipse (for solids); `half` draws only the front (lower) or back (upper) half. */
  | {
      t: 'ellipse';
      o: string;
      rx: number;
      ry: number;
      c?: DColor;
      fill?: DColor;
      dash?: boolean;
      half?: 'front' | 'back';
    }
  /** Arc of the circle centered at o, from point `from` to point `to`, counter-clockwise on screen. */
  | { t: 'arc'; o: string; from: string; to: string; c?: DColor; w?: number; dash?: boolean }
  | {
      t: 'angle';
      p: [string, string, string];
      n?: number;
      label?: string;
      c?: DColor;
      r?: number;
      fill?: boolean;
    }
  | { t: 'right'; p: [string, string, string]; c?: DColor }
  | { t: 'tick'; p: [string, string]; n?: number; c?: DColor }
  | { t: 'par'; p: [string, string]; n?: number; c?: DColor }
  | { t: 'vec'; p: [string, string]; c?: DColor; w?: number; dash?: boolean }
  | { t: 'pts'; p: string[]; c?: DColor; open?: boolean; nolabel?: boolean }
  | { t: 'label'; p: string; s: string; pos?: Compass; c?: DColor; size?: number }
  | { t: 'seglabel'; p: [string, string]; s: string; side?: number; c?: DColor; size?: number }
  | {
      t: 'text';
      at: [number, number];
      s: string;
      c?: DColor;
      size?: number;
      anchor?: 'start' | 'middle' | 'end';
      bold?: boolean;
    }
  // ---- elements that need a coordinate window ----
  | { t: 'axes'; grid?: boolean; x?: string; y?: string; noY?: boolean; step?: number; labels?: boolean }
  | { t: 'fn'; f: string; dom?: [number, number]; c?: DColor; dash?: boolean; w?: number; label?: string }
  | { t: 'area'; f: string; g?: string; dom: [number, number]; c?: DColor }
  | { t: 'vline'; x: number; c?: DColor; dash?: boolean; label?: string }
  | { t: 'hline'; y: number; c?: DColor; dash?: boolean; label?: string };

export type DiagramShape =
  | 'angles'
  | 'parallel'
  | 'triangle'
  | 'right-triangle'
  | 'quadrilateral'
  | 'polygon'
  | 'circle'
  | 'tangent'
  | 'similar'
  | 'graph'
  | 'coordinate'
  | 'number-line'
  | 'solid'
  | 'vector'
  | 'complex-plane'
  | 'venn'
  | 'tree'
  | 'chart';

export interface DiagramSpec {
  id: string;
  shape: DiagramShape;
  /** Math coordinate window [xmin, xmax, ymin, ymax]; when present, coordinates are y-up math units. */
  window?: [number, number, number, number];
  /** Scale x and y independently (charts). Default: equal scaling so circles stay round. */
  free?: boolean;
  /** Size of the SVG view box (default 320×240). */
  size?: [number, number];
  points?: Record<string, PointDef>;
  /** Label placement overrides for point labels. */
  lpos?: Record<string, Compass>;
  elements: DiagramElement[];
}

// ---------- Solvers ----------

export interface SolutionStep {
  /** Short title of the step, e.g. "פותחים סוגריים". */
  title: string;
  /** Rich text explanation (Hebrew with $…$ math). */
  text?: string;
  /** Display math for this step (LaTeX). */
  tex?: string;
  /** For proof-style solutions. */
  claim?: string;
  reason?: string;
  ref?: string;
}

export interface Hints {
  /** 1: general direction. */
  direction: string;
  /** 2: which theorem / rule / formula is relevant. */
  tool: string;
  /** 3: the next concrete step. */
  next: string;
}

export interface Solution {
  kind: string;
  /** Human title of the detected problem type. */
  title: string;
  /** Problem rendered as LaTeX. */
  problemTex?: string;
  hints: Hints;
  steps: SolutionStep[];
  /** Final answer (rich text). */
  answer: string;
  /** Proof table (geometry). */
  proof?: ProofStep[];
  diagram?: DiagramSpec;
  topic: string;
  notes?: string[];
}
