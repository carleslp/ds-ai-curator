import {
  collectCandidatesWithDiagnostics,
  type CandidateResource,
  type SourceResult
} from "./collectCandidates.js";
import {
  scoreEditorialCandidate,
  scoreEditorialCandidates,
  type EditorialScore,
  type EditorialScoredCandidate
} from "./editorialEngine.js";
import { withEditorialSections } from "./editorial.js";
import {
  buildEditorialContexts,
  createEditorialContextDebug,
  type EditorialContextDebug
} from "./editorialContexts.js";
import {
  buildEditorialBrief,
  emptyEditorialBrief,
  type EditorialBrief
} from "./editorialBrief.js";
import { validateSectionContracts, type SectionContractsDebug } from "./editorialContracts.js";
import {
  applyEditorialWritingLayer,
  emptyEditorialWritingLayerDebug,
  type EditorialWritingLayerDebug
} from "./editorialWritingLayer.js";
import {
  selectEditorialCandidates,
  type EditorialSelectionDecision,
  type EditorialSelectionResult,
  type TopicGroup
} from "./editorialSelection.js";
import { selectEditorialThesis } from "./editorialThesis.js";
import type { Digest, Resource } from "./emailTemplate.js";
import {
  aiEvidenceForText,
  designSystemEvidenceForText,
  maturityLevelForText
} from "./filterCandidates.js";
import {
  rankAndSummarizeWithGemini,
  rankAndSummarizeWithOpenAI,
  type ProviderName
} from "./rankAndSummarize.js";
import {
  emptyNarrativeExtraction,
  extractNarrativeFrame,
  type NarrativeExtraction
} from "./narrativeExtraction.js";
import { truncateText } from "./textUtils.js";
import { createLedgerPreview, type ThesisLedgerPreview } from "./thesisLedger.js";
import type {
  CandidateSignal,
  EvidenceReasoningDebug,
  EditorialDeliberationDecision,
  EvidenceGroup,
  EvidencePromotionRejection,
  EvidenceSetSummary,
  HiddenEvidenceReason,
  RejectedSignal,
  SignalEvidence,
  EditorialThesisResult
} from "./editorialThesis.js";
import {
  classifyCandidatesTopics,
  classifyCandidateTopics,
  type AiTopic,
  type DesignSystemTopic,
  type TopicClassification,
  type WorkflowTopic
} from "./topicClassifier.js";

type DigestMode =
  | "liveOpenAI"
  | "liveGemini"
  | "candidateFallback"
  | "candidateFallbackEmptySelection"
  | "cachedDigest"
  | "emergencyFallback";

type CandidatePreview = {
  title: string;
  url: string;
  source: string;
  published_date: string;
  sourceScore: number;
  readerValue: number;
  learningValue: number;
  sourceCategory: CandidateResource["sourceCategory"];
  rankingExplanation: string;
  directDesignSystemEvidence: string;
  editorialScore: EditorialScore;
  selectionReason: string;
  rejectionReason: string;
  topicGroup: TopicGroup;
  selectedBecause: string;
  skippedBecause: string;
  editorialMissionMatch: boolean;
  missionReason: string;
  editorialValueMatch: boolean;
  editorialValueReason: string;
  actionabilityScore: number;
  mondayMorningChange: string;
  editorialTitle: string;
  aiTopics: AiTopic[];
  designSystemTopics: DesignSystemTopic[];
  workflowTopics: WorkflowTopic[];
};

type SelectedPreview = {
  title: string;
  url: string;
  source: string;
  aiEvidence: string;
  designSystemEvidence: string;
  maturityLevel: "advanced" | "intermediate" | "basic";
  editorialScore?: EditorialScore;
  selectionReason?: string;
  rejectionReason?: string;
  topicGroup?: TopicGroup;
  selectedBecause?: string;
  skippedBecause?: string;
  editorialMissionMatch?: boolean;
  missionReason?: string;
  editorialValueMatch?: boolean;
  editorialValueReason?: string;
  actionabilityScore?: number;
  readerValue?: number;
  learningValue?: number;
  sourceCategory?: CandidateResource["sourceCategory"];
  rankingExplanation?: string;
  mondayMorningChange?: string;
  editorialTitle?: string;
  aiTopics: AiTopic[];
  designSystemTopics: DesignSystemTopic[];
  workflowTopics: WorkflowTopic[];
  relevance_score: number;
  worth_your_time_score: number;
  directDesignSystemEvidence: string;
};

type DailyDigestResult = {
  digest: Digest;
  mode: DigestMode;
  hasOpenAIKey: boolean;
  hasGeminiKey: boolean;
  thesisEngineEnabled: boolean;
  thesisLedgerEnabled: boolean;
  thesisLedgerEntryCount: number;
  thesisLedgerPreview: ThesisLedgerPreview;
  leadSignal: CandidateSignal | null;
  candidateSignals: CandidateSignal[];
  rejectedSignals: RejectedSignal[];
  signalFormationReasons: string[];
  evidenceSetSummary: EvidenceSetSummary;
  evidenceFormationReasons: string[];
  degenerateEvidenceSet: boolean;
  evidencePromotionInputCount: number;
  promotedEvidenceCount: number;
  evidenceGroups: EvidenceGroup[];
  editorialDeliberation: EditorialDeliberationDecision;
  leadSignalSelectionReason: string;
  runnerUpEvidenceGroups: EvidenceGroup[];
  evidencePromotionRejections: EvidencePromotionRejection[];
  representativeLeadEvidence: SignalEvidence | null;
  representativeSupportingEvidence: SignalEvidence[];
  representativeSelectionReasons: string[];
  hiddenEvidenceCount: number;
  hiddenEvidenceReasons: HiddenEvidenceReason[];
  renderedResourceCount: number;
  renderedResourceTitles: string[];
  evidenceReasoning: EvidenceReasoningDebug;
  narrativeExtraction: NarrativeExtraction;
  editorialBrief: EditorialBrief;
  editorialContexts: EditorialContextDebug["editorialContexts"];
  contextBoundaryViolations: string[];
  sectionContracts: SectionContractsDebug["sectionContracts"];
  redundancyMatrix: SectionContractsDebug["redundancyMatrix"];
  tensionHonesty: SectionContractsDebug["tensionHonesty"];
  sectionContractViolations: string[];
  sectionContractWarnings: string[];
  editorialWritingLayer: EditorialWritingLayerDebug["editorialWritingLayer"];
  resourceCardIntegrity: EditorialWritingLayerDebug["resourceCardIntegrity"];
  supportingResourceRanking: EditorialThesisResult["supportingResourceRanking"];
  candidateCount: number;
  filteredCandidateCount: number;
  selectedResourceCount: number;
  fallbackReason?: string;
  sourceResults: SourceResult[];
  rejectedCandidates: EditorialSelectionDecision[];
  candidatesPreview: CandidatePreview[];
  selectedPreview: SelectedPreview[];
  editorialScores: EditorialScoredCandidate[];
  topicClassifications: TopicClassification[];
  editorialSelection: EditorialSelectionDecision[];
};

