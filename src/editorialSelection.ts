import type { CandidateResource, SourceCategory } from "./collectCandidates.js";
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
  editorialValueMatch: boolean;
  editorialValueReason: string;
  actionabilityScore: number;
  readerValue: number;
  learningValue: number;
  sourceCategory: SourceCategory;
  rankingExplanation: string;
  mondayMorningChange: string;
  editorialTitle: string;
  aiTopics: AiTopic[];
  designSystemTopics: DesignSystemTopic[];
  workflowTopics: WorkflowTopic[];
};

export type EditorialSelectionResult = {
  selectedCandidates: CandidateResource[];
  qualifiedCandidates: CandidateResource[];
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
const minimumActionabilityScore = 6;
const missionRejectReason =
  "Skipped because it does not satisfy the DS × AI Curator mission: AI-powered tooling with direct Design System work impact.";
const valueRejectReason = "Skipped because it does not change how a mature Design System team works.";
const mondayRejectReason = "Skipped because the Monday Morning Test produced no concrete team change.";
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

// Evidence-format candidates (primary sources) must prove the AI thesis
// directly. Teaching/Practice artifacts teach the Design System practice the
// thesis depends on and do not need to mention AI themselves. sourceCategory
// "Official" is deliberately excluded here: it is collectCandidates.ts's
// catch-all default for anything unclassified, not a primary-source signal.
function isEvidenceFormatCandidate(candidate: CandidateResource, text: string): boolean {
  return (
    candidate.sourceCategory === "Research" ||
    hasAnyText(text, [
      "release notes",
      "changelog",
      "/releases",
      "releases.atom",
      "rfc",
      "api reference",
      "reference documentation",
      "official docs",
      "arxiv"
    ])
  );
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

function uniqueReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter(Boolean)));
}

function editorialValueFor(candidate: CandidateResource): Pick<EditorialSelectionDecision, "editorialValueMatch" | "editorialValueReason"> {
  const text = textForCandidate(candidate);
  const reasons = uniqueReasons([
    hasAnyText(text, ["component generation", "component metadata", "component api", "component apis", "production-ready ui"])
      ? "changes how Design Systems are built"
      : "",
    hasAnyText(text, ["documentation automation", "docs automation", "docgen", "machine-readable", "ai-ready documentation"])
      ? "changes how Design Systems are documented"
      : "",
    hasAnyText(text, ["design system agent", "agent consuming", "mcp", "model context protocol"])
      ? "changes how AI agents consume Design Systems"
      : "",
    hasAnyText(text, ["workflow", "checklist", "playbook", "pattern", "implementation"])
      ? "introduces a workflow designers could realistically adopt"
      : "",
    hasAnyText(text, ["governance", "guardrail", "standard", "policy"])
      ? "introduces governance practices"
      : "",
    hasAnyText(text, ["design-to-code", "design to code", "figma2code", "ui code generation", "mockups to code"])
      ? "improves Design-to-Code"
      : "",
    hasAnyText(text, ["design qa", "qa automation", "visual regression", "testing", "test automation"])
      ? "improves Design QA"
      : "",
    hasAnyText(text, ["accessibility automation", "accessibility", "a11y"])
      ? "improves accessibility workflows"
      : "",
    hasAnyText(text, ["design tokens", "token intelligence", "figma variables", "variables", "style dictionary"])
      ? "improves Design Token workflows"
      : ""
  ]);

  if (reasons.length === 0) {
    return {
      editorialValueMatch: false,
      editorialValueReason: "No concrete editorial value: the resource does not change build, documentation, agent, workflow, governance, design-to-code, QA, accessibility, or token work."
    };
  }

  return {
    editorialValueMatch: true,
    editorialValueReason: `Editorial value: ${reasons.slice(0, 3).join("; ")}.`
  };
}

