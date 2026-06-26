import { hasEditorialSections } from "../src/editorial.js";
import { getDailyDigest } from "../src/digestService.js";

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(statusCode: number): VercelResponse;
  json(body: unknown): void;
};

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const result = await getDailyDigest();

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    mode: result.mode,
    hasOpenAIKey: result.hasOpenAIKey,
    hasGeminiKey: result.hasGeminiKey,
    thesisEngineEnabled: result.thesisEngineEnabled,
    thesisLedgerEnabled: result.thesisLedgerEnabled,
    hasThesisLedger: result.thesisLedgerEnabled,
    thesisLedgerEntryCount: result.thesisLedgerEntryCount,
    thesisLedgerPreview: result.thesisLedgerPreview,
    fallbackReason: result.fallbackReason ?? "",
    candidateCount: result.candidateCount,
    filteredCandidateCount: result.filteredCandidateCount,
    selectedResourceCount: result.selectedResourceCount,
    resourceCount: result.selectedResourceCount,
    hasEditorialSections: hasEditorialSections(result.digest),
    theSignalPreview: result.digest.theSignal.slice(0, 220),
    executiveBriefPreview: result.digest.executiveBrief.slice(0, 220),
    editorsPickTitle: result.digest.editorsPick?.title ?? "",
    supportingSignals: result.digest.supportingSignals,
    thisWeeksSignals: result.digest.thisWeeksSignals,
    suggestedExperiment: result.digest.suggestedExperiment,
    nextWeekWatchlist: result.digest.nextWeekWatchlist,
    sourceResults: result.sourceResults,
    rejectedCandidates: result.rejectedCandidates,
    candidatesPreview: result.candidatesPreview,
    selectedPreview: result.selectedPreview,
    editorialSelection: result.editorialSelection,
    editorialScores: result.editorialScores,
    topicClassifications: result.topicClassifications
  });
}
