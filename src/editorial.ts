import type { Digest, Resource } from "./emailTemplate.js";
import {
  buildEditorialContexts,
  type EditorsPickContext,
  type EditorialContexts,
  type HorizonContext,
  type ImpactContext,
  type MoveContext,
  type SignalContext,
  type SupportingSignalsContext
} from "./editorialContexts.js";
import { cleanText, truncateText } from "./textUtils.js";

type EditorialFields = Pick<
  Digest,
  | "theSignal"
  | "executiveBrief"
  | "editorsPick"
  | "supportingSignals"
  | "thisWeeksSignals"
  | "suggestedExperiment"
  | "teamDiscussionQuestions"
  | "nextWeekWatchlist"
  | "leadSignal"
>;

type DigestInput = Pick<Digest, "date" | "trend_summary" | "resources"> & Partial<EditorialFields>;

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function limitWords(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value.trim();
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;]$/, "")}.`;
}

function polishSignal(value: string): string {
  return limitWords(
    cleanText(value)
      .replace(/\bAs Principal Design System Lead,?\s*/gi, "")
      .replace(/\bAs a Principal Design System Lead,?\s*/gi, "")
      .replace(/\bI would\s+/gi, "")
      .replace(/\bI’d\s+/gi, ""),
    140
  );
}

const workflowAreas = [
  "Figma",
  "Storybook",
  "React",
  "React Native",
  "Azure DevOps",
  "Governance",
  "Documentation",
  "Accessibility",
  "Internal Design System Agent",
  "Internal QA Agent"
] as const;

function resourceText(resource: Resource): string {
  return cleanText(
    `${resource.title} ${resource.source} ${resource.summary} ${resource.cleanSummary ?? ""} ${
      resource.design_system_angle ?? ""
    } ${resource.directDesignSystemEvidence ?? ""}`
  ).toLowerCase();
}

function affectedWorkflowAreas(resource: Resource): string[] {
  const text = resourceText(resource);
  const areas = new Set<string>();

  if (text.includes("figma") || text.includes("library") || text.includes("component")) areas.add("Figma");
  if (text.includes("storybook")) areas.add("Storybook");
  if (text.includes("react native")) areas.add("React Native");
  if (text.includes("react") || text.includes("component api")) areas.add("React");
  if (text.includes("azure devops") || text.includes("ado") || text.includes("pipeline")) areas.add("Azure DevOps");
  if (text.includes("governance") || text.includes("guardrail") || text.includes("standard")) areas.add("Governance");
  if (text.includes("doc") || text.includes("documentation") || text.includes("mcp")) areas.add("Documentation");
  if (text.includes("accessibility") || text.includes("a11y")) areas.add("Accessibility");
  if (text.includes("qa") || text.includes("test") || text.includes("regression")) areas.add("Internal QA Agent");
  if (text.includes("ai") || text.includes("agent") || text.includes("mcp") || text.includes("llm")) {
    areas.add("Internal Design System Agent");
  }

  if (areas.size === 0) {
    areas.add("Documentation");
    areas.add("Internal Design System Agent");
  }

  return workflowAreas.filter((area) => areas.has(area));
}

function impactScore(resource: Resource, areas: string[]): number {
  const score = Math.round(((resource.relevance_score ?? 4) + (resource.worth_your_time_score ?? 4)) / 2);
  return Math.max(1, Math.min(5, Math.max(score, areas.length >= 4 ? 5 : areas.length >= 3 ? 4 : score)));
}

function audienceFor(resource: Resource, areas: string[]): string {
  const readers = new Set<string>();
  if (areas.includes("Figma")) readers.add("Designer");
  if (areas.includes("Storybook") || areas.includes("React") || areas.includes("React Native")) readers.add("Frontend DS Engineer");
  if (areas.includes("Internal Design System Agent") || areas.includes("Internal QA Agent") || resourceText(resource).includes("mcp")) {
    readers.add("AI Engineer");
  }
  if (areas.includes("Documentation") || areas.includes("Governance") || areas.includes("Azure DevOps")) readers.add("DesignOps");
  return Array.from(readers).join(" / ") || "Designer / Frontend DS Engineer";
}

function readingTime(resource: Resource): string {
  const text = cleanText(`${resource.summary} ${resource.cleanSummary ?? ""} ${resource.directDesignSystemEvidence ?? ""}`);
  const minutes = Math.max(3, Math.min(12, Math.ceil(wordCount(text) / 120) + 3));
  return `${minutes} min`;
}

function workflowPhrase(areas: string[]): string {
  if (areas.length <= 1) return areas[0] ?? "Design System documentation";
  if (areas.length === 2) return `${areas[0]} and ${areas[1]}`;
  return `${areas.slice(0, -1).join(", ")}, and ${areas[areas.length - 1]}`;
}

function whyItMatters(resource: Resource, areas: string[], index: number): string {
  const evidence = truncateText(
    resource.directDesignSystemEvidence || resource.design_system_angle || resource.cleanSummary || resource.summary,
    120
  );
  const areaPhrase = workflowPhrase(areas);
  const patterns = [
    `Use this to decide where ${areaPhrase} need clearer machine-readable guidance; the useful signal is ${evidence}`,
    `This can sharpen how ${areaPhrase} are documented and reviewed before an internal agent suggests component changes; the direct clue is ${evidence}`,
    `The practical value is in translating ${areaPhrase} into repeatable system rules rather than one-off AI assistance; the evidence is ${evidence}`,
    `This should influence how we expose ${areaPhrase} to designers, engineers, and agents so AI output stays inside system constraints; the signal is ${evidence}`,
    `This gives the team a concrete lens for improving ${areaPhrase} without weakening governance or accessibility review; the strongest evidence is ${evidence}`
  ];
  return truncateText(patterns[index % patterns.length], 220);
}

function ignoreRisk(resource: Resource, areas: string[]): string {
  const text = resourceText(resource);

  if (text.includes("storybook") && (text.includes("mcp") || text.includes("agent"))) {
    return "Our Design System Agent may continue relying on static documentation instead of reading component metadata, examples, and states directly.";
  }

  if (text.includes("design-to-code") || text.includes("design to code") || text.includes("code generation")) {
    return "We may evaluate design-to-code output without understanding how Figma metadata, component structure, and token semantics affect quality.";
  }

  if (text.includes("token")) {
    return "AI-generated interfaces may keep using tokens by name only, without understanding semantic intent, theming rules, or governance constraints.";
  }

  if (text.includes("figma") && (text.includes("mcp") || text.includes("agent") || text.includes("library"))) {
    return "Our Figma libraries may remain useful to humans but under-specified for agents that need component intent, variants, and constraints.";
  }

  if (text.includes("accessibility") || text.includes("qa") || text.includes("test")) {
    return "AI-assisted component changes may pass visual review while missing accessibility, regression, or QA rules that should be system-owned.";
  }

  if (text.includes("documentation") || text.includes("docs") || text.includes("machine-readable")) {
    return "Our documentation may stay readable for people but too ambiguous for agents to retrieve, compare, and apply safely.";
  }

  return truncateText(
    `We may miss a chance to turn ${workflowPhrase(areas)} into explicit system rules that agents and reviewers can apply consistently.`,
    180
  );
}

function selectedReason(resource: Resource, areas: string[]): string {
  return truncateText(
    `Selected because it connects ${workflowPhrase(areas)} to a reusable Design System workflow, not just a generic AI update.`,
    160
  );
}

function expectedImpact(resource: Resource, areas: string[]): string {
  return truncateText(
    `Expected to improve how the team structures ${workflowPhrase(
      areas
    )} so designers, engineers, and internal agents can act from the same source of truth.`,
    180
  );
}

function enrichResources(resources: Resource[]): Resource[] {
  return resources.map((resource, index) => {
    const areas = resource.affected_workflow_areas?.length ? resource.affected_workflow_areas : affectedWorkflowAreas(resource);

    return {
      ...resource,
      cleanSummary: truncateText(resource.cleanSummary ?? resource.summary, 280),
      why_it_matters_to_our_team: whyItMatters(resource, areas, index),
      why_selected: resource.why_selected ?? selectedReason(resource, areas),
      expected_impact_on_workflow: resource.expected_impact_on_workflow ?? expectedImpact(resource, areas),
      who_should_read: resource.who_should_read ?? audienceFor(resource, areas),
      estimated_reading_time: resource.estimated_reading_time ?? readingTime(resource),
      ignore_risk: resource.ignore_risk ?? ignoreRisk(resource, areas),
      impact_score: resource.impact_score ?? impactScore(resource, areas),
      affected_workflow_areas: areas
    };
  });
}

function applyEditorsPickContext(resource: Resource | null, context: EditorsPickContext): Resource | null {
  if (!resource) return null;

  const contribution = context.contribution || resource.cleanSummary || resource.summary;
  const source = context.sourceMetadata?.source ?? resource.source;

  return {
    ...resource,
    cleanSummary: truncateText(contribution, 280),
    summary: truncateText(contribution, 280),
    why_selected: truncateText(`Selected as lead evidence for this thesis: ${context.claim}`, 160),
    expected_impact_on_workflow: truncateText(
      `Expected to help the team inspect ${source} as evidence for an AI-enabled Design System workflow change.`,
      180
    )
  };
}

export function selectEditorsPick(resources: Resource[]): Resource | null {
  if (resources.length === 0) return null;

  return [...resources].sort((a, b) => {
    const worthDifference = (b.worth_your_time_score ?? 0) - (a.worth_your_time_score ?? 0);
    if (worthDifference !== 0) return worthDifference;

    const relevanceDifference = (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
    if (relevanceDifference !== 0) return relevanceDifference;

    return a.title.localeCompare(b.title);
  })[0];
}

function buildSignal(context: SignalContext): string {
  if (!context.claim || context.claim === "No strong DS x AI signal cleared the bar today.") {
    return "No strong signal cleared the bar today. The sources leaned either generic, introductory, or disconnected from mature Design System work. That is worth saying plainly: weak AI content creates false urgency, especially when it never touches Figma libraries, Storybook evidence, React implementation, governance, documentation, accessibility, or agent-readable QA. The useful move is to protect attention and inspect our own readiness. Pick one high-traffic component and ask whether an internal Design System Agent could understand its variants, token intent, accessibility states, Storybook examples, Azure DevOps links, and review rules without asking a human to interpret the gaps.";
  }

  const themePhrase = context.themeAnchor || "Documentation + Internal Design System Agent";
  const claim = truncateText(context.claim, 90);
  const whyNow = truncateText(context.whyNow, 170);
  const brief = `The useful signal is not that AI can produce more interface work; it is that mature systems now need sharper evidence. This week's strongest thread sits across ${themePhrase}: the places where component intent, implementation rules, and review criteria either become machine-readable or remain tribal knowledge. "${claim}" is the lead thesis because it points to workflow impact, not novelty theatre. ${whyNow} Speed matters less than whether generated work can be reviewed against the same system rules the team already owns.`;

  return polishSignal(brief);
}

