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

export type EvidenceGroup = {
  groupKey: string;
  claim: string;
  evidenceCount: number;
  supportingEvidenceCount: number;
  contradictingEvidenceCount: number;
  leadEvidenceTitle: string;
  totalStrength: number;
  qualityAdjustedScore: number;
  uniqueIndependenceMarkerCount: number;
  sourceFamilyCount: number;
  repeatedSourcePenalty: number;
  contributionSimilarityPenalty: number;
  crossSurfaceScore: number;
  workflowImpactScore: number;
  actionabilityScore: number;
  groupQualityReason: string;
};

export type EditorialDeliberationStory = {
  story: string;
  themeAnchor: string;
  clusterIndexes: number[];
  clusterClaims: string[];
  evidenceCount: number;
  qualityAdjustedScore: number;
  reasoning: string;
};

export type EditorialDeliberationMerge = {
  clusterIndexes: number[];
  clusterClaims: string[];
  mergedStory: string;
  reason: string;
};

export type EditorialDeliberationDecision = {
  detectedStories: EditorialDeliberationStory[];
  mergedClusters: EditorialDeliberationMerge[];
  dominantStory: EditorialDeliberationStory | null;
  secondaryStories: EditorialDeliberationStory[];
  reasoning: string[];
};

export type EvidencePromotionRejection = {
  title: string;
  url: string;
  source: string;
  reason: string;
};

export type HiddenEvidenceReason = {
  resourceRef: SignalEvidence["resourceRef"];
  reason: string;
};

export type SupportingResourceRankingEntry = {
  title: string;
  url: string;
  source: string;
  dsSpecificityScore: number;
  genericAIPenalty: number;
  reason: string;
};

export type SupportingResourceRankingDebug = {
  candidatesConsidered: number;
  selected: SupportingResourceRankingEntry[];
  rejected: SupportingResourceRankingEntry[];
};

export type EvidenceReasoningEntry = {
  title: string;
  url: string;
  source: string;
  role: EvidenceRole;
  uniqueContribution: string;
  duplicateWith: string | null;
  status: "kept" | "discarded";
  reason: string;
};

export type EvidenceReasoningDebug = {
  entries: EvidenceReasoningEntry[];
  keptCount: number;
  discardedCount: number;
  reasoning: string[];
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
  evidencePromotionInputCount: number;
  promotedEvidenceCount: number;
  evidenceGroups: EvidenceGroup[];
  editorialDeliberation: EditorialDeliberationDecision;
  leadSignalSelectionReason: string;
  runnerUpEvidenceGroups: EvidenceGroup[];
  evidencePromotionRejections: EvidencePromotionRejection[];
  representativeLeadEvidence: SignalEvidence | null;
  representativeSupportingEvidence: SignalEvidence[];
  representativeSelectionReasons: string[];
  hiddenEvidenceCount: number;
  hiddenEvidenceReasons: HiddenEvidenceReason[];
  renderedResourceCount: number;
  renderedResourceTitles: string[];
  evidenceReasoning: EvidenceReasoningDebug;
  supportingResourceRanking: SupportingResourceRankingDebug;
};

