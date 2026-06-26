import type { CandidateResource } from "./collectCandidates.js";
import {
  selectEditorialCandidates,
  type EditorialSelectionDecision,
  type EditorialSelectionResult
} from "./editorialSelection.js";

export type SignalEvidence = {
  resourceRef: {
    title: string;
    url: string;
    source: string;
  };
  stance: "supports";
  role: "lead";
  contribution: string;
  independenceMarker: string;
};

export type CandidateSignal = {
  role: "lead";
  claim: string;
  whyNow: string;
  evidence: SignalEvidence[];
  confidence: number;
  editorialConviction: number;
  opportunity: string;
  resourceUrl: string;
  resourceTitle: string;
  formationReason: string;
  decision: EditorialSelectionDecision;
};

export type RejectedSignal = {
  resourceUrl: string;
  resourceTitle: string;
  rejectionReason: string;
  formationReason: string;
};

export type EditorialThesisResult = {
  selectionResult: EditorialSelectionResult;
  leadSignal: CandidateSignal | null;
  candidateSignals: CandidateSignal[];
  rejectedSignals: RejectedSignal[];
  signalFormationReasons: string[];
};

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, roundScore(value)));
}

function workflowImpactScore(decision: EditorialSelectionDecision): number {
  const workflowBreadth =
    decision.designSystemTopics.length * 2 + decision.workflowTopics.length * 3 + decision.aiTopics.length;

  return (
    decision.editorialScore.workflowScore * 2 +
    decision.editorialScore.enterpriseScore +
    decision.editorialScore.practicalityScore +
    workflowBreadth
  );
}

function signalStrength(signal: CandidateSignal): number {
  const decision = signal.decision;
  const evidenceBonus = decision.designSystemTopics.length + decision.workflowTopics.length;
  const mondayBonus = decision.mondayMorningChange === "nothing" ? 0 : 8;
  const missionBonus = decision.editorialMissionMatch ? 10 : 0;

  return (
    decision.editorialScore.totalScore +
    workflowImpactScore(decision) +
    decision.actionabilityScore * 3 +
    evidenceBonus +
    mondayBonus +
    missionBonus
  );
}

function decisionForCandidate(candidate: CandidateResource, decisions: EditorialSelectionDecision[]): EditorialSelectionDecision | undefined {
  return decisions.find((decision) => decision.url === candidate.url);
}

function confidenceFor(decision: EditorialSelectionDecision): number {
  const scoreConfidence = Math.min(0.55, decision.editorialScore.totalScore / 180);
  const missionConfidence = decision.editorialMissionMatch ? 0.15 : 0;
  const evidenceConfidence = decision.designSystemTopics.length > 0 || decision.workflowTopics.length > 0 ? 0.15 : 0;
  const actionConfidence = decision.actionabilityScore >= 6 ? 0.15 : 0;

  return clamp01(scoreConfidence + missionConfidence + evidenceConfidence + actionConfidence);
}

