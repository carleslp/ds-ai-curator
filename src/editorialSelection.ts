import type { CandidateResource } from "./collectCandidates.js";
import { scoreEditorialCandidate, type EditorialScore } from "./editorialEngine.js";
import { classifyCandidateTopics, type AiTopic, type DesignSystemTopic, type WorkflowTopic } from "./topicClassifier.js";

export type TopicGroup = "Storybook" | "Figma" | "AI Research" | "Enterprise Practice" | "Tooling" | "Other";

export type EditorialSelectionDecision = {
  title: string;
  url: string;
  source: string;
  editorialScore: EditorialScore;
  selectionReason: string;
  rejectionReason: string;
  topicGroup: TopicGroup;
  selectedBecause: string;
  skippedBecause: string;
  aiTopics: AiTopic[];
  designSystemTopics: DesignSystemTopic[];
  workflowTopics: WorkflowTopic[];
};

export type EditorialSelectionResult = {
  selectedCandidates: CandidateResource[];
  decisions: EditorialSelectionDecision[];
  selectedDecisions: EditorialSelectionDecision[];
  rejectedDecisions: EditorialSelectionDecision[];
  qualifyingCandidateCount: number;
  editorsPickCandidate?: CandidateResource;
};

type ScoredCandidate = {
  candidate: CandidateResource;
  decision: EditorialSelectionDecision;
  workflowImpactScore: number;
};

const targetGroups: TopicGroup[] = ["Storybook", "Figma", "AI Research", "Enterprise Practice", "Tooling"];
const minimumEditorialScore = 30;
const aiResearchDesignSystemTopics: DesignSystemTopic[] = [
  "Figma",
  "Storybook",
  "Metadata",
  "Design Tokens",
  "Component APIs",
  "Documentation"
];
const aiResearchAiTopics: AiTopic[] = ["Design-to-Code", "QA Automation", "Accessibility AI"];

function textForCandidate(candidate: CandidateResource): string {
  return `${candidate.title} ${candidate.source} ${candidate.url} ${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText} ${candidate.directDesignSystemEvidence}`.toLowerCase();
}

function hasAnyTopic<T extends string>(topics: T[], expected: T[]): boolean {
  return expected.some((topic) => topics.includes(topic));
}

function topicGroupFor(
  candidate: CandidateResource,
  aiTopics: AiTopic[],
  designSystemTopics: DesignSystemTopic[],
  workflowTopics: WorkflowTopic[]
): TopicGroup {
  const text = textForCandidate(candidate);

  if (designSystemTopics.includes("Storybook") || candidate.source.toLowerCase().includes("storybook")) {
    return "Storybook";
  }

  if (
    hasAnyTopic(designSystemTopics, ["Figma", "Code Connect", "Dev Mode", "Variables"]) ||
    text.includes("figma2code")
  ) {
    return "Figma";
  }

  if (candidate.source.toLowerCase().includes("arxiv") || candidate.url.toLowerCase().includes("arxiv.org")) {
    return "AI Research";
  }

  if (
    hasAnyTopic(designSystemTopics, ["Enterprise", "Governance"]) ||
    hasAnyTopic(workflowTopics, ["Design System Agent", "Internal Tools", "Design QA"])
  ) {
    return "Enterprise Practice";
  }

  if (
    hasAnyTopic(aiTopics, ["Code Generation", "Design-to-Code", "QA Automation", "Accessibility AI"]) ||
    hasAnyTopic(designSystemTopics, ["Component APIs", "React", "React Native", "Metadata", "Design Tokens", "Documentation"]) ||
    hasAnyTopic(workflowTopics, ["Developer Workflow", "Designer Workflow"])
  ) {
    return "Tooling";
  }

  return "Other";
}

function workflowImpactScore(score: EditorialScore, decisionTopics: Pick<EditorialSelectionDecision, "designSystemTopics" | "workflowTopics" | "aiTopics">): number {
  const workflowBreadth =
    decisionTopics.designSystemTopics.length * 2 + decisionTopics.workflowTopics.length * 3 + decisionTopics.aiTopics.length;

  return score.workflowScore * 2 + score.enterpriseScore + score.practicalityScore + workflowBreadth;
}

function hasAiResearchWorkflowConnection(
  candidate: CandidateResource,
  topics: Pick<EditorialSelectionDecision, "designSystemTopics" | "workflowTopics" | "aiTopics">
): boolean {
  const text = textForCandidate(candidate);

  return (
    hasAnyTopic(topics.designSystemTopics, aiResearchDesignSystemTopics) ||
    hasAnyTopic(topics.aiTopics, aiResearchAiTopics) ||
    topics.workflowTopics.includes("Design QA") ||
    text.includes("accessibility") ||
    text.includes("component generation")
  );
}

