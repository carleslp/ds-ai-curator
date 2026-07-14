import type { CandidateResource } from "./collectCandidates.js";
import { cleanText } from "./textUtils.js";

export interface EditorialScore {
  aiScore: number;
  designSystemScore: number;
  workflowScore: number;
  enterpriseScore: number;
  noveltyScore: number;
  practicalityScore: number;
  sourceScore: number;

  beginnerPenalty: number;
  marketingPenalty: number;
  genericPenalty: number;
  duplicatePenalty: number;

  totalScore: number;
  cappedScoreReason?: string;

  editorialReasons: string[];
}

export type EditorialScoredCandidate = {
  title: string;
  url: string;
  source: string;
  editorialScore: EditorialScore;
};

type SignalRule = {
  terms: string[];
  points: number;
  reason: string;
};

const aiRules: SignalRule[] = [
  { terms: ["storybook ai"], points: 10, reason: "Storybook AI signal" },
  { terms: ["figma make"], points: 9, reason: "Figma Make signal" },
  { terms: ["mcp"], points: 8, reason: "MCP workflow signal" },
  { terms: ["model context protocol"], points: 8, reason: "Model Context Protocol signal" },
  { terms: ["llm"], points: 7, reason: "LLM signal" },
  { terms: ["agent"], points: 7, reason: "AI agent signal" },
  { terms: ["ai-assisted"], points: 7, reason: "AI-assisted workflow signal" },
  { terms: ["automation"], points: 6, reason: "Automation signal" },
  { terms: ["generative"], points: 5, reason: "Generative AI signal" },
  { terms: ["copilot"], points: 5, reason: "Copilot signal" },
  { terms: [" ai "], points: 4, reason: "AI signal" }
];

const designSystemRules: SignalRule[] = [
  { terms: ["figma code connect"], points: 10, reason: "Figma Code Connect signal" },
  { terms: ["component metadata"], points: 9, reason: "Component metadata signal" },
  { terms: ["component manifest"], points: 9, reason: "Component manifest signal" },
  { terms: ["design tokens"], points: 8, reason: "Design tokens signal" },
  { terms: ["component library"], points: 8, reason: "Component library signal" },
  { terms: ["storybook"], points: 8, reason: "Storybook workflow signal" },
  { terms: ["figma metadata"], points: 8, reason: "Figma metadata signal" },
  { terms: ["figma library"], points: 7, reason: "Figma library signal" },
  { terms: ["design system"], points: 6, reason: "Design System signal" },
  { terms: ["accessibility"], points: 5, reason: "Accessibility signal" },
  { terms: ["governance"], points: 5, reason: "Governance signal" }
];

const workflowRules: SignalRule[] = [
  { terms: ["design-to-code"], points: 10, reason: "Design-to-code workflow" },
  { terms: ["design to code"], points: 10, reason: "Design-to-code workflow" },
  { terms: ["ui code generation"], points: 9, reason: "UI code generation workflow" },
  { terms: ["component generation"], points: 9, reason: "Component generation workflow" },
  { terms: ["design qa"], points: 9, reason: "Design QA workflow" },
  { terms: ["qa automation"], points: 9, reason: "QA automation workflow" },
  { terms: ["accessibility automation"], points: 9, reason: "Accessibility automation workflow" },
  { terms: ["documentation automation"], points: 8, reason: "Documentation automation workflow" },
  { terms: ["docs automation"], points: 8, reason: "Docs automation workflow" },
  { terms: ["docgen"], points: 7, reason: "Docgen workflow" },
  { terms: ["component api"], points: 7, reason: "Component API workflow" },
  { terms: ["component apis"], points: 7, reason: "Component API workflow" },
  { terms: ["production-ready ui"], points: 7, reason: "Production-ready UI workflow" },
  { terms: ["production ready ui"], points: 7, reason: "Production-ready UI workflow" },
  { terms: ["component reuse"], points: 7, reason: "Component reuse workflow" },
  { terms: ["design mockups to code"], points: 7, reason: "Mockups-to-code workflow" },
  { terms: ["machine-readable"], points: 6, reason: "Machine-readable DS workflow" },
  { terms: ["machine readable"], points: 6, reason: "Machine-readable DS workflow" }
];

const enterpriseRules: SignalRule[] = [
  { terms: ["governance"], points: 8, reason: "Enterprise governance relevance" },
  { terms: ["internal ai agent"], points: 8, reason: "Internal AI agent relevance" },
  { terms: ["design system agent"], points: 8, reason: "Design System Agent relevance" },
  { terms: ["qa agent"], points: 8, reason: "QA Agent relevance" },
  { terms: ["enterprise"], points: 6, reason: "Enterprise context" },
  { terms: ["react native"], points: 6, reason: "React Native implementation context" },
  { terms: ["react"], points: 5, reason: "React implementation context" },
  { terms: ["metadata"], points: 5, reason: "Structured metadata relevance" },
  { terms: ["api"], points: 4, reason: "API integration relevance" }
];

