import type { Resource } from "./emailTemplate.js";
import type { SignalEvidence } from "./editorialThesis.js";

type RenderingTraceInput = {
  digest: {
    editorsPick: Resource | null;
    supportingSignals: string[];
    resources: Resource[];
  };
  representativeLeadEvidence: SignalEvidence | null;
  representativeSupportingEvidence: SignalEvidence[];
};

function debugIdFromUrl(value: string | undefined): string {
  const rawUrl = String(value ?? "").trim();
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return rawUrl.toLowerCase();
  }
}

function evidenceId(evidence: SignalEvidence | null): string {
  return evidence ? debugIdFromUrl(evidence.resourceRef.url) : "";
}

function resourceId(resource: Resource | null): string {
  return resource ? debugIdFromUrl(resource.url) : "";
}

export function buildRenderingPipelineTrace(input: RenderingTraceInput) {
  const representativeLeadEvidenceId = evidenceId(input.representativeLeadEvidence);
  const representativeSupportingEvidenceIds = input.representativeSupportingEvidence.map(evidenceId).filter(Boolean);
  const editorsPickResourceId = resourceId(input.digest.editorsPick);
  const renderedSupportingResourceIds = input.digest.resources.map(resourceId).filter(Boolean);
  const duplicatedEditorPick = renderedSupportingResourceIds.includes(editorsPickResourceId);

  return {
    collectionsUsed: {
      editorsPick: "digest.editorsPick",
      supportingSignals: "digest.supportingSignals",
      supportingResources: "digest.resources"
    },
    representativeLeadEvidence: {
      id: representativeLeadEvidenceId
    },
    representativeSupportingEvidence: {
      ids: representativeSupportingEvidenceIds
    },
    renderedSupportingResource: {
      ids: renderedSupportingResourceIds
    },
    representativeLeadEvidenceId,
    representativeSupportingEvidenceIds,
    editorsPickResourceId,
    renderedSupportingResourceIds,
    renderedSupportingResourceTitles: input.digest.resources.map((resource) => resource.title),
    editorPickDuplicateInSupportingResources: duplicatedEditorPick,
    duplicateExplanation:
      duplicatedEditorPick && editorsPickResourceId
        ? "Supporting Resources renders digest.resources, and digest.resources still includes the same resource used for digest.editorsPick."
        : "No Editor's Pick duplicate detected in digest.resources."
  };
}