function actionabilityScoreFor(candidate: CandidateResource): number {
  const text = textForCandidate(candidate);
  let score = 0;

  const positiveSignals: Array<[string[], number]> = [
    [["workflow", "checklist", "playbook"], 4],
    [["implementation pattern", "architecture", "component api", "component metadata"], 4],
    [["repeatable", "practice", "process", "standard"], 3],
    [["production", "production-ready", "migration"], 3],
    [["governance", "guardrail", "policy"], 3],
    [["design-to-code", "ui code generation", "component generation"], 3],
    [["qa automation", "visual regression", "accessibility automation"], 3],
    [["storybook", "figma", "react", "react native"], 2],
    [["mcp", "agent", "machine-readable"], 2]
  ];
  const negativeSignals: Array<[string[], number]> = [
    [["release notes", "changelog", "release:"], 5],
    [["launch", "announcement", "introducing"], 3],
    [["pricing", "book a demo", "contact sales"], 5],
    [["teaser", "preview"], 3],
    [["benchmark"], 4],
    [["speculative", "survey"], 2]
  ];

  for (const [terms, points] of positiveSignals) {
    if (hasAnyText(text, terms)) score += points;
  }

  for (const [terms, points] of negativeSignals) {
    if (hasAnyText(text, terms)) score -= points;
  }

  return Math.max(0, Math.min(20, score));
}

function mondayMorningChangeFor(candidate: CandidateResource, actionabilityScore: number): string {
  const text = textForCandidate(candidate);

  if (actionabilityScore < minimumActionabilityScore) {
    return "nothing";
  }

  if (hasAnyText(text, ["storybook", "component metadata", "component api", "docgen"])) {
    return "Audit one Storybook component page for metadata, examples, props, and agent-readable documentation gaps.";
  }

  if (hasAnyText(text, ["figma", "design-to-code", "figma2code", "ui code generation"])) {
    return "Review one Figma component against generated-code readiness: variant intent, metadata, tokens, and React mapping.";
  }

  if (hasAnyText(text, ["qa", "visual regression", "accessibility", "a11y", "testing"])) {
    return "Add one QA or accessibility check the Internal QA Agent should run before accepting AI-assisted component changes.";
  }

  if (hasAnyText(text, ["governance", "guardrail", "policy"])) {
    return "Turn one governance rule into an explicit checklist item tied to documentation and Azure DevOps ownership.";
  }

  if (hasAnyText(text, ["token", "variables", "style dictionary"])) {
    return "Inspect one token decision and document semantic intent so AI-generated UI cannot use tokens by name alone.";
  }

  return "Identify one component workflow gap and convert it into a concrete instruction for the internal Design System Agent.";
}

function editorialTitleFor(candidate: CandidateResource): string {
  const text = textForCandidate(candidate);

  if (candidate.source.toLowerCase().includes("storybook") && hasAnyText(text, ["ai", "mcp", "component metadata", "docgen"])) {
    return "Storybook prepares AI-ready component metadata";
  }

  if (hasAnyText(text, ["figma2code", "figma metadata", "design-to-code", "design to code"])) {
    return "Why Figma metadata is becoming the bottleneck for Design-to-Code AI";
  }

  if (hasAnyText(text, ["mobile user experience", "ui flows", "complete ui flows"])) {
    return "LLMs are beginning to reason about complete UI flows instead of isolated screens";
  }

  if (hasAnyText(text, ["design tokens", "token intelligence", "figma variables"])) {
    return "Design tokens are becoming an AI control surface";
  }

  if (hasAnyText(text, ["accessibility automation", "qa automation", "visual regression"])) {
    return "AI-assisted QA is moving closer to Design System governance";
  }

  if (hasAnyText(text, ["mcp", "model context protocol", "agent consuming"])) {
    return "Agents need structured Design System context before they can act safely";
  }

  return candidate.title;
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

  if (!hasDirectDesignSystemImpact) {
    return {
      editorialMissionMatch: false,
      missionReason: hasAiRelevance
        ? "Rejected mission match: AI relevance exists, but direct impact on mature Design System work was not strong enough."
        : "Rejected mission match: neither AI-powered tooling nor direct Design System workflow impact was strong enough."
    };
  }

  // Direct Design System impact exists. Evidence-format resources (releases,
  // changelogs, RFCs, API references, arXiv papers) must still prove the AI
  // thesis directly — a changelog that never says "AI" is not evidence of an
  // AI development. Teaching/Practice artifacts (essays, talks, governance,
  // accessibility, token workflow pieces) teach the underlying Design System
  // practice the thesis depends on and need not mention AI themselves.
  if (isEvidenceFormatCandidate(candidate, text) && !hasAiRelevance) {
    return {
      editorialMissionMatch: false,
      missionReason: "Rejected mission match: Design System relevance exists, but this primary-source/evidence-format resource is not about AI or AI-powered tooling."
    };
  }

  return {
    editorialMissionMatch: true,
    missionReason: hasAiRelevance
      ? "Matches mission: AI or AI-powered tooling intersects with mature Design System work such as design, documentation, governance, implementation, testing, maintenance, or consumption."
      : "Matches mission: strong Design System relevance supports the thesis's implied work; a Teaching/Practice artifact need not mention AI to teach the practice mature Design System teams rely on."
  };
}

