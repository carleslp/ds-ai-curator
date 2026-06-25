import type { CandidateResource } from "./collectCandidates.js";

export type RejectedCandidate = {
  title: string;
  url: string;
  source: string;
  rejectionReason: string;
  directDesignSystemEvidence: string;
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
  "figma",
  "storybook",
  "design-to-code",
  "frontend",
  "accessibility",
  "design qa",
  "ui generation",
  "component generation",
  "react",
  "react native"
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
  "component",
  "components",
  "design-to-code"
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

function haystack(candidate: CandidateResource): string {
  return ` ${candidate.title} ${candidate.source} ${candidate.snippet} ${candidate.rawText} `.toLowerCase();
}

function candidateContent(candidate: CandidateResource): string {
  return ` ${candidate.title} ${candidate.url} ${candidate.snippet} ${candidate.rawText} `.toLowerCase();
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
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

function rejectionReason(candidate: CandidateResource): string | undefined {
  const text = haystack(candidate);
  const hasHighPriorityKeyword = containsAny(text, highPriorityKeywords);
  const hasDirectEvidence = candidate.directDesignSystemEvidence.trim().length > 0;
  const hasDirectDesignSystemSignal = containsAny(text, directDesignSystemSignals);

  if (isGitHubTopicPage(candidate)) {
    return "Rejected GitHub topic page.";
  }

  if (!hasDirectEvidence) {
    return "Rejected because directDesignSystemEvidence is empty.";
  }

  if (!hasHighPriorityKeyword) {
    return "Rejected because no high-priority Design System keyword was found.";
  }

  if (isArxiv(candidate) && containsAny(text, genericMcpOrAgentSignals) && !hasDirectDesignSystemSignal) {
    return "Rejected generic arXiv MCP/agent paper without explicit UI, Design System, component, Figma, Storybook, token, frontend, accessibility, or Design QA evidence.";
  }

  if (isGenericDocumentationPage(candidate) && !containsAny(candidateContent(candidate), documentationSpecificSignals)) {
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