const noveltyRules: SignalRule[] = [
  { terms: ["new"], points: 4, reason: "New signal" },
  { terms: ["introducing"], points: 5, reason: "Introduced capability" },
  { terms: ["launch"], points: 4, reason: "Launch signal" },
  { terms: ["alpha"], points: 3, reason: "Early capability signal" },
  { terms: ["beta"], points: 3, reason: "Beta capability signal" },
  { terms: ["mcp"], points: 5, reason: "Emerging MCP signal" }
];

const practicalityRules: SignalRule[] = [
  { terms: ["guide"], points: 4, reason: "Practical guide" },
  { terms: ["workflow"], points: 6, reason: "Workflow applicability" },
  { terms: ["integration"], points: 6, reason: "Integration applicability" },
  { terms: ["checklist"], points: 5, reason: "Operational checklist" },
  { terms: ["testing"], points: 5, reason: "Testing applicability" },
  { terms: ["qa"], points: 5, reason: "QA applicability" },
  { terms: ["documentation"], points: 5, reason: "Documentation applicability" },
  { terms: ["docs"], points: 4, reason: "Docs applicability" }
];

const beginnerPenaltyRules: SignalRule[] = [
  { terms: ["101"], points: 12, reason: "Beginner 101 content" },
  { terms: ["basics"], points: 12, reason: "Basic Design System content" },
  { terms: ["beginner"], points: 12, reason: "Beginner content" },
  { terms: ["introduction"], points: 10, reason: "Introductory content" },
  { terms: ["getting started"], points: 10, reason: "Getting-started content" },
  { terms: ["building blocks"], points: 8, reason: "Foundational building-block content" },
  { terms: ["guide to design tokens"], points: 12, reason: "Generic design token guide" },
  { terms: ["what are design tokens"], points: 12, reason: "Generic design token explainer" },
  { terms: ["motion design tokens"], points: 12, reason: "Generic motion token content" },
  { terms: ["what is a design system"], points: 12, reason: "Generic Design System explainer" }
];

// "Typography as a system" alone reads as a generic 101 explainer, but a
// title that pairs it with an explicit "goes beyond the basics" qualifier
// (e.g. "Typography as a System: Beyond Font Choices and Scale") is signaling
// the opposite — advanced content, not an introduction. Scored separately
// from beginnerPenaltyRules because the false positive is specific to this
// one hardcoded phrase, not the whole beginner-penalty mechanism.
const typographyAdvancedQualifiers = ["beyond", "advanced", "deep dive", "in depth", "in-depth"];

function typographySystemPenalty(text: string, reasons: string[]): number {
  if (!text.includes("typography as a system")) return 0;
  if (typographyAdvancedQualifiers.some((qualifier) => text.includes(qualifier))) return 0;

  reasons.push("Generic typography system content");
  return 12;
}

const marketingPenaltyRules: SignalRule[] = [
  { terms: ["pricing"], points: 8, reason: "Pricing/marketing page" },
  { terms: ["book a demo"], points: 10, reason: "Demo CTA marketing page" },
  { terms: ["contact sales"], points: 10, reason: "Sales CTA marketing page" },
  { terms: ["customer story"], points: 7, reason: "Customer-story marketing content" },
  { terms: ["case study"], points: 6, reason: "Case-study marketing content" },
  { terms: ["webinar"], points: 5, reason: "Webinar marketing content" }
];

const genericPenaltyRules: SignalRule[] = [
  { terms: ["prompt engineering"], points: 8, reason: "Generic prompt-engineering content" },
  { terms: ["productivity"], points: 6, reason: "Generic productivity content" },
  { terms: ["career"], points: 8, reason: "Career content" },
  { terms: ["portfolio"], points: 8, reason: "Portfolio content" },
  { terms: ["freelance"], points: 8, reason: "Freelance content" },
  { terms: ["funding"], points: 8, reason: "Funding/news content" },
  { terms: ["privacy leakage"], points: 8, reason: "Generic MCP paper risk" },
  { terms: ["telecom"], points: 8, reason: "Non-UI domain signal" },
  { terms: ["agriculture"], points: 8, reason: "Non-UI domain signal" },
  { terms: ["music retrieval"], points: 8, reason: "Non-UI domain signal" }
];