function qualityRejection(
  candidate: CandidateResource,
  score: EditorialScore,
  topicGroup: TopicGroup,
  topics: Pick<
    EditorialSelectionDecision,
    "designSystemTopics" | "workflowTopics" | "aiTopics" | "editorialMissionMatch" | "editorialValueMatch" | "actionabilityScore" | "mondayMorningChange"
  >
): string {
  if (topicGroup === "AI Research" && !hasAiResearchWorkflowConnection(topics)) {
    return "Skipped because AI Research lacks a direct Design System workflow connection.";
  }

  if (!topics.editorialMissionMatch) {
    return missionRejectReason;
  }

  if (!topics.editorialValueMatch) {
    return valueRejectReason;
  }

  if (topics.mondayMorningChange === "nothing") {
    return mondayRejectReason;
  }

  if (topics.actionabilityScore < minimumActionabilityScore) {
    return `Skipped because actionabilityScore (${topics.actionabilityScore}) is below ${minimumActionabilityScore}.`;
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

  if (score.aiScore === 0 && isEvidenceFormatCandidate(candidate, textForCandidate(candidate))) {
    return "Skipped because no AI, automation, agent, MCP, or code-generation signal was strong enough for primary-source evidence.";
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

function audienceScore(candidate: CandidateResource): number {
  return Math.round(candidate.readerValue * 0.55 + candidate.learningValue * 0.45);
}

function selectionReason(topicGroup: TopicGroup, score: EditorialScore, impactScore: number, candidate: CandidateResource): string {
  return `Candidate mapped to ${topicGroup} with editorial score ${score.totalScore}, workflow-impact score ${impactScore}, audience score ${audienceScore(candidate)}, and ${candidate.sourceCategory} source category.`;
}

function selectedBecause(
  topicGroup: TopicGroup,
  score: EditorialScore,
  impactScore: number,
  actionabilityScore: number,
  candidate: CandidateResource
): string {
  return `Selected as the strongest ${topicGroup} signal after balancing evidence quality, workflow impact, audience fit, and source-category diversity. Editorial score: ${score.totalScore}; actionability: ${actionabilityScore}; workflow impact: ${impactScore}; reader value: ${candidate.readerValue}; learning value: ${candidate.learningValue}; source category: ${candidate.sourceCategory}.`;
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
  const actionabilityDifference = b.decision.actionabilityScore - a.decision.actionabilityScore;
  if (Math.abs(actionabilityDifference) > 2) return actionabilityDifference;

  const scoreDifference = b.decision.editorialScore.totalScore - a.decision.editorialScore.totalScore;
  if (Math.abs(scoreDifference) > 6) return scoreDifference;

  const audienceDifference = audienceScore(b.candidate) - audienceScore(a.candidate);
  if (audienceDifference !== 0) return audienceDifference;

  if (actionabilityDifference !== 0) return actionabilityDifference;
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

function isEquivalentAudienceAlternative(candidate: ScoredCandidate, bestCandidate: ScoredCandidate): boolean {
  return (
    bestCandidate.decision.actionabilityScore - candidate.decision.actionabilityScore <= 2 &&
    bestCandidate.decision.editorialScore.totalScore - candidate.decision.editorialScore.totalScore <= 6 &&
    bestCandidate.workflowImpactScore - candidate.workflowImpactScore <= 6
  );
}

export function selectEditorialCandidates(candidates: CandidateResource[]): EditorialSelectionResult {
  const scoredCandidates = candidates.map((candidate): ScoredCandidate => {
    const topics = classifyCandidateTopics(candidate);
    const editorialScore = scoreEditorialCandidate(candidate, candidates);
    const topicGroup = topicGroupFor(candidate, topics.aiTopics, topics.designSystemTopics, topics.workflowTopics);
    const missionMatch = missionMatchFor(candidate, editorialScore, topics);
    const editorialValue = editorialValueFor(candidate);
    const actionabilityScore = actionabilityScoreFor(candidate);
    const mondayMorningChange = mondayMorningChangeFor(candidate, actionabilityScore);
    const baseDecision = {
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      editorialScore,
      topicGroup,
      ...missionMatch,
      ...editorialValue,
      actionabilityScore,
      readerValue: candidate.readerValue,
      learningValue: candidate.learningValue,
      sourceCategory: candidate.sourceCategory,
      rankingExplanation: candidate.rankingExplanation,
      mondayMorningChange,
      editorialTitle: editorialTitleFor(candidate),
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
        selectionReason: selectionReason(topicGroup, editorialScore, impactScore, candidate),
        rejectionReason,
        selectedBecause: "",
        skippedBecause: rejectionReason
      }
    };
  });

  const qualified = scoredCandidates.filter((item) => !item.decision.rejectionReason);
  const selected: ScoredCandidate[] = [];
  const selectedGroups = new Set<TopicGroup>();
  const selectedSourceCategories = new Set<SourceCategory>();

  for (const group of targetGroups) {
    const groupCandidates = qualified
      .filter((item) => item.decision.topicGroup === group && !selectedGroups.has(item.decision.topicGroup))
      .sort(compareCandidates);
    const bestCandidate = groupCandidates[0];

    if (!bestCandidate) {
      continue;
    }

    const categoryDiverseAlternative = groupCandidates.find(
      (item) =>
        !selectedSourceCategories.has(item.candidate.sourceCategory) &&
        item.candidate.sourceCategory !== bestCandidate.candidate.sourceCategory &&
        isEquivalentAudienceAlternative(item, bestCandidate)
    );
    const selectedCandidate = selectedSourceCategories.has(bestCandidate.candidate.sourceCategory) && categoryDiverseAlternative
      ? categoryDiverseAlternative
      : bestCandidate;

    selected.push(selectedCandidate);
    selectedGroups.add(group);
    selectedSourceCategories.add(selectedCandidate.candidate.sourceCategory);
  }

  const finalSelected = selected.filter((item) => !aiResearchRejectionReason(item.decision));
  const selectedUrls = new Set(finalSelected.map((item) => item.candidate.url));
  const selectedDecisions = finalSelected.map((item) => ({
    ...item.decision,
    selectedBecause: selectedBecause(
      item.decision.topicGroup,
      item.decision.editorialScore,
      item.workflowImpactScore,
      item.decision.actionabilityScore,
      item.candidate
    ),
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
    qualifiedCandidates: qualified.map((item) => item.candidate),
    decisions,
    selectedDecisions,
    rejectedDecisions,
    qualifyingCandidateCount: qualified.length,
    editorsPickCandidate
  };
}
