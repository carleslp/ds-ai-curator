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
  resourceCardIntegrity: ResourceCardIntegrityDebug;
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

type ResourceCardIntegrityCard = {
  title: string;
  url: string;
  source: string;
  summaryPass: boolean;
  whyItMattersPass: boolean;
  impactPass: boolean;
  bannedTerms: string[];
  summaryWhyItMattersOverlap: number;
  finalReaderFacingPreview: {
    summary: string;
    whyItMatters: string;
    impact: string;
  };
};

type ResourceCardIntegrityDebug = {
  pass: boolean;
  checkedCardCount: number;
  failingCards: ResourceCardIntegrityCard[];
  sanitizedCards: string[];
  regeneratedCards: string[];
  bannedTermsByCard: Array<{
    title: string;
    url: string;
    terms: string[];
  }>;
  duplicateTitleCheck: {
    pass: boolean;
    duplicates: string[];
  };
  summaryWhyItMattersSimilarity: Array<{
    title: string;
    url: string;
    overlap: number;
    warning: boolean;
  }>;
  cards: ResourceCardIntegrityCard[];
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

const readerCardBannedTerms = [
  "Editorial value",
  "editorial value",
  "selected",
  "selected because",
  "candidate",
  "evidence",
  "lead evidence",
  "supporting evidence",
  "resource ranking",
  "rank",
  "ranked",
  "score",
  "scored",
  "editorial score",
  "workflow score",
  "quality-adjusted",
  "actionability score",
  "cluster",
  "pipeline",
  "formation",
  "thesis path",
  "grounded in",
  "source marker",
  "independence marker",
  "rejection reason",
  "skipped because",
  "selectedBecause",
  "skippedBecause",
  "nothing Editorial value",
  "The important shift is this",
  "this direct clue is chosen",
  "chosen from curated",
  "curated Design System"
];

function safeText(value: string): string {
  return machineryReplacements
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), cleanText(value))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function bannedTermsInReaderText(value: string): string[] {
  const text = cleanText(value);
  const lower = text.toLowerCase();

  return readerCardBannedTerms.filter((term) => {
    const normalized = term.toLowerCase();
    if (/^[a-z0-9-]+$/i.test(normalized)) {
      return new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
    }

    return lower.includes(normalized);
  });
}

const cardStopWords = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "into",
  "where",
  "what",
  "when",
  "which",
  "will",
  "would",
  "should",
  "could",
  "our",
  "their",
  "about",
  "because",
  "before",
  "after",
  "than",
  "then",
  "today",
  "week"
]);

function uniqueReaderTerms(value: string): Set<string> {
  return new Set(
    cleanText(value)
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^a-z0-9\s-]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !cardStopWords.has(word))
  );
}

function textOverlap(leftValue: string, rightValue: string): number {
  const left = uniqueReaderTerms(leftValue);
  const right = uniqueReaderTerms(rightValue);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const term of left) {
    if (right.has(term)) shared += 1;
  }

  return Math.round((shared / Math.min(left.size, right.size)) * 100) / 100;
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

function workflowAreasFor(resource: Resource): string[] {
  const text = `${resource.title} ${resource.source} ${resource.url} ${resource.summary} ${resource.cleanSummary ?? ""} ${
    resource.directDesignSystemEvidence ?? ""
  }`.toLowerCase();
  const areas: string[] = [];
  const add = (label: string, pattern: RegExp) => {
    if (pattern.test(text) && !areas.includes(label)) areas.push(label);
  };

  add("Figma", /\bfigma\b|dev mode|code connect|variables?/i);
  add("Storybook", /\bstorybook\b|component manifest|docgen/i);
  add("React", /\breact\b/i);
  add("React Native", /react native/i);
  add("Design Tokens", /design tokens?|tokens?|variables?/i);
  add("Documentation", /docs?|documentation|component metadata|metadata/i);
  add("Accessibility", /accessibility|a11y/i);
  add("QA", /\bqa\b|testing|test automation|review/i);
  add("AI Agents", /\bagents?\b|mcp|llm|copilot|ai-assisted|artificial intelligence/i);
  add("Design-to-Code", /design-to-code|code generation|component generation|ui generation/i);
  add("Governance", /governance|ownership|policy|standards/i);

  return areas.slice(0, 4);
}