function buildSupportingSignals(context: SupportingSignalsContext): string[] {
  if (context.representativeSupportingEvidence.length === 0) {
    return [
      "Most available items were too broad for a mature Design System team.",
      "The practical gap is still internal: component knowledge needs to be readable by people and agents.",
      "Attention should stay on evidence, not AI commentary."
    ];
  }

  const supportingText = `${context.contributions.join(" ")} ${context.representativeSupportingEvidence
    .map((evidence) => `${evidence.title} ${evidence.source}`)
    .join(" ")}`.toLowerCase();
  const signals = [
    supportingText.includes("agent") || supportingText.includes("mcp") || supportingText.includes("ai")
      ? "Agent-readable component knowledge is becoming part of the Design System surface."
      : "The useful AI work is narrowing toward operational workflow changes, not broad productivity claims.",
    supportingText.includes("figma") || supportingText.includes("react") || supportingText.includes("design-to-code")
      ? "Figma intent and React implementation need a tighter handshake before generation can be trusted."
      : "The strongest signals make system decisions easier to verify across design and engineering.",
    supportingText.includes("qa") || supportingText.includes("accessibility") || supportingText.includes("storybook")
      ? "Storybook, accessibility, and QA evidence are becoming the guardrails for assisted delivery."
      : "Documentation is becoming an automation input, not a cleanup task."
  ];

  return signals.slice(0, 3);
}

