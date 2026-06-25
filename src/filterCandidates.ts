import type { CandidateResource } from "./collectCandidates.js";

export type RejectedCandidate = {
  title: string;
  url: string;
  source: string;
  rejectionReason: string;
  directDesignSystemEvidence: string;
  aiEvidence: string;
  designSystemEvidence: string;
  maturityLevel: "advanced" | "intermediate" | "basic";
  relevance_score: number;
  worth_your_time_score: number;
};

export type CandidateFilterResult = {
  accepted: CandidateResource[];
  rejected: RejectedCandidate[];
};

const highPriorityKeywords = [
  "design system",
  "design systems",
  "component",
  "components",
  "component library",
  "component libraries",
  "design tokens",
  "tokens",
  "token architecture",
  "figma",
  "storybook",
  "react",
  "react native",
  "design-to-code",
  "mcp",
  "model context protocol",
  "agent",
  "ai agent",
  "design system agent",
  "qa design system agent",
  "accessibility",
  "governance",
  "ui generation",
  "component generation",
  "code generation",
  "documentation",
  "design qa",
  "visual regression",
  "ui testing",
  "design review",
  "frontend architecture"
];

const directDesignSystemSignals = [
  "design system",
  "design systems",
  "component library",
  "component libraries",
  "design tokens",
  "storybook",
  "design-to-code",
  "design to code",
  "figma component",
  "figma library",
  "mcp figma",
  "mcp storybook",
  "design system agent",
  "qa design system agent",
  "design qa",
  "ai design system",
  "ai design systems",
  "ai component library",
  "ai design tokens"
];

const genericAiSignals = [
  " ai ",
  "artificial intelligence",
  "llm",
  "large language model",
  "genai",
  "generative ai",
  "agentic"
];

const genericMcpOrAgentSignals = [
  "mcp",
  "model context protocol",
  "agent",
  "agents",
  "privacy leakage",
  "script generation",
  "telecom"
];

const falsePositiveDomainSignals = [
  "agriculture",
  "smallholder",
  "farmers",
  "farming",
  "telecom",
  "peptide",
  "protein",
  "scientific workflow",
  "music retrieval",
  "fine-grained music retrieval",
  "figma: towards fine-grained music retrieval"
];

const requiredForGenericAi = [
  "design system",
  "component",
  "token",
  "figma",
  "storybook",
  "design-to-code",
  "ui pattern",
  "accessibility",
  "governance",
  "documentation",
  " qa ",
  "mcp",
  "agent",
  "frontend"
];

const mediumAllowedSignals = [
  "design system",
  "design systems",
  "component library",
  "component libraries",
  "design tokens",
  "storybook",
  "figma",
  "design-to-code",
  "ai-assisted design qa",
  "ai-assisted documentation",
  "ai design systems",
  "component generation",
  "design governance",
  "accessibility",
  "mcp",
  "ai agents",
  "design system agents",
  "qa design system agents"
];

const documentationSpecificSignals = [
  " ai ",
  "artificial intelligence",
  "mcp",
  "model context protocol",
  "design system",
  "design systems",
  "design tokens",
  "components",
  "code connect",
  "dev mode",
  "design-to-code",
  "design to code"
];

const figmaSpecificSignals = [
  " ai ",
  "artificial intelligence",
  "mcp",
  "model context protocol",
  "design system",
  "design systems",
  "components",
  "component",
  "tokens",
  "code connect",
  "dev mode",
  "design-to-code",
  "design to code"
];

const figmaAngleSignals = [
  " ai ",
  "artificial intelligence",
  "mcp",
  "model context protocol",
  "components",
  "component",
  "tokens",
  "code connect",
  "dev mode",
  "design-to-code",
  "design to code",
  "agent"
];

const figmaStrongDesignSystemSignals = [
  "ai applied to design systems",
  "ai design system",
  "ai design systems",
  "mcp",
  "model context protocol",
  "code connect",
  "design-to-code",
  "design to code",
  "design tokens automation",
  "token automation",
  "component generation",
  "storybook integration",
  "ai agents",
  "design system agent",
  "design qa automation"
];