function fallbackSummaryFor(resource: Resource): string {
  const title = cleanResourceTitle(resource.title) || "This item";
  const source = cleanText(resource.source) || "the source";
  const areas = workflowAreasFor(resource);
  const areaPhrase =
    areas.length > 0
      ? ` Its useful signal is how ${areas.slice(0, 3).join(", ")} now need clearer system context for AI-assisted work.`
      : " Its useful signal is the move from generic AI output toward explicit Design System context.";
  return truncateText(`${title} from ${source} is worth reading for the workflow implication, not the headline alone.${areaPhrase}`, 280);
}

function fallbackWhyItMattersFor(resource: Resource): string {
  const areas = workflowAreasFor(resource);
  if (areas.includes("Storybook")) {
    return "Component metadata is becoming agent input, not just documentation support.";
  }
  if (areas.includes("Figma") || areas.includes("Design-to-Code")) {
    return "Figma metadata now shapes how much review generated UI needs before it can reuse system components.";
  }
  if (areas.includes("Design Tokens")) {
    return "Token intent has to be explicit enough for AI-assisted changes to preserve semantics, not just names.";
  }
  if (areas.includes("Accessibility") || areas.includes("QA")) {
    return "Automated review only earns trust when it maps back to accessibility, QA, and ownership rules.";
  }
  if (areas.includes("Documentation") || areas.includes("AI Agents")) {
    return "Internal agents need trustworthy system context before they can propose or validate changes.";
  }

  return "The practical implication is clearer system context for AI-assisted implementation and review.";
}

function fallbackImpactFor(resource: Resource): string {
  const areas = workflowAreasFor(resource);
  if (areas.length > 0) {
    return `Review how ${areas.slice(0, 3).join(", ")} guidance is exposed to AI-assisted tools.`;
  }

  return "Check whether existing system guidance is explicit enough for AI-assisted delivery.";
}

function fallbackIgnoreRiskFor(resource: Resource): string {
  const areas = workflowAreasFor(resource);
  if (areas.includes("Storybook")) {
    return "Our internal agents may keep relying on static docs instead of component metadata and examples.";
  }
  if (areas.includes("Figma") || areas.includes("Design-to-Code")) {
    return "We may evaluate generated UI without checking whether Figma metadata supports component reuse.";
  }
  if (areas.includes("Accessibility") || areas.includes("QA")) {
    return "Automated review may miss the system-specific rules that determine whether a change is shippable.";
  }

  return "AI-assisted work may keep depending on undocumented assumptions that should be part of the system surface.";
}

function safeReaderCopy(value: string | undefined, fallback: string, maxLength: number): { value: string; regenerated: boolean } {
  const raw = cleanText(value || "");
  const cleaned = safeText(raw);
  const hasBannedTerms = bannedTermsInReaderText(raw).length > 0 || bannedTermsInReaderText(cleaned).length > 0;
  const hasContent = cleaned.length > 0;

  if (!hasContent || hasBannedTerms) {
    return {
      value: truncateText(fallback, maxLength),
      regenerated: true
    };
  }

  return {
    value: truncateText(cleaned, maxLength),
    regenerated: false
  };
}

function preview(value: string): string {
  return truncateText(cleanText(value), 220);
}

function sentenceCase(value: string): string {
  const text = safeText(value);
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
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
    `The useful shift is from AI as a production shortcut to AI as a test of system readiness. Across ${theme || "metadata, documentation quality, review rules, and system context"}, the advantage goes to teams whose component intent is explicit enough for agents and humans to verify the same way.`
  );
}

