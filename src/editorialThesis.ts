import type { CandidateResource } from "./collectCandidates.js";
import { selectEditorialCandidates, type EditorialSelectionResult } from "./editorialSelection.js";

export const selectEditorialThesis: (candidatePool: CandidateResource[]) => EditorialSelectionResult =
  selectEditorialCandidates;
