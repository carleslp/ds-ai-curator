import type { CandidateResource } from "./collectCandidates.js";
import { cleanText } from "./textUtils.js";

export type EditorialQualificationDecision = "qualified" | "rejected";

export type EditorialQualification = {
  title: string;
  url: string;
  source: string;
  domainAffinity: number;
  audienceFit: number;
  teachingValue: number;
  practicalRelevance: number;
  editorialConfidence: number;
  qualificationDecision: EditorialQualificationDecision;
  qualificationReason: string;
};

export type EditorialQualificationResult = {
  qualifiedCandidates: CandidateResource[];
  rejectedCandidates: CandidateResource[];
  editorialQualification: EditorialQualification[];
};

const preferredSources = [
  "medium",
  "smashing",
  "shopify",
  "airbnb",
  "github blog",
  "github engineering",
  "stripe",
  "adobe",
  "figma",
  "storybook",
  "react",
  "react native",
  "builder.io",
  "frontend masters",
  "youtube",
  "config",
  "into design systems",
  "design systems wtf",
  "evil martians",
  "martin fowler"
];

const designSystemTerms = [
  "design system",
  "design systems",
  "storybook",
  "figma",
  "design tokens",
  "tokens",
  "accessibility",
  "react native",
  "react",
  "ux engineering",
  "component library",
  "component libraries",
  "component api",
  "component metadata",
  "component manifest",
  "code connect",
  "dev mode",
  "design-to-code",
  "design to code",
  "frontend",
  "front-end",
  "developer experience",
  "dx",
  "ui engineering",
  "ui code generation",
  "component generation",
  "documentation automation",
  "qa automation",
  "visual regression"
];

const unrelatedDomains = [
  "agriculture",
  "agricultural",
  "farmer",
  "farmers",
  "smallholder",
  "island smallholder",
  "healthcare",
  "medical",
  "medicine",
  "biology",
  "protein",
  "peptide",
  "finance",
  "trading",
  "education",
  "classroom",
  "politics",
  "farming",
  "telecom",
  "music retrieval"
];

const genericAiTerms = [
  "benchmark",
  "dataset",
  "survey",
  "large language model",
  "llm",
  "agent",
  "multi-agent",
  "rag",
  "prompt engineering"
];

const teachingTerms = [
  "guide",
  "tutorial",
  "walkthrough",
  "essay",
  "explainer",
  "talk",
  "examples",
  "example",
  "checklist",
  "playbook",
  "case study",
  "deep dive",
  "how to",
  "pattern"
];

const practicalTerms = [
  "workflow",
  "implementation",
  "migration",
  "integration",
  "governance",
  "documentation",
  "docs",
  "testing",
  "qa",
  "automation",
  "component",
  "tokens",
  "accessibility",
  "figma",
  "storybook",
  "react"
];

const penalizedTerms = [
  "github.com/topics",
  "/topics/",
  "github issue",
  "github issues",
  "/issues/",
  "release notes",
  "changelog",
  "releases.atom",
  "/releases",
  "pricing",
  "book a demo",
  "contact sales",
  "marketing",
  "landing page",
  "documentation index",
  "docs index",
  "reference index",
  "help center",
  "search results",
  "link directory",
  "directory"
];

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function candidateText(candidate: CandidateResource): string {
  return cleanText(
    `${candidate.title} ${candidate.source} ${candidate.url} ${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText} ${candidate.directDesignSystemEvidence}`
  ).toLowerCase();
}