function convictionFor(decision: EditorialSelectionDecision): number {
  const workflowConviction = Math.min(0.45, workflowImpactScore(decision) / 120);
  const actionConviction = Math.min(0.25, decision.actionabilityScore / 40);
  const mondayConviction = decision.mondayMorningChange === "nothing" ? 0 : 0.2;
  const selectionConviction = decision.selectedBecause ? 0.1 : 0;

  return clamp01(workflowConviction + actionConviction + mondayConviction + selectionConviction);
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function evidenceContribution(candidate: CandidateResource, decision: EditorialSelectionDecision): string {
  if (decision.mondayMorningChange !== "nothing") {
    return decision.mondayMorningChange;
  }

  if (candidate.directDesignSystemEvidence.trim()) {
    return candidate.directDesignSystemEvidence;
  }

  return decision.selectedBecause || decision.selectionReason;
}

function buildCandidateSignal(candidate: CandidateResource, decision: EditorialSelectionDecision): CandidateSignal {
  const topics = [
    ...decision.aiTopics,
    ...decision.designSystemTopics,
    ...decision.workflowTopics
  ];
  const topicPhrase = topics.length ? topics.slice(0, 5).join(", ") : decision.topicGroup;
  const claim = decision.editorialTitle || candidate.title;
  const whyNow = decision.selectedBecause || decision.selectionReason;
  const opportunity =
    decision.mondayMorningChange !== "nothing"
      ? decision.mondayMorningChange
      : "Use the resource to identify one mature Design System workflow that should become agent-readable.";

  return {
    role: "lead",
    claim,
    whyNow,
    evidence: [
      {
        resourceRef: {
          title: candidate.title,
          url: candidate.url,
          source: candidate.source
        },
        stance: "supports",
        role: "lead",
        contribution: evidenceContribution(candidate, decision),
        independenceMarker: sourceDomain(candidate.url) || candidate.source
      }
    ],
    confidence: confidenceFor(decision),
    editorialConviction: convictionFor(decision),
    opportunity,
    resourceUrl: candidate.url,
    resourceTitle: candidate.title,
    formationReason: `Formed from ${decision.topicGroup} candidate using ${topicPhrase}.`,
    decision
  };
}

function orderSelectionByLead(selectionResult: EditorialSelectionResult, leadSignal: CandidateSignal | null): EditorialSelectionResult {
  if (!leadSignal) {
    return selectionResult;
  }

  const leadUrl = leadSignal.resourceUrl;
  const selectedCandidates = [
    ...selectionResult.selectedCandidates.filter((candidate) => candidate.url === leadUrl),
    ...selectionResult.selectedCandidates.filter((candidate) => candidate.url !== leadUrl)
  ];
  const selectedDecisions = [
    ...selectionResult.selectedDecisions.filter((decision) => decision.url === leadUrl),
    ...selectionResult.selectedDecisions.filter((decision) => decision.url !== leadUrl)
  ];

  return {
    ...selectionResult,
    selectedCandidates,
    selectedDecisions,
    decisions: [...selectedDecisions, ...selectionResult.rejectedDecisions],
    editorsPickCandidate: selectedCandidates[0] ?? selectionResult.editorsPickCandidate
  };
}

export function selectEditorialThesis(candidatePool: CandidateResource[]): EditorialThesisResult {
  const baseSelection = selectEditorialCandidates(candidatePool);
  const candidateSignals = baseSelection.selectedCandidates
    .map((candidate) => {
      const decision = decisionForCandidate(candidate, baseSelection.selectedDecisions);
      return decision ? buildCandidateSignal(candidate, decision) : undefined;
    })
    .filter((signal): signal is CandidateSignal => Boolean(signal));
  const leadSignal = candidateSignals.length
    ? [...candidateSignals].sort((a, b) => signalStrength(b) - signalStrength(a))[0]
    : null;
  const selectionResult = orderSelectionByLead(baseSelection, leadSignal);
  const rejectedSignals = baseSelection.rejectedDecisions.map((decision) => ({
    resourceUrl: decision.url,
    resourceTitle: decision.title,
    rejectionReason: decision.rejectionReason || decision.skippedBecause,
    formationReason: `Not formed as a Lead Signal: ${decision.rejectionReason || decision.skippedBecause || "lower signal strength"}.`
  }));
  const signalFormationReasons = [
    `Evaluated ${baseSelection.selectedCandidates.length} selected candidates as deterministic Lead Signal candidates.`,
    leadSignal
      ? `Selected "${leadSignal.claim}" as Lead Signal using editorial score, workflow impact, actionability, Monday Morning change, DS evidence, and mission match.`
      : "No Lead Signal formed because no candidate survived editorial selection."
  ];

  return {
    selectionResult,
    leadSignal,
    candidateSignals,
    rejectedSignals,
    signalFormationReasons
  };
}