type EvidenceCandidate = {
  candidate: CandidateResource;
  decision: EditorialSelectionDecision;
  evidence: SignalEvidence;
  strength: number;
  groupKey: string;
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

function hasStrongDirectDesignSystemEvidence(candidate: CandidateResource, decision: EditorialSelectionDecision): boolean {
  return (
    candidate.directDesignSystemEvidence.trim().length > 0 ||
    decision.designSystemTopics.length > 0 ||
    decision.workflowTopics.length > 0 ||
    decision.editorialScore.designSystemScore >= 8 ||
    decision.editorialScore.workflowScore >= 8
  );
}

function hasMeaningfulDsAiRelevance(candidate: CandidateResource, decision: EditorialSelectionDecision): boolean {
  return (
    decision.editorialMissionMatch &&
    (decision.aiTopics.length > 0 || decision.editorialScore.aiScore > 0) &&
    hasStrongDirectDesignSystemEvidence(candidate, decision)
  );
}

function evidencePromotionRejectionReason(candidate: CandidateResource, decision: EditorialSelectionDecision): string {
  if (!decision.editorialMissionMatch) {
    return "Not promoted: candidate does not match the DS × AI mission.";
  }

  if (!decision.editorialValueMatch) {
    return "Not promoted: candidate does not show concrete editorial value for mature Design System work.";
  }

  if (decision.editorialScore.beginnerPenalty >= 20) {
    return "Not promoted: candidate reads as beginner Design System education.";
  }

  if (decision.editorialScore.marketingPenalty >= 10) {
    return "Not promoted: candidate looks primarily like marketing or sales material.";
  }

  if (decision.editorialScore.genericPenalty >= 20) {
    return "Not promoted: candidate is too generic for thesis evidence.";
  }

  if (!hasMeaningfulDsAiRelevance(candidate, decision)) {
    return "Not promoted: candidate lacks meaningful DS × AI relevance.";
  }

  if (decision.editorialScore.totalScore < 30 && !hasStrongDirectDesignSystemEvidence(candidate, decision)) {
    return `Not promoted: editorial score ${decision.editorialScore.totalScore} is below threshold and direct Design System evidence is weak.`;
  }

  return "";
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

function sourceFamilyFor(candidate: CandidateResource): string {
  const domain = sourceDomain(candidate.url);
  if (domain) return domain.replace(/^api\./, "");
  return candidate.source.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function candidateText(candidate: CandidateResource): string {
  return `${candidate.title} ${candidate.source} ${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText}`.toLowerCase();
}

function isReleaseLike(candidate: CandidateResource): boolean {
  const text = `${candidate.title} ${candidate.source} ${candidate.url}`.toLowerCase();
  return /\b(release|changelog|alpha|beta|rc|v\d+\.\d+|\d+\.\d+\.\d+)\b/.test(text);
}

function normalizedTitle(value: string): string {
  return value.toLowerCase().replace(/\bv?\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?\b/g, "version").replace(/[^a-z0-9]+/g, " ").trim();
}

function repoKeyFor(candidate: CandidateResource): string {
  try {
    const url = new URL(candidate.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.includes("github.com") && parts.length >= 2) {
      return `${url.hostname}/${parts[0]}/${parts[1]}`.toLowerCase();
    }
  } catch {
    // Ignore malformed URLs; fall through to source family.
  }

  return sourceFamilyFor(candidate);
}

function releaseFamilyFor(candidate: CandidateResource): string {
  if (!isReleaseLike(candidate)) {
    return "";
  }

  return `${repoKeyFor(candidate)}:${normalizedTitle(candidate.title).replace(/\bversion\b/g, "release")}`;
}

function evidenceContribution(candidate: CandidateResource, decision: EditorialSelectionDecision): string {
  const topicFocus = [
    ...decision.designSystemTopics.slice(0, 2),
    ...decision.workflowTopics.slice(0, 2),
    ...decision.aiTopics.slice(0, 1)
  ].join(", ");
  const evidence = candidate.directDesignSystemEvidence.trim();
  const text = candidateText(candidate);

  if (decision.topicGroup === "Storybook") {
    if (text.includes("preset") || text.includes("metadata")) {
      return "Reveals Storybook turning preset and component metadata into context agents can consume.";
    }

    if (text.includes("cli") || text.includes("mcp")) {
      return "Marks the AI CLI/MCP path moving from experiment toward repeatable component-aware assistance.";
    }

    if (text.includes("manifest") || text.includes("docgen")) {
      return "Places manifest and docgen work inside the AI-readable component surface.";
    }

    return "Positions Storybook documentation as machine-readable context for component review and agent consumption.";
  }

  if (decision.topicGroup === "Figma") {
    return "Reveals how Figma metadata affects whether design-to-code output respects component intent.";
  }

  if (decision.topicGroup === "AI Research") {
    return "Provides research evidence that AI can influence UI implementation workflows when connected to concrete Design System metadata.";
  }

  if (decision.topicGroup === "Enterprise Practice") {
    return "Connects AI-assisted workflow change to governance, documentation, or agent-readiness concerns in a mature Design System setting.";
  }

  if (decision.topicGroup === "Tooling") {
    return "Maps a practical tooling path from Design System knowledge to repeatable AI-assisted implementation or review.";
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

function groupKeyFor(decision: EditorialSelectionDecision): string {
  if (decision.editorialTitle) return decision.editorialTitle;
  if (decision.topicGroup !== "Other") return decision.topicGroup;
  return decision.designSystemTopics[0] ?? decision.workflowTopics[0] ?? decision.aiTopics[0] ?? "Unclassified";
}

function promoteCandidatesToEvidence(
  candidatePool: CandidateResource[],
  selectionResult: EditorialSelectionResult
): {
  promotedEvidence: EvidenceCandidate[];
  evidencePromotionRejections: EvidencePromotionRejection[];
} {
  const promotedEvidence: EvidenceCandidate[] = [];
  const evidencePromotionRejections: EvidencePromotionRejection[] = [];

  for (const candidate of candidatePool) {
    const decision = decisionForCandidate(candidate, selectionResult.decisions);
    if (!decision) {
      evidencePromotionRejections.push({
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        reason: "Not promoted: candidate had no editorial decision metadata."
      });
      continue;
    }

    const rejectionReason = evidencePromotionRejectionReason(candidate, decision);
    if (rejectionReason) {
      evidencePromotionRejections.push({
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        reason: rejectionReason
      });
      continue;
    }

    promotedEvidence.push({
      candidate,
      decision,
      evidence: buildEvidence(candidate, decision),
      strength: evidenceStrength(decision),
      groupKey: groupKeyFor(decision)
    });
  }

  return {
    promotedEvidence,
    evidencePromotionRejections
  };
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

function groupEvidenceCandidates(evidenceCandidates: EvidenceCandidate[]): EvidenceCandidate[][] {
  const groups = new Map<string, EvidenceCandidate[]>();

  for (const item of evidenceCandidates) {
    const existing = groups.get(item.groupKey) ?? [];
    existing.push(item);
    groups.set(item.groupKey, existing);
  }

  return Array.from(groups.values()).map((group) => assignEvidenceRoles(group));
}

function evidenceGroupStrength(group: EvidenceCandidate[]): number {
  const supportingCount = group.filter((item) => item.evidence.stance === "supports").length;
  const independentMarkers = new Set(group.map((item) => item.evidence.independenceMarker)).size;
  return group.reduce((total, item) => total + item.strength, 0) + supportingCount * 5 + independentMarkers * 4;
}

function normalizeContribution(value: string): string {
  return value.toLowerCase().replace(/["'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 96);
}

function crossSurfaceScoreFor(group: EvidenceCandidate[]): number {
  const surfaces = new Set<string>();

  for (const item of group) {
    for (const topic of item.decision.designSystemTopics) surfaces.add(topic);
    for (const topic of item.decision.workflowTopics) surfaces.add(topic);
    if (item.decision.topicGroup !== "Other") surfaces.add(item.decision.topicGroup);
  }

  return Math.min(28, surfaces.size * 4);
}

function groupWorkflowImpactScore(group: EvidenceCandidate[]): number {
  return Math.min(40, Math.round(group.reduce((total, item) => total + workflowImpactScore(item.decision), 0) / Math.max(1, group.length)));
}

function groupActionabilityScore(group: EvidenceCandidate[]): number {
  return Math.min(30, group.reduce((total, item) => total + item.decision.actionabilityScore, 0));
}

function repeatedSourcePenaltyFor(group: EvidenceCandidate[]): number {
  const evidenceCount = group.length;
  const uniqueIndependenceMarkerCount = new Set(group.map((item) => item.evidence.independenceMarker)).size;
  const sourceFamilyCount = new Set(group.map((item) => sourceFamilyFor(item.candidate))).size;
  const allReleaseLike = evidenceCount > 1 && group.every((item) => isReleaseLike(item.candidate));
  let penalty = Math.max(0, evidenceCount - uniqueIndependenceMarkerCount) * 18;

  if (evidenceCount > 1 && uniqueIndependenceMarkerCount === 1) penalty += 28;
  if (evidenceCount > 1 && sourceFamilyCount === 1) penalty += 18;
  if (allReleaseLike && uniqueIndependenceMarkerCount === 1 && sourceFamilyCount === 1) penalty += 35;

  return penalty;
}

function contributionSimilarityPenaltyFor(group: EvidenceCandidate[]): number {
  const contributions = group.map((item) => normalizeContribution(item.evidence.contribution));
  const uniqueContributions = new Set(contributions).size;
  let penalty = Math.max(0, group.length - uniqueContributions) * 12;

  if (group.length > 1 && uniqueContributions === 1) penalty += 24;

  return penalty;
}

function evidenceGroupQuality(group: EvidenceCandidate[]): EvidenceGroup {
  const evidenceSet = group.map((item) => item.evidence);
  const lead = group.find((item) => item.evidence.role === "lead") ?? group[0];
  const totalStrength = roundScore(evidenceGroupStrength(group));
  const uniqueIndependenceMarkerCount = new Set(group.map((item) => item.evidence.independenceMarker)).size;
  const sourceFamilyCount = new Set(group.map((item) => sourceFamilyFor(item.candidate))).size;
  const repeatedSourcePenalty = repeatedSourcePenaltyFor(group);
  const contributionSimilarityPenalty = contributionSimilarityPenaltyFor(group);
  const crossSurfaceScore = crossSurfaceScoreFor(group);
  const workflowImpactScoreValue = groupWorkflowImpactScore(group);
  const actionabilityScore = groupActionabilityScore(group);
  const qualityAdjustedScore = roundScore(
    totalStrength +
      crossSurfaceScore +
      workflowImpactScoreValue +
      actionabilityScore -
      repeatedSourcePenalty -
      contributionSimilarityPenalty
  );
  const groupQualityReason =
    uniqueIndependenceMarkerCount === 1 && group.length > 1
      ? `Penalized for ${group.length} evidence items sharing one independence marker.`
      : `Rewarded for ${uniqueIndependenceMarkerCount} independence markers across ${sourceFamilyCount} source families.`;

  return {
    groupKey: lead?.groupKey ?? "",
    claim: lead ? claimFor(lead.decision, lead.candidate) : "",
    evidenceCount: evidenceSet.length,
    supportingEvidenceCount: evidenceSet.filter((evidence) => evidence.stance === "supports").length,
    contradictingEvidenceCount: evidenceSet.filter((evidence) => evidence.stance === "contradicts").length,
    leadEvidenceTitle: lead?.evidence.resourceRef.title ?? "",
    totalStrength,
    qualityAdjustedScore,
    uniqueIndependenceMarkerCount,
    sourceFamilyCount,
    repeatedSourcePenalty,
    contributionSimilarityPenalty,
    crossSurfaceScore,
    workflowImpactScore: workflowImpactScoreValue,
    actionabilityScore,
    groupQualityReason
  };
}

function selectLeadEvidenceGroup(groups: EvidenceCandidate[][]): EvidenceCandidate[] {
  return [...groups].sort((a, b) => evidenceGroupQuality(b).qualityAdjustedScore - evidenceGroupQuality(a).qualityAdjustedScore)[0] ?? [];
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

function representativeRolePriority(item: EvidenceCandidate): number {
  if (item.evidence.role === "lead") return 35;
  if (item.evidence.role === "corroborating") return 22;
  if (item.evidence.role === "context") return 12;
  return 4;
}

function surfaceSetFor(item: EvidenceCandidate): Set<string> {
  return new Set([
    ...item.decision.workflowTopics,
    ...item.decision.designSystemTopics,
    ...item.decision.aiTopics,
    item.decision.topicGroup
  ]);
}

function dsSpecificityScore(item: EvidenceCandidate): number {
  const text = `${item.candidate.title} ${item.candidate.source} ${item.candidate.url} ${item.candidate.snippet} ${item.candidate.cleanSummary} ${
    item.candidate.directDesignSystemEvidence
  }`.toLowerCase();
  let score = 0;

  const add = (points: number, pattern: RegExp) => {
    if (pattern.test(text)) score += points;
  };

  score += item.decision.designSystemTopics.length * 6;
  score += item.decision.workflowTopics.length * 5;
  add(12, /design systems?|component librar|component api|component metadata|component manifest/i);
  add(10, /storybook|figma|code connect|dev mode|design-to-code|design to code/i);
  add(8, /design tokens?|documentation|accessibility|governance|\bqa\b|azure devops/i);
  add(8, /mcp|ai agents?|internal agents?|copilot/i);
  add(6, /react native|\breact\b|component generation|code generation/i);

  return Math.min(60, score);
}

function genericAIPenalty(item: EvidenceCandidate): number {
  const text = `${item.candidate.title} ${item.candidate.source} ${item.candidate.url} ${item.candidate.snippet} ${item.candidate.cleanSummary}`.toLowerCase();
  const genericAi =
    item.decision.topicGroup === "AI Research" ||
    /\barxiv\b|llm|rag|benchmark|reasoning|agent/i.test(text);
  const directDs =
    item.decision.designSystemTopics.length > 0 ||
    /figma|storybook|design systems?|design-to-code|design to code|component metadata|component api|design tokens?|accessibility|\bqa\b|documentation/i.test(
      text
    );

  return genericAi && !directDs ? 45 : genericAi && item.decision.designSystemTopics.length === 0 ? 25 : 0;
}

function representativeScore(item: EvidenceCandidate, selected: EvidenceCandidate[]): {
  finalRepresentativeScore: number;
  reason: string;
  redundancyPenalty: number;
  releaseFamilyPenalty: number;
  sameRepoPenalty: number;
  sameTitlePenalty: number;
  dsSpecificityScore: number;
  genericAIPenalty: number;
} {
  const baseEvidenceWeight = item.evidence.editorialWeight ? item.evidence.editorialWeight * 20 : item.strength / 5;
  const rolePriority = representativeRolePriority(item);
  const selectedSourceFamilies = new Set(selected.map((selectedItem) => sourceFamilyFor(selectedItem.candidate)));
  const selectedRepos = new Set(selected.map((selectedItem) => repoKeyFor(selectedItem.candidate)));
  const selectedReleaseFamilies = new Set(selected.map((selectedItem) => releaseFamilyFor(selectedItem.candidate)).filter(Boolean));
  const selectedTitles = new Set(selected.map((selectedItem) => normalizedTitle(selectedItem.candidate.title)));
  const selectedSurfaces = new Set(selected.flatMap((selectedItem) => Array.from(surfaceSetFor(selectedItem))));
  const itemSurfaces = Array.from(surfaceSetFor(item));
  const newSurfaceCount = itemSurfaces.filter((surface) => !selectedSurfaces.has(surface)).length;
  const sourceDiversityBonus = selectedSourceFamilies.has(sourceFamilyFor(item.candidate)) ? 0 : 14;
  const workflowSurfaceDiversityBonus = newSurfaceCount * 3;
  const designSystemSurfaceDiversityBonus = item.decision.designSystemTopics.some((topic) => !selectedSurfaces.has(topic)) ? 8 : 0;
  const redundancyPenalty = selectedSourceFamilies.has(sourceFamilyFor(item.candidate)) ? 28 : 0;
  const releaseFamily = releaseFamilyFor(item.candidate);
  const releaseFamilyPenalty = releaseFamily && selectedReleaseFamilies.has(releaseFamily) ? 36 : 0;
  const sameRepoPenalty = selectedRepos.has(repoKeyFor(item.candidate)) ? 24 : 0;
  const sameTitlePenalty = selectedTitles.has(normalizedTitle(item.candidate.title)) ? 30 : 0;
  const directDsScore = dsSpecificityScore(item);
  const aiAdjacencyPenalty = genericAIPenalty(item);
  const finalRepresentativeScore = roundScore(
    baseEvidenceWeight +
      rolePriority +
      sourceDiversityBonus +
      workflowSurfaceDiversityBonus +
      designSystemSurfaceDiversityBonus -
      aiAdjacencyPenalty +
      directDsScore -
      redundancyPenalty -
      releaseFamilyPenalty -
      sameRepoPenalty -
      sameTitlePenalty
  );

  return {
    finalRepresentativeScore,
    reason: `Representative score ${finalRepresentativeScore}: base ${roundScore(baseEvidenceWeight)}, role ${rolePriority}, source diversity ${sourceDiversityBonus}, DS specificity ${directDsScore}, generic AI penalty ${aiAdjacencyPenalty}, workflow/design-surface diversity ${
      workflowSurfaceDiversityBonus + designSystemSurfaceDiversityBonus
    }, penalties ${redundancyPenalty + releaseFamilyPenalty + sameRepoPenalty + sameTitlePenalty}.`,
    redundancyPenalty,
    releaseFamilyPenalty,
    sameRepoPenalty,
    sameTitlePenalty,
    dsSpecificityScore: directDsScore,
    genericAIPenalty: aiAdjacencyPenalty
  };
}

function rankingEntryFor(item: EvidenceCandidate, selected: EvidenceCandidate[]): SupportingResourceRankingEntry {
  const score = representativeScore(item, selected);
  return {
    title: item.candidate.title,
    url: item.candidate.url,
    source: item.candidate.source,
    dsSpecificityScore: score.dsSpecificityScore,
    genericAIPenalty: score.genericAIPenalty,
    reason: score.reason
  };
}

function evidenceReasoningQuestion(role: EvidenceRole): string {
  if (role === "lead") return "What makes the thesis real?";
  if (role === "corroborating") return "What independent observation points in the same direction?";
  if (role === "counter") return "What limits or qualifies this conclusion?";
  return "What helps explain this shift?";
}

function uniqueContributionFor(item: EvidenceCandidate): string {
  const text = `${item.evidence.contribution} ${item.candidate.title} ${item.candidate.cleanSummary} ${item.candidate.directDesignSystemEvidence}`.toLowerCase();

  if (/accessibility|a11y|wcag/.test(text)) return "Accessibility is becoming part of AI-assisted Design System verification.";
  if (/\bqa\b|test|regression|review/.test(text)) return "QA rules are becoming enforceable checks for assisted delivery.";
  if (/governance|ownership|policy|standards/.test(text)) return "Governance is becoming an operating constraint for AI-assisted changes.";
  if (/tokens?|variables?|semantic/.test(text)) return "Token intent is becoming operational context, not naming convention.";
  if (/figma|design-to-code|design to code|code generation|component generation/.test(text)) {
    return "Figma metadata is shaping whether generated UI can reuse system components.";
  }
  if (/storybook|component metadata|manifest|docgen|mcp|machine-readable|machine readable/.test(text)) {
    return "Component metadata is becoming executable knowledge for agents.";
  }
  if (/docs?|documentation|rag|agent-readable|agent readable/.test(text)) {
    return "Documentation is becoming machine-readable system context.";
  }
  if (/component api|react native|\breact\b/.test(text)) return "Implementation APIs are becoming part of the AI-readable system surface.";

  return item.evidence.contribution;
}

function normalizedContribution(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function emptyEvidenceReasoning(): EvidenceReasoningDebug {
  return {
    entries: [],
    keptCount: 0,
    discardedCount: 0,
    reasoning: ["No Evidence reached the reasoning pass."]
  };
}

function reasonEvidence(items: EvidenceCandidate[], leadUrl: string): {
  kept: EvidenceCandidate[];
  discarded: EvidenceCandidate[];
  debug: EvidenceReasoningDebug;
} {
  if (items.length === 0) {
    return {
      kept: [],
      discarded: [],
      debug: emptyEvidenceReasoning()
    };
  }

  const ordered = [...items].sort((a, b) => {
    if (a.candidate.url === leadUrl) return -1;
    if (b.candidate.url === leadUrl) return 1;
    const roleDifference = representativeRolePriority(b) - representativeRolePriority(a);
    if (roleDifference !== 0) return roleDifference;
    return b.strength - a.strength;
  });
  const contributionOwners = new Map<string, EvidenceCandidate>();
  const kept: EvidenceCandidate[] = [];
  const discarded: EvidenceCandidate[] = [];
  const entries: EvidenceReasoningEntry[] = [];

  for (const item of ordered) {
    const uniqueContribution = uniqueContributionFor(item);
    const contributionKey = normalizedContribution(uniqueContribution);
    const duplicate = contributionOwners.get(contributionKey);
    const isLead = item.candidate.url === leadUrl;

    if (duplicate && !isLead) {
      discarded.push(item);
      entries.push({
        title: item.evidence.resourceRef.title,
        url: item.evidence.resourceRef.url,
        source: item.evidence.resourceRef.source,
        role: item.evidence.role,
        uniqueContribution,
        duplicateWith: duplicate.evidence.resourceRef.title,
        status: "discarded",
        reason: "No additional explanatory value beyond an Evidence item already covering this contribution."
      });
      continue;
    }

    kept.push(item);
    contributionOwners.set(contributionKey, item);
    entries.push({
      title: item.evidence.resourceRef.title,
      url: item.evidence.resourceRef.url,
      source: item.evidence.resourceRef.source,
      role: item.evidence.role,
      uniqueContribution,
      duplicateWith: null,
      status: "kept",
      reason: `${evidenceReasoningQuestion(item.evidence.role)} ${uniqueContribution}`
    });
  }

  return {
    kept,
    discarded,
    debug: {
      entries,
      keptCount: kept.length,
      discardedCount: discarded.length,
      reasoning: [
        `Evaluated ${items.length} Evidence item${items.length === 1 ? "" : "s"} for distinct editorial contribution.`,
        `Kept ${kept.length} Evidence item${kept.length === 1 ? "" : "s"} and discarded ${discarded.length} duplicate contribution${discarded.length === 1 ? "" : "s"}.`,
        "Evidence Reasoning does not edit Evidence; it decides which contributions should survive into representative supporting resources."
      ]
    }
  };
}

function hiddenReasonFor(item: EvidenceCandidate, selected: EvidenceCandidate[]): string {
  const selectedTitles = new Set(selected.map((selectedItem) => normalizedTitle(selectedItem.candidate.title)));
  const selectedSourceFamilies = new Set(selected.map((selectedItem) => sourceFamilyFor(selectedItem.candidate)));
  const selectedRepos = new Set(selected.map((selectedItem) => repoKeyFor(selectedItem.candidate)));
  const selectedReleaseFamilies = new Set(selected.map((selectedItem) => releaseFamilyFor(selectedItem.candidate)).filter(Boolean));
  const releaseFamily = releaseFamilyFor(item.candidate);

  if (selectedTitles.has(normalizedTitle(item.candidate.title))) return "duplicate title";
  if (releaseFamily && selectedReleaseFamilies.has(releaseFamily)) return "same release family";
  if (selectedRepos.has(repoKeyFor(item.candidate))) return "same repo";
  if (selectedSourceFamilies.has(sourceFamilyFor(item.candidate))) return "same source family";
  return "lower representative score than selected item";
}

function representativeEvidenceGroup(leadGroup: EvidenceCandidate[], leadUrl: string): {
  representatives: EvidenceCandidate[];
  representativeSelectionReasons: string[];
  hiddenEvidenceReasons: HiddenEvidenceReason[];
  evidenceReasoning: EvidenceReasoningDebug;
  supportingResourceRanking: SupportingResourceRankingDebug;
} {
  const lead = leadGroup.find((item) => item.candidate.url === leadUrl);
  if (!lead) {
    return {
      representatives: [],
      representativeSelectionReasons: ["No representative Evidence selected because no lead Evidence item exists."],
      hiddenEvidenceReasons: leadGroup.map((item) => ({
        resourceRef: item.evidence.resourceRef,
        reason: "lower representative score than selected item"
      })),
      supportingResourceRanking: {
        candidatesConsidered: leadGroup.length,
        selected: [],
        rejected: leadGroup.map((item) => rankingEntryFor(item, []))
      },
      evidenceReasoning: emptyEvidenceReasoning()
    };
  }

  const reasoning = reasonEvidence(leadGroup, leadUrl);
  const reasonedLead = reasoning.kept.find((item) => item.candidate.url === leadUrl) ?? lead;
  const representatives: EvidenceCandidate[] = [reasonedLead];
  const representativeSelectionReasons = [`Selected lead representative Evidence: "${lead.evidence.resourceRef.title}".`];
  const remaining = reasoning.kept.filter((item) => item.candidate.url !== leadUrl);
  const rankingCandidates = leadGroup.filter((item) => item.candidate.url !== leadUrl);

  while (representatives.length < 4 && remaining.length > 0) {
    const scored = remaining
      .map((item) => ({ item, score: representativeScore(item, representatives) }))
      .sort((a, b) => b.score.finalRepresentativeScore - a.score.finalRepresentativeScore);
    const next = scored[0];

    if (!next || next.score.finalRepresentativeScore < 20) {
      break;
    }

    representatives.push(next.item);
    representativeSelectionReasons.push(`Selected supporting representative "${next.item.evidence.resourceRef.title}". ${next.score.reason}`);
    remaining.splice(remaining.indexOf(next.item), 1);
  }

  const hiddenEvidenceReasons = [
    ...reasoning.discarded.map((item) => ({
      resourceRef: item.evidence.resourceRef,
      reason: "duplicate editorial contribution"
    })),
    ...remaining.map((item) => ({
      resourceRef: item.evidence.resourceRef,
      reason: hiddenReasonFor(item, representatives)
    }))
  ];
  const selectedSupporting = representatives.filter((item) => item.candidate.url !== leadUrl);

  return {
    representatives,
    representativeSelectionReasons,
    hiddenEvidenceReasons,
    evidenceReasoning: reasoning.debug,
    supportingResourceRanking: {
      candidatesConsidered: rankingCandidates.length,
      selected: selectedSupporting.map((item) => rankingEntryFor(item, representatives.filter((selectedItem) => selectedItem !== item))),
      rejected: [...reasoning.discarded, ...remaining].map((item) => rankingEntryFor(item, representatives))
    }
  };
}

function selectionFromLeadEvidence(
  selectionResult: EditorialSelectionResult,
  leadGroup: EvidenceCandidate[],
  leadSignal: CandidateSignal | null,
  representatives: EvidenceCandidate[]
): EditorialSelectionResult {
  if (!leadSignal) {
    return {
      ...selectionResult,
      selectedCandidates: [],
      selectedDecisions: [],
      decisions: selectionResult.rejectedDecisions,
      editorsPickCandidate: undefined
    };
  }

  const leadUrl = leadSignal.resourceUrl;
  const selectedCandidates = [
    ...representatives.filter((item) => item.candidate.url === leadUrl).map((item) => item.candidate),
    ...representatives.filter((item) => item.candidate.url !== leadUrl).map((item) => item.candidate)
  ];
  const selectedDecisions = [
    ...representatives.filter((item) => item.candidate.url === leadUrl).map((item) => ({
      ...item.decision,
      selectedBecause: item.decision.selectedBecause || `Selected as lead Evidence for "${leadSignal.claim}".`,
      skippedBecause: ""
    })),
    ...representatives.filter((item) => item.candidate.url !== leadUrl).map((item) => ({
      ...item.decision,
      selectedBecause: item.decision.selectedBecause || `Selected as ${item.evidence.role} Evidence for "${leadSignal.claim}".`,
      skippedBecause: ""
    }))
  ];
  const selectedUrls = new Set(selectedCandidates.map((candidate) => candidate.url));
  const rejectedDecisions = selectionResult.decisions
    .filter((decision) => !selectedUrls.has(decision.url))
    .map((decision) => ({
      ...decision,
      selectedBecause: "",
      skippedBecause: decision.skippedBecause || decision.rejectionReason || "Not part of the selected Lead Signal evidence set."
    }));

  return {
    ...selectionResult,
    selectedCandidates,
    selectedDecisions,
    rejectedDecisions,
    decisions: [...selectedDecisions, ...rejectedDecisions],
    qualifyingCandidateCount: selectedCandidates.length,
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

function evidenceGroupsFor(groups: EvidenceCandidate[][]): EvidenceGroup[] {
  return groups.map(evidenceGroupQuality).sort((a, b) => b.qualityAdjustedScore - a.qualityAdjustedScore);
}

function emptyEditorialDeliberation(): EditorialDeliberationDecision {
  return {
    detectedStories: [],
    mergedClusters: [],
    dominantStory: null,
    secondaryStories: [],
    reasoning: ["No thematic clusters reached Editorial Deliberation."]
  };
}

function storyTextFor(group: EvidenceCandidate[]): string {
  return group
    .map((item) =>
      [
        item.groupKey,
        item.decision.editorialTitle,
        item.decision.topicGroup,
        ...item.decision.designSystemTopics,
        ...item.decision.workflowTopics,
        ...item.decision.aiTopics,
        item.evidence.contribution,
        item.candidate.title,
        item.candidate.cleanSummary,
        item.candidate.directDesignSystemEvidence
      ].join(" ")
    )
    .join(" ")
    .toLowerCase();
}

function storyTerms(value: string): Set<string> {
  const stopWords = new Set([
    "this",
    "that",
    "with",
    "from",
    "into",
    "where",
    "when",
    "they",
    "their",
    "system",
    "systems",
    "design",
    "component",
    "components"
  ]);

  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
  );
}

function sharedStoryTermCount(left: string, right: string): number {
  const leftTerms = storyTerms(left);
  const rightTerms = storyTerms(right);
  let shared = 0;
  for (const term of leftTerms) {
    if (rightTerms.has(term)) shared += 1;
  }
  return shared;
}

function executableKnowledgeStory(text: string): boolean {
  return /\b(mcp|metadata|machine-readable|machine readable|docgen|manifest|documentation automation|design-to-code|design to code|code generation|component api|component generation)\b/i.test(
    text
  );
}

function storyThemeAnchorFor(groups: EvidenceCandidate[][]): string {
  const text = groups.map(storyTextFor).join(" ");
  const anchors: string[] = [];
  const add = (label: string, pattern: RegExp) => {
    if (pattern.test(text) && !anchors.includes(label)) anchors.push(label);
  };

  add("Storybook metadata", /\bstorybook\b|manifest|docgen|component metadata/i);
  add("Design-to-code", /design-to-code|design to code|code generation|component generation|figma metadata/i);
  add("Figma", /\bfigma\b|code connect|dev mode/i);
  add("AI agents", /\bagents?\b|mcp|copilot|llm/i);
  add("Documentation", /docs?|documentation|machine-readable|metadata/i);
  add("Accessibility", /accessibility|a11y/i);
  add("Governance", /governance|ownership|policy|standards/i);
  add("Design tokens", /design tokens?|tokens?|variables?/i);

  return anchors.slice(0, 3).join(" + ") || "Design System workflow";
}

function storyTitleFor(groups: EvidenceCandidate[][]): string {
  const anchor = storyThemeAnchorFor(groups);
  const text = groups.map(storyTextFor).join(" ");

  if (/storybook|metadata|manifest|docgen|design-to-code|design to code|code generation|component generation/i.test(text)) {
    return "Structured Design System knowledge is becoming executable";
  }

  if (/accessibility|qa|test|regression/i.test(text)) {
    return "Design System review is moving toward automated verification";
  }

  if (/tokens?|variables?|semantic/i.test(text)) {
    return "Token intent is becoming operational AI context";
  }

  return `${anchor} is becoming the week’s main DS × AI story`;
}

function storyFromGroups(groups: EvidenceCandidate[][], clusterIndexes: number[], reasoning: string): EditorialDeliberationStory {
  const qualities = groups.map(evidenceGroupQuality);
  return {
    story: storyTitleFor(groups),
    themeAnchor: storyThemeAnchorFor(groups),
    clusterIndexes,
    clusterClaims: qualities.map((quality) => quality.claim),
    evidenceCount: qualities.reduce((total, quality) => total + quality.evidenceCount, 0),
    qualityAdjustedScore: roundScore(qualities.reduce((total, quality) => total + quality.qualityAdjustedScore, 0)),
    reasoning
  };
}

function mergeReason(left: EvidenceCandidate[][], right: EvidenceCandidate[]): string {
  const leftText = left.map(storyTextFor).join(" ");
  const rightText = storyTextFor(right);
  const sharedTerms = sharedStoryTermCount(leftText, rightText);
  const bothExecutable = executableKnowledgeStory(leftText) && executableKnowledgeStory(rightText);
  const leftAnchor = storyThemeAnchorFor(left);
  const rightAnchor = storyThemeAnchorFor([right]);

  if (bothExecutable && /storybook|metadata|documentation|figma|design-to-code|code generation|component generation/i.test(`${leftText} ${rightText}`)) {
    return `Merged because ${leftAnchor} and ${rightAnchor} describe the same transition from documentation to executable Design System knowledge.`;
  }

  if (sharedTerms >= 4 && storyTitleFor(left) === storyTitleFor([right])) {
    return `Merged because the clusters share ${sharedTerms} story terms and explain one DS × AI workflow shift more clearly together.`;
  }

  return "";
}

function deliberateEditorialStory(groups: EvidenceCandidate[][]): {
  decision: EditorialDeliberationDecision;
  dominantGroup: EvidenceCandidate[];
} {
  if (groups.length === 0) {
    return {
      decision: emptyEditorialDeliberation(),
      dominantGroup: []
    };
  }

  const detectedStories = groups.map((group, index) =>
    storyFromGroups([group], [index], `Detected theme cluster "${evidenceGroupQuality(group).claim}".`)
  );
  const stories: Array<{ groups: EvidenceCandidate[][]; clusterIndexes: number[]; reasoning: string }> = [];
  const mergedClusters: EditorialDeliberationMerge[] = [];

  groups.forEach((group, index) => {
    const target = stories.find((story) => mergeReason(story.groups, group));
    if (!target) {
      stories.push({
        groups: [group],
        clusterIndexes: [index],
        reasoning: `Kept "${evidenceGroupQuality(group).claim}" as a distinct story candidate.`
      });
      return;
    }

    const reason = mergeReason(target.groups, group);
    target.groups.push(group);
    target.clusterIndexes.push(index);
    target.reasoning = reason;
    mergedClusters.push({
      clusterIndexes: [...target.clusterIndexes],
      clusterClaims: target.groups.map((item) => evidenceGroupQuality(item).claim),
      mergedStory: storyTitleFor(target.groups),
      reason
    });
  });

  const storyCandidates = stories
    .map((story) => storyFromGroups(story.groups, story.clusterIndexes, story.reasoning))
    .sort((a, b) => b.qualityAdjustedScore - a.qualityAdjustedScore);
  const dominantStory = storyCandidates[0];
  const secondaryStories = storyCandidates.slice(1);
  const dominantSource = stories.find((story) => story.clusterIndexes.join(",") === dominantStory.clusterIndexes.join(",")) ?? stories[0];

  return {
    decision: {
      detectedStories,
      mergedClusters,
      dominantStory,
      secondaryStories,
      reasoning: [
        `Detected ${detectedStories.length} thematic cluster${detectedStories.length === 1 ? "" : "s"} from Theme Discovery.`,
        mergedClusters.length > 0
          ? `Merged ${mergedClusters.length} related cluster pair${mergedClusters.length === 1 ? "" : "s"} before choosing a story.`
          : "No clusters were merged because the available themes would become broader rather than more coherent.",
        `Dominant story is "${dominantStory.story}" with quality-adjusted score ${dominantStory.qualityAdjustedScore}.`,
        "Editorial Deliberation does not decide publication readiness; it only selects the story for Lead Signal formulation."
      ]
    },
    dominantGroup: dominantSource.groups.flat()
  };
}

function leadSignalSelectionReasonFor(evidenceGroups: EvidenceGroup[]): string {
  const winner = evidenceGroups[0];
  const runnerUp = evidenceGroups[1];

  if (!winner) {
    return "No Lead Signal selected because no Evidence group passed promotion.";
  }

  if (!runnerUp) {
    return `Selected "${winner.claim}" as the only Evidence group with quality-adjusted score ${winner.qualityAdjustedScore}.`;
  }

  return `Selected "${winner.claim}" because its quality-adjusted score (${winner.qualityAdjustedScore}) beat "${runnerUp.claim}" (${runnerUp.qualityAdjustedScore}) after diversity, workflow, actionability, repeated-source, and contribution-similarity adjustments.`;
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
  const { promotedEvidence, evidencePromotionRejections } = promoteCandidatesToEvidence(candidatePool, baseSelection);
  const evidenceGroupsRaw = groupEvidenceCandidates(promotedEvidence);
  const deliberation = deliberateEditorialStory(evidenceGroupsRaw);
  const leadGroup = deliberation.dominantGroup.length
    ? assignEvidenceRoles(deliberation.dominantGroup)
    : selectLeadEvidenceGroup(evidenceGroupsRaw);
  const evidenceSet = leadGroup.map((item) => item.evidence);
  const leadEvidence = leadGroup.find((item) => item.evidence.role === "lead");
  const leadSignal = leadEvidence ? buildCandidateSignal(leadEvidence, evidenceSet) : null;
  const representativeResult = leadSignal
    ? representativeEvidenceGroup(leadGroup, leadSignal.resourceUrl)
    : {
        representatives: [],
        representativeSelectionReasons: ["No representative Evidence selected because no Lead Signal exists."],
        hiddenEvidenceReasons: leadGroup.map((item) => ({
          resourceRef: item.evidence.resourceRef,
          reason: "lower representative score than selected item"
        })),
        supportingResourceRanking: {
          candidatesConsidered: 0,
          selected: [],
          rejected: []
        },
        evidenceReasoning: emptyEvidenceReasoning()
      };
  const selectionResult = selectionFromLeadEvidence(baseSelection, leadGroup, leadSignal, representativeResult.representatives);
  const candidateSignals = leadSignal ? [leadSignal] : [];
  const rejectedSignals = selectionResult.rejectedDecisions.map((decision) => ({
    resourceUrl: decision.url,
    resourceTitle: decision.title,
    rejectionReason: decision.rejectionReason || decision.skippedBecause,
    formationReason: `Not selected for Lead Signal Evidence: ${decision.rejectionReason || decision.skippedBecause || "outside the winning evidence group"}.`
  }));
  const evidenceSetSummary = evidenceSet.length ? evidenceSetSummaryFor(evidenceSet) : emptyEvidenceSetSummary();
  const evidenceGroups = evidenceGroupsFor(evidenceGroupsRaw);
  const leadSignalSelectionReason = deliberation.decision.dominantStory
    ? `Editorial Deliberation selected "${deliberation.decision.dominantStory.story}" before Lead Signal formulation. ${deliberation.decision.dominantStory.reasoning}`
    : leadSignalSelectionReasonFor(evidenceGroups);
  const runnerUpEvidenceGroups = evidenceGroups.slice(1, 4);
  const degenerateEvidenceSet = evidenceSet.length === 1;
  const evidenceFormationReasons = [
    `Evaluated ${candidatePool.length} qualified candidate pool item${candidatePool.length === 1 ? "" : "s"} for Evidence promotion.`,
    `Promoted ${promotedEvidence.length} candidate${promotedEvidence.length === 1 ? "" : "s"} into Evidence before final thesis selection.`,
    `Grouped promoted Evidence into ${evidenceGroups.length} claim/theme group${evidenceGroups.length === 1 ? "" : "s"}.`,
    leadSignal
      ? `Assigned exactly one lead supporting Evidence item: "${leadSignal.resourceTitle}".`
      : "No Evidence set formed because no candidate passed thesis Evidence eligibility.",
    degenerateEvidenceSet
      ? "Evidence set is degenerate because only one valid Evidence item supported the Lead Signal."
      : `Evidence set includes ${evidenceSet.length} items with ${evidenceSetSummary.contradictingEvidenceCount} contradicting item${evidenceSetSummary.contradictingEvidenceCount === 1 ? "" : "s"}.`
  ];
  const signalFormationReasons = [
    `Evaluated ${promotedEvidence.length} promoted Evidence item${promotedEvidence.length === 1 ? "" : "s"} before Lead Signal formation.`,
    leadSignal
      ? leadSignalSelectionReason
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
    degenerateEvidenceSet,
    evidencePromotionInputCount: candidatePool.length,
    promotedEvidenceCount: promotedEvidence.length,
    evidenceGroups,
    editorialDeliberation: deliberation.decision,
    leadSignalSelectionReason,
    runnerUpEvidenceGroups,
    evidencePromotionRejections,
    representativeLeadEvidence: representativeResult.representatives[0]?.evidence ?? null,
    representativeSupportingEvidence: representativeResult.representatives.slice(1).map((item) => item.evidence),
    representativeSelectionReasons: representativeResult.representativeSelectionReasons,
    hiddenEvidenceCount: representativeResult.hiddenEvidenceReasons.length,
    hiddenEvidenceReasons: representativeResult.hiddenEvidenceReasons,
    renderedResourceCount: selectionResult.selectedCandidates.length,
    renderedResourceTitles: selectionResult.selectedCandidates.map((candidate) => candidate.title),
    evidenceReasoning: representativeResult.evidenceReasoning,
    supportingResourceRanking: representativeResult.supportingResourceRanking
  };
}