export function writeEditorsPickSection(resource: Resource | null, context: EditorsPickContext): Resource | null {
  if (!resource) return null;

  const safeResource = sanitizeResource(resource);
  const title = context.sourceMetadata?.title || safeResource.title;
  const source = context.sourceMetadata?.source || safeResource.source;
  const contribution = safeText(context.contribution || safeResource.cleanSummary || safeResource.summary);
  const cleanSummary = contribution
    ? `${title} turns the week’s thesis into an operating question: ${truncateText(contribution, 185)}`
    : `${title} gives the week’s thesis a concrete Design System surface.`;
  const summaryCopy = safeReaderCopy(cleanSummary, fallbackSummaryFor({ ...safeResource, title, source }), 220);
  const whyCopy = safeReaderCopy(
    safeResource.why_it_matters_to_our_team,
    fallbackWhyItMattersFor({ ...safeResource, title, source }),
    180
  );
  const impactCopy = safeReaderCopy(
    `${source} shifts the work from trusting generated output to checking whether metadata, review rules, and reusable context are strong enough to guide it.`,
    fallbackImpactFor({ ...safeResource, title, source }),
    180
  );

  return {
    ...safeResource,
    title,
    source,
    cleanSummary: summaryCopy.value,
    summary: summaryCopy.value,
    why_it_matters_to_our_team: whyCopy.value,
    why_selected: safeText(`${title} is the clearest concrete example of this week’s workflow shift.`),
    expected_impact_on_workflow: impactCopy.value
  };
}

export function writeSupportingSignalsSection(context: SupportingSignalsContext): string[] {
  const contributions = context.contributions.map(safeText).filter(Boolean);
  if (contributions.length === 0) {
    return [
      "The secondary signal is thin today.",
      "The useful pattern remains clearer system context for AI-assisted work."
    ];
  }

  return contributions.slice(0, 3).map((contribution, index) => {
    const prefixes = ["The pattern:", "The second read:", "The operating takeaway:"];
    return safeText(truncateText(`${prefixes[index] ?? "Another angle:"} ${contribution}`, 170));
  });
}

export function writeSuggestedExperimentSection(context: MoveContext): string {
  const surface = safeText(context.targetSurface || "system knowledge");
  const move = safeText(context.opportunityMove || "choose one high-use component and document the assumptions an internal agent should not have to infer");
  const precondition = safeText(context.preconditions[0] || "one high-use component");

  return safeText(
    `Because ${surface} is becoming an AI input, start with ${precondition}. ${sentenceCase(truncateText(move, 145))} Capture one rule an internal agent should not have to infer.`
  );
}

export function writeQuestionsSection(context: ImpactContext): string[] {
  const surface = safeText(context.workflowSurface[0] || "our component workflow");
  return [
    `Which part of ${surface} still depends on interpretation rather than an explicit rule?`,
    "Where would an internal agent make a confident but wrong assumption?",
    "Which governance or accessibility rule should block AI-assisted changes before release?"
  ];
}

export function writeWatchlistSection(context: HorizonContext): string[] {
  const watchlist = context.watchlist.map(safeText).filter(Boolean);
  if (watchlist.length >= 2) {
    return watchlist.slice(0, 3);
  }

  return [
    "Watch for tools that expose component metadata directly to AI agents.",
    "Track design-to-code releases that disclose review quality and component reuse.",
    "Look for QA or accessibility automation tied to ownership, documentation, and delivery workflows."
  ];
}