function countMatches(text: string, terms: string[]): number {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function isPreferredSource(text: string): boolean {
  return hasAny(text, preferredSources);
}

function isDocumentationIndex(candidate: CandidateResource, text: string): boolean {
  const url = candidate.url.toLowerCase();
  const title = candidate.title.toLowerCase();
  return (
    hasAny(text, ["documentation index", "docs index", "reference index", "help center", "search results", "link directory"]) ||
    url.includes("/search?") ||
    (title.includes("documentation") && !hasAny(text, ["ai", "mcp", "agent", "component", "token", "design-to-code", "code connect"]))
  );
}

function domainAffinityFor(candidate: CandidateResource, text: string): number {
  if (hasAny(text, unrelatedDomains)) return 0;

  const dsMatches = countMatches(text, designSystemTerms);
  if (dsMatches >= 4) return 10;
  if (dsMatches >= 2) return 9;
  if (hasAny(text, ["frontend architecture", "developer experience", "ai tooling for ui", "ui engineering"])) return 8;
  if (hasAny(text, ["software engineering", "developer tools", "code generation"])) return 5;
  if (hasAny(text, genericAiTerms)) return 2;
  if (candidate.directDesignSystemEvidence.trim().length > 0) return 8;
  return 0;
}

function audienceFitFor(candidate: CandidateResource, text: string, domainAffinity: number): number {
  let score = domainAffinity;
  if (isPreferredSource(text)) score += 1;
  if (candidate.readerValue >= 80) score += 1;
  if (hasAny(text, teachingTerms)) score += 1;
  if (hasAny(text, unrelatedDomains)) score = 0;
  if (isDocumentationIndex(candidate, text)) score -= 5;
  if (hasAny(text, ["/topics/", "github.com/topics", "/issues/", "pricing", "book a demo", "contact sales"])) score -= 4;
  if (hasAny(text, ["release notes", "changelog", "/releases"])) score -= 2;
  if (candidate.sourceCategory === "Research" && domainAffinity < 9) score -= 3;
  if (candidate.sourceCategory === "Social") score -= 2;
  return clampScore(score);
}

function teachingValueFor(candidate: CandidateResource, text: string): number {
  let score = Math.round(candidate.learningValue / 12);
  score += Math.min(3, countMatches(text, teachingTerms));
  if (isPreferredSource(text)) score += 1;
  if (isDocumentationIndex(candidate, text)) score -= 5;
  if (hasAny(text, ["release notes", "changelog", "/releases", "api reference", "reference documentation"])) score -= 3;
  if (hasAny(text, unrelatedDomains)) score = 0;
  return clampScore(score);
}

function practicalRelevanceFor(candidate: CandidateResource, text: string, domainAffinity: number): number {
  let score = Math.min(10, domainAffinity);
  score += Math.min(3, countMatches(text, practicalTerms));
  if (candidate.practicalityScore >= 4) score += 1;
  if (hasAny(text, ["within design system", "mature design system", "component workflow", "design qa"])) score += 1;
  if (hasAny(text, unrelatedDomains)) score = 0;
  if (isDocumentationIndex(candidate, text)) score -= 3;
  return clampScore(score);
}

function editorialConfidenceFor(scores: Pick<EditorialQualification, "domainAffinity" | "audienceFit" | "teachingValue" | "practicalRelevance">): number {
  return clampScore(
    scores.domainAffinity * 0.35 +
      scores.audienceFit * 0.25 +
      scores.teachingValue * 0.2 +
      scores.practicalRelevance * 0.2
  );
}

function qualificationReasonFor(
  candidate: CandidateResource,
  text: string,
  scores: Pick<EditorialQualification, "domainAffinity" | "audienceFit" | "teachingValue" | "practicalRelevance" | "editorialConfidence">,
  decision: EditorialQualificationDecision
): string {
  if (decision === "rejected") {
    if (hasAny(text, unrelatedDomains)) {
      return "Rejected by EQE because the resource belongs to an unrelated domain, not the Design Systems editorial universe.";
    }
    if (isDocumentationIndex(candidate, text)) {
      return "Rejected by EQE because it is a generic documentation or search index rather than a specific editorial artifact.";
    }
    if (scores.domainAffinity < 7) {
      return `Rejected by EQE because domain affinity ${scores.domainAffinity}/10 is below the Design Systems threshold.`;
    }
    if (scores.audienceFit < 6) {
      return `Rejected by EQE because audience fit ${scores.audienceFit}/10 is too weak for a Senior Design System Designer.`;
    }
    return "Rejected by EQE because it is technically relevant but editorially weak.";
  }

  const strengths = [
    scores.domainAffinity >= 8 ? "strong Design Systems domain affinity" : "",
    scores.audienceFit >= 7 ? "credible senior-practitioner audience fit" : "",
    scores.teachingValue >= 7 ? "useful teaching value" : "",
    scores.practicalRelevance >= 7 ? "practical workflow relevance" : ""
  ].filter(Boolean);
  return `Qualified by EQE for ${strengths.join(", ") || "sufficient editorial fit"}.`;
}

export function evaluateEditorialQualification(candidate: CandidateResource): EditorialQualification {
  const text = candidateText(candidate);
  const domainAffinity = domainAffinityFor(candidate, text);
  const audienceFit = audienceFitFor(candidate, text, domainAffinity);
  const teachingValue = teachingValueFor(candidate, text);
  const practicalRelevance = practicalRelevanceFor(candidate, text, domainAffinity);
  const editorialConfidence = editorialConfidenceFor({
    domainAffinity,
    audienceFit,
    teachingValue,
    practicalRelevance
  });
  const hardRejected =
    hasAny(text, unrelatedDomains) ||
    isDocumentationIndex(candidate, text) ||
    hasAny(text, ["github.com/topics", "/topics/"]);
  const thresholdRejected = (domainAffinity < 7 || audienceFit < 6) && editorialConfidence < 9;
  const qualificationDecision: EditorialQualificationDecision = hardRejected || thresholdRejected ? "rejected" : "qualified";

  return {
    title: candidate.title,
    url: candidate.url,
    source: candidate.source,
    domainAffinity,
    audienceFit,
    teachingValue,
    practicalRelevance,
    editorialConfidence,
    qualificationDecision,
    qualificationReason: qualificationReasonFor(
      candidate,
      text,
      {
        domainAffinity,
        audienceFit,
        teachingValue,
        practicalRelevance,
        editorialConfidence
      },
      qualificationDecision
    )
  };
}

export function qualifyEditorialCandidates(candidates: CandidateResource[]): EditorialQualificationResult {
  const editorialQualification = candidates.map(evaluateEditorialQualification);
  const qualificationByUrl = new Map(editorialQualification.map((qualification) => [qualification.url, qualification]));

  return {
    qualifiedCandidates: candidates.filter(
      (candidate) => qualificationByUrl.get(candidate.url)?.qualificationDecision === "qualified"
    ),
    rejectedCandidates: candidates.filter(
      (candidate) => qualificationByUrl.get(candidate.url)?.qualificationDecision === "rejected"
    ),
    editorialQualification
  };
}
