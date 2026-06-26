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

function normalizeTitle(value: string | undefined): string {
  return String(value ?? "").toLowerCase().replace(/\bv?\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?\b/g, "version").replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceFamily(value: { source?: string; url?: string }): string {
  try {
    return new URL(String(value.url ?? "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return String(value.source ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
}

function repoKey(value: { source?: string; url?: string }): string {
  try {
    const url = new URL(String(value.url ?? ""));
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.includes("github.com") && parts.length >= 2) {
      return `${url.hostname}/${parts[0]}/${parts[1]}`.toLowerCase();
    }
  } catch {
    // Fall back to source family when the URL is malformed.
  }

  return sourceFamily(value);
}

function evidenceDuplicatesResource(evidence: SignalEvidence, resource: Resource | null): boolean {
  if (!resource) return false;

  return (
    debugIdFromUrl(evidence.resourceRef.url) === debugIdFromUrl(resource.url) ||
    normalizeTitle(evidence.resourceRef.title) === normalizeTitle(resource.title) ||
    sourceFamily(evidence.resourceRef) === sourceFamily(resource) ||
    repoKey(evidence.resourceRef) === repoKey(resource)
  );
}

export function buildRenderingPipelineTrace(input: RenderingTraceInput) {
  const representativeLeadEvidenceId = evidenceId(input.representativeLeadEvidence);
  const representativeSupportingEvidenceIds = input.representativeSupportingEvidence.map(evidenceId).filter(Boolean);
  const editorsPickResourceId = resourceId(input.digest.editorsPick);
  const renderedSupportingResourceIds = input.digest.resources.map(resourceId).filter(Boolean);
  const duplicatedEditorPick = renderedSupportingResourceIds.includes(editorsPickResourceId);
  const supportingResourcesExcludedBecauseDuplicateOfEditorsPick = input.representativeSupportingEvidence
    .filter((evidence) => evidenceDuplicatesResource(evidence, input.digest.editorsPick))
    .map(evidenceId)
    .filter(Boolean);

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
    supportingResourcesExcludedBecauseDuplicateOfEditorsPick,
    duplicateExplanation:
      duplicatedEditorPick && editorsPickResourceId
        ? "Supporting Resources renders digest.resources, and digest.resources still includes the same resource used for digest.editorsPick."
        : "No Editor's Pick duplicate detected in digest.resources."
  };
}
