import type { CandidateResource } from "./collectCandidates.js";
import type { EditorialBrief } from "./editorialBrief.js";
import type { EditorialSelectionDecision } from "./editorialSelection.js";
import type { CandidateSignal, SignalEvidence } from "./editorialThesis.js";
import { cleanText, truncateText } from "./textUtils.js";

export type LearningRecommendation = {
  title: string;
  url: string;
  author: string;
  source: string;
  format: string;
  estimatedMinutes: number;
  readerGain: string;
  whyRecommended: string;
  confidence: number;
  relationshipToThesis: string;
};

export type LearningRecommendationDebug = {
  recommendation: LearningRecommendation | null;
  whyItWon: string;
  alternativesLost: Array<{
    title: string;
    url: string;
    source: string;
    sourceCategory: CandidateResource["sourceCategory"];
    score: number;
    reason: string;
  }>;
  nullConsidered: boolean;
  nullReason: string;
};

type LearningRecommendationInput = {
  editorialBrief: EditorialBrief;
  thesis: CandidateSignal | null;
  evidence: SignalEvidence[];
  qualifiedResources: CandidateResource[];
  selectionDecisions: EditorialSelectionDecision[];
};

type ScoredLearningCandidate = {
  candidate: CandidateResource;
  score: number;
  relationScore: number;
  teachingScore: number;
  avoidPenalty: number;
  reasons: string[];
};

const preferredCategories = new Set<CandidateResource["sourceCategory"]>(["Practical", "Talk", "Community"]);

const teachingTerms = [
  "guide",
  "tutorial",
  "walkthrough",
  "essay",
  "explainer",
  "talk",
  "lesson",
  "course",
  "how to",
  "example",
  "examples",
  "checklist",
  "playbook",
  "pattern",
  "case study",
  "deep dive"
];

const avoidedTerms = [
  "release notes",
  "changelog",
  "releases.atom",
  "github.com/releases",
  "api reference",
  "reference documentation",
  "rfc",
  "specification"
];

const stopWords = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "into",
  "where",
  "what",
  "when",
  "which",
  "will",
  "would",
  "should",
  "could",
  "about",
  "because",
  "before",
  "after",
  "than",
  "then",
  "week",
  "teams",
  "system",
  "systems"
]);

export function emptyLearningRecommendation(): LearningRecommendationDebug {
  return {
    recommendation: null,
    whyItWon: "",
    alternativesLost: [],
    nullConsidered: true,
    nullReason: "Learning Recommendation did not run because no qualified resources were available."
  };
}