function sanitizeResource(resource: Resource): Resource {
  const title = cleanResourceTitle(resource.title);
  const summary = safeReaderCopy(resource.cleanSummary || resource.summary, fallbackSummaryFor({ ...resource, title }), 280);
  let whyItMatters = safeReaderCopy(resource.why_it_matters_to_our_team, fallbackWhyItMattersFor({ ...resource, title }), 220);
  const impact = safeReaderCopy(resource.expected_impact_on_workflow, fallbackImpactFor({ ...resource, title }), 180);
  const ignoreRisk = safeReaderCopy(resource.ignore_risk, fallbackIgnoreRiskFor({ ...resource, title }), 180);

  if (textOverlap(summary.value, whyItMatters.value) >= 0.58) {
    whyItMatters = {
      value: fallbackWhyItMattersFor({ ...resource, title }),
      regenerated: true
    };
  }

  const sanitized = {
    ...resource,
    title,
    editorialTitle: undefined,
    cleanSummary: summary.value,
    summary: summary.value,
    why_selected: undefined,
    expected_impact_on_workflow: impact.value,
    why_it_matters_to_our_team: whyItMatters.value,
    ignore_risk: ignoreRisk.value
  };

  return sanitized;
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

function validateResourceCardIntegrity(cards: Resource[], beforeCards: Resource[] = cards): ResourceCardIntegrityDebug {
  const titleCounts = new Map<string, number>();
  for (const card of cards) {
    const key = normalizedTitle(card.title);
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  const duplicateTitles = cards
    .filter((card) => (titleCounts.get(normalizedTitle(card.title)) ?? 0) > 1)
    .map((card) => card.title);

  const sanitizedCards: string[] = [];
  const regeneratedCards: string[] = [];
  const cardResults = cards.map((card) => {
    const before = beforeCards.find((candidate) => candidate.url === card.url);
    const beforeText = [before?.cleanSummary, before?.summary, before?.why_it_matters_to_our_team, before?.expected_impact_on_workflow].join(" ");
    const afterText = [card.cleanSummary, card.summary, card.why_it_matters_to_our_team, card.expected_impact_on_workflow, card.ignore_risk].join(" ");
    const bannedTerms = bannedTermsInReaderText(afterText);
    const summaryTerms = bannedTermsInReaderText(card.cleanSummary || card.summary);
    const whyTerms = bannedTermsInReaderText(card.why_it_matters_to_our_team || "");
    const impactTerms = bannedTermsInReaderText(card.expected_impact_on_workflow || "");
    const overlap = textOverlap(card.cleanSummary || card.summary, card.why_it_matters_to_our_team || "");

    if (cleanText(beforeText) !== cleanText(afterText)) sanitizedCards.push(card.title);
    if (bannedTermsInReaderText(beforeText).length > 0 || overlap >= 0.58) regeneratedCards.push(card.title);

    return {
      title: card.title,
      url: card.url,
      source: card.source,
      summaryPass: summaryTerms.length === 0,
      whyItMattersPass: whyTerms.length === 0 && overlap < 0.58,
      impactPass: impactTerms.length === 0,
      bannedTerms,
      summaryWhyItMattersOverlap: overlap,
      finalReaderFacingPreview: {
        summary: preview(card.cleanSummary || card.summary),
        whyItMatters: preview(card.why_it_matters_to_our_team || ""),
        impact: preview(card.expected_impact_on_workflow || "")
      }
    };
  });
  const failingCards = cardResults.filter(
    (card) => !card.summaryPass || !card.whyItMattersPass || !card.impactPass || card.bannedTerms.length > 0
  );

  return {
    pass: failingCards.length === 0 && duplicateTitles.length === 0,
    checkedCardCount: cards.length,
    failingCards,
    sanitizedCards,
    regeneratedCards,
    bannedTermsByCard: cardResults.map((card) => ({
      title: card.title,
      url: card.url,
      terms: card.bannedTerms
    })),
    duplicateTitleCheck: {
      pass: duplicateTitles.length === 0,
      duplicates: duplicateTitles
    },
    summaryWhyItMattersSimilarity: cardResults.map((card) => ({
      title: card.title,
      url: card.url,
      overlap: card.summaryWhyItMattersOverlap,
      warning: card.summaryWhyItMattersOverlap >= 0.58
    })),
    cards: cardResults
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
  const originalResourceCards = [originalSections.editorsPick, ...originalSections.resources].filter(
    (resource): resource is Resource => Boolean(resource)
  );
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
  const finalResourceCards = [finalDigest.editorsPick, ...finalDigest.resources].filter((resource): resource is Resource => Boolean(resource));
  const resourceCardIntegrity = validateResourceCardIntegrity(finalResourceCards, originalResourceCards);

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
    },
    resourceCardIntegrity
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
    },
    resourceCardIntegrity: {
      pass: true,
      checkedCardCount: 0,
      failingCards: [],
      sanitizedCards: [],
      regeneratedCards: [],
      bannedTermsByCard: [],
      duplicateTitleCheck: {
        pass: true,
        duplicates: []
      },
      summaryWhyItMattersSimilarity: [],
      cards: []
    }
  };
}