const rejectionSignals = [
  "career",
  "portfolio",
  "freelance",
  "prompt engineering",
  "productivity hacks",
  "startup funding",
  "raised $",
  "listicle",
  "inspiration",
  "beginner",
  "for beginners"
];

const broadAiSources = [
  "openai",
  "anthropic",
  "google deepmind",
  "vercel",
  "github blog",
  "microsoft developer blog",
  "adobe blog",
  "cursor",
  "windsurf",
  "github copilot",
  "claude code",
  "openai codex",
  "vercel ai sdk",
  "langgraph",
  "crewai",
  "autogen",
  "openhands",
  "browser use",
  "playwright mcp"
];

const matureAiAnchors = [
  " ai ",
  "artificial intelligence",
  "llm",
  "large language model",
  "agent",
  "agents",
  "mcp",
  "model context protocol",
  "automation",
  "generative",
  "design-to-code",
  "design to code",
  "code generation",
  "qa automation",
  "accessibility automation",
  "ai-assisted",
  "machine-readable",
  "machine readable",
  "rag",
  "retrieval augmented generation",
  "copilot"
];

const matureWorkflowAnchors = [
  "design system",
  "design systems",
  "design tokens",
  "component library",
  "storybook",
  "figma library",
  "figma components",
  "code connect",
  "design qa",
  "governance",
  "documentation",
  "accessibility",
  "react",
  "react native"
];

const beginnerSignals = [
  "101",
  "basics",
  "beginner",
  "introduction",
  "getting started",
  "building blocks",
  "guide to design tokens",
  "what are design tokens",
  "typography as a system",
  "motion design tokens"
];

const advancedAiSignals = [
  " ai ",
  "artificial intelligence",
  "llm",
  "agent",
  "agents",
  "mcp",
  "model context protocol",
  "automation",
  "design-to-code",
  "design to code",
  "storybook integration",
  "qa automation",
  "token intelligence",
  "machine-readable",
  "machine readable",
  "rag",
  "copilot"
];

function haystack(candidate: CandidateResource): string {
  return ` ${candidate.title} ${candidate.source} ${candidate.snippet} ${candidate.rawText} `.toLowerCase();
}

function candidateContent(candidate: CandidateResource): string {
  return ` ${candidate.title} ${candidate.url} ${candidate.snippet} ${candidate.rawText} `.toLowerCase();
}