function normalizeUrl(url: string): string {
  return url.replace(/[#?].*$/, "").replace(/\/$/, "");
}

function uniqueQualifiedResources(resources: CandidateResource[]): CandidateResource[] {
  const seen = new Set<string>();
  const qualified: CandidateResource[] = [];

  for (const resource of resources) {
    const key = normalizeUrl(resource.url);
    if (seen.has(key)) continue;
    qualified.push(resource);
    seen.add(key);
  }

  return qualified;
}

function textForCandidate(candidate: CandidateResource): string {
  return cleanText(`${candidate.title} ${candidate.source} ${candidate.url} ${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText}`).toLowerCase();
}

function relationTerms(input: LearningRecommendationInput): Set<string> {
  const text = cleanText(
    [
      input.editorialBrief.thesis,
      input.editorialBrief.narrativeHeadline,
      input.editorialBrief.newReality,
      input.editorialBrief.whyNow,
      input.editorialBrief.editorialPosition,
      input.thesis?.claim,
      input.thesis?.whyNow
    ]
      .filter(Boolean)
      .join(" ")
  )
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ");

  return new Set(text.split(/\s+/).filter((term) => term.length > 3 && !stopWords.has(term)));
}

function countMatchingTerms(text: string, terms: Set<string>): number {
  let count = 0;
  for (const term of terms) {
    if (text.includes(term)) count += 1;
  }
  return count;
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function formatFor(candidate: CandidateResource): string {
  const text = textForCandidate(candidate);
  if (candidate.sourceCategory === "Talk" || text.includes("youtube") || text.includes("conference") || text.includes("session")) {
    return "Talk";
  }
  if (candidate.sourceCategory === "Research") return "Research";
  if (text.includes("docs") || text.includes("documentation")) return "Docs";
  if (text.includes("course") || text.includes("frontend masters")) return "Course";
  if (text.includes("essay") || candidate.sourceCategory === "Practical") return "Essay";
  return "Article";
}

function estimateMinutes(candidate: CandidateResource, format: string): number {
  if (format === "Talk") return 20;
  if (format === "Course") return 20;
  const textLength = `${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText}`.split(/\s+/).filter(Boolean).length;
  return Math.max(6, Math.min(20, Math.ceil(textLength / 140) + 5));
}

function scoreCandidate(candidate: CandidateResource, thesisTerms: Set<string>): ScoredLearningCandidate {
  const text = textForCandidate(candidate);
  const reasons: string[] = [];
  const relationScore = Math.min(20, countMatchingTerms(text, thesisTerms) * 4);
  const teachingScore = Math.round(candidate.readerValue * 0.35 + candidate.learningValue * 0.45);
  let categoryScore = 0;
  let avoidPenalty = 0;

  if (preferredCategories.has(candidate.sourceCategory)) {
    categoryScore += 18;
    reasons.push(`${candidate.sourceCategory} source is better suited to teaching than proving`);
  } else if (candidate.sourceCategory === "Official") {
    categoryScore += 2;
    reasons.push("official source is useful evidence but weaker as a learning artifact");
  } else if (candidate.sourceCategory === "Research") {
    categoryScore -= 14;
    reasons.push("research source is stronger for trend detection than designer learning");
  } else if (candidate.sourceCategory === "Social") {
    categoryScore -= 18;
    reasons.push("social source is too thin for a learning recommendation");
  }

  if (hasAny(text, teachingTerms)) {
    categoryScore += 14;
    reasons.push("contains teaching cues such as examples, guide, talk, or walkthrough");
  }

  if (hasAny(text, avoidedTerms)) {
    avoidPenalty += 26;
    reasons.push("release-note, RFC, API, or reference format is avoided unless no teaching artifact exists");
  }

  if (relationScore > 0) {
    reasons.push("shares language with this week's thesis");
  }

  return {
    candidate,
    score: teachingScore + categoryScore + relationScore - avoidPenalty,
    relationScore,
    teachingScore,
    avoidPenalty,
    reasons
  };
}

function relationshipToThesisFor(candidate: CandidateResource, input: LearningRecommendationInput): string {
  const thesis = input.editorialBrief.thesis || input.thesis?.claim || "this week's thesis";
  return truncateText(`${candidate.title} helps unpack the practical meaning of ${thesis.charAt(0).toLowerCase()}${thesis.slice(1)}`, 180);
}

function recommendationFor(scored: ScoredLearningCandidate, input: LearningRecommendationInput): LearningRecommendation {
  const format = formatFor(scored.candidate);
  return {
    title: scored.candidate.title,
    url: scored.candidate.url,
    author: scored.candidate.source,
    source: scored.candidate.source,
    format,
    estimatedMinutes: estimateMinutes(scored.candidate, format),
    readerGain: truncateText(
      `A clearer mental model for how this week's shift changes Design System practice, not just whether the evidence is true.`,
      170
    ),
    whyRecommended: truncateText(
      `It is the strongest teaching artifact in the qualified set: ${scored.reasons.slice(0, 2).join("; ")}.`,
      190
    ),
    confidence: Math.max(0.5, Math.min(0.95, Math.round((scored.score / 100) * 100) / 100)),
    relationshipToThesis: relationshipToThesisFor(scored.candidate, input)
  };
}

export function selectLearningRecommendation(input: LearningRecommendationInput): LearningRecommendationDebug {
  if (!input.editorialBrief.thesis && !input.thesis?.claim) {
    return {
      recommendation: null,
      whyItWon: "",
      alternativesLost: [],
      nullConsidered: true,
      nullReason: "Learning Recommendation returned null because no editorial thesis was available to teach."
    };
  }

  const qualified = uniqueQualifiedResources(input.qualifiedResources);
  if (qualified.length === 0) {
    return emptyLearningRecommendation();
  }

  const thesisTerms = relationTerms(input);
  const scored = qualified.map((candidate) => scoreCandidate(candidate, thesisTerms)).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const nullReason = "Null was considered because the recommendation should disappear rather than downgrade to mediocre documentation.";
  const threshold = 72;
  const bestIsAvoidedOfficial = best.candidate.sourceCategory === "Official" && best.avoidPenalty > 0;

  if (!best || best.score < threshold || bestIsAvoidedOfficial) {
    return {
      recommendation: null,
      whyItWon: "",
      alternativesLost: scored.slice(0, 5).map((item) => ({
        title: item.candidate.title,
        url: item.candidate.url,
        source: item.candidate.source,
        sourceCategory: item.candidate.sourceCategory,
        score: item.score,
        reason: item.score < threshold ? "Did not clear the teaching threshold." : item.reasons.join("; ")
      })),
      nullConsidered: true,
      nullReason
    };
  }

  return {
    recommendation: recommendationFor(best, input),
    whyItWon: `${best.candidate.title} won because it best balances clarity, learning value, and relationship to the thesis, independent of Evidence selection.`,
    alternativesLost: scored.slice(1, 6).map((item) => ({
      title: item.candidate.title,
      url: item.candidate.url,
      source: item.candidate.source,
      sourceCategory: item.candidate.sourceCategory,
      score: item.score,
      reason: item.avoidPenalty > 0 ? "Lost because the format is closer to release/reference material than teaching." : item.reasons.join("; ")
    })),
    nullConsidered: true,
    nullReason
  };
}
