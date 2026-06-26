import type { CandidateResource } from "./collectCandidates.js";
import {
  selectEditorialCandidates,
  type EditorialSelectionDecision,
  type EditorialSelectionResult
} from "./editorialSelection.js";

export type EvidenceStance = "supports" | "contradicts";
export type EvidenceRole = "lead" | "corroborating" | "context" | "counter";

export type SignalEvidence = {
  resourceRef: {
    title: string;
    url: string;
    source: string;
  };
  stance: EvidenceStance;
  role: EvidenceRole;
  contribution: string;
  independenceMarker: string;
  editorialWeight?: number | null;
};

export type CandidateSignal = {
  role: "lead";
  claim: string;
  whyNow: string;
  evidence: SignalEvidence[];
  evidenceCount: number;
  contradictingEvidenceCount: number;
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

export type EvidenceSetSummary = {
  evidenceCount: number;
  supportingEvidenceCount: number;
  contradictingEvidenceCount: number;
  leadEvidenceTitle: string;
  independenceMarkers: string[];
};

export type EditorialThesisResult = {
  selectionResult: EditorialSelectionResult;
  leadSignal: CandidateSignal | null;
  candidateSignals: CandidateSignal[];
  rejectedSignals: RejectedSignal[];
  signalFormationReasons: string[];
  evidenceSetSummary: EvidenceSetSummary;
  evidenceFormationReasons: string[];
  degenerateEvidenceSet: boolean;
};

type EvidenceCandidate = {
  candidate: CandidateResource;
  decision: EditorialSelectionDecision;
  evidence: SignalEvidence;
  strength: number;
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

function evidenceStrength(decision: EditorialSelectionDecision): number {
  const evidenceBonus = decision.designSystemTopics.length + decision.workflowTopics.length;
  const mondayBonus = decision.mondayMorningChange === "nothing" ? 0 : 8;
  const missionBonus = decision.editorialMissionMatch ? 10 : 0;
  const valueBonus = decision.editorialValueMatch ? 6 : 0;

  return (
    decision.editorialScore.totalScore +
    workflowImpactScore(decision) +
    decision.actionabilityScore * 3 +
    evidenceBonus +
    mondayBonus +
    missionBonus +
    valueBonus
  );
}

function signalStrength(signal: CandidateSignal): number {
  return evidenceStrength(signal.decision) + signal.evidenceCount * 3 - signal.contradictingEvidenceCount * 5;
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
  const topicFocus = [
    ...decision.designSystemTopics.slice(0, 2),
    ...decision.workflowTopics.slice(0, 2),
    ...decision.aiTopics.slice(0, 1)
  ].join(", ");
  const evidence = candidate.directDesignSystemEvidence.trim();

  if (decision.topicGroup === "Storybook") {
    return "Shows that Storybook evidence can become more machine-readable for AI-assisted component documentation, review, and agent consumption.";
  }

  if (decision.topicGroup === "Figma") {
    return "Shows how Figma metadata and design-to-code workflows can affect whether AI-generated implementation respects component intent.";
  }

  if (decision.topicGroup === "AI Research") {
    return "Provides research evidence that AI can influence UI implementation workflows when connected to concrete Design System metadata.";
  }

  if (decision.topicGroup === "Enterprise Practice") {
    return "Connects AI-assisted workflow change to governance, documentation, or agent-readiness concerns in a mature Design System setting.";
  }

  if (decision.topicGroup === "Tooling") {
    return "Shows a practical tooling path for turning Design System knowledge into repeatable AI-assisted implementation or review behavior.";
  }

  if (evidence) {
    return `Supports the claim through direct Design System evidence: ${evidence}`;
  }

  return `Supports the claim through ${topicFocus || "mature Design System workflow"} evidence tied to the selected resource.`;
}

function isCounterEvidence(decision: EditorialSelectionDecision): boolean {
  const text = `${decision.rejectionReason} ${decision.skippedBecause} ${decision.missionReason} ${decision.editorialValueReason}`.toLowerCase();
  return /\b(challenge|limits?|weakens?|complicat|contradict|counter|risk|not strong enough)\b/.test(text);
}

function buildEvidence(candidate: CandidateResource, decision: EditorialSelectionDecision): SignalEvidence {
  const stance: EvidenceStance = isCounterEvidence(decision) ? "contradicts" : "supports";

  return {
    resourceRef: {
      title: candidate.title,
      url: candidate.url,
      source: candidate.source
    },
    stance,
    role: stance === "contradicts" ? "counter" : "context",
    contribution: evidenceContribution(candidate, decision),
    independenceMarker: sourceDomain(candidate.url) || candidate.source,
    editorialWeight: roundScore(evidenceStrength(decision) / 100)
  };
}

function promoteCandidatesToEvidence(selectionResult: EditorialSelectionResult): EvidenceCandidate[] {
  return selectionResult.selectedCandidates
    .map((candidate) => {
      const decision = decisionForCandidate(candidate, selectionResult.selectedDecisions);
      if (!decision) return undefined;

      return {
        candidate,
        decision,
        evidence: buildEvidence(candidate, decision),
        strength: evidenceStrength(decision)
      };
    })
    .filter((item): item is EvidenceCandidate => Boolean(item));
}

function assignEvidenceRoles(evidenceCandidates: EvidenceCandidate[]): EvidenceCandidate[] {
  const ordered = [...evidenceCandidates].sort((a, b) => b.strength - a.strength);
  const strongestSupport = ordered.find((item) => item.evidence.stance === "supports");
  const leadStrength = strongestSupport?.strength ?? 0;

  return ordered.map((item) => {
    if (item.evidence.stance === "contradicts") {
      return {
        ...item,
        evidence: {
          ...item.evidence,
          role: "counter"
        }
      };
    }

    if (strongestSupport && item.candidate.url === strongestSupport.candidate.url) {
      return {
        ...item,
        evidence: {
          ...item.evidence,
          role: "lead"
        }
      };
    }

    const role: EvidenceRole = item.strength >= leadStrength * 0.75 ? "corroborating" : "context";
    return {
      ...item,
      evidence: {
        ...item.evidence,
        role
      }
    };
  });
}

function claimFor(decision: EditorialSelectionDecision, candidate: CandidateResource): string {
  return decision.editorialTitle || candidate.title;
}

function whyNowFor(lead: EvidenceCandidate, evidenceSet: SignalEvidence[]): string {
  const supportingSources = new Set(
    evidenceSet.filter((evidence) => evidence.stance === "supports").map((evidence) => evidence.independenceMarker)
  );
  const evidencePhrase =
    evidenceSet.length > 1
      ? `${evidenceSet.length} evidence items across ${supportingSources.size} independent source marker${supportingSources.size === 1 ? "" : "s"}`
      : "one strong evidence item";

  return `${lead.decision.selectedBecause || lead.decision.selectionReason} The M2.5 thesis path is grounded in ${evidencePhrase}.`;
}

function opportunityFor(lead: EvidenceCandidate): string {
  if (lead.decision.mondayMorningChange !== "nothing") {
    return lead.decision.mondayMorningChange;
  }

  return "Use the lead evidence to identify one mature Design System workflow that should become agent-readable.";
}

function buildCandidateSignal(lead: EvidenceCandidate, evidenceSet: SignalEvidence[]): CandidateSignal {
  const contradictingEvidenceCount = evidenceSet.filter((evidence) => evidence.stance === "contradicts").length;

  return {
    role: "lead",
    claim: claimFor(lead.decision, lead.candidate),
    whyNow: whyNowFor(lead, evidenceSet),
    evidence: evidenceSet,
    evidenceCount: evidenceSet.length,
    contradictingEvidenceCount,
    confidence: confidenceFor(lead.decision),
    editorialConviction: convictionFor(lead.decision),
    opportunity: opportunityFor(lead),
    resourceUrl: lead.candidate.url,
    resourceTitle: lead.candidate.title,
    formationReason: `Formed from ${evidenceSet.length} Evidence item${evidenceSet.length === 1 ? "" : "s"} with "${lead.candidate.title}" as lead evidence.`,
    decision: lead.decision
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

function evidenceSetSummaryFor(evidenceSet: SignalEvidence[]): EvidenceSetSummary {
  const leadEvidence = evidenceSet.find((evidence) => evidence.role === "lead");
  const independenceMarkers = Array.from(new Set(evidenceSet.map((evidence) => evidence.independenceMarker)));

  return {
    evidenceCount: evidenceSet.length,
    supportingEvidenceCount: evidenceSet.filter((evidence) => evidence.stance === "supports").length,
    contradictingEvidenceCount: evidenceSet.filter((evidence) => evidence.stance === "contradicts").length,
    leadEvidenceTitle: leadEvidence?.resourceRef.title ?? "",
    independenceMarkers
  };
}

function emptyEvidenceSetSummary(): EvidenceSetSummary {
  return {
    evidenceCount: 0,
    supportingEvidenceCount: 0,
    contradictingEvidenceCount: 0,
    leadEvidenceTitle: "",
    independenceMarkers: []
  };
}

export function selectEditorialThesis(candidatePool: CandidateResource[]): EditorialThesisResult {
  const baseSelection = selectEditorialCandidates(candidatePool);
  const promotedEvidence = assignEvidenceRoles(promoteCandidatesToEvidence(baseSelection));
  const evidenceSet = promotedEvidence.map((item) => item.evidence);
  const leadEvidence = promotedEvidence.find((item) => item.evidence.role === "lead");
  const leadSignal = leadEvidence ? buildCandidateSignal(leadEvidence, evidenceSet) : null;
  const selectionResult = orderSelectionByLead(baseSelection, leadSignal);
  const candidateSignals = leadSignal ? [leadSignal] : [];
  const rejectedSignals = baseSelection.rejectedDecisions.map((decision) => ({
    resourceUrl: decision.url,
    resourceTitle: decision.title,
    rejectionReason: decision.rejectionReason || decision.skippedBecause,
    formationReason: `Not promoted to Evidence: ${decision.rejectionReason || decision.skippedBecause || "lower evidence strength"}.`
  }));
  const evidenceSetSummary = evidenceSet.length ? evidenceSetSummaryFor(evidenceSet) : emptyEvidenceSetSummary();
  const degenerateEvidenceSet = evidenceSet.length === 1;
  const evidenceFormationReasons = [
    `Promoted ${baseSelection.selectedCandidates.length} selected qualified candidate${baseSelection.selectedCandidates.length === 1 ? "" : "s"} into Evidence.`,
    leadSignal
      ? `Assigned exactly one lead supporting Evidence item: "${leadSignal.resourceTitle}".`
      : "No Evidence set formed because no candidate survived editorial selection.",
    degenerateEvidenceSet
      ? "Evidence set is degenerate because only one valid Evidence item supported the Lead Signal."
      : `Evidence set includes ${evidenceSet.length} items with ${evidenceSetSummary.contradictingEvidenceCount} contradicting item${evidenceSetSummary.contradictingEvidenceCount === 1 ? "" : "s"}.`
  ];
  const signalFormationReasons = [
    `Evaluated ${baseSelection.selectedCandidates.length} selected candidates as Evidence candidates before Lead Signal formation.`,
    leadSignal
      ? `Selected "${leadSignal.claim}" as Lead Signal from first-class Evidence using editorial score, workflow impact, actionability, Monday Morning change, DS evidence, and mission match.`
      : "No Lead Signal formed because no Evidence item survived editorial selection."
  ];

  return {
    selectionResult,
    leadSignal,
    candidateSignals,
    rejectedSignals,
    signalFormationReasons,
    evidenceSetSummary,
    evidenceFormationReasons,
    degenerateEvidenceSet
  };
}
