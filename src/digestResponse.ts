// Response-shaping layer for the three route implementations (src/server.ts's
// dev routes, api/daily-digest.ts, api/debug-digest.ts). All three call the
// same getDailyDigest() (digestService.ts) — the pipeline itself was never
// duplicated. What WAS duplicated, hand-typed near-identically in up to three
// places, was the list of which DailyDigestResult fields to expose and under
// what key. That's what caused PR-23's redundancyEnforcementLog and
// PR-25/26's resourceRepairs/resourceDrops to land in src/server.ts but go
// missing from both api/*.ts files — nobody had one place to add a field
// once and have every route pick it up (PR-27).
//
// buildDailyDigestResponse()'s `debug` key deliberately reuses
// buildDebugResponse() wholesale rather than keeping a second, smaller field
// list — before this PR daily-digest's debug object was a 65-field subset of
// debug-digest's 86, with no documented reason for the gap, and every field
// added since (redundancyEnforcementLog, resourceRepairs, resourceDrops) was
// intended for both. A second list is exactly the shape of problem this PR
// exists to remove.
import { hasEditorialSections } from "./editorial.js";
import { renderEmail } from "./emailTemplate.js";
import { buildSubject, type DailyDigestResult } from "./digestService.js";
import { buildRenderingPipelineTrace } from "./renderingPipelineTrace.js";

export function buildDebugResponse(result: DailyDigestResult) {
  const { digest } = result;
  const renderingPipelineTrace = buildRenderingPipelineTrace(result);

  return {
    mode: result.mode,
    hasOpenAIKey: result.hasOpenAIKey,
    hasGeminiKey: result.hasGeminiKey,
    usableProviderCount: result.usableProviderCount,
    providerWarning: result.providerWarning,
    providerAttempts: result.providerAttempts,
    providerUsed: result.providerUsed,
    providerFailures: result.providerFailures,
    synthesisMode: result.synthesisMode,
    degraded: result.degraded,
    degradedReason: result.degradedReason,
    fallbackSectionsApplied: result.fallbackSectionsApplied,
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
    recommendedReading: result.learningRecommendation.recommendedReading,
    recommendedReadingSelectionReason: result.learningRecommendation.recommendedReadingSelectionReason,
    teachingCandidatesConsidered: result.learningRecommendation.teachingCandidatesConsidered,
    teachingCandidatesRejected: result.learningRecommendation.teachingCandidatesRejected,
    evidenceVsTeachingSeparation: result.learningRecommendation.evidenceVsTeachingSeparation,
    renderingPipelineTrace,
    editorialContexts: result.editorialContexts,
    contextBoundaryViolations: result.contextBoundaryViolations,
    sectionContracts: result.sectionContracts,
    redundancyMatrix: result.redundancyMatrix,
    tensionHonesty: result.tensionHonesty,
    sectionContractViolations: result.sectionContractViolations,
    sectionContractWarnings: result.sectionContractWarnings,
    redundancyEnforcementLog: result.redundancyEnforcementLog,
    resourceRepairs: result.resourceRepairs,
    resourceDrops: result.resourceDrops,
    editorialWritingLayer: result.editorialWritingLayer,
    resourceCardIntegrity: result.resourceCardIntegrity,
    supportingResourceRanking: result.supportingResourceRanking,
    fallbackReason: result.fallbackReason ?? "",
    candidateCount: result.candidateCount,
    filteredCandidateCount: result.filteredCandidateCount,
    selectedResourceCount: result.selectedResourceCount,
    resourceCount: result.selectedResourceCount,
    hasEditorialSections: hasEditorialSections(digest),
    theSignalPreview: digest.theSignal.slice(0, 220),
    executiveBriefPreview: digest.executiveBrief.slice(0, 220),
    editorsPickTitle: digest.editorsPick?.title ?? "",
    supportingSignals: digest.supportingSignals,
    thisWeeksSignals: digest.thisWeeksSignals,
    suggestedExperiment: digest.suggestedExperiment,
    nextWeekWatchlist: digest.nextWeekWatchlist,
    sourceResults: result.sourceResults,
    droppedArtifacts: result.droppedArtifacts,
    pipelineCounts: result.pipelineCounts,
    rejectedCandidates: result.rejectedCandidates,
    candidatesPreview: result.candidatesPreview,
    selectedPreview: result.selectedPreview,
    editorialQualification: result.editorialQualification,
    editorialRoles: result.editorialRoles,
    editorialSelection: result.editorialSelection,
    editorialScores: result.editorialScores,
    topicClassifications: result.topicClassifications
  };
}

// The response for the "real" digest — what Make.com's HTTP module actually
// consumes to send the email (subject/html/digest), plus the full debug
// object unconditionally. The NODE_ENV !== "production" gate that used to
// hide `debug` here was undocumented and inconsistent with debug-digest
// (which has never gated on NODE_ENV and is reachable unauthenticated
// regardless), so it provided no real protection — dropped per PR-27,
// an accepted tradeoff, not an oversight.
export function buildDailyDigestResponse(result: DailyDigestResult) {
  const { digest } = result;

  return {
    subject: buildSubject(digest.date),
    html: renderEmail(digest),
    digest,
    debug: buildDebugResponse(result)
  };
}
