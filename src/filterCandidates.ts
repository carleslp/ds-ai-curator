import type { CandidateResource } from "./collectCandidates.js";

const highPriorityKeywords = [
  "design system",
  "design systems",
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

const genericAiSignals = [
  " ai ",
  "artificial intelligence",
  "llm",
  "large language model",
  "genai",
  "generative ai",
  "agentic"
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
  "agent"
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

export function filterCandidates(candidates: CandidateResource[]): CandidateResource[] {
  return candidates
    .filter((candidate) => {
      const text = haystack(candidate);
      const hasHighPriorityKeyword = containsAny(text, highPriorityKeywords);

      if (!hasHighPriorityKeyword) {
        return false;
      }

      if (containsAny(text, rejectionSignals) && !containsAny(text, requiredForGenericAi)) {
        return false;
      }

      if (isMedium(candidate) && !containsAny(text, mediumAllowedSignals)) {
        return false;
      }

      const looksLikeGenericAi = containsAny(text, genericAiSignals);
      if ((looksLikeGenericAi || isBroadAiToolingSource(candidate)) && !containsAny(text, requiredForGenericAi)) {
        return false;
      }

      if (candidate.relevanceScore < 4) {
        return false;
      }

      if (candidate.sourceScore < 3 && candidate.relevanceScore < 5) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const scoreDifference = editorialFinalScore(b) - editorialFinalScore(a);
      if (scoreDifference !== 0) return scoreDifference;
      return b.recencyScore - a.recencyScore;
    });
}
