import { collectCandidates, type CandidateResource } from "./collectCandidates.js";
import type { Digest, Resource } from "./emailTemplate.js";
import { filterCandidates } from "./filterCandidates.js";
import {
  rankAndSummarizeWithGemini,
  rankAndSummarizeWithOpenAI,
  type ProviderName
} from "./rankAndSummarize.js";

type DigestMode = "liveOpenAI" | "liveGemini" | "candidateFallback" | "cachedDigest" | "emergencyFallback";

type CandidatePreview = {
  title: string;
  url: string;
  source: string;
  published_date: string;
};

type SelectedPreview = {
  title: string;
  url: string;
  source: string;
  relevance_score: number;
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
  candidatesPreview: CandidatePreview[];
  selectedPreview: SelectedPreview[];
};

let cachedDigest: Digest | undefined;

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
  return {
    date: todayIsoDate(),
    trend_summary: "Fallback: candidate collection and live ranking are currently unavailable.",
    resources: []
  };
}

function candidateToResource(candidate: CandidateResource): Resource {
  return {
    title: candidate.title,
    url: candidate.url,
    source: candidate.source,
    type: "Article",
    published_date: candidate.published_date ?? "Recent",
    summary: candidate.snippet || "Candidate collected from a curated source for Design System review.",
    is_real_source: true,
    relevance_score: 3
  };
}

function buildCandidateFallbackDigest(filteredCandidates: CandidateResource[]): Digest {
  const resources = filteredCandidates.slice(0, 5).map(candidateToResource);

  return {
    date: todayIsoDate(),
    trend_summary:
      resources.length > 0
        ? "Candidate-based digest generated from curated Design System sources because LLM ranking was unavailable."
        : "Fallback: no relevant candidate resources were available from curated sources.",
    resources
  };
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
    published_date: candidate.published_date ?? ""
  }));
}

function previewResources(resources: Resource[]): SelectedPreview[] {
  return resources.map((resource) => ({
    title: resource.title,
    url: resource.url,
    source: resource.source,
    relevance_score: resource.relevance_score ?? 0
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

  console.log(`Provider config: OPENAI_API_KEY exists? ${hasOpenAIKey}`);
  console.log(`Provider config: GEMINI_API_KEY exists? ${hasGeminiKey}`);

  try {
    console.log("Step 1: Candidate collection started.");
    candidates = await collectCandidates();
    console.log(`Step 2: Candidate collection completed (${candidates.length} candidates).`);

    filteredCandidates = filterCandidates(candidates);
    console.log(`Step 3: Candidate pre-filter completed (${filteredCandidates.length} candidates).`);

    if (filteredCandidates.length === 0) {
      throw new Error("No relevant candidates after pre-filtering.");
    }

    try {
      console.log("Step 4: LLM ranking/summarization started.");
      const ranked = await rankWithAvailableProvider(filteredCandidates);
      console.log(`Step 5: LLM ranking/summarization completed (${ranked.digest.resources.length} selected).`);

      cachedDigest = ranked.digest;
      console.log("Step 6: Digest cached.");

      return {
        digest: ranked.digest,
        mode: ranked.provider === "openAI" ? "liveOpenAI" : "liveGemini",
        hasOpenAIKey,
        hasGeminiKey,
        candidateCount: candidates.length,
        filteredCandidateCount: filteredCandidates.length,
        selectedResourceCount: ranked.digest.resources.length,
        candidatesPreview: previewCandidates(candidates),
        selectedPreview: previewResources(ranked.digest.resources)
      };
    } catch (error) {
      const fallbackReason = getErrorMessage(error);
      console.error(`LLM ranking failed: ${fallbackReason}`);

      const fallbackDigest = buildCandidateFallbackDigest(filteredCandidates);
      console.log(`Daily digest mode: candidateFallback (${fallbackDigest.resources.length} resources).`);

      if (fallbackDigest.resources.length > 0) {
        return {
          digest: fallbackDigest,
          mode: "candidateFallback",
          hasOpenAIKey,
          hasGeminiKey,
          candidateCount: candidates.length,
          filteredCandidateCount: filteredCandidates.length,
          selectedResourceCount: fallbackDigest.resources.length,
          fallbackReason,
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
      candidatesPreview: previewCandidates(candidates),
      selectedPreview: []
    };
  }
}
