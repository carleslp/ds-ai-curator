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
  editorialMissionMatch: boolean;
  missionReason: string;
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
const missionRejectReason =
  "Skipped because it does not satisfy the DS × AI Curator mission: AI-powered tooling with direct Design System work impact.";
const aiResearchDesignSystemTopics: DesignSystemTopic[] = [
  "Figma",
  "Storybook",
  "Metadata",
  "Design Tokens",
  "Component APIs",
  "Documentation",
  "Accessibility",
  "Design-to-Code",
  "QA Automation",
  "Component Generation"
];

function textForCandidate(candidate: CandidateResource): string {
  return `${candidate.title} ${candidate.source} ${candidate.url} ${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText} ${candidate.directDesignSystemEvidence}`.toLowerCase();
}

function hasAnyTopic<T extends string>(topics: T[], expected: T[]): boolean {
  return expected.some((topic) => topics.includes(topic));
}

function hasAnyText(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function hasAiTextSignal(text: string): boolean {
  return (
    /(^|[^a-z])ai([^a-z]|$)/i.test(text) ||
    hasAnyText(text, [
      "artificial intelligence",
      "llm",
      "agent",
      "mcp",
      "model context protocol",
      "automation",
      "generative",
      "copilot",
      "rag",
      "machine-readable",
      "machine readable"
    ])
  );
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
  topics: Pick<EditorialSelectionDecision, "designSystemTopics" | "workflowTopics" | "aiTopics">
): boolean {
  return hasAnyTopic(topics.designSystemTopics, aiResearchDesignSystemTopics);
}

function missionMatchFor(
  candidate: CandidateResource,
  score: EditorialScore,
  topics: Pick<EditorialSelectionDecision, "designSystemTopics" | "workflowTopics" | "aiTopics">
): Pick<EditorialSelectionDecision, "editorialMissionMatch" | "missionReason"> {
  const text = textForCandidate(candidate);
  const hasAiRelevance =
    topics.aiTopics.length > 0 ||
    score.aiScore > 0 ||
    hasAiTextSignal(text);
  const hasDirectDesignSystemImpact =
    topics.designSystemTopics.length > 0 ||
    topics.workflowTopics.length > 0 ||
    score.workflowScore > 0 ||
    candidate.directDesignSystemEvidence.trim().length > 0;

  if (hasAiRelevance && hasDirectDesignSystemImpact) {
    return {
      editorialMissionMatch: true,
      missionReason:
        "Matches mission: AI or AI-powered tooling intersects with mature Design System work such as design, documentation, governance, implementation, testing, maintenance, or consumption."
    };
  }

  if (!hasAiRelevance && !hasDirectDesignSystemImpact) {
    return {
      editorialMissionMatch: false,
      missionReason: "Rejected mission match: neither AI-powered tooling nor direct Design System workflow impact was strong enough."
    };
  }

  if (!hasAiRelevance) {
    return {
      editorialMissionMatch: false,
      missionReason: "Rejected mission match: Design System relevance exists, but the resource is not about AI or AI-powered tooling."
    };
  }

  return {
    editorialMissionMatch: false,
    missionReason: "Rejected mission match: AI relevance exists, but direct impact on mature Design System work was not strong enough."
  };
}

function qualityRejection(
  candidate: CandidateResource,
  score: EditorialScore,
  topicGroup: TopicGroup,
  topics: Pick<EditorialSelectionDecision, "designSystemTopics" | "workflowTopics" | "aiTopics" | "editorialMissionMatch">
): string {
  if (topicGroup === "AI Research" && !hasAiResearchWorkflowConnection(topics)) {
    return "Skipped because AI Research lacks a direct Design System workflow connection.";
  }

  if (!topics.editorialMissionMatch) {
    return missionRejectReason;
  }

  if (score.beginnerPenalty >= 20) {
    return "Skipped because it reads as beginner Design System education for a mature enterprise team.";
  }

  if (score.marketingPenalty >= 10) {
    return "Skipped because it looks primarily like marketing or a sales page.";
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

function aiResearchRejectionReason(decision: Pick<EditorialSelectionDecision, "topicGroup" | "designSystemTopics" | "workflowTopics" | "aiTopics">): string {
  if (decision.topicGroup === "AI Research" && !hasAiResearchWorkflowConnection(decision)) {
    return "Skipped because AI Research lacks a direct Design System workflow connection.";
  }

  return "";
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
    const missionMatch = missionMatchFor(candidate, editorialScore, topics);
    const baseDecision = {
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      editorialScore,
      topicGroup,
      ...missionMatch,
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

  const finalSelected = selected.filter((item) => !aiResearchRejectionReason(item.decision));
  const selectedUrls = new Set(finalSelected.map((item) => item.candidate.url));
  const selectedDecisions = finalSelected.map((item) => ({
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
      const reason = item.decision.rejectionReason || aiResearchRejectionReason(item.decision) || duplicateTopicReason;

      return {
        ...item.decision,
        rejectionReason: reason,
        selectedBecause: "",
        skippedBecause: skippedBecause(reason)
      };
    });
  const decisions = [...selectedDecisions, ...rejectedDecisions];
  const editorsPickCandidate = finalSelected.length ? [...finalSelected].sort(compareWorkflowImpact)[0].candidate : undefined;

  return {
    selectedCandidates: finalSelected.map((item) => item.candidate),
    decisions,
    selectedDecisions,
    rejectedDecisions,
    qualifyingCandidateCount: qualified.length,
    editorsPickCandidate
  };
}