function buildSuggestedExperiment(context: MoveContext): string {
  if (!context.opportunityMove) {
    return "In 30 minutes, audit one high-use component and add a checklist of what an internal Design System Agent and Internal QA Agent would need: Figma variant intent, Storybook examples, React/React Native props, accessibility states, Azure DevOps link, and governance rule.";
  }

  return `In 30 minutes, use this move on ${context.targetSurface}: ${truncateText(
    context.opportunityMove,
    150
  )} Start with ${context.preconditions[0] ?? "one high-use component"} and capture one gap an internal agent should not have to infer.`;
}

function buildTeamQuestions(context: ImpactContext): string[] {
  if (!context.claim) {
    return [
      "Which Figma library component would expose the biggest gap if an internal Design System Agent tried to explain it today?",
      "Where do Storybook, React or React Native, Azure DevOps, and documentation disagree about ownership or expected behavior?",
      "Which governance or accessibility rule should the Internal QA Agent check before any AI-assisted component change moves forward?"
    ];
  }

  const surfaces = workflowPhrase(context.workflowSurface.length ? context.workflowSurface.slice(0, 3) : ["Figma", "Storybook"]);

  return [
    `What would need to change in ${surfaces} for this signal to become usable in our workflow?`,
    "What documentation or Azure DevOps metadata would our internal Design System Agent need before it could act safely?",
    `Which governance, accessibility, or Internal QA Agent check would reduce this cost of inaction: ${truncateText(
      context.costOfInaction,
      120
    )}`
  ];
}

