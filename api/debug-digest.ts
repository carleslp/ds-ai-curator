import { hasEditorialSections } from "../src/editorial.js";
import { getDailyDigest } from "../src/digestService.js";
import { buildRenderingPipelineTrace } from "../src/renderingPipelineTrace.js";

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
  const renderingPipelineTrace = buildRenderingPipelineTrace(result);

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
    leadSignal: result.leadSignal,
    candidateSignalCount: result.candidateSignals.length,
    candidateSignals: result.candidateSignals,
    rejectedSignalCount: result.rejectedSignals.length,
    rejectedSignals: result.rejectedSignals,
    signalFormationReasons: result.signalFormationReasons,
    evidenceSetSummary: result.evidenceSetSummary,
    evidenceFormationReasons: result.evidenceFormationReasons,
    degenerateEvidenceSet: result.degenerateEvidenceSet,
    evidencePromotionInputCount: result.evidencePromotionInputCount,
    promotedEvidenceCount: result.promotedEvidenceCount,
    evidenceGroups: result.evidenceGroups,
    editorialDeliberation: result.editorialDeliberation,
    leadSignalSelectionReason: result.leadSignalSelectionReason,
    runnerUpEvidenceGroups: result.runnerUpEvidenceGroups,
    evidencePromotionRejections: result.evidencePromotionRejections,
    representativeLeadEvidence: result.representativeLeadEvidence,
    representativeSupportingEvidence: result.representativeSupportingEvidence,
    representativeSelectionReasons: result.representativeSelectionReasons,
    hiddenEvidenceCount: result.hiddenEvidenceCount,
    hiddenEvidenceReasons: result.hiddenEvidenceReasons,
    renderedResourceCount: result.renderedResourceCount,
    renderedResourceTitles: result.renderedResourceTitles,
    evidenceReasoning: result.evidenceReasoning,
    narrativeExtraction: result.narrativeExtraction,
    editorialBrief: result.editorialBrief,
    learningRecommendation: result.learningRecommendation,
    renderingPipelineTrace,
    editorialContexts: result.editorialContexts,
    contextBoundaryViolations: result.contextBoundaryViolations,
    sectionContracts: result.sectionContracts,
    redundancyMatrix: result.redundancyMatrix,
    tensionHonesty: result.tensionHonesty,
    sectionContractViolations: result.sectionContractViolations,
    sectionContractWarnings: result.sectionContractWarnings,
    editorialWritingLayer: result.editorialWritingLayer,
    resourceCardIntegrity: result.resourceCardIntegrity,
    supportingResourceRanking: result.supportingResourceRanking,
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
    editorialQualification: result.editorialQualification,
    editorialRoles: result.editorialRoles,
    editorialSelection: result.editorialSelection,
    editorialScores: result.editorialScores,
    topicClassifications: result.topicClassifications
  });
}