function qualityRejection(
  candidate: CandidateResource,
  score: EditorialScore,
  topicGroup: TopicGroup,
  topics: Pick<EditorialSelectionDecision, "designSystemTopics" | "workflowTopics" | "aiTopics">
): string {
  if (score.beginnerPenalty >= 20) {
    return "Skipped because it reads as beginner Design System education for a mature enterprise team.";
  }

  if (score.marketingPenalty >= 10) {
    return "Skipped because it looks primarily like marketing or a sales page.";
  }

  if (topicGroup === "AI Research" && !hasAiResearchWorkflowConnection(candidate, topics)) {
    return "Skipped because AI Research lacks a direct Design System workflow connection.";
  }

  if (score.designSystemScore === 0 && score.workflowScore === 0) {
    return "Skipped because no Design System or UI workflow connection was strong enough.";
  }

  if (score.aiScore === 0) {
    return "Skipped because no AI, automation, agent, MCP, or code-generation signal was strong enough.";
  }

  if (score.totalScore < minimumEditorialScore) {
    return `Skipped because the editorial score (${score.totalScore}) is below the quality threshold (${minimumEditorialScore}).`;
  }

  if (topicGroup === "Other") {
    return "Skipped because it does not fit the target editorial mix: Storybook, Figma, AI Research, Enterprise Practice, or Tooling.";
  }

  if (candidate.directDesignSystemEvidence.trim().length === 0 && score.designSystemScore < 8 && score.workflowScore < 8) {
    return "Skipped because direct Design System evidence was too weak for selection.";
  }

  return "";
}

function selectionReason(topicGroup: TopicGroup, score: EditorialScore, impactScore: number): string {
  return `Candidate mapped to ${topicGroup} with editorial score ${score.totalScore} and workflow-impact score ${impactScore}.`;
}

function selectedBecause(topicGroup: TopicGroup, score: EditorialScore, impactScore: number): string {
  return `Selected as the strongest ${topicGroup} signal after balancing quality, workflow impact, and topic diversity. Editorial score: ${score.totalScore}; workflow impact: ${impactScore}.`;
}

function skippedBecause(reason: string): string {
  return reason || "Skipped to preserve topic diversity; another stronger article already covered this topic group.";
}

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  const scoreDifference = b.decision.editorialScore.totalScore - a.decision.editorialScore.totalScore;
  if (scoreDifference !== 0) return scoreDifference;

  const impactDifference = b.workflowImpactScore - a.workflowImpactScore;
  if (impactDifference !== 0) return impactDifference;

  return b.candidate.recencyScore - a.candidate.recencyScore;
}

function compareWorkflowImpact(a: ScoredCandidate, b: ScoredCandidate): number {
  const impactDifference = b.workflowImpactScore - a.workflowImpactScore;
  if (impactDifference !== 0) return impactDifference;

  const workflowDifference = b.decision.editorialScore.workflowScore - a.decision.editorialScore.workflowScore;
  if (workflowDifference !== 0) return workflowDifference;

  return b.decision.editorialScore.enterpriseScore - a.decision.editorialScore.enterpriseScore;
}

export function selectEditorialCandidates(candidates: CandidateResource[]): EditorialSelectionResult {
  const scoredCandidates = candidates.map((candidate): ScoredCandidate => {
    const topics = classifyCandidateTopics(candidate);
    const editorialScore = scoreEditorialCandidate(candidate, candidates);
    const topicGroup = topicGroupFor(candidate, topics.aiTopics, topics.designSystemTopics, topics.workflowTopics);
    const baseDecision = {
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      editorialScore,
      topicGroup,
      aiTopics: topics.aiTopics,
      designSystemTopics: topics.designSystemTopics,
      workflowTopics: topics.workflowTopics
    };
    const impactScore = workflowImpactScore(editorialScore, baseDecision);
    const rejectionReason = qualityRejection(candidate, editorialScore, topicGroup, baseDecision);

    return {
      candidate,
      workflowImpactScore: impactScore,
      decision: {
        ...baseDecision,
        selectionReason: selectionReason(topicGroup, editorialScore, impactScore),
        rejectionReason,
        selectedBecause: "",
        skippedBecause: rejectionReason
      }
    };
  });

  const qualified = scoredCandidates.filter((item) => !item.decision.rejectionReason);
  const selected: ScoredCandidate[] = [];
  const selectedGroups = new Set<TopicGroup>();

  for (const group of targetGroups) {
    const bestCandidate = qualified
      .filter((item) => item.decision.topicGroup === group && !selectedGroups.has(item.decision.topicGroup))
      .sort(compareCandidates)[0];

    if (!bestCandidate) {
      continue;
    }

    selected.push(bestCandidate);
    selectedGroups.add(group);
  }

  const selectedUrls = new Set(selected.map((item) => item.candidate.url));
  const selectedDecisions = selected.map((item) => ({
    ...item.decision,
    selectedBecause: selectedBecause(item.decision.topicGroup, item.decision.editorialScore, item.workflowImpactScore),
    skippedBecause: ""
  }));
  const rejectedDecisions = scoredCandidates
    .filter((item) => !selectedUrls.has(item.candidate.url))
    .map((item) => {
      const duplicateTopicReason = selectedGroups.has(item.decision.topicGroup)
        ? `Skipped to preserve diversity; ${item.decision.topicGroup} is already represented.`
        : "";
      const reason = item.decision.rejectionReason || duplicateTopicReason;

      return {
        ...item.decision,
        rejectionReason: reason,
        selectedBecause: "",
        skippedBecause: skippedBecause(reason)
      };
    });
  const decisions = [...selectedDecisions, ...rejectedDecisions];
  const editorsPickCandidate = selected.length ? [...selected].sort(compareWorkflowImpact)[0].candidate : undefined;

  return {
    selectedCandidates: selected.map((item) => item.candidate),
    decisions,
    selectedDecisions,
    rejectedDecisions,
    qualifyingCandidateCount: qualified.length,
    editorsPickCandidate
  };
}