let cachedDigest: Digest | undefined;
const recentSelectedUrls = new Map<string, number>();
const historyWindowMs = 30 * 24 * 60 * 60 * 1000;

function thesisEngineEnabledFromEnv(): boolean {
  return process.env.THESIS_ENGINE === "true";
}

function emptySupportingResourceRanking(): EditorialThesisResult["supportingResourceRanking"] {
  return {
    candidatesConsidered: 0,
    selected: [],
    rejected: []
  };
}

function emptyEditorialDeliberation(): EditorialDeliberationDecision {
  return {
    detectedStories: [],
    mergedClusters: [],
    dominantStory: null,
    secondaryStories: [],
    reasoning: ["Editorial Deliberation did not run because no Theme Discovery clusters were available."]
  };
}

function emptyEvidenceReasoning(): EvidenceReasoningDebug {
  return {
    entries: [],
    keptCount: 0,
    discardedCount: 0,
    reasoning: ["Evidence Reasoning did not run because no Lead Signal evidence was available."]
  };
}

function emptyLedgerPreview(): ThesisLedgerPreview {
  return {
    totalEntries: 0,
    latestPublishedAt: null,
    latestClaimAsPublished: null,
    latestThemeAnchor: null,
    latestOutcome: null
  };
}

function emptyEvidenceSetSummary(): EvidenceSetSummary {
  return {
    evidenceCount: 0,
    supportingEvidenceCount: 0,
    contradictingEvidenceCount: 0,
    leadEvidenceTitle: "",
    independenceMarkers: []
  };
}

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
    trend_summary: "Curation mode unavailable: trusted sources could not return relevant mature-DS AI signals today.",
    resources: []
  });
}

function createEmptySelectionDigest(): Digest {
  return withEditorialSections({
    date: todayIsoDate(),
    trend_summary: "No strong resources today. Curated sources were checked, but none passed the mature Design System AI editorial gate.",
    resources: []
  });
}

