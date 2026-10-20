import type { Concept, DiagramSpec, FormulaSection, Theorem, Topic } from '../types';

import topicsJson from './topics.json';
import formulasJson from './formulas.json';
import thTriangles from './theorems/triangles.json';
import thLociQuads from './theorems/loci-right-quads.json';
import thSimCircle from './theorems/similarity-circle.json';
import coGeometry from './concepts/geometry.json';
import coAlgebra from './concepts/algebra-calculus.json';
import coMore from './concepts/more.json';
import dgGeometry from './diagrams/geometry.json';
import dgGraphs from './diagrams/graphs.json';
import dgBasics from './diagrams/basics.json';
import dgMisc from './diagrams/misc.json';

// JSON imports are widened by TypeScript; the data tests (tests/data.test.ts) validate the shapes.
export const topics = topicsJson as unknown as Topic[];
export const theorems = [...thTriangles, ...thLociQuads, ...thSimCircle] as unknown as Theorem[];
export const concepts = [...coGeometry, ...coAlgebra, ...coMore] as unknown as Concept[];
export const formulaSections = formulasJson as unknown as FormulaSection[];
export const diagrams = [...dgGeometry, ...dgGraphs, ...dgBasics, ...dgMisc] as unknown as DiagramSpec[];

const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));

export const topicById = byId(topics);
export const theoremById = byId(theorems);
export const conceptById = byId(concepts);
export const diagramById = byId(diagrams);

export function getDiagram(id: string): DiagramSpec | undefined {
  return diagramById.get(id);
}

export function getTopic(id: string): Topic | undefined {
  return topicById.get(id);
}

/** Theorems whose `related` list mentions the concept. */
export function theoremsForConcept(conceptId: string): Theorem[] {
  return theorems.filter((t) => t.related.includes(conceptId));
}

/** Concepts that list this concept as related (reverse links). */
export function conceptsLinkingTo(conceptId: string): Concept[] {
  return concepts.filter((c) => c.related.includes(conceptId) && c.id !== conceptId);
}