function candidatePrimaryContent(candidate: CandidateResource): string {
  return ` ${candidate.title} ${candidate.url} ${candidate.rawText} `.toLowerCase();
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function firstMatch(text: string, keywords: string[]): string | undefined {
  return keywords.find((keyword) => text.includes(keyword));
}

export function aiEvidenceForText(text: string): string {
  const normalized = ` ${text.toLowerCase()} `;
  const match = firstMatch(normalized, matureAiAnchors);
  return match ? `Matched AI anchor: ${match.trim()}` : "";
}

export function designSystemEvidenceForText(text: string): string {
  const normalized = ` ${text.toLowerCase()} `;
  const match = firstMatch(normalized, matureWorkflowAnchors);
  return match ? `Matched Design System workflow anchor: ${match.trim()}` : "";
}

export function maturityLevelForText(text: string): "advanced" | "intermediate" | "basic" {
  const normalized = ` ${text.toLowerCase()} `;
  const hasBeginnerSignal = containsAny(normalized, beginnerSignals);
  const hasAdvancedSignal = containsAny(normalized, advancedAiSignals);

  if (hasBeginnerSignal && !hasAdvancedSignal) return "basic";
  if (hasAdvancedSignal && containsAny(normalized, matureWorkflowAnchors)) return "advanced";
  return "intermediate";
}

function isMedium(candidate: CandidateResource): boolean {
  const source = candidate.source.toLowerCase();
  const url = candidate.url.toLowerCase();
  return source.includes("medium") || url.includes("medium.com");
}

function isBroadAiToolingSource(candidate: CandidateResource): boolean {
  const source = candidate.source.toLowerCase();
  return broadAiSources.some((item) => source.includes(item));
}

function isArxiv(candidate: CandidateResource): boolean {
  return candidate.source.toLowerCase().includes("arxiv") || candidate.url.includes("arxiv.org");
}

function isGenericDocumentationPage(candidate: CandidateResource): boolean {
  const source = candidate.source.toLowerCase();
  const url = candidate.url.toLowerCase();
  return (
    source.includes("documentation") ||
    url.includes("/docs") ||
    url.includes("/documentation") ||
    url.includes("help.figma.com")
  );
}

function isGitHubTopicPage(candidate: CandidateResource): boolean {
  try {
    const url = new URL(candidate.url);
    return url.hostname === "github.com" && url.pathname.startsWith("/topics/");
  } catch {
    return candidate.url.includes("github.com/topics/");
  }
}

function isFigmaSource(candidate: CandidateResource): boolean {
  const source = candidate.source.toLowerCase();
  const url = candidate.url.toLowerCase();
  return source.includes("figma") || url.includes("figma.com") || url.includes("help.figma.com");
}

function isFigmaWeave(candidate: CandidateResource): boolean {
  return candidateContent(candidate).includes("weave");
}

function isGenericDesignSystemLandingPage(candidate: CandidateResource): boolean {
  try {
    const url = new URL(candidate.url);
    const pathname = url.pathname.replace(/\/+$/, "");
    return (
      (url.hostname === "figma.com" || url.hostname.endsWith(".figma.com")) &&
      (pathname === "/design-systems" || pathname === "/best-practices/design-systems")
    );
  } catch {
    return candidate.url.includes("figma.com/design-systems");
  }
}

function hasStrongFigmaDesignSystemAngle(candidate: CandidateResource): boolean {
  const primaryContent = candidatePrimaryContent(candidate);
  const hasDesignSystem = primaryContent.includes("design system") || primaryContent.includes("design systems");
  const hasFigma = primaryContent.includes("figma") || candidate.url.includes("figma.com");

  return (
    (hasDesignSystem && containsAny(primaryContent, figmaStrongDesignSystemSignals)) ||
    (hasFigma && primaryContent.includes("mcp") && hasDesignSystem) ||
    (hasFigma && (primaryContent.includes("design-to-code") || primaryContent.includes("design to code"))) ||
    (hasFigma && primaryContent.includes("code connect")) ||
    (hasFigma && primaryContent.includes("component generation"))
  );
}

function rejectionReason(candidate: CandidateResource): string | undefined {
  const text = haystack(candidate);
  const content = candidateContent(candidate);
  const aiEvidence = aiEvidenceForText(text);
  const designSystemEvidence = designSystemEvidenceForText(text);
  const maturityLevel = maturityLevelForText(text);
  const hasHighPriorityKeyword = containsAny(text, highPriorityKeywords);
  const hasDirectEvidence = candidate.directDesignSystemEvidence.trim().length > 0;
  const hasDirectDesignSystemSignal = containsAny(text, directDesignSystemSignals);

  if (!aiEvidence) {
    return "Rejected because no AI relevance anchor was found for a mature Design System workflow.";
  }

  if (!designSystemEvidence) {
    return "Rejected because no Design System workflow anchor was found.";
  }

  if (maturityLevel === "basic") {
    return "Rejected beginner/basic Design System education; mature enterprise DS teams need advanced AI, automation, validation, governance, or integration signals.";
  }

  if (isGitHubTopicPage(candidate)) {
    return "Rejected GitHub topic page.";
  }

  if (!hasDirectEvidence) {
    return "Rejected because directDesignSystemEvidence is empty.";
  }

  if (containsAny(content, falsePositiveDomainSignals) && !hasDirectDesignSystemSignal) {
    return "Rejected false-positive domain match without explicit UI or Design System evidence.";
  }

  if (!hasHighPriorityKeyword) {
    return "Rejected because no high-priority Design System keyword was found.";
  }

  if (isArxiv(candidate) && (!hasDirectDesignSystemSignal || containsAny(content, falsePositiveDomainSignals))) {
    return "Rejected generic arXiv MCP/agent paper without explicit UI, Design System, component, Figma, Storybook, token, frontend, accessibility, or Design QA evidence.";
  }

  if (isFigmaSource(candidate) && !containsAny(content, figmaSpecificSignals)) {
    return "Rejected generic Figma page without AI, MCP, design systems, components, tokens, Code Connect, Dev Mode, or design-to-code angle.";
  }

  if (isGenericDesignSystemLandingPage(candidate) && !hasStrongFigmaDesignSystemAngle(candidate)) {
    return "Rejected generic Design System landing page without AI, MCP, Code Connect, design-to-code, token automation, component generation, Storybook integration, AI agents, or Design QA automation.";
  }

  if (isFigmaSource(candidate) && !hasStrongFigmaDesignSystemAngle(candidate)) {
    return "Rejected Figma source without design systems plus AI/MCP/agent/code/tokens/component generation, Figma+MCP+design systems, Figma+design-to-code, Figma+Code Connect, or Figma+component generation.";
  }

  if (isFigmaSource(candidate) && !containsAny(content, figmaAngleSignals)) {
    return "Rejected generic Figma page without AI, MCP, component, token, Code Connect, Dev Mode, agent, or design-to-code angle.";
  }

  if (isFigmaWeave(candidate) && !hasDirectDesignSystemSignal) {
    return "Rejected Figma Weave/media workflow content without clear Design System evidence.";
  }

  if (isGenericDocumentationPage(candidate) && !containsAny(content, documentationSpecificSignals)) {
    return "Rejected generic documentation page without AI, MCP, Design System, token, component, or design-to-code specificity.";
  }

  if (containsAny(text, rejectionSignals) && !containsAny(text, requiredForGenericAi)) {
    return "Rejected low-quality/generic editorial pattern.";
  }

  if (isMedium(candidate) && !containsAny(text, mediumAllowedSignals)) {
    return "Rejected Medium item without explicit Design System, Figma, Storybook, token, MCP, accessibility, or AI Design QA relevance.";
  }

  const looksLikeGenericAi = containsAny(text, genericAiSignals);
  if ((looksLikeGenericAi || isBroadAiToolingSource(candidate)) && !containsAny(text, requiredForGenericAi)) {
    return "Rejected generic AI/tooling item without Design System workflow connection.";
  }

  if (candidate.relevanceScore < 4) {
    return "Rejected because relevance_score is below 4.";
  }

  if (candidate.worthYourTimeScore < 4) {
    return "Rejected because worth_your_time_score is below 4.";
  }

  if (candidate.sourceScore < 3 && candidate.relevanceScore < 5) {
    return "Rejected because sourceScore is below 3 and relevance is not exceptional.";
  }

  return undefined;
}

export function editorialFinalScore(candidate: CandidateResource): number {
  return (
    candidate.worthYourTimeScore * 0.35 +
    candidate.relevanceScore * 0.25 +
    candidate.practicalityScore * 0.15 +
    candidate.sourceScore * 0.1 +
    candidate.technicalDepthScore * 0.1 +
    candidate.noveltyScore * 0.05
  );
}

export function filterCandidatesWithDiagnostics(candidates: CandidateResource[]): CandidateFilterResult {
  const accepted: CandidateResource[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const candidate of candidates) {
    const reason = rejectionReason(candidate);

    if (reason) {
      rejected.push({
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        rejectionReason: reason,
        directDesignSystemEvidence: candidate.directDesignSystemEvidence,
        aiEvidence: aiEvidenceForText(haystack(candidate)),
        designSystemEvidence: designSystemEvidenceForText(haystack(candidate)),
        maturityLevel: maturityLevelForText(haystack(candidate)),
        relevance_score: candidate.relevanceScore,
        worth_your_time_score: candidate.worthYourTimeScore
      });
    } else {
      accepted.push(candidate);
    }
  }

  accepted.sort((a, b) => {
    const scoreDifference = editorialFinalScore(b) - editorialFinalScore(a);
    if (scoreDifference !== 0) return scoreDifference;
    return b.recencyScore - a.recencyScore;
  });

  return { accepted, rejected };
}

export function filterCandidates(candidates: CandidateResource[]): CandidateResource[] {
  return filterCandidatesWithDiagnostics(candidates).accepted;
}
