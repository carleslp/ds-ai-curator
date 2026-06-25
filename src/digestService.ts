import {
  collectCandidatesWithDiagnostics,
  type CandidateResource,
  type SourceResult
} from "./collectCandidates.js";
import { withEditorialSections } from "./editorial.js";
import type { Digest, Resource } from "./emailTemplate.js";
import {
  editorialFinalScore,
  filterCandidatesWithDiagnostics,
  type RejectedCandidate
} from "./filterCandidates.js";
import {
  rankAndSummarizeWithGemini,
  rankAndSummarizeWithOpenAI,
  type ProviderName
} from "./rankAndSummarize.js";
import { truncateText } from "./textUtils.js";

type DigestMode = "liveOpenAI" | "liveGemini" | "candidateFallback" | "cachedDigest" | "emergencyFallback";

type CandidatePreview = {
  title: string;
  url: string;
  source: string;
  published_date: string;
  sourceScore: number;
  directDesignSystemEvidence: string;
};

type SelectedPreview = {
  title: string;
  url: string;
  source: string;
  relevance_score: number;
  worth_your_time_score: number;
  directDesignSystemEvidence: string;
};

type DailyDigestResult = {
  digest: Digest;
  mode: DigestMode;
  hasOpenAIKey: boolean;
  hasGeminiKey: boolean;
  candidateCount: number;
  filteredCandidateCount: number;
  selectedResourceCount: number;
  fallbackReason?: string;
  sourceResults: SourceResult[];
  rejectedCandidates: RejectedCandidate[];
  candidatesPreview: CandidatePreview[];
  selectedPreview: SelectedPreview[];
};

let cachedDigest: Digest | undefined;
const recentSelectedUrls = new Map<string, number>();
const historyWindowMs = 30 * 24 * 60 * 60 * 1000;

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function buildSubject(date: string): string {
  return `DS × AI Curator — ${date}`;
}

function createEmergencyFallbackDigest(): Digest {
  return withEditorialSections({
    date: todayIsoDate(),
    trend_summary: "Fallback: candidate collection and live ranking are currently unavailable.",
    resources: []
  });
}

