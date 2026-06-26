import { renderEmail } from "../src/emailTemplate.js";
import { buildSubject, getDailyDigest } from "../src/digestService.js";
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
  const { digest } = result;
  const renderingPipelineTrace = buildRenderingPipelineTrace(result);

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    subject: buildSubject(digest.date),
    html: renderEmail(digest),
    digest,
    ...(process.env.NODE_ENV !== "production"
      ? {
          debug: {
            mode: result.mode,
            hasOpenAIKey: result.hasOpenAIKey,
            hasGeminiKey: result.hasGeminiKey,
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
            candidateCount: result.candidateCount,
            filteredCandidateCount: result.filteredCandidateCount,
            selectedResourceCount: result.selectedResourceCount,
            sourceResults: result.sourceResults,
            rejectedCandidates: result.rejectedCandidates,
            ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {})
          }
        }
      : {})
  });
}
