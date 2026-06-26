import type { Digest, Resource } from "./emailTemplate.js";
import type {
  EditorialContexts,
  EditorsPickContext,
  HorizonContext,
  ImpactContext,
  MoveContext,
  SignalContext,
  SupportingSignalsContext
} from "./editorialContexts.js";
import type { CandidateSignal } from "./editorialThesis.js";
import { validateSectionContracts } from "./editorialContracts.js";
import { cleanText, truncateText } from "./textUtils.js";

export type EditorialWritingLayerSectionDebug = {
  initialMachineryLeakPass: boolean;
  finalMachineryLeakPass: boolean;
  initialOwnershipPresencePass: boolean;
  finalOwnershipPresencePass: boolean;
  fallbackApplied: boolean;
};

export type EditorialWritingLayerDebug = {
  editorialWritingLayer: {
    applied: boolean;
    rewrittenSections: string[];
    originalSectionTextPreview: Record<string, string>;
    finalSectionTextPreview: Record<string, string>;
    rewriteReasons: string[];
    finalContractPass: boolean;
    sections: Record<string, EditorialWritingLayerSectionDebug>;
  };
};

type DraftSections = {
  theSignal: string;
  editorsPick: Resource | null;
  supportingSignals: string[];
  suggestedExperiment: string;
  teamDiscussionQuestions: string[];
  nextWeekWatchlist: string[];
  resources: Resource[];
};

const machineryReplacements: Array<[RegExp, string]> = [
  [/\bM0\b/gi, ""],
  [/\bM1\b/gi, ""],
  [/\bM2(?:\.\d+)?\b/gi, ""],
  [/\bthesis path\b/gi, "editorial direction"],
  [/\bselection reason\b/gi, "rationale"],
  [/\brejection reason\b/gi, "rationale"],
  [/\bsource marker\b/gi, "source"],
  [/\bindependence marker\b/gi, "source"],
  [/\bgrounded in\b/gi, "based on"],
  [/\bselected\b/gi, "chosen"],
  [/\bcandidates?\b/gi, "items"],
  [/\blead evidence\b/gi, "clearest example"],
  [/\bsupporting evidence\b/gi, "related signals"],
  [/\bevidence items?\b/gi, "signals"],
  [/\bevidence\b/gi, "signal"],
  [/\bresources?\b/gi, "items"],
  [/\branked?\b/gi, "prioritized"],
  [/\branking\b/gi, "prioritization"],
  [/\bquality-adjusted\b/gi, "quality"],
  [/\bworkflow-impact\b/gi, "workflow"],
  [/\beditorial read\b/gi, "editorial view"],
  [/\bworkflow score\b/gi, "workflow view"],
  [/\beditorial score\b/gi, "editorial view"],
  [/\bscore\b/gi, "assessment"],
  [/\bscored\b/gi, "assessed"],
  [/\brating\b/gi, "assessment"],
  [/\brated\b/gi, "assessed"],
  [/\bclusters?\b/gi, "patterns"],
  [/\bpipeline\b/gi, "workflow"],
  [/\bformation\b/gi, "shape"],
  [/\bdebug\b/gi, "review"],
  [/\bprompt\b/gi, "brief"],
  [/\bLLM reasoning\b/gi, "model output"],
  [/\brelevance_score\b/gi, "relevance"],
  [/\bworth_your_time\b/gi, "usefulness"],
  [/\bactionability\b/gi, "practicality"]
];

function safeText(value: string): string {
  return machineryReplacements
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), cleanText(value))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function cleanResourceTitle(value: string): string {
  return cleanText(value)
    .replace(/\s+/g, " ")
    .replace(/^[:\-\s]+|[:\-\s]+$/g, "")
    .trim();
}