function normalizeUrl(url: string): string {
  return url.replace(/[#?].*$/, "").replace(/\/$/, "");
}

function pruneRecentHistory(): void {
  const cutoff = Date.now() - historyWindowMs;
  for (const [url, timestamp] of recentSelectedUrls.entries()) {
    if (timestamp < cutoff) {
      recentSelectedUrls.delete(url);
    }
  }
}

function filterRecentCandidates(candidates: CandidateResource[]): CandidateResource[] {
  pruneRecentHistory();
  const freshCandidates = candidates.filter((candidate) => !recentSelectedUrls.has(normalizeUrl(candidate.url)));
  return freshCandidates.length >= 3 ? freshCandidates : candidates;
}

function rememberDigest(digest: Digest): void {
  pruneRecentHistory();
  const now = Date.now();
  for (const resource of digest.resources) {
    recentSelectedUrls.set(normalizeUrl(resource.url), now);
  }
}

function candidateToResource(candidate: CandidateResource): Resource {
  const cleanSummary = truncateText(candidate.cleanSummary || candidate.snippet, 280);

  return {
    title: candidate.title,
    url: candidate.url,
    source: candidate.source,
    type: "Article",
    published_date: candidate.published_date,
    summary: cleanSummary || "Candidate collected from a curated source for Design System review.",
    cleanSummary,
    design_system_angle:
      "Selected from curated Design System, UI engineering, tooling, or research sources and ranked against the Figma-to-Storybook workflow.",
    why_it_matters_to_our_team: truncateText(
      "Worth reviewing because it connects to components, tokens, documentation, QA, governance, or AI-assisted delivery for an enterprise Design System team.",
      220
    ),
    directDesignSystemEvidence: candidate.directDesignSystemEvidence,
    is_real_source: true,
    relevance_score: candidate.relevanceScore,
    worth_your_time_score: candidate.worthYourTimeScore
  };
}

function hasReusableEditorialLearning(candidate: CandidateResource): boolean {
  const text = `${candidate.title} ${candidate.source} ${candidate.url} ${candidate.cleanSummary} ${candidate.snippet}`.toLowerCase();
  const releaseOnly = /\b(changelog|release notes)\b/.test(text) || /\breleases?\b/.test(candidate.source.toLowerCase());
  const learningSignals = [
    "workflow",
    "guide",
    "patterns",
    "design system",
    "design systems",
    "design tokens",
    "storybook",
    "figma",
    "mcp",
    "agent",
    "automation",
    "documentation",
    "accessibility",
    "qa",
    "testing",
    "governance"
  ];
  const marketingSignals = ["pricing", "customer story", "case study", "book a demo", "contact sales"];
  const hasLearningSignal = learningSignals.some((signal) => text.includes(signal));
  const isMarketingPage = marketingSignals.some((signal) => text.includes(signal));

  if (isMarketingPage) return false;
  if (releaseOnly) return false;
  return hasLearningSignal;
}

function buildCandidateFallbackDigest(filteredCandidates: CandidateResource[]): Digest {
  const rankedCandidates = [...filteredCandidates]
    .filter(
      (candidate) =>
        candidate.relevanceScore >= 4 &&
        candidate.worthYourTimeScore >= 4 &&
        candidate.directDesignSystemEvidence.trim().length > 0 &&
        hasReusableEditorialLearning(candidate)
    )
    .sort((a, b) => {
      const scoreDifference = editorialFinalScore(b) - editorialFinalScore(a);
      if (scoreDifference !== 0) return scoreDifference;
      return b.recencyScore - a.recencyScore;
    });
  const selectedCandidates: CandidateResource[] = [];
  const sourceCounts = new Map<string, number>();

  for (const candidate of rankedCandidates) {
    const sourceKey = candidate.source.toLowerCase();
    const sourceCount = sourceCounts.get(sourceKey) ?? 0;
    if (sourceCount >= 2) {
      continue;
    }

    selectedCandidates.push(candidate);
    sourceCounts.set(sourceKey, sourceCount + 1);

    if (selectedCandidates.length === 5) {
      break;
    }
  }

  if (selectedCandidates.length < 5) {
    for (const candidate of rankedCandidates) {
      if (selectedCandidates.includes(candidate)) {
        continue;
      }

      selectedCandidates.push(candidate);
      if (selectedCandidates.length === 5) {
        break;
      }
    }
  }

  const resources = selectedCandidates.map(candidateToResource);

  return withEditorialSections({
    date: todayIsoDate(),
    trend_summary:
      resources.length > 0
        ? "Candidate-based digest generated from curated Design System sources because LLM ranking was unavailable."
        : "Fallback: no relevant candidate resources were available from curated sources.",
    resources
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const details: string[] = [error.message];
    const maybeApiError = error as Error & {
      status?: number;
      code?: string;
      type?: string;
      requestID?: string;
    };

    if (maybeApiError.status) details.push(`status=${maybeApiError.status}`);
    if (maybeApiError.code) details.push(`code=${maybeApiError.code}`);
    if (maybeApiError.type) details.push(`type=${maybeApiError.type}`);
    if (maybeApiError.requestID) details.push(`requestID=${maybeApiError.requestID}`);

    return details.join(" | ");
  }

  return String(error);
}

function previewCandidates(candidates: CandidateResource[]): CandidatePreview[] {
  return candidates.slice(0, 10).map((candidate) => ({
    title: candidate.title,
    url: candidate.url,
    source: candidate.source,
    published_date: candidate.published_date,
    sourceScore: candidate.sourceScore,
    directDesignSystemEvidence: candidate.directDesignSystemEvidence
  }));
}

function previewResources(resources: Resource[]): SelectedPreview[] {
  return resources.map((resource) => ({
    title: resource.title,
    url: resource.url,
    source: resource.source,
    relevance_score: resource.relevance_score ?? 0,
    worth_your_time_score: resource.worth_your_time_score ?? 0,
    directDesignSystemEvidence: resource.directDesignSystemEvidence ?? ""
  }));
}

async function rankWithAvailableProvider(filteredCandidates: CandidateResource[]): Promise<{
  digest: Digest;
  provider: ProviderName;
}> {
  if (process.env.OPENAI_API_KEY) {
    console.log("LLM ranking provider: OpenAI.");
    return {
      digest: await rankAndSummarizeWithOpenAI(filteredCandidates),
      provider: "openAI"
    };
  }

  if (process.env.GEMINI_API_KEY) {
    console.log("LLM ranking provider: Gemini.");
    return {
      digest: await rankAndSummarizeWithGemini(filteredCandidates),
      provider: "gemini"
    };
  }

  throw new Error("No LLM provider key configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
}

export async function getDailyDigest(): Promise<DailyDigestResult> {
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  let candidates: CandidateResource[] = [];
  let filteredCandidates: CandidateResource[] = [];
  let fallbackCandidates: CandidateResource[] = [];
  let sourceResults: SourceResult[] = [];
  let rejectedCandidates: RejectedCandidate[] = [];

  console.log(`Provider config: OPENAI_API_KEY exists? ${hasOpenAIKey}`);
  console.log(`Provider config: GEMINI_API_KEY exists? ${hasGeminiKey}`);

  try {
    console.log("Step 1: Candidate collection started.");
    const collectionResult = await collectCandidatesWithDiagnostics();
    candidates = collectionResult.candidates;
    sourceResults = collectionResult.sourceResults;
    console.log(`Step 2: Candidate collection completed (${candidates.length} candidates).`);

    const filterResult = filterCandidatesWithDiagnostics(candidates);
    filteredCandidates = filterResult.accepted;
    rejectedCandidates = filterResult.rejected;
    console.log(`Step 3: Candidate pre-filter completed (${filteredCandidates.length} candidates).`);
    filteredCandidates = filterRecentCandidates(filteredCandidates);
    console.log(`Step 3b: Recent-history filter completed (${filteredCandidates.length} candidates).`);
    fallbackCandidates = filteredCandidates;

    if (candidates.length === 0) {
      throw new Error("No candidates collected from configured sources.");
    }

    if (filteredCandidates.length === 0) {
      console.error("No candidates survived strict pre-filtering; candidateFallback will return fewer or zero resources.");
      const fallbackDigest = buildCandidateFallbackDigest(fallbackCandidates);
      if (fallbackDigest.resources.length > 0) {
        rememberDigest(fallbackDigest);
      }
      return {
        digest: fallbackDigest,
        mode: "candidateFallback",
        hasOpenAIKey,
        hasGeminiKey,
        candidateCount: candidates.length,
        filteredCandidateCount: 0,
        selectedResourceCount: fallbackDigest.resources.length,
        fallbackReason: "No candidates survived strict pre-filtering.",
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidates),
        selectedPreview: previewResources(fallbackDigest.resources)
      };
    }

    try {
      console.log("Step 4: LLM ranking/summarization started.");
      const ranked = await rankWithAvailableProvider(filteredCandidates);
      const editorialDigest = withEditorialSections(ranked.digest);
      console.log(`Step 5: LLM ranking/summarization completed (${editorialDigest.resources.length} selected).`);

      cachedDigest = editorialDigest;
      rememberDigest(editorialDigest);
      console.log("Step 6: Digest cached.");

      return {
        digest: editorialDigest,
        mode: ranked.provider === "openAI" ? "liveOpenAI" : "liveGemini",
        hasOpenAIKey,
        hasGeminiKey,
        candidateCount: candidates.length,
        filteredCandidateCount: filteredCandidates.length,
        selectedResourceCount: editorialDigest.resources.length,
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidates),
        selectedPreview: previewResources(editorialDigest.resources)
      };
    } catch (error) {
      const fallbackReason = getErrorMessage(error);
      console.error(`LLM ranking failed: ${fallbackReason}`);

      const fallbackDigest = buildCandidateFallbackDigest(fallbackCandidates);
      console.log(`Daily digest mode: candidateFallback (${fallbackDigest.resources.length} resources).`);

      if (fallbackDigest.resources.length > 0) {
        rememberDigest(fallbackDigest);
        return {
          digest: fallbackDigest,
          mode: "candidateFallback",
          hasOpenAIKey,
          hasGeminiKey,
          candidateCount: candidates.length,
          filteredCandidateCount: filteredCandidates.length,
          selectedResourceCount: fallbackDigest.resources.length,
          fallbackReason,
          sourceResults,
          rejectedCandidates,
          candidatesPreview: previewCandidates(candidates),
          selectedPreview: previewResources(fallbackDigest.resources)
        };
      }

      if (cachedDigest) {
        console.error("Daily digest mode: cachedDigest.");
        return {
          digest: cachedDigest,
          mode: "cachedDigest",
          hasOpenAIKey,
          hasGeminiKey,
          candidateCount: candidates.length,
          filteredCandidateCount: filteredCandidates.length,
          selectedResourceCount: cachedDigest.resources.length,
          fallbackReason,
          sourceResults,
          rejectedCandidates,
          candidatesPreview: previewCandidates(candidates),
          selectedPreview: previewResources(cachedDigest.resources)
        };
      }

      return {
        digest: createEmergencyFallbackDigest(),
        mode: "emergencyFallback",
        hasOpenAIKey,
        hasGeminiKey,
        candidateCount: candidates.length,
        filteredCandidateCount: filteredCandidates.length,
        selectedResourceCount: 0,
        fallbackReason,
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidates),
        selectedPreview: []
      };
    }
  } catch (error) {
    const fallbackReason = getErrorMessage(error);
    console.error(`Candidate pipeline failed: ${fallbackReason}`);

    if (cachedDigest) {
      console.error("Daily digest mode: cachedDigest.");
      return {
        digest: cachedDigest,
        mode: "cachedDigest",
        hasOpenAIKey,
        hasGeminiKey,
        candidateCount: candidates.length,
        filteredCandidateCount: filteredCandidates.length,
        selectedResourceCount: cachedDigest.resources.length,
        fallbackReason,
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidates),
        selectedPreview: previewResources(cachedDigest.resources)
      };
    }

    console.error("Daily digest mode: emergencyFallback.");
    return {
      digest: createEmergencyFallbackDigest(),
      mode: "emergencyFallback",
      hasOpenAIKey,
      hasGeminiKey,
      candidateCount: candidates.length,
      filteredCandidateCount: filteredCandidates.length,
      selectedResourceCount: 0,
      fallbackReason,
      sourceResults,
      rejectedCandidates,
      candidatesPreview: previewCandidates(candidates),
      selectedPreview: []
    };
  }
}
