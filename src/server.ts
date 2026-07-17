import http from "node:http";
import { hasEditorialSections } from "./editorial.js";
import { renderEmail } from "./emailTemplate.js";
import { buildSubject, getDailyDigest } from "./digestService.js";
import { buildRenderingPipelineTrace } from "./renderingPipelineTrace.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

function jsonResponse(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method !== "GET") {
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }

  if (url.pathname === "/health") {
    jsonResponse(response, 200, { ok: true });
    return;
  }

  if (
    url.pathname !== "/daily-digest" &&
    url.pathname !== "/api/daily-digest" &&
    url.pathname !== "/api/debug-digest"
  ) {
    jsonResponse(response, 404, {
      error: "Not found",
      available_routes: ["/api/daily-digest", "/api/debug-digest", "/daily-digest", "/health"]
    });
    return;
  }

  const result = await getDailyDigest();
  const { digest } = result;
  const renderingPipelineTrace = buildRenderingPipelineTrace(result);

  if (url.pathname === "/api/debug-digest") {
    jsonResponse(response, 200, {
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
    });
    return;
  }

  jsonResponse(response, 200, {
    subject: buildSubject(digest.date),
    html: renderEmail(digest),
    digest,
    ...(process.env.NODE_ENV !== "production"
      ? {
          debug: {
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
            leadSignal: result.leadSignal,
            candidateSignalCount: result.candidateSignals.length,
            rejectedSignalCount: result.rejectedSignals.length,
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
            candidateCount: result.candidateCount,
            filteredCandidateCount: result.filteredCandidateCount,
            selectedResourceCount: result.selectedResourceCount,
            sourceResults: result.sourceResults,
      droppedArtifacts: result.droppedArtifacts,
      pipelineCounts: result.pipelineCounts,
            rejectedCandidates: result.rejectedCandidates,
            editorialQualification: result.editorialQualification,
            editorialRoles: result.editorialRoles,
            ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {})
          }
        }
      : {})
  });
});

server.listen(port, host, () => {
  console.log(`DS AI Curator API listening on http://${host}:${port}`);
  console.log(`Daily digest endpoint: http://${host}:${port}/api/daily-digest`);
});