function normalizedTitle(value: string): string {
  return cleanResourceTitle(value)
    .toLowerCase()
    .replace(/\bv?\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?\b/g, "version")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function preview(value: string): string {
  return truncateText(cleanText(value), 220);
}

function sectionText(sections: DraftSections, section: string): string {
  if (section === "theSignal") return sections.theSignal;
  if (section === "editorsPick") {
    const pick = sections.editorsPick;
    return pick
      ? [pick.title, pick.source, pick.cleanSummary, pick.summary, pick.why_selected, pick.expected_impact_on_workflow]
          .filter(Boolean)
          .join(" ")
      : "";
  }
  if (section === "supportingSignals") return sections.supportingSignals.join(" ");
  if (section === "suggestedExperiment") return sections.suggestedExperiment;
  if (section === "questionsForOurTeam") return sections.teamDiscussionQuestions.join(" ");
  if (section === "watchlist") return sections.nextWeekWatchlist.join(" ");
  if (section === "supportingResources") {
    return sections.resources
      .map((resource) =>
        [
          resource.editorialTitle,
          resource.cleanSummary,
          resource.summary,
          resource.why_selected,
          resource.expected_impact_on_workflow,
          resource.why_it_matters_to_our_team,
          resource.ignore_risk
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ");
  }
  return "";
}

function applySectionsToDigest(digest: Digest, sections: DraftSections): Digest {
  return {
    ...digest,
    theSignal: sections.theSignal,
    executiveBrief: sections.theSignal,
    editorsPick: sections.editorsPick,
    supportingSignals: sections.supportingSignals,
    thisWeeksSignals: sections.supportingSignals,
    suggestedExperiment: sections.suggestedExperiment,
    teamDiscussionQuestions: sections.teamDiscussionQuestions,
    nextWeekWatchlist: sections.nextWeekWatchlist,
    resources: sections.resources
  };
}

function workflowPhrase(value: string | undefined): string {
  const text = safeText(value || "");
  return text || "Design System metadata, documentation, review rules, and system context";
}

export function writeSignalSection(context: SignalContext): string {
  const theme = workflowPhrase(context.themeAnchor);

  return safeText(
    `This week’s strongest shift is that AI-assisted Design System work is becoming less constrained by interface generation and more constrained by the structured knowledge tools can safely consume. The important work is moving toward ${theme || "metadata, documentation quality, review rules, and system context"} that agents can understand without guessing.`
  );
}

export function writeEditorsPickSection(resource: Resource | null, context: EditorsPickContext): Resource | null {
  if (!resource) return null;

  const title = context.sourceMetadata?.title || resource.title;
  const source = context.sourceMetadata?.source || resource.source;
  const contribution = safeText(context.contribution || resource.cleanSummary || resource.summary);
  const cleanSummary = contribution
    ? `${title} is useful because it shows ${truncateText(contribution, 190)}`
    : `${title} is useful because it makes the shift concrete for mature Design System work.`;

  return {
    ...resource,
    title,
    source,
    cleanSummary: safeText(cleanSummary),
    summary: safeText(cleanSummary),
    why_selected: safeText(`${title} is the clearest concrete example of this week’s shift.`),
    expected_impact_on_workflow: safeText(`${source} shows the workflow moving from generation toward verification and reusable system context.`)
  };
}

export function writeSupportingSignalsSection(context: SupportingSignalsContext): string[] {
  const contributions = context.contributions.map(safeText).filter(Boolean);
  if (contributions.length === 0) {
    return [
      "Related signals were too thin to add much beyond the main shift.",
      "The practical pattern is still moving toward clearer system context for AI-assisted work."
    ];
  }

  return contributions.slice(0, 3).map((contribution) => safeText(truncateText(contribution, 150)));
}

export function writeSuggestedExperimentSection(context: MoveContext): string {
  const surface = safeText(context.targetSurface || "system knowledge");
  const move = safeText(context.opportunityMove || "choose one high-use component and document the assumptions an internal agent should not have to infer");
  const precondition = safeText(context.preconditions[0] || "one high-use component");

  return safeText(
    `Because ${surface} now depends on clearer system assumptions, ${truncateText(move, 145)} Start with ${precondition} and capture one gap an internal agent should not have to infer.`
  );
}

export function writeQuestionsSection(context: ImpactContext): string[] {
  const surface = safeText(context.workflowSurface[0] || "our component workflow");
  return [
    `Where does ${surface} still depend on human interpretation instead of explicit system rules?`,
    "Which documentation or ownership gap would make an internal agent unreliable?",
    "What governance or accessibility assumption should be made visible before AI-assisted changes ship?"
  ];
}

export function writeWatchlistSection(context: HorizonContext): string[] {
  const watchlist = context.watchlist.map(safeText).filter(Boolean);
  if (watchlist.length >= 2) {
    return watchlist.slice(0, 3);
  }

  return [
    "Watch for tools that expose component metadata directly to AI agents.",
    "Track whether design-to-code work explains review quality and component reuse.",
    "Look for QA or accessibility automation that connects back to ownership and delivery workflows."
  ];
}

function sanitizeResource(resource: Resource): Resource {
  return {
    ...resource,
    title: cleanResourceTitle(resource.title),
    editorialTitle: undefined,
    cleanSummary: resource.cleanSummary ? safeText(resource.cleanSummary) : resource.cleanSummary,
    summary: safeText(resource.summary),
    why_selected: resource.why_selected ? safeText(resource.why_selected) : resource.why_selected,
    expected_impact_on_workflow: resource.expected_impact_on_workflow
      ? safeText(resource.expected_impact_on_workflow)
      : resource.expected_impact_on_workflow,
    why_it_matters_to_our_team: resource.why_it_matters_to_our_team
      ? safeText(resource.why_it_matters_to_our_team)
      : resource.why_it_matters_to_our_team,
    ignore_risk: resource.ignore_risk ? safeText(resource.ignore_risk) : resource.ignore_risk
  };
}

function dedupeSupportingResources(resources: Resource[]): Resource[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: Resource[] = [];

  for (const resource of resources) {
    const urlKey = resource.url.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
    const titleKey = normalizedTitle(resource.title);

    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) {
      continue;
    }

    deduped.push(resource);
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
  }

  return deduped;
}

function draftFromDigest(digest: Digest): DraftSections {
  return {
    theSignal: digest.theSignal,
    editorsPick: digest.editorsPick,
    supportingSignals: digest.supportingSignals,
    suggestedExperiment: digest.suggestedExperiment,
    teamDiscussionQuestions: digest.teamDiscussionQuestions,
    nextWeekWatchlist: digest.nextWeekWatchlist,
    resources: digest.resources
  };
}

function buildFallbackSections(digest: Digest, contexts: EditorialContexts): DraftSections {
  return {
    theSignal: writeSignalSection(contexts.signalContext),
    editorsPick: writeEditorsPickSection(digest.editorsPick, contexts.editorsPickContext),
    supportingSignals: writeSupportingSignalsSection(contexts.supportingSignalsContext),
    suggestedExperiment: writeSuggestedExperimentSection(contexts.moveContext),
    teamDiscussionQuestions: writeQuestionsSection(contexts.impactContext),
    nextWeekWatchlist: writeWatchlistSection(contexts.horizonContext),
    resources: dedupeSupportingResources(digest.resources.map(sanitizeResource))
  };
}

export function applyEditorialWritingLayer(
  digest: Digest,
  contexts: EditorialContexts,
  leadSignal: CandidateSignal | null
): { digest: Digest } & EditorialWritingLayerDebug {
  const originalSections = draftFromDigest(digest);
  const initialContracts = validateSectionContracts(digest, leadSignal);
  const fallbackSections = buildFallbackSections(digest, contexts);
  let finalSections: DraftSections = {
    theSignal: safeText(originalSections.theSignal),
    editorsPick: originalSections.editorsPick ? sanitizeResource(originalSections.editorsPick) : null,
    supportingSignals: originalSections.supportingSignals.map(safeText),
    suggestedExperiment: safeText(originalSections.suggestedExperiment),
    teamDiscussionQuestions: originalSections.teamDiscussionQuestions.map(safeText),
    nextWeekWatchlist: originalSections.nextWeekWatchlist.map(safeText),
    resources: dedupeSupportingResources(originalSections.resources.map(sanitizeResource))
  };
  const rewrittenSections: string[] = [];
  const rewriteReasons: string[] = [];

  for (const [sectionName, result] of Object.entries(initialContracts.sectionContracts)) {
    if (result.machineryLeakPass && result.ownershipPresencePass) continue;

    rewrittenSections.push(sectionName);
    if (!result.machineryLeakPass) {
      rewriteReasons.push(`${sectionName}: machinery vocabulary (${result.offendingTerms.join(", ")}).`);
    }
    if (!result.ownershipPresencePass) {
      rewriteReasons.push(`${sectionName}: ownership presence check failed.`);
    }

    if (sectionName === "theSignal") finalSections.theSignal = fallbackSections.theSignal;
    if (sectionName === "editorsPick") finalSections.editorsPick = fallbackSections.editorsPick;
    if (sectionName === "supportingSignals") finalSections.supportingSignals = fallbackSections.supportingSignals;
    if (sectionName === "suggestedExperiment") finalSections.suggestedExperiment = fallbackSections.suggestedExperiment;
    if (sectionName === "questionsForOurTeam") finalSections.teamDiscussionQuestions = fallbackSections.teamDiscussionQuestions;
    if (sectionName === "watchlist") finalSections.nextWeekWatchlist = fallbackSections.nextWeekWatchlist;
    if (sectionName === "supportingResources") finalSections.resources = fallbackSections.resources;
  }

  let finalDigest = applySectionsToDigest(digest, finalSections);
  let finalContracts = validateSectionContracts(finalDigest, leadSignal);

  if (finalContracts.sectionContractViolations.length > 0) {
    finalSections = fallbackSections;
    finalDigest = applySectionsToDigest(digest, finalSections);
    finalContracts = validateSectionContracts(finalDigest, leadSignal);
    for (const sectionName of Object.keys(finalContracts.sectionContracts)) {
      if (!rewrittenSections.includes(sectionName)) rewrittenSections.push(sectionName);
    }
    rewriteReasons.push("Applied full deterministic fallback because partial repair still failed.");
  }

  const sectionNames = Object.keys(finalContracts.sectionContracts);
  const sectionDebug = Object.fromEntries(
    sectionNames.map((sectionName) => {
      const initial = initialContracts.sectionContracts[sectionName as keyof typeof initialContracts.sectionContracts];
      const final = finalContracts.sectionContracts[sectionName as keyof typeof finalContracts.sectionContracts];
      return [
        sectionName,
        {
          initialMachineryLeakPass: initial.machineryLeakPass,
          finalMachineryLeakPass: final.machineryLeakPass,
          initialOwnershipPresencePass: initial.ownershipPresencePass,
          finalOwnershipPresencePass: final.ownershipPresencePass,
          fallbackApplied: rewrittenSections.includes(sectionName)
        }
      ];
    })
  );

  const originalSectionTextPreview = Object.fromEntries(sectionNames.map((sectionName) => [sectionName, preview(sectionText(originalSections, sectionName))]));
  const finalSectionTextPreview = Object.fromEntries(sectionNames.map((sectionName) => [sectionName, preview(sectionText(finalSections, sectionName))]));

  return {
    digest: finalDigest,
    editorialWritingLayer: {
      applied: true,
      rewrittenSections,
      originalSectionTextPreview,
      finalSectionTextPreview,
      rewriteReasons,
      finalContractPass: finalContracts.sectionContractViolations.length === 0,
      sections: sectionDebug
    }
  };
}

export function emptyEditorialWritingLayerDebug(): EditorialWritingLayerDebug {
  return {
    editorialWritingLayer: {
      applied: false,
      rewrittenSections: [],
      originalSectionTextPreview: {},
      finalSectionTextPreview: {},
      rewriteReasons: [],
      finalContractPass: true,
      sections: {}
    }
  };
}
