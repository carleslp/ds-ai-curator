import type {
  CandidateSignal,
  EditorialDeliberationDecision,
  EvidenceReasoningDebug,
  SignalEvidence
} from "./editorialThesis.js";
import { cleanText, truncateText } from "./textUtils.js";

export type NarrativeExtraction = {
  headline: string;
  oldAssumption: string;
  newReality: string;
  narrativeThesis: string;
  whyNow: string;
  leadProof: string;
  supportingObservations: string[];
  implicationForDesignSystemTeams: string;
  readerTakeaway: string;
  sourceInputsUsed: string[];
  reasoning: string[];
};

type NarrativeExtractionInput = {
  leadSignal: CandidateSignal | null;
  editorialDeliberation: EditorialDeliberationDecision;
  evidenceReasoning: EvidenceReasoningDebug;
  representativeLeadEvidence: SignalEvidence | null;
  representativeSupportingEvidence: SignalEvidence[];
};

const fallbackNarrative: NarrativeExtraction = {
  headline: "",
  oldAssumption: "",
  newReality: "",
  narrativeThesis: "",
  whyNow: "",
  leadProof: "",
  supportingObservations: [],
  implicationForDesignSystemTeams: "",
  readerTakeaway: "",
  sourceInputsUsed: [],
  reasoning: ["Narrative Extraction did not run because no selected Lead Signal evidence was available."]
};

function hasPattern(value: string, pattern: RegExp): boolean {
  return pattern.test(value.toLowerCase());
}

function compact(value: string, maxLength: number): string {
  return truncateText(cleanText(value), maxLength);
}

function keptContributions(evidenceReasoning: EvidenceReasoningDebug): string[] {
  return evidenceReasoning.entries
    .filter((entry) => entry.status === "kept")
    .map((entry) => entry.uniqueContribution)
    .filter(Boolean);
}

function sourceInputsUsed(input: NarrativeExtractionInput): string[] {
  return [
    input.editorialDeliberation.dominantStory ? "editorialDeliberation.dominantStory" : "",
    input.leadSignal ? "leadSignal" : "",
    input.representativeLeadEvidence ? "representativeLeadEvidence" : "",
    input.representativeSupportingEvidence.length > 0 ? "representativeSupportingEvidence" : "",
    input.evidenceReasoning.entries.length > 0 ? "evidenceReasoning.keptEntries" : ""
  ].filter(Boolean);
}

function oldAssumptionFor(text: string): string {
  if (hasPattern(text, /metadata|machine-readable|machine readable|mcp|docgen|manifest|documentation/)) {
    return "Design Systems primarily publish guidance that humans interpret during design and implementation.";
  }

  if (hasPattern(text, /design-to-code|code generation|component generation|figma/)) {
    return "Design-to-code quality mainly depends on how well a model can generate interface code.";
  }

  if (hasPattern(text, /accessibility|qa|test|regression|governance/)) {
    return "AI-assisted component work can be reviewed after the fact by the same human QA and governance routines.";
  }

  return "Design Systems mainly help teams keep human-made interface work consistent.";
}

function newRealityFor(text: string): string {
  if (hasPattern(text, /metadata|machine-readable|machine readable|mcp|docgen|manifest|documentation/)) {
    return "Design Systems increasingly need to expose structured intent that agents can retrieve, compare, and apply safely.";
  }

  if (hasPattern(text, /design-to-code|code generation|component generation|figma/)) {
    return "Generated UI is only useful when Figma, component, and implementation context are explicit enough to preserve reuse.";
  }

  if (hasPattern(text, /accessibility|qa|test|regression|governance/)) {
    return "AI-assisted delivery needs system-owned checks for accessibility, QA, and governance before changes become trusted.";
  }

  return "The system now has to carry enough operational context for people and agents to make the same decision.";
}

export function emptyNarrativeExtraction(): NarrativeExtraction {
  return fallbackNarrative;
}

export function extractNarrativeFrame(input: NarrativeExtractionInput): NarrativeExtraction {
  const kept = keptContributions(input.evidenceReasoning);
  const leadContribution =
    input.representativeLeadEvidence?.contribution ||
    input.leadSignal?.evidence.find((evidence) => evidence.role === "lead")?.contribution ||
    kept[0] ||
    "";

  if (!input.leadSignal || !leadContribution) {
    return fallbackNarrative;
  }

  const dominantStory = input.editorialDeliberation.dominantStory?.story || input.leadSignal.claim;
  const themeAnchor = input.editorialDeliberation.dominantStory?.themeAnchor || input.leadSignal.claim;
  const evidenceText = [dominantStory, themeAnchor, input.leadSignal.whyNow, leadContribution, ...kept].join(" ");
  const oldAssumption = oldAssumptionFor(evidenceText);
  const newReality = newRealityFor(evidenceText);
  const supportingObservations = kept
    .filter((contribution) => contribution !== leadContribution)
    .slice(0, 3)
    .map((contribution) => compact(contribution, 150));
  const implicationForDesignSystemTeams = hasPattern(evidenceText, /accessibility|qa|governance/)
    ? "Mature teams need system rules that can block weak AI-assisted changes before review turns into cleanup."
    : "Mature teams need component intent, documentation, and implementation context to become explicit enough for assisted work to be reviewed against the same rules humans use.";
  const readerTakeaway = hasPattern(evidenceText, /figma|storybook|metadata|documentation|mcp/)
    ? "Treat system readability as delivery infrastructure, not documentation polish."
    : "Start with the workflow rule an internal agent should not have to infer.";

  return {
    headline: compact(dominantStory, 120),
    oldAssumption,
    newReality,
    narrativeThesis: compact(`${newReality} ${implicationForDesignSystemTeams}`, 240),
    whyNow: compact(input.leadSignal.whyNow, 220),
    leadProof: compact(leadContribution, 180),
    supportingObservations,
    implicationForDesignSystemTeams,
    readerTakeaway,
    sourceInputsUsed: sourceInputsUsed(input),
    reasoning: [
      `Used dominant story "${dominantStory}" from Editorial Deliberation.`,
      `Used ${kept.length} kept Evidence contribution${kept.length === 1 ? "" : "s"} from Evidence Reasoning.`,
      `Framed the narrative as old assumption versus new reality without changing selection, ranking, or Evidence.`
    ]
  };
}
