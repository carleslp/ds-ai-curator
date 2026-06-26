import type { CandidateResource } from "./collectCandidates.js";
import { selectEditorialCandidates, type EditorialSelectionResult } from "./editorialSelection.js";

export function selectEditorialThesis(candidatePool: CandidateResource[]): EditorialSelectionResult {
  return selectEditorialCandidates(candidatePool);
}
