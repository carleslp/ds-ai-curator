import type { CandidateResource } from "./collectCandidates.js";

const highPriorityKeywords = [
  "design system",
  "design systems",
  "component library",
  "design tokens",
  "tokens",
  "figma",
  "storybook",
  "react",
  "react native",
  "design-to-code",
  "mcp",
  "agent",
  "ai agent",
  "accessibility",
  "governance",
  "ui generation",
  "component generation",
  "code generation",
  "documentation",
  "design qa"
];

const genericAiSignals = [" ai ", "artificial intelligence", "llm", "large language model", "genai"];

const requiredForGenericAi = [
  "design system",
  "component",
  "token",
  "figma",
  "storybook",
  "design-to-code",
  "ui pattern",
  "accessibility",
  "governance"
];

function haystack(candidate: CandidateResource): string {
  return ` ${candidate.title} ${candidate.source} ${candidate.snippet} ${candidate.rawText ?? ""} `.toLowerCase();
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function filterCandidates(candidates: CandidateResource[]): CandidateResource[] {
  return candidates.filter((candidate) => {
    const text = haystack(candidate);
    const hasHighPriorityKeyword = containsAny(text, highPriorityKeywords);

    if (!hasHighPriorityKeyword) {
      return false;
    }

    const looksLikeGenericAi = containsAny(text, genericAiSignals);
    if (looksLikeGenericAi && !containsAny(text, requiredForGenericAi)) {
      return false;
    }

    return true;
  });
}
