import type { EvidenceReasoningDebug, SignalEvidence } from "./editorialThesis.js";
import type { NarrativeExtraction } from "./narrativeExtraction.js";
import { cleanText, truncateText } from "./textUtils.js";

export type EditorialBriefEvidenceMapping = {
  title: string;
  url: string;
  source: string;
  evidentialRole: string;
  supportsBrief: string;
};

export type EditorialBrief = {
  thesis: string;
  narrativeHeadline: string;
  narrativeFrame: NarrativeExtraction;
  editorialPosition: string;
  oldAssumption: string;
  newReality: string;
  whyNow: string;
  leadEvidence: string;
  supportingEvidence: string[];
  consequences: {
    immediate: string;
    mediumTerm: string;
  };
  experiment: string;
  discussionQuestions: string[];
  watchlist: string[];
  evidenceMapping: EditorialBriefEvidenceMapping[];
  reasoning: string[];
};

type EditorialBriefInput = {
  narrativeFrame: NarrativeExtraction;
  evidenceReasoning: EvidenceReasoningDebug;
  representativeLeadEvidence: SignalEvidence | null;
  representativeSupportingEvidence: SignalEvidence[];
};

const emptyBrief: EditorialBrief = {
  thesis: "",
  narrativeHeadline: "",
  narrativeFrame: {
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
    reasoning: ["Narrative Extraction did not run."]
  },
  editorialPosition: "",
  oldAssumption: "",
  newReality: "",
  whyNow: "",
  leadEvidence: "",
  supportingEvidence: [],
  consequences: {
    immediate: "",
    mediumTerm: ""
  },
  experiment: "",
  discussionQuestions: [],
  watchlist: [],
  evidenceMapping: [],
  reasoning: ["Editorial Brief did not run because no narrative frame was available."]
};

function compact(value: string, maxLength: number): string {
  return truncateText(cleanText(value), maxLength);
}

function withoutPeriod(value: string): string {
  return cleanText(value).replace(/[.!?]+$/g, "");
}

function entryForUrl(evidenceReasoning: EvidenceReasoningDebug, url: string) {
  return evidenceReasoning.entries.find((entry) => entry.url === url);
}

function evidenceMappingFor(input: EditorialBriefInput): EditorialBriefEvidenceMapping[] {
  const allEvidence = [
    input.representativeLeadEvidence,
    ...input.representativeSupportingEvidence
  ].filter((evidence): evidence is SignalEvidence => Boolean(evidence));

  return allEvidence.map((evidence) => {
    const reasoningEntry = entryForUrl(input.evidenceReasoning, evidence.resourceRef.url);
    const contribution = reasoningEntry?.uniqueContribution || evidence.contribution;
    const roleLabel =
      evidence.role === "lead"
        ? "Makes the thesis concrete"
        : evidence.role === "corroborating"
          ? "Points in the same direction"
          : evidence.role === "counter"
            ? "Qualifies the conclusion"
            : "Explains why the shift is happening";

    return {
      title: evidence.resourceRef.title,
      url: evidence.resourceRef.url,
      source: evidence.resourceRef.source,
      evidentialRole: roleLabel,
      supportsBrief: compact(`${roleLabel}: ${contribution}`, 220)
    };
  });
}

export function emptyEditorialBrief(): EditorialBrief {
  return emptyBrief;
}

export function buildEditorialBrief(input: EditorialBriefInput): EditorialBrief {
  const frame = input.narrativeFrame;

  if (!frame.narrativeThesis || !frame.headline) {
    return emptyBrief;
  }

  const supportingEvidence = frame.supportingObservations.length
    ? frame.supportingObservations
    : input.evidenceReasoning.entries.filter((entry) => entry.status === "kept").map((entry) => entry.uniqueContribution).slice(1, 4);
  const immediate = compact(frame.implicationForDesignSystemTeams, 180);
  const mediumTerm = compact(`${frame.newReality} ${frame.readerTakeaway}`, 190);
  // frame.readerTakeaway is always an imperative clause ("Treat system
  // readability as..." / "Start with the workflow rule..."), so it can only be
  // chained after another imperative — never spliced into a "test whether"
  // clause, which needs a declarative. Mirrors the "Because X, start with Y
  // and Z" shape already used by buildSuggestedExperiment's own fallback.
  const reason = withoutPeriod(frame.newReality);
  const takeaway = withoutPeriod(frame.readerTakeaway);
  const experiment = compact(
    `Because ${reason.charAt(0).toLowerCase()}${reason.slice(1)}, start with one high-use component and ${takeaway.charAt(0).toLowerCase()}${takeaway.slice(1)}.`,
    200
  );
  const discussionQuestions = [
    `Where are we still assuming ${withoutPeriod(frame.oldAssumption).charAt(0).toLowerCase()}${withoutPeriod(frame.oldAssumption).slice(1)}?`,
    "Which system rule would an internal agent still have to infer?",
    `What would make this new reality operational rather than aspirational: ${withoutPeriod(frame.newReality).toLowerCase()}?`
  ];
  const watchlist = [
    `Watch for tools that make this new reality concrete: ${withoutPeriod(frame.newReality).toLowerCase()}.`,
    "Track whether teams publish review rules alongside generated output.",
    "Look for workflow examples where resources validate the story instead of carrying it."
  ];

  return {
    thesis: frame.narrativeThesis,
    narrativeHeadline: frame.headline,
    narrativeFrame: frame,
    editorialPosition: compact(`${frame.newReality} ${frame.readerTakeaway}`, 220),
    oldAssumption: frame.oldAssumption,
    newReality: frame.newReality,
    whyNow: frame.whyNow,
    leadEvidence: frame.leadProof,
    supportingEvidence,
    consequences: {
      immediate,
      mediumTerm
    },
    experiment,
    discussionQuestions,
    watchlist,
    evidenceMapping: evidenceMappingFor(input),
    reasoning: [
      "Built from Narrative Extraction plus kept Evidence Reasoning entries.",
      "Resources are mapped as proof points for the brief, not as independent narrative sources.",
      "Brief is internal and feeds existing section writers without adding a visible email section."
    ]
  };
}