function normalizeUrl(url: string): string {
  return url.replace(/[#?].*$/, "").replace(/\/$/, "");
}

function normalizeTitleForDedupe(value: string): string {
  return value.toLowerCase().replace(/\bv?\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?\b/g, "version").replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceFamilyForResource(resource: Resource): string {
  try {
    return new URL(resource.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return resource.source.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
}

function repoKeyForResource(resource: Resource): string {
  try {
    const url = new URL(resource.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.includes("github.com") && parts.length >= 2) {
      return `${url.hostname}/${parts[0]}/${parts[1]}`.toLowerCase();
    }
  } catch {
    // Fall through to source family when the URL is malformed.
  }

  return sourceFamilyForResource(resource);
}

function isDuplicateOfEditorsPick(resource: Resource, editorsPick: Resource | null): boolean {
  if (!editorsPick) return false;

  return (
    normalizeUrl(resource.url) === normalizeUrl(editorsPick.url) ||
    normalizeTitleForDedupe(resource.title) === normalizeTitleForDedupe(editorsPick.title) ||
    sourceFamilyForResource(resource) === sourceFamilyForResource(editorsPick) ||
    repoKeyForResource(resource) === repoKeyForResource(editorsPick)
  );
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
  if (digest.editorsPick) {
    recentSelectedUrls.set(normalizeUrl(digest.editorsPick.url), now);
  }
  for (const resource of digest.resources) {
    recentSelectedUrls.set(normalizeUrl(resource.url), now);
  }
}

function hasRenderableDigestContent(digest: Digest): boolean {
  return digest.resources.length > 0 || Boolean(digest.editorsPick);
}

function editorialContextDebugFor(
  digest: Digest,
  leadSignal: CandidateSignal | null,
  representativeLeadEvidence: SignalEvidence | null,
  representativeSupportingEvidence: SignalEvidence[]
): EditorialContextDebug {
  return createEditorialContextDebug(
    buildEditorialContexts({
      leadSignal,
      representativeLeadEvidence,
      representativeSupportingEvidence,
      editorsPick: digest.editorsPick,
      resources: digest.resources
    })
  );
}

function sectionContractDebugFor(digest: Digest, leadSignal: CandidateSignal | null): SectionContractsDebug {
  return validateSectionContracts(digest, leadSignal);
}

function candidateToResource(candidate: CandidateResource): Resource {
  const cleanSummary = truncateText(candidate.cleanSummary || candidate.snippet, 280);

  return {
    title: candidate.title,
    original_title: candidate.title,
    url: candidate.url,
    source: candidate.source,
    type: "Article",
    published_date: candidate.published_date,
    summary: cleanSummary || `${candidate.title} from ${candidate.source}.`,
    cleanSummary,
    design_system_angle:
      "Connects Design System, UI engineering, tooling, or research signals to the Figma-to-Storybook workflow.",
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

function applySelectionMetadataToResource(resource: Resource, decision?: EditorialSelectionDecision): Resource {
  if (!decision) return resource;

  return {
    ...resource,
    original_title: resource.original_title ?? decision.title,
    editorialTitle: decision.editorialTitle,
    actionabilityScore: decision.actionabilityScore,
    affected_workflow_areas: Array.from(
      new Set([...decision.designSystemTopics, ...decision.workflowTopics].filter(Boolean))
    ).slice(0, 5),
    impact_score: Math.max(
      1,
      Math.min(5, Math.round((decision.actionabilityScore + decision.designSystemTopics.length + decision.workflowTopics.length) / 3))
    )
  };
}

function buildCandidateFallbackDigest(selectionResult: EditorialSelectionResult): Digest {
  const decisionMap = decisionsByUrl(selectionResult.selectedDecisions);
  const resources = selectionResult.selectedCandidates.map((candidate) =>
    applySelectionMetadataToResource(candidateToResource(candidate), decisionMap.get(normalizeUrl(candidate.url)))
  );
  const editorsPick = selectionResult.editorsPickCandidate
    ? resources.find((resource) => normalizeUrl(resource.url) === normalizeUrl(selectionResult.editorsPickCandidate?.url ?? "")) ?? null
    : null;

  return withEditorialSections({
    date: todayIsoDate(),
    trend_summary:
      resources.length > 0
        ? buildCurationDiagnosis(selectionResult.selectedDecisions)
        : "No mature Design System AI signal produced a concrete Monday-afternoon workflow change today.",
    editorsPick,
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

function decisionsByUrl(decisions: EditorialSelectionDecision[]): Map<string, EditorialSelectionDecision> {
  return new Map(decisions.map((decision) => [normalizeUrl(decision.url), decision]));
}

function buildCurationDiagnosis(decisions: EditorialSelectionDecision[]): string {
  const text = decisions.map((decision) => `${decision.editorialTitle} ${decision.editorialValueReason}`).join(" ").toLowerCase();

  if (text.includes("component metadata") || text.includes("agent")) {
    return "This week's signals point toward AI becoming better at consuming Design Systems than generating them.";
  }

  if (text.includes("documentation") || text.includes("machine-readable")) {
    return "Documentation quality is emerging as the limiting factor for reliable AI-assisted Design System workflows.";
  }

  if (text.includes("figma") || text.includes("design-to-code")) {
    return "The bottleneck is moving from UI generation to structured Figma and component metadata.";
  }

  if (text.includes("qa") || text.includes("accessibility")) {
    return "The useful AI signal is shifting toward review, accessibility, and QA workflows that Design System teams can operationalize.";
  }

  return "The strongest signal this week is practical workflow change, not feature novelty.";
}

function previewCandidates(candidates: CandidateResource[], decisions: EditorialSelectionDecision[] = []): CandidatePreview[] {
  const decisionMap = decisionsByUrl(decisions);
  return candidates.slice(0, 10).map((candidate) => {
    const topics = classifyCandidateTopics(candidate);
    const decision = decisionMap.get(normalizeUrl(candidate.url));

    return {
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      published_date: candidate.published_date,
      sourceScore: candidate.sourceScore,
      readerValue: decision?.readerValue ?? candidate.readerValue,
      learningValue: decision?.learningValue ?? candidate.learningValue,
      sourceCategory: decision?.sourceCategory ?? candidate.sourceCategory,
      rankingExplanation: decision?.rankingExplanation ?? candidate.rankingExplanation,
      directDesignSystemEvidence: candidate.directDesignSystemEvidence,
      editorialScore: decision?.editorialScore ?? scoreEditorialCandidate(candidate, candidates),
      selectionReason: decision?.selectionReason ?? "",
      rejectionReason: decision?.rejectionReason ?? "",
      topicGroup: decision?.topicGroup ?? "Other",
      selectedBecause: decision?.selectedBecause ?? "",
      skippedBecause: decision?.skippedBecause ?? "",
      editorialMissionMatch: decision?.editorialMissionMatch ?? false,
      missionReason: decision?.missionReason ?? "No editorial selection decision was available for this preview.",
      editorialValueMatch: decision?.editorialValueMatch ?? false,
      editorialValueReason: decision?.editorialValueReason ?? "",
      actionabilityScore: decision?.actionabilityScore ?? 0,
      mondayMorningChange: decision?.mondayMorningChange ?? "",
      editorialTitle: decision?.editorialTitle ?? candidate.title,
      aiTopics: topics.aiTopics,
      designSystemTopics: topics.designSystemTopics,
      workflowTopics: topics.workflowTopics
    };
  });
}

function previewResources(resources: Resource[], decisions: EditorialSelectionDecision[] = []): SelectedPreview[] {
  const decisionMap = decisionsByUrl(decisions);
  return resources.map((resource) => {
    const text = `${resource.title} ${resource.source} ${resource.summary} ${resource.cleanSummary ?? ""} ${
      resource.directDesignSystemEvidence ?? ""
    }`;
    const decision = decisionMap.get(normalizeUrl(resource.url));

    return {
      title: resource.title,
      url: resource.url,
      source: resource.source,
      aiEvidence: aiEvidenceForText(text),
      designSystemEvidence: designSystemEvidenceForText(text),
      maturityLevel: maturityLevelForText(text),
      editorialScore: decision?.editorialScore,
      selectionReason: decision?.selectionReason,
      rejectionReason: decision?.rejectionReason,
      topicGroup: decision?.topicGroup,
      selectedBecause: decision?.selectedBecause,
      skippedBecause: decision?.skippedBecause,
      editorialMissionMatch: decision?.editorialMissionMatch,
      missionReason: decision?.missionReason,
      editorialValueMatch: decision?.editorialValueMatch,
      editorialValueReason: decision?.editorialValueReason,
      actionabilityScore: decision?.actionabilityScore,
      readerValue: decision?.readerValue,
      learningValue: decision?.learningValue,
      sourceCategory: decision?.sourceCategory,
      rankingExplanation: decision?.rankingExplanation,
      mondayMorningChange: decision?.mondayMorningChange,
      editorialTitle: decision?.editorialTitle,
      aiTopics: classifyTopicsFromResource(resource).aiTopics,
      designSystemTopics: classifyTopicsFromResource(resource).designSystemTopics,
      workflowTopics: classifyTopicsFromResource(resource).workflowTopics,
      relevance_score: resource.relevance_score ?? 0,
      worth_your_time_score: resource.worth_your_time_score ?? 0,
      directDesignSystemEvidence: resource.directDesignSystemEvidence ?? ""
    };
  });
}

function applyWorkflowImpactEditorsPick(digest: Digest, selectionResult: EditorialSelectionResult): Digest {
  const pickUrl = selectionResult.editorsPickCandidate ? normalizeUrl(selectionResult.editorsPickCandidate.url) : "";
  if (!pickUrl) return digest;

  const decisionMap = decisionsByUrl(selectionResult.selectedDecisions);
  const resources = digest.resources.map((resource) =>
    applySelectionMetadataToResource(resource, decisionMap.get(normalizeUrl(resource.url)))
  );
  const editorsPick = resources.find((resource) => normalizeUrl(resource.url) === pickUrl) ?? digest.editorsPick;
  return {
    ...digest,
    resources,
    editorsPick
  };
}

function applyRepresentativeRenderingAssembly(
  digest: Digest,
  selectionResult: EditorialSelectionResult,
  representativeLeadEvidence: SignalEvidence | null,
  representativeSupportingEvidence: SignalEvidence[],
  leadSignal: CandidateSignal | null,
  narrativeExtraction: NarrativeExtraction,
  editorialBrief: EditorialBrief
): { digest: Digest } & EditorialWritingLayerDebug {
  if (!representativeLeadEvidence) {
    return {
      digest,
      ...emptyEditorialWritingLayerDebug()
    };
  }

  const decisionMap = decisionsByUrl(selectionResult.selectedDecisions);
  const resourceByUrl = new Map(digest.resources.map((resource) => [normalizeUrl(resource.url), resource]));
  const candidateByUrl = new Map(selectionResult.selectedCandidates.map((candidate) => [normalizeUrl(candidate.url), candidate]));

  function resourceForEvidence(evidence: SignalEvidence): Resource | null {
    const url = normalizeUrl(evidence.resourceRef.url);
    const existing = resourceByUrl.get(url);
    if (existing) {
      return applySelectionMetadataToResource(existing, decisionMap.get(url));
    }

    const candidate = candidateByUrl.get(url);
    if (candidate) {
      return applySelectionMetadataToResource(candidateToResource(candidate), decisionMap.get(url));
    }

    return null;
  }

  const editorsPick = resourceForEvidence(representativeLeadEvidence) ?? digest.editorsPick;
  const supportingResources: Resource[] = [];
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const seenSourceFamilies = new Set<string>();
  const seenRepos = new Set<string>();

  for (const evidence of representativeSupportingEvidence) {
    const resource = resourceForEvidence(evidence);
    if (!resource || isDuplicateOfEditorsPick(resource, editorsPick)) {
      continue;
    }

    const urlKey = normalizeUrl(resource.url);
    const titleKey = normalizeTitleForDedupe(resource.title);
    const sourceFamilyKey = sourceFamilyForResource(resource);
    const repoKey = repoKeyForResource(resource);

    if (
      seenUrls.has(urlKey) ||
      seenTitles.has(titleKey) ||
      seenSourceFamilies.has(sourceFamilyKey) ||
      seenRepos.has(repoKey)
    ) {
      continue;
    }

    supportingResources.push(resource);
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    seenSourceFamilies.add(sourceFamilyKey);
    seenRepos.add(repoKey);
  }

  const contexts = buildEditorialContexts({
    leadSignal,
    representativeLeadEvidence,
    representativeSupportingEvidence,
    editorsPick,
    resources: supportingResources
  });

  const assembledDigest = withEditorialSections(
    {
      date: digest.date,
      trend_summary: digest.trend_summary,
      editorsPick,
      resources: supportingResources,
      ...(leadSignal !== null ? { leadSignal } : {})
    },
    contexts,
    narrativeExtraction,
    editorialBrief
  );

  return applyEditorialWritingLayer(assembledDigest, contexts, leadSignal);
}

function applyLeadSignal(digest: Digest, leadSignal: CandidateSignal | null): Digest {
  if (!leadSignal) {
    return digest;
  }

  return {
    ...digest,
    leadSignal
  };
}

function stripLeadSignal(digest: Digest): Digest {
  const { leadSignal: _leadSignal, ...digestWithoutLeadSignal } = digest;
  return digestWithoutLeadSignal;
}

function digestForCurrentThesisFlag(digest: Digest, thesisEngineEnabled: boolean): Digest {
  return thesisEngineEnabled ? digest : stripLeadSignal(digest);
}

function classifyTopicsFromResource(resource: Resource): Pick<TopicClassification, "aiTopics" | "designSystemTopics" | "workflowTopics"> {
  return classifyCandidateTopics({
    title: resource.title,
    url: resource.url,
    source: resource.source,
    published_date: resource.published_date ?? resource.date ?? "",
    snippet: resource.cleanSummary ?? resource.summary,
    cleanSummary: resource.cleanSummary ?? resource.summary,
    rawText: `${resource.summary} ${resource.design_system_angle ?? ""} ${resource.directDesignSystemEvidence ?? ""}`,
    sourceTier: 2,
    sourceScore: 3,
    relevanceScore: resource.relevance_score ?? 3,
    recencyScore: 3,
    technicalDepthScore: 3,
    practicalityScore: 3,
    noveltyScore: 3,
    worthYourTimeScore: resource.worth_your_time_score ?? 3,
    readerValue: 0,
    learningValue: 0,
    sourceCategory: "Official",
    rankingExplanation: "",
    directDesignSystemEvidence: resource.directDesignSystemEvidence ?? ""
  });
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
  const thesisEngineEnabled = thesisEngineEnabledFromEnv();
  const thesisLedgerEnabled = thesisEngineEnabled;
  const thesisLedgerPreview = thesisLedgerEnabled ? await createLedgerPreview() : emptyLedgerPreview();
  const thesisLedgerEntryCount = thesisLedgerPreview.totalEntries;
  let candidates: CandidateResource[] = [];
  let candidatePool: CandidateResource[] = [];
  let selectionResult: EditorialSelectionResult = selectEditorialCandidates([]);
  let sourceResults: SourceResult[] = [];
  let rejectedCandidates: EditorialSelectionDecision[] = [];
  let leadSignal: CandidateSignal | null = null;
  let candidateSignals: CandidateSignal[] = [];
  let rejectedSignals: RejectedSignal[] = [];
  let signalFormationReasons: string[] = [];
  let evidenceSetSummary: EvidenceSetSummary = emptyEvidenceSetSummary();
  let evidenceFormationReasons: string[] = [];
  let degenerateEvidenceSet = false;
  let evidencePromotionInputCount = 0;
  let promotedEvidenceCount = 0;
  let evidenceGroups: EvidenceGroup[] = [];
  let editorialDeliberation: EditorialDeliberationDecision = emptyEditorialDeliberation();
  let leadSignalSelectionReason = "";
  let runnerUpEvidenceGroups: EvidenceGroup[] = [];
  let evidencePromotionRejections: EvidencePromotionRejection[] = [];
  let representativeLeadEvidence: SignalEvidence | null = null;
  let representativeSupportingEvidence: SignalEvidence[] = [];
  let representativeSelectionReasons: string[] = [];
  let hiddenEvidenceCount = 0;
  let hiddenEvidenceReasons: HiddenEvidenceReason[] = [];
  let renderedResourceCount = 0;
  let renderedResourceTitles: string[] = [];
  let evidenceReasoning: EvidenceReasoningDebug = emptyEvidenceReasoning();
  let narrativeExtraction: NarrativeExtraction = emptyNarrativeExtraction();
  let editorialBrief: EditorialBrief = emptyEditorialBrief();
  let supportingResourceRanking = emptySupportingResourceRanking();

  console.log(`Provider config: OPENAI_API_KEY exists? ${hasOpenAIKey}`);
  console.log(`Provider config: GEMINI_API_KEY exists? ${hasGeminiKey}`);
  console.log(`Provider config: THESIS_ENGINE enabled? ${thesisEngineEnabled}`);

  try {
    console.log("Step 1: Candidate collection started.");
    const collectionResult = await collectCandidatesWithDiagnostics();
    candidates = collectionResult.candidates;
    sourceResults = collectionResult.sourceResults;
    console.log(`Step 2: Candidate collection completed (${candidates.length} candidates).`);

    candidatePool = filterRecentCandidates(candidates);
    console.log(`Step 3: Candidate normalization/recent-history pass completed (${candidatePool.length} candidates).`);
    console.log("Step 4: Topic classification and editorial scoring started.");
    if (thesisEngineEnabled) {
      const thesisResult = selectEditorialThesis(candidatePool);
      selectionResult = thesisResult.selectionResult;
      leadSignal = thesisResult.leadSignal;
      candidateSignals = thesisResult.candidateSignals;
      rejectedSignals = thesisResult.rejectedSignals;
      signalFormationReasons = thesisResult.signalFormationReasons;
      evidenceSetSummary = thesisResult.evidenceSetSummary;
      evidenceFormationReasons = thesisResult.evidenceFormationReasons;
      degenerateEvidenceSet = thesisResult.degenerateEvidenceSet;
      evidencePromotionInputCount = thesisResult.evidencePromotionInputCount;
      promotedEvidenceCount = thesisResult.promotedEvidenceCount;
      evidenceGroups = thesisResult.evidenceGroups;
      editorialDeliberation = thesisResult.editorialDeliberation;
      leadSignalSelectionReason = thesisResult.leadSignalSelectionReason;
      runnerUpEvidenceGroups = thesisResult.runnerUpEvidenceGroups;
      evidencePromotionRejections = thesisResult.evidencePromotionRejections;
      representativeLeadEvidence = thesisResult.representativeLeadEvidence;
      representativeSupportingEvidence = thesisResult.representativeSupportingEvidence;
      representativeSelectionReasons = thesisResult.representativeSelectionReasons;
      hiddenEvidenceCount = thesisResult.hiddenEvidenceCount;
      hiddenEvidenceReasons = thesisResult.hiddenEvidenceReasons;
      renderedResourceCount = thesisResult.renderedResourceCount;
      renderedResourceTitles = thesisResult.renderedResourceTitles;
      evidenceReasoning = thesisResult.evidenceReasoning;
      supportingResourceRanking = thesisResult.supportingResourceRanking;
      narrativeExtraction = extractNarrativeFrame({
        leadSignal,
        editorialDeliberation,
        evidenceReasoning,
        representativeLeadEvidence,
        representativeSupportingEvidence
      });
      editorialBrief = buildEditorialBrief({
        narrativeFrame: narrativeExtraction,
        evidenceReasoning,
        representativeLeadEvidence,
        representativeSupportingEvidence
      });
    } else {
      selectionResult = selectEditorialCandidates(candidatePool);
    }
    rejectedCandidates = selectionResult.rejectedDecisions;
    console.log(
      `Step 5: Editorial selection completed (${selectionResult.selectedCandidates.length} selected, ${selectionResult.qualifyingCandidateCount} qualified).`
    );

    if (candidates.length === 0) {
      throw new Error("No candidates collected from configured sources.");
    }

    if (selectionResult.selectedCandidates.length === 0) {
      console.error("No candidates survived editorial selection; returning a clean empty-selection digest.");
      const fallbackDigest = applyLeadSignal(buildCandidateFallbackDigest(selectionResult), leadSignal);
      if (fallbackDigest.resources.length > 0) {
        rememberDigest(fallbackDigest);
      }
      return {
        digest: fallbackDigest,
        mode: "candidateFallbackEmptySelection",
        hasOpenAIKey,
        hasGeminiKey,
        thesisEngineEnabled,
        thesisLedgerEnabled,
        thesisLedgerEntryCount,
        thesisLedgerPreview,
        leadSignal,
        candidateSignals,
        rejectedSignals,
        signalFormationReasons,
        evidenceSetSummary,
        evidenceFormationReasons,
        degenerateEvidenceSet,
        evidencePromotionInputCount,
        promotedEvidenceCount,
        evidenceGroups,
        editorialDeliberation,
        leadSignalSelectionReason,
        runnerUpEvidenceGroups,
        evidencePromotionRejections,
        representativeLeadEvidence,
        representativeSupportingEvidence,
        representativeSelectionReasons,
        hiddenEvidenceCount,
        hiddenEvidenceReasons,
        renderedResourceCount,
        renderedResourceTitles,
        evidenceReasoning,
        narrativeExtraction,
        editorialBrief,
        ...editorialContextDebugFor(fallbackDigest, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
        ...sectionContractDebugFor(fallbackDigest, leadSignal),
        ...emptyEditorialWritingLayerDebug(),
        supportingResourceRanking,
        candidateCount: candidates.length,
        filteredCandidateCount: selectionResult.qualifyingCandidateCount,
        selectedResourceCount: fallbackDigest.resources.length,
        fallbackReason: "No candidates survived editorial selection.",
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
        selectedPreview: previewResources(fallbackDigest.resources, selectionResult.decisions),
        editorialScores: scoreEditorialCandidates(candidates),
        topicClassifications: classifyCandidatesTopics(candidates),
        editorialSelection: selectionResult.decisions
      };
    }

    try {
      console.log("Step 6: LLM ranking/summarization started.");
      const ranked = await rankWithAvailableProvider(selectionResult.selectedCandidates);
      const editorialAssembly = applyRepresentativeRenderingAssembly(
        applyWorkflowImpactEditorsPick(withEditorialSections(ranked.digest), selectionResult),
        selectionResult,
        representativeLeadEvidence,
        representativeSupportingEvidence,
        leadSignal,
        narrativeExtraction,
        editorialBrief
      );
      const editorialDigest = applyLeadSignal(editorialAssembly.digest, leadSignal);
      console.log(`Step 7: LLM ranking/summarization completed (${editorialDigest.resources.length} selected).`);

      cachedDigest = editorialDigest;
      rememberDigest(editorialDigest);
      console.log("Step 8: Digest cached.");

      return {
        digest: editorialDigest,
        mode: ranked.provider === "openAI" ? "liveOpenAI" : "liveGemini",
        hasOpenAIKey,
        hasGeminiKey,
        thesisEngineEnabled,
        thesisLedgerEnabled,
        thesisLedgerEntryCount,
        thesisLedgerPreview,
        leadSignal,
        candidateSignals,
        rejectedSignals,
        signalFormationReasons,
        evidenceSetSummary,
        evidenceFormationReasons,
        degenerateEvidenceSet,
        evidencePromotionInputCount,
        promotedEvidenceCount,
        evidenceGroups,
        editorialDeliberation,
        leadSignalSelectionReason,
        runnerUpEvidenceGroups,
        evidencePromotionRejections,
        representativeLeadEvidence,
        representativeSupportingEvidence,
        representativeSelectionReasons,
        hiddenEvidenceCount,
        hiddenEvidenceReasons,
        renderedResourceCount: editorialDigest.resources.length,
        renderedResourceTitles: editorialDigest.resources.map((resource) => resource.title),
        evidenceReasoning,
        narrativeExtraction,
        editorialBrief,
        ...editorialContextDebugFor(editorialDigest, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
        ...sectionContractDebugFor(editorialDigest, leadSignal),
        editorialWritingLayer: editorialAssembly.editorialWritingLayer,
        resourceCardIntegrity: editorialAssembly.resourceCardIntegrity,
        supportingResourceRanking,
        candidateCount: candidates.length,
        filteredCandidateCount: selectionResult.qualifyingCandidateCount,
        selectedResourceCount: editorialDigest.resources.length,
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
        selectedPreview: previewResources(editorialDigest.resources, selectionResult.decisions),
        editorialScores: scoreEditorialCandidates(candidates),
        topicClassifications: classifyCandidatesTopics(candidates),
        editorialSelection: selectionResult.decisions
      };
    } catch (error) {
      const fallbackReason = getErrorMessage(error);
      console.error(`LLM ranking failed: ${fallbackReason}`);

      const fallbackAssembly = applyRepresentativeRenderingAssembly(
        buildCandidateFallbackDigest(selectionResult),
        selectionResult,
        representativeLeadEvidence,
        representativeSupportingEvidence,
        leadSignal,
        narrativeExtraction,
        editorialBrief
      );
      const fallbackDigest = applyLeadSignal(fallbackAssembly.digest, leadSignal);
      console.log(`Daily digest mode: candidateFallback (${fallbackDigest.resources.length} resources).`);

      if (hasRenderableDigestContent(fallbackDigest)) {
        rememberDigest(fallbackDigest);
        return {
          digest: fallbackDigest,
          mode: "candidateFallback",
          hasOpenAIKey,
          hasGeminiKey,
          thesisEngineEnabled,
          thesisLedgerEnabled,
          thesisLedgerEntryCount,
          thesisLedgerPreview,
          leadSignal,
          candidateSignals,
          rejectedSignals,
          signalFormationReasons,
          evidenceSetSummary,
          evidenceFormationReasons,
          degenerateEvidenceSet,
          evidencePromotionInputCount,
          promotedEvidenceCount,
          evidenceGroups,
          editorialDeliberation,
          leadSignalSelectionReason,
          runnerUpEvidenceGroups,
          evidencePromotionRejections,
          representativeLeadEvidence,
          representativeSupportingEvidence,
          representativeSelectionReasons,
          hiddenEvidenceCount,
          hiddenEvidenceReasons,
          renderedResourceCount: fallbackDigest.resources.length,
          renderedResourceTitles: fallbackDigest.resources.map((resource) => resource.title),
          evidenceReasoning,
          narrativeExtraction,
          editorialBrief,
          ...editorialContextDebugFor(fallbackDigest, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
          ...sectionContractDebugFor(fallbackDigest, leadSignal),
          editorialWritingLayer: fallbackAssembly.editorialWritingLayer,
          resourceCardIntegrity: fallbackAssembly.resourceCardIntegrity,
          supportingResourceRanking,
          candidateCount: candidates.length,
          filteredCandidateCount: selectionResult.qualifyingCandidateCount,
          selectedResourceCount: fallbackDigest.resources.length,
          fallbackReason,
          sourceResults,
          rejectedCandidates,
          candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
          selectedPreview: previewResources(fallbackDigest.resources, selectionResult.decisions),
          editorialScores: scoreEditorialCandidates(candidates),
          topicClassifications: classifyCandidatesTopics(candidates),
          editorialSelection: selectionResult.decisions
        };
      }

      if (candidatePool.length > 0) {
        const emptyDigest = createEmptySelectionDigest();
        console.error("Daily digest mode: candidateFallbackEmptySelection.");
        return {
          digest: emptyDigest,
          mode: "candidateFallbackEmptySelection",
          hasOpenAIKey,
          hasGeminiKey,
          thesisEngineEnabled,
          thesisLedgerEnabled,
          thesisLedgerEntryCount,
          thesisLedgerPreview,
          leadSignal,
          candidateSignals,
          rejectedSignals,
          signalFormationReasons,
          evidenceSetSummary,
          evidenceFormationReasons,
          degenerateEvidenceSet,
          evidencePromotionInputCount,
          promotedEvidenceCount,
          evidenceGroups,
          editorialDeliberation,
          leadSignalSelectionReason,
          runnerUpEvidenceGroups,
          evidencePromotionRejections,
          representativeLeadEvidence,
          representativeSupportingEvidence,
          representativeSelectionReasons,
          hiddenEvidenceCount,
          hiddenEvidenceReasons,
          renderedResourceCount,
          renderedResourceTitles,
          evidenceReasoning,
          narrativeExtraction,
          editorialBrief,
          ...editorialContextDebugFor(emptyDigest, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
          ...sectionContractDebugFor(emptyDigest, leadSignal),
          ...emptyEditorialWritingLayerDebug(),
          supportingResourceRanking,
          candidateCount: candidates.length,
          filteredCandidateCount: selectionResult.qualifyingCandidateCount,
          selectedResourceCount: 0,
          fallbackReason,
          sourceResults,
          rejectedCandidates,
          candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
          selectedPreview: [],
          editorialScores: scoreEditorialCandidates(candidates),
          topicClassifications: classifyCandidatesTopics(candidates),
          editorialSelection: selectionResult.decisions
        };
      }

      if (cachedDigest) {
        console.error("Daily digest mode: cachedDigest.");
        const cachedDigestForResponse = digestForCurrentThesisFlag(cachedDigest, thesisEngineEnabled);
        return {
          digest: cachedDigestForResponse,
          mode: "cachedDigest",
          hasOpenAIKey,
          hasGeminiKey,
          thesisEngineEnabled,
          thesisLedgerEnabled,
          thesisLedgerEntryCount,
          thesisLedgerPreview,
          leadSignal,
          candidateSignals,
          rejectedSignals,
          signalFormationReasons,
          evidenceSetSummary,
          evidenceFormationReasons,
          degenerateEvidenceSet,
          evidencePromotionInputCount,
          promotedEvidenceCount,
          evidenceGroups,
          editorialDeliberation,
          leadSignalSelectionReason,
          runnerUpEvidenceGroups,
          evidencePromotionRejections,
          representativeLeadEvidence,
          representativeSupportingEvidence,
          representativeSelectionReasons,
          hiddenEvidenceCount,
          hiddenEvidenceReasons,
          renderedResourceCount,
          renderedResourceTitles,
          evidenceReasoning,
          narrativeExtraction,
          editorialBrief,
          ...editorialContextDebugFor(cachedDigestForResponse, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
          ...sectionContractDebugFor(cachedDigestForResponse, leadSignal),
          ...emptyEditorialWritingLayerDebug(),
          supportingResourceRanking,
          candidateCount: candidates.length,
          filteredCandidateCount: selectionResult.qualifyingCandidateCount,
          selectedResourceCount: cachedDigestForResponse.resources.length,
          fallbackReason,
          sourceResults,
          rejectedCandidates,
          candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
          selectedPreview: previewResources(cachedDigestForResponse.resources, selectionResult.decisions),
          editorialScores: scoreEditorialCandidates(candidates),
          topicClassifications: classifyCandidatesTopics(candidates),
          editorialSelection: selectionResult.decisions
        };
      }

      const emergencyFallbackDigest = createEmergencyFallbackDigest();
      return {
        digest: emergencyFallbackDigest,
        mode: "emergencyFallback",
        hasOpenAIKey,
        hasGeminiKey,
        thesisEngineEnabled,
        thesisLedgerEnabled,
        thesisLedgerEntryCount,
        thesisLedgerPreview,
        leadSignal,
        candidateSignals,
        rejectedSignals,
        signalFormationReasons,
        evidenceSetSummary,
        evidenceFormationReasons,
        degenerateEvidenceSet,
        evidencePromotionInputCount,
        promotedEvidenceCount,
        evidenceGroups,
        editorialDeliberation,
        leadSignalSelectionReason,
        runnerUpEvidenceGroups,
        evidencePromotionRejections,
        representativeLeadEvidence,
        representativeSupportingEvidence,
        representativeSelectionReasons,
        hiddenEvidenceCount,
        hiddenEvidenceReasons,
        renderedResourceCount,
        renderedResourceTitles,
        evidenceReasoning,
        narrativeExtraction,
        editorialBrief,
        ...editorialContextDebugFor(emergencyFallbackDigest, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
        ...sectionContractDebugFor(emergencyFallbackDigest, leadSignal),
        ...emptyEditorialWritingLayerDebug(),
        supportingResourceRanking,
        candidateCount: candidates.length,
        filteredCandidateCount: selectionResult.qualifyingCandidateCount,
        selectedResourceCount: 0,
        fallbackReason,
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
        selectedPreview: [],
        editorialScores: scoreEditorialCandidates(candidates),
        topicClassifications: classifyCandidatesTopics(candidates),
        editorialSelection: selectionResult.decisions
      };
    }
  } catch (error) {
    const fallbackReason = getErrorMessage(error);
    console.error(`Candidate pipeline failed: ${fallbackReason}`);

    if (candidatePool.length > 0) {
      const emptyDigest = createEmptySelectionDigest();
      console.error("Daily digest mode: candidateFallbackEmptySelection.");
      return {
        digest: emptyDigest,
        mode: "candidateFallbackEmptySelection",
        hasOpenAIKey,
        hasGeminiKey,
        thesisEngineEnabled,
        thesisLedgerEnabled,
        thesisLedgerEntryCount,
        thesisLedgerPreview,
        leadSignal,
        candidateSignals,
        rejectedSignals,
        signalFormationReasons,
        evidenceSetSummary,
        evidenceFormationReasons,
        degenerateEvidenceSet,
        evidencePromotionInputCount,
        promotedEvidenceCount,
        evidenceGroups,
        editorialDeliberation,
        leadSignalSelectionReason,
        runnerUpEvidenceGroups,
        evidencePromotionRejections,
        representativeLeadEvidence,
        representativeSupportingEvidence,
        representativeSelectionReasons,
        hiddenEvidenceCount,
        hiddenEvidenceReasons,
        renderedResourceCount,
        renderedResourceTitles,
        evidenceReasoning,
        narrativeExtraction,
        editorialBrief,
        ...editorialContextDebugFor(emptyDigest, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
        ...sectionContractDebugFor(emptyDigest, leadSignal),
        ...emptyEditorialWritingLayerDebug(),
        supportingResourceRanking,
        candidateCount: candidates.length,
        filteredCandidateCount: selectionResult.qualifyingCandidateCount,
        selectedResourceCount: 0,
        fallbackReason,
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
        selectedPreview: [],
        editorialScores: scoreEditorialCandidates(candidates),
        topicClassifications: classifyCandidatesTopics(candidates),
        editorialSelection: selectionResult.decisions
      };
    }

    if (cachedDigest) {
      console.error("Daily digest mode: cachedDigest.");
      const cachedDigestForResponse = digestForCurrentThesisFlag(cachedDigest, thesisEngineEnabled);
      return {
        digest: cachedDigestForResponse,
        mode: "cachedDigest",
        hasOpenAIKey,
        hasGeminiKey,
        thesisEngineEnabled,
        thesisLedgerEnabled,
        thesisLedgerEntryCount,
        thesisLedgerPreview,
        leadSignal,
        candidateSignals,
        rejectedSignals,
        signalFormationReasons,
        evidenceSetSummary,
        evidenceFormationReasons,
        degenerateEvidenceSet,
        evidencePromotionInputCount,
        promotedEvidenceCount,
        evidenceGroups,
        editorialDeliberation,
        leadSignalSelectionReason,
        runnerUpEvidenceGroups,
        evidencePromotionRejections,
        representativeLeadEvidence,
        representativeSupportingEvidence,
        representativeSelectionReasons,
        hiddenEvidenceCount,
        hiddenEvidenceReasons,
        renderedResourceCount,
        renderedResourceTitles,
        evidenceReasoning,
        narrativeExtraction,
        editorialBrief,
        ...editorialContextDebugFor(cachedDigestForResponse, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
        ...sectionContractDebugFor(cachedDigestForResponse, leadSignal),
        ...emptyEditorialWritingLayerDebug(),
        supportingResourceRanking,
        candidateCount: candidates.length,
        filteredCandidateCount: selectionResult.qualifyingCandidateCount,
        selectedResourceCount: cachedDigestForResponse.resources.length,
        fallbackReason,
        sourceResults,
        rejectedCandidates,
        candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
        selectedPreview: previewResources(cachedDigestForResponse.resources, selectionResult.decisions),
        editorialScores: scoreEditorialCandidates(candidates),
        topicClassifications: classifyCandidatesTopics(candidates),
        editorialSelection: selectionResult.decisions
      };
    }

    console.error("Daily digest mode: emergencyFallback.");
    const emergencyFallbackDigest = createEmergencyFallbackDigest();
    return {
      digest: emergencyFallbackDigest,
      mode: "emergencyFallback",
      hasOpenAIKey,
      hasGeminiKey,
      thesisEngineEnabled,
      thesisLedgerEnabled,
      thesisLedgerEntryCount,
      thesisLedgerPreview,
      leadSignal,
      candidateSignals,
      rejectedSignals,
      signalFormationReasons,
      evidenceSetSummary,
      evidenceFormationReasons,
      degenerateEvidenceSet,
      evidencePromotionInputCount,
      promotedEvidenceCount,
      evidenceGroups,
      editorialDeliberation,
      leadSignalSelectionReason,
      runnerUpEvidenceGroups,
      evidencePromotionRejections,
      representativeLeadEvidence,
      representativeSupportingEvidence,
      representativeSelectionReasons,
      hiddenEvidenceCount,
      hiddenEvidenceReasons,
      renderedResourceCount,
      renderedResourceTitles,
      evidenceReasoning,
      narrativeExtraction,
      editorialBrief,
      ...editorialContextDebugFor(emergencyFallbackDigest, leadSignal, representativeLeadEvidence, representativeSupportingEvidence),
      ...sectionContractDebugFor(emergencyFallbackDigest, leadSignal),
      ...emptyEditorialWritingLayerDebug(),
      supportingResourceRanking,
      candidateCount: candidates.length,
      filteredCandidateCount: selectionResult.qualifyingCandidateCount,
      selectedResourceCount: 0,
      fallbackReason,
      sourceResults,
      rejectedCandidates,
      candidatesPreview: previewCandidates(candidatePool, selectionResult.decisions),
      selectedPreview: [],
      editorialScores: scoreEditorialCandidates(candidates),
      topicClassifications: classifyCandidatesTopics(candidates),
      editorialSelection: selectionResult.decisions
    };
  }
}