function buildNextWeekWatchlist(context: HorizonContext): string[] {
  return context.watchlist.length
    ? context.watchlist.slice(0, 3)
    : [
        "Look for practical examples of agents reading Storybook or Figma metadata, not generic AI commentary.",
        "Watch for design-to-code work that explains review quality, accessibility, and component reuse.",
        "Track whether tooling connects outputs back to governance, Azure DevOps, and documentation."
      ];
}

export function withEditorialSections(digest: DigestInput, editorialContexts?: EditorialContexts): Digest {
  const resources = enrichResources(digest.resources);
  const provisionalEditorsPick = digest.editorsPick
    ? enrichResources([digest.editorsPick])[0]
    : selectEditorsPick(resources);
  const contexts =
    editorialContexts ??
    buildEditorialContexts({
      leadSignal: digest.leadSignal,
      editorsPick: provisionalEditorsPick,
      resources
    });
  const editorsPick = applyEditorsPickContext(provisionalEditorsPick, contexts.editorsPickContext);
  const theSignal = polishSignal(digest.theSignal ?? digest.executiveBrief ?? buildSignal(contexts.signalContext));
  const supportingSignals = digest.supportingSignals ?? digest.thisWeeksSignals ?? buildSupportingSignals(contexts.supportingSignalsContext);

  return {
    date: digest.date,
    trend_summary: digest.trend_summary,
    theSignal,
    executiveBrief: digest.executiveBrief ?? theSignal,
    editorsPick,
    supportingSignals,
    thisWeeksSignals: supportingSignals,
    suggestedExperiment: digest.suggestedExperiment ?? buildSuggestedExperiment(contexts.moveContext),
    teamDiscussionQuestions: digest.teamDiscussionQuestions ?? buildTeamQuestions(contexts.impactContext),
    nextWeekWatchlist: digest.nextWeekWatchlist ?? buildNextWeekWatchlist(contexts.horizonContext),
    ...(digest.leadSignal !== undefined ? { leadSignal: digest.leadSignal } : {}),
    resources
  };
}

export function hasEditorialSections(digest: Digest): boolean {
  return Boolean(
    digest.theSignal &&
      digest.executiveBrief &&
      Array.isArray(digest.supportingSignals) &&
      digest.supportingSignals.length === 3 &&
      digest.suggestedExperiment &&
      Array.isArray(digest.teamDiscussionQuestions) &&
      digest.teamDiscussionQuestions.length >= 2 &&
      Array.isArray(digest.nextWeekWatchlist) &&
      digest.nextWeekWatchlist.length >= 2 &&
      "editorsPick" in digest
  );
}