const arxivUiEvidenceTerms = [
  " ui ",
  "user interface",
  "figma",
  "storybook",
  "component",
  "components",
  "design-to-code",
  "design to code",
  "token",
  "tokens",
  "accessibility",
  " qa ",
  "quality assurance",
  "frontend",
  "front-end"
];

function normalizeText(candidate: Pick<CandidateResource, "title" | "source" | "url" | "snippet" | "rawText" | "cleanSummary">): string {
  return ` ${cleanText(
    `${candidate.title} ${candidate.source} ${candidate.url} ${candidate.snippet} ${candidate.rawText} ${candidate.cleanSummary}`
  ).toLowerCase()} `;
}

function normalizeIdentity(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreRules(text: string, rules: SignalRule[], reasons: string[]): number {
  let score = 0;

  for (const rule of rules) {
    if (rule.terms.every((term) => text.includes(term))) {
      score += rule.points;
      reasons.push(rule.reason);
    }
  }

  return score;
}

function duplicatePenalty(candidate: CandidateResource, candidates: CandidateResource[], reasons: string[]): number {
  const title = normalizeIdentity(candidate.title);
  const url = candidate.url.replace(/[#?].*$/, "").replace(/\/$/, "");
  const titleMatches = candidates.filter((item) => normalizeIdentity(item.title) === title).length;
  const urlMatches = candidates.filter((item) => item.url.replace(/[#?].*$/, "").replace(/\/$/, "") === url).length;
  const duplicateCount = Math.max(titleMatches, urlMatches) - 1;

  if (duplicateCount <= 0) return 0;

  reasons.push("Duplicate candidate");
  return Math.min(12, duplicateCount * 6);
}

function clampNonNegative(value: number): number {
  return Math.max(0, value);
}

function isArxivCandidate(candidate: CandidateResource): boolean {
  return candidate.source.toLowerCase().includes("arxiv") || candidate.url.toLowerCase().includes("arxiv.org");
}

function hasArxivUiEvidence(text: string): boolean {
  return arxivUiEvidenceTerms.some((term) => text.includes(term));
}

export function scoreEditorialCandidate(candidate: CandidateResource, candidates: CandidateResource[] = [candidate]): EditorialScore {
  const text = normalizeText(candidate);
  const editorialReasons: string[] = [];

  const aiScore = scoreRules(text, aiRules, editorialReasons);
  const designSystemScore = scoreRules(text, designSystemRules, editorialReasons);
  const workflowScore = scoreRules(text, workflowRules, editorialReasons);
  const enterpriseScore = scoreRules(text, enterpriseRules, editorialReasons);
  const noveltyScore = scoreRules(text, noveltyRules, editorialReasons);
  const practicalityScore = scoreRules(text, practicalityRules, editorialReasons);
  const sourceScore = candidate.sourceScore;

  const beginnerPenalty = scoreRules(text, beginnerPenaltyRules, editorialReasons) + typographySystemPenalty(text, editorialReasons);
  const marketingPenalty = scoreRules(text, marketingPenaltyRules, editorialReasons);
  let genericPenalty = scoreRules(text, genericPenaltyRules, editorialReasons);

  if (isArxivCandidate(candidate) && !hasArxivUiEvidence(text)) {
    genericPenalty += 30;
    editorialReasons.push("Generic arXiv AI/MCP paper without UI or Design System workflow evidence");
  }

  const duplicatePenaltyScore = duplicatePenalty(candidate, candidates, editorialReasons);

  const rawTotalScore =
    aiScore +
    designSystemScore +
    workflowScore +
    enterpriseScore +
    noveltyScore +
    practicalityScore +
    sourceScore -
    beginnerPenalty -
    marketingPenalty -
    genericPenalty -
    duplicatePenaltyScore;

  const shouldCapIrrelevant = designSystemScore === 0 && workflowScore === 0 && rawTotalScore > 25;
  const cappedScoreReason = shouldCapIrrelevant
    ? "Capped at 25 because designSystemScore and workflowScore are both 0."
    : undefined;
  const totalScore = shouldCapIrrelevant ? 25 : rawTotalScore;

  return {
    aiScore,
    designSystemScore,
    workflowScore,
    enterpriseScore,
    noveltyScore,
    practicalityScore,
    sourceScore,
    beginnerPenalty,
    marketingPenalty,
    genericPenalty,
    duplicatePenalty: duplicatePenaltyScore,
    totalScore: clampNonNegative(totalScore),
    cappedScoreReason,
    editorialReasons
  };
}

export function scoreEditorialCandidates(candidates: CandidateResource[]): EditorialScoredCandidate[] {
  return candidates.map((candidate) => ({
    title: candidate.title,
    url: candidate.url,
    source: candidate.source,
    editorialScore: scoreEditorialCandidate(candidate, candidates)
  }));
}
