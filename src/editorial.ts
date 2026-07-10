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
import type { EditorialBrief } from "./editorialBrief.js";
import type { NarrativeExtraction } from "./narrativeExtraction.js";
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

function withoutTerminalPunctuation(value: string): string {
  return cleanText(value).replace(/[.!?]+$/g, "");
}

// Removes a leading occurrence of `clause` from `value` (case-insensitive,
// ignoring trailing punctuation on the clause). Used when a composite field
// such as editorialPosition — built as `${newReality} ${readerTakeaway}` — is
// appended after the same newReality has already been emitted, which otherwise
// prints the clause verbatim twice and inflates the sentence count.
function withoutLeadingClause(value: string, clause: string): string {
  const text = cleanText(value);
  const lead = withoutTerminalPunctuation(clause).trim();
  if (!lead) return text;
  if (text.toLowerCase().startsWith(lead.toLowerCase())) {
    return text.slice(lead.length).replace(/^[\s.;:,–—-]+/, "").trim();
  }
  return text;
}

function publicationSafeText(value: string): string {
  return cleanText(value)
    .replace(/\bselected\b/gi, "chosen")
    .replace(/\bcandidates?\b/gi, "items")
    .replace(/\bquality-adjusted score\b/gi, "quality read")
    .replace(/\bworkflow score\b/gi, "workflow read")
    .replace(/\beditorial score\b/gi, "editorial read")
    .replace(/\bevidence items?\b/gi, "signals")
    .replace(/\blead evidence\b/gi, "clearest example")
    .replace(/\bsupporting evidence\b/gi, "related signals")
    .replace(/\bevidence\b/gi, "signal")
    .replace(/\bresources?\b/gi, "items")
    .replace(/\branked?\b/gi, "prioritized")
    .replace(/\branking\b/gi, "prioritization")
    .replace(/\bscored?\b/gi, "rated")
    .replace(/\bclusters?\b/gi, "patterns")
    .replace(/\bpipeline\b/gi, "workflow")
    .replace(/\bformation\b/gi, "shape")
    .replace(/\bactionability\b/gi, "practicality")
    .replace(/\bdebug\b/gi, "review")
    .replace(/\bprompt\b/gi, "brief")
    .replace(/\bLLM reasoning\b/gi, "model output");
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
  const clean = areas.map(cleanText).filter(Boolean);
  if (clean.length === 0) return "Design System documentation";
  if (clean.length === 1) return clean[0];
  // Never enumerate the enum. Reader copy names at most two surfaces so it reads
  // like an editor wrote it, not like a machine dumped affected_workflow_areas
  // ("Storybook, Documentation, React, React Native, and Metadata").
  return `${clean[0]} and ${clean[1]}`;
}

function uniqueOrdered(values: string[]): string[] {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function deliberationAreas(contexts: EditorialContexts, resources: Resource[]): string[] {
  const areas = uniqueOrdered([
    ...contexts.impactContext.workflowSurface,
    ...resources.flatMap((resource) => resource.affected_workflow_areas ?? affectedWorkflowAreas(resource))
  ]);

  return areas.length ? areas.slice(0, 4) : ["Documentation", "Internal Design System Agent"];
}

function hasText(value: string, pattern: RegExp): boolean {
  return pattern.test(value.toLowerCase());
}

function buildEditorialDeliberation(contexts: EditorialContexts, resources: Resource[], editorsPick: Resource | null) {
  const areas = deliberationAreas(contexts, resources);
  const resourceBody = resources.map(resourceText).join(" ");
  const supportingContributions = contexts.supportingSignalsContext.contributions.map(publicationSafeText).filter(Boolean);
  const theme = contexts.signalContext.themeAnchor || workflowPhrase(areas.slice(0, 3));
  const actualChange = hasText(resourceBody, /agent|mcp|machine-readable|metadata|docgen|manifest/)
    ? `${theme} is moving from human-readable reference material to operational context for AI-assisted work`
    : `${theme} is becoming the place where AI-assisted work is either constrained by system rules or left to guess`;
  const whyNow = publicationSafeText(
    truncateText(
      contexts.signalContext.whyNow ||
        "the week’s strongest sources point to practical workflow pressure rather than broad AI novelty",
      170
    )
  );
  const leadTitle = cleanText(editorsPick?.editorialTitle || editorsPick?.title || contexts.editorsPickContext.sourceMetadata?.title || "");
  const leadReason = leadTitle
    ? `${leadTitle} makes the shift concrete because it shows where the abstract trend touches an owned workflow.`
    : "The lead item makes the shift concrete because it connects the abstract trend to an owned workflow.";
  const materialContributions = supportingContributions.filter((contribution) =>
    areas.some((area) => contribution.toLowerCase().includes(area.toLowerCase().split(" ")[0]))
  );
  const interestingButNonMaterial = supportingContributions.find((contribution) => !materialContributions.includes(contribution)) || "";
  const teamChange = `Mature teams need ${workflowPhrase(areas.slice(0, 3))} to carry enough intent for designers, engineers, and agents to reach the same decision.`;

  return {
    actualChange,
    whyNow,
    leadReason,
    interestingButNonMaterial,
    teamChange,
    areas
  };
}

function whyItMatters(resource: Resource, areas: string[], index: number, contractMode: boolean): string {
  const signal = truncateText(
    resource.directDesignSystemEvidence || resource.design_system_angle || resource.cleanSummary || resource.summary,
    120
  );
  const areaPhrase = workflowPhrase(areas);
  if (!contractMode) {
    const legacyPatterns = [
      `Use this to decide where ${areaPhrase} need clearer machine-readable guidance; the useful signal is ${signal}`,
      `This can sharpen how ${areaPhrase} are documented and reviewed before an internal agent suggests component changes; the direct clue is ${signal}`,
      `The practical value is in translating ${areaPhrase} into repeatable system rules rather than one-off AI assistance; the evidence is ${signal}`,
      `This should influence how we expose ${areaPhrase} to designers, engineers, and agents so AI output stays inside system constraints; the signal is ${signal}`,
      `This gives the team a concrete lens for improving ${areaPhrase} without weakening governance or accessibility review; the strongest evidence is ${signal}`
    ];
    return truncateText(legacyPatterns[index % legacyPatterns.length], 220);
  }

  const patterns = [
    `Use this to find where ${areaPhrase} need clearer machine-readable guidance before AI assistance becomes dependable; the useful clue is ${signal}`,
    `The important change is how ${areaPhrase} are documented and reviewed before an internal agent suggests component changes; the direct clue is ${signal}`,
    `The practical value is in turning ${areaPhrase} into repeatable system rules rather than one-off AI assistance; the clue is ${signal}`,
    `This should change how ${areaPhrase} are exposed to designers, engineers, and agents so AI output stays inside system constraints; the signal is ${signal}`,
    `This gives the team a sharper lens for improving ${areaPhrase} without weakening governance or accessibility review; the strongest clue is ${signal}`
  ];
  return publicationSafeText(truncateText(patterns[index % patterns.length], 220));
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
  return publicationSafeText(
    truncateText(`Worth attention because it connects ${workflowPhrase(areas)} to a reusable Design System workflow, not just a generic AI update.`, 160)
  );
}

function legacySelectedReason(resource: Resource, areas: string[]): string {
  return truncateText(
    `Selected because it connects ${workflowPhrase(areas)} to a reusable Design System workflow, not just a generic AI update.`,
    160
  );
}

function expectedImpact(
  resource: Resource,
  areas: string[],
  deliberation?: ReturnType<typeof buildEditorialDeliberation>,
  narrative?: NarrativeExtraction,
  brief?: EditorialBrief
): string {
  return truncateText(
    brief?.consequences.immediate ||
      narrative?.implicationForDesignSystemTeams ||
      deliberation?.teamChange ||
      `Use it to improve how the team structures ${workflowPhrase(
        areas
      )} so designers, engineers, and internal agents can make the same system decision from the same context.`,
    180
  );
}

function enrichResources(
  resources: Resource[],
  contractMode = false,
  deliberation?: ReturnType<typeof buildEditorialDeliberation>,
  narrative?: NarrativeExtraction,
  brief?: EditorialBrief
): Resource[] {
  return resources.map((resource, index) => {
    const areas = resource.affected_workflow_areas?.length ? resource.affected_workflow_areas : affectedWorkflowAreas(resource);
    const evidenceMapping = brief?.evidenceMapping.find((mapping) => mapping.url === resource.url);
    const briefSummary = evidenceMapping?.supportsBrief;

    return {
      ...resource,
      cleanSummary: contractMode
        ? publicationSafeText(truncateText(briefSummary || resource.cleanSummary || resource.summary, 280))
        : truncateText(resource.cleanSummary ?? resource.summary, 280),
      summary: contractMode ? publicationSafeText(truncateText(briefSummary || resource.summary, 280)) : truncateText(resource.summary, 280),
      why_it_matters_to_our_team: evidenceMapping
        ? publicationSafeText(truncateText(`${evidenceMapping.evidentialRole}. ${brief?.consequences.immediate}`, 220))
        : whyItMatters(resource, areas, index, contractMode),
      why_selected: resource.why_selected ?? (contractMode ? selectedReason(resource, areas) : legacySelectedReason(resource, areas)),
      expected_impact_on_workflow: resource.expected_impact_on_workflow ?? expectedImpact(resource, areas, deliberation, narrative, brief),
      who_should_read: resource.who_should_read ?? audienceFor(resource, areas),
      estimated_reading_time: resource.estimated_reading_time ?? readingTime(resource),
      ignore_risk: resource.ignore_risk ?? ignoreRisk(resource, areas),
      impact_score: resource.impact_score ?? impactScore(resource, areas),
      affected_workflow_areas: areas
    };
  });
}

function applyEditorsPickContext(
  resource: Resource | null,
  context: EditorsPickContext,
  contractMode: boolean,
  deliberation?: ReturnType<typeof buildEditorialDeliberation>,
  narrative?: NarrativeExtraction,
  brief?: EditorialBrief
): Resource | null {
  if (!resource) return null;

  const contribution = context.contribution || resource.cleanSummary || resource.summary;
  const source = context.sourceMetadata?.source ?? resource.source;

  if (!contractMode) {
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

  return {
    ...resource,
    cleanSummary: publicationSafeText(truncateText(brief?.leadEvidence || contribution, 280)),
    summary: publicationSafeText(truncateText(brief?.leadEvidence || contribution, 280)),
    why_selected: publicationSafeText(
      truncateText(
        brief?.leadEvidence
          ? `${resource.title} makes the thesis concrete: ${brief.leadEvidence}`
          : narrative?.leadProof
          ? `${resource.title} makes the shift tangible: ${narrative.leadProof}`
          : deliberation?.leadReason || `This is the clearest concrete example of the shift: ${context.claim}`,
        160
      )
    ),
    expected_impact_on_workflow: publicationSafeText(
      truncateText(
        brief?.consequences.immediate ||
          narrative?.implicationForDesignSystemTeams ||
          deliberation?.teamChange ||
          `Useful because ${source} shows how an AI-enabled Design System workflow becomes concrete.`,
        180
      )
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

function buildSignal(
  context: SignalContext,
  contractMode: boolean,
  deliberation?: ReturnType<typeof buildEditorialDeliberation>,
  narrative?: NarrativeExtraction,
  brief?: EditorialBrief
): string {
  if (!context.claim || context.claim === "No strong DS x AI signal cleared the bar today.") {
    return contractMode
      ? "No strong shift cleared the bar today. The useful takeaway is restraint: weak AI commentary creates false urgency when it never touches Figma libraries, Storybook metadata, React implementation, governance, documentation, accessibility, or agent-readable QA."
      : "No strong signal cleared the bar today. The sources leaned either generic, introductory, or disconnected from mature Design System work. That is worth saying plainly: weak AI content creates false urgency, especially when it never touches Figma libraries, Storybook evidence, React implementation, governance, documentation, accessibility, or agent-readable QA. The useful move is to protect attention and inspect our own readiness. Pick one high-traffic component and ask whether an internal Design System Agent could understand its variants, token intent, accessibility states, Storybook examples, Azure DevOps links, and review rules without asking a human to interpret the gaps.";
  }

  const themePhrase = context.themeAnchor || "Documentation + Internal Design System Agent";
  if (!contractMode) {
    const claim = truncateText(context.claim, 90);
    const whyNow = truncateText(context.whyNow, 170);
    const signalCopy = `The useful signal is not that AI can produce more interface work; it is that mature systems now need sharper evidence. This week's strongest thread sits across ${themePhrase}: the places where component intent, implementation rules, and review criteria either become machine-readable or remain tribal knowledge. "${claim}" is the lead thesis because it points to workflow impact, not novelty theatre. ${whyNow} Speed matters less than whether generated work can be reviewed against the same system rules the team already owns.`;
    return polishSignal(signalCopy);
  }

  if (contractMode && brief?.thesis) {
    const oldAssumption = withoutTerminalPunctuation(brief.oldAssumption);
    const newReality = withoutTerminalPunctuation(brief.newReality);
    // editorialPosition is `${newReality} ${readerTakeaway}`; strip the leading
    // newReality so it is not printed twice (once here, once as the position).
    const position = withoutTerminalPunctuation(withoutLeadingClause(brief.editorialPosition, brief.newReality));
    const positionSentence = position ? ` ${position.charAt(0).toUpperCase()}${position.slice(1)}.` : "";
    return polishSignal(
      publicationSafeText(
        `The shift is not that ${oldAssumption.charAt(0).toLowerCase()}${oldAssumption.slice(1)}; it is that ${newReality
          .charAt(0)
          .toLowerCase()}${newReality.slice(1)}.${positionSentence}`
      )
    );
  }

  if (contractMode && narrative?.narrativeThesis) {
    const oldAssumption = withoutTerminalPunctuation(narrative.oldAssumption);
    const newReality = withoutTerminalPunctuation(narrative.newReality);
    const readerTakeaway = withoutTerminalPunctuation(withoutLeadingClause(narrative.readerTakeaway, narrative.newReality));
    const takeawaySentence = readerTakeaway ? ` ${readerTakeaway.charAt(0).toUpperCase()}${readerTakeaway.slice(1)}.` : "";
    return polishSignal(
      publicationSafeText(
        `The shift is not that ${oldAssumption.charAt(0).toLowerCase()}${oldAssumption.slice(1)}; it is that ${newReality
          .charAt(0)
          .toLowerCase()}${newReality.slice(1)}.${takeawaySentence}`
      )
    );
  }

  const whyNow = publicationSafeText(truncateText(context.whyNow, 170));
  const change = deliberation?.actualChange || `AI-assisted Design System work is becoming constrained less by generation quality than by the structured knowledge it can safely consume across ${themePhrase}`;
  const timing = deliberation?.whyNow || whyNow;
  const signalCopy = `This week’s strongest shift is that ${change}. The timing matters because ${timing}; teams that make component intent explicit will review AI output faster and with fewer governance gaps.`;

  return polishSignal(signalCopy);
}

function buildSupportingSignals(
  context: SupportingSignalsContext,
  contractMode: boolean,
  deliberation?: ReturnType<typeof buildEditorialDeliberation>,
  narrative?: NarrativeExtraction,
  brief?: EditorialBrief
): string[] {
  if (contractMode && brief?.supportingEvidence.length) {
    const support = brief.supportingEvidence.slice(0, 3);
    // No "Proof:" / "Consequence:" role labels — the reader gets the observation,
    // not the editorial scaffolding used to assemble it.
    return [
      support[0] || brief.leadEvidence,
      support[1] || brief.consequences.immediate,
      support[2] || brief.consequences.mediumTerm
    ].map((item) => publicationSafeText(truncateText(item, 170)));
  }

  if (contractMode && narrative?.supportingObservations.length) {
    const observations = narrative.supportingObservations.slice(0, 3);
    return [
      observations[0] || narrative.leadProof,
      observations[1] || narrative.implicationForDesignSystemTeams,
      observations[2] || narrative.readerTakeaway
    ].map((item) => publicationSafeText(truncateText(item, 170)));
  }

  if (context.representativeSupportingEvidence.length === 0) {
    return [
      "Most available items were too broad for a mature Design System team.",
      "The practical gap is still internal: component knowledge needs to be readable by people and agents.",
      contractMode ? "Attention should stay on practical signals, not AI commentary." : "Attention should stay on evidence, not AI commentary."
    ];
  }

  const supportingText = `${context.contributions.join(" ")} ${context.representativeSupportingEvidence
    .map((evidence) => `${evidence.title} ${evidence.source}`)
    .join(" ")}`.toLowerCase();
  const signals = [
    supportingText.includes("agent") || supportingText.includes("mcp") || supportingText.includes("ai")
      ? "The pattern is clear: agent-readable component knowledge is becoming part of the Design System surface."
      : "The useful AI work is narrowing toward operational workflow change, not broad productivity claims.",
    supportingText.includes("figma") || supportingText.includes("react") || supportingText.includes("design-to-code")
      ? "The fragile link is still the handoff: Figma intent and React implementation need tighter shared context before generation can be trusted."
      : "The strongest signals make system decisions easier to verify across design and engineering.",
    supportingText.includes("qa") || supportingText.includes("accessibility") || supportingText.includes("storybook")
      ? "The control point is shifting toward Storybook, accessibility, and QA signals that can block weak assisted delivery."
      : "Documentation is becoming an automation input, not a cleanup task."
  ];

  if (deliberation?.interestingButNonMaterial) {
    signals[1] = truncateText(
      `The useful distinction is what changes the thesis versus what merely adds color: ${deliberation.interestingButNonMaterial}`,
      170
    );
  }

  return signals.map(publicationSafeText).slice(0, 3);
}

function buildSuggestedExperiment(
  context: MoveContext,
  contractMode: boolean,
  deliberation?: ReturnType<typeof buildEditorialDeliberation>,
  narrative?: NarrativeExtraction,
  brief?: EditorialBrief
): string {
  if (!context.opportunityMove) {
    return "In 30 minutes, audit one high-use component and add a checklist of what an internal Design System Agent and Internal QA Agent would need: Figma variant intent, Storybook examples, React/React Native props, accessibility states, Azure DevOps link, and governance rule.";
  }

  const experiment = contractMode
    ? brief?.experiment ||
      `Because ${workflowPhrase(deliberation?.areas?.slice(0, 2) ?? [context.targetSurface])} now depends on clearer system assumptions, ${truncateText(
        context.opportunityMove,
        120
      )} Start with ${context.preconditions[0] ?? "one high-use component"} and ${truncateText(
        narrative?.readerTakeaway || "capture one gap an internal agent should not have to infer",
        95
      )}.`
    : `In 30 minutes, use this move on ${context.targetSurface}: ${truncateText(
        context.opportunityMove,
        150
      )} Start with ${context.preconditions[0] ?? "one high-use component"} and capture one gap an internal agent should not have to infer.`;
  return contractMode ? publicationSafeText(experiment) : experiment;
}

function buildTeamQuestions(context: ImpactContext, contractMode: boolean, narrative?: NarrativeExtraction, brief?: EditorialBrief): string[] {
  if (!context.claim) {
    return [
      "Which Figma library component would expose the biggest gap if an internal Design System Agent tried to explain it today?",
      "Where do Storybook, React or React Native, Azure DevOps, and documentation disagree about ownership or expected behavior?",
      "Which governance or accessibility rule should the Internal QA Agent check before any AI-assisted component change moves forward?"
    ];
  }

  const surfaces = workflowPhrase(context.workflowSurface.length ? context.workflowSurface.slice(0, 3) : ["Figma", "Storybook"]);

  return contractMode
    ? [
    narrative?.oldAssumption && narrative?.newReality
      ? `Where are we still operating as if ${narrative.oldAssumption.charAt(0).toLowerCase()}${narrative.oldAssumption.slice(1).replace(/[.]+$/, "")}?`
      : `What would need to change in ${surfaces} for this signal to become usable in our workflow?`,
    "What documentation or Azure DevOps metadata would our internal Design System Agent need before it could act safely?",
    `Which governance, accessibility, or Internal QA Agent check would reduce this cost of inaction: ${truncateText(
      narrative?.implicationForDesignSystemTeams || context.costOfInaction,
      120
    ).replace(/[.]+$/, "")}?`
      ]
    : [
        "What would need to change in Figma, Storybook, React, or React Native for this signal to become usable in our workflow?",
        "What documentation or Azure DevOps metadata would our internal Design System Agent need before it could act safely?",
        "Which governance, accessibility, or Internal QA Agent check should stay visible before AI-assisted changes ship?"
      ];
}

function buildNextWeekWatchlist(context: HorizonContext, contractMode: boolean, narrative?: NarrativeExtraction, brief?: EditorialBrief): string[] {
  if (!contractMode) {
    return [
      "Watch whether Storybook AI/MCP work moves from release notes into repeatable component review workflows.",
      "Track whether Figma-related AI work explains metadata quality, variant intent, and design-to-code review.",
      "Look for governance patterns that tie AI-assisted changes back to documentation and ownership."
    ];
  }

  if (narrative?.newReality) {
    return [
      `Watch for examples that confirm whether ${truncateText(narrative.newReality.charAt(0).toLowerCase() + narrative.newReality.slice(1), 110)}`,
      "Track whether tooling connects generated output back to component intent, documentation, QA, and governance.",
      "Look for teams publishing concrete review rules instead of broad AI productivity claims."
    ];
  }

  return context.watchlist.length
    ? context.watchlist.slice(0, 3)
    : [
        "Look for practical examples of agents reading Storybook or Figma metadata, not generic AI commentary.",
        "Watch for design-to-code work that explains review quality, accessibility, and component reuse.",
        "Track whether tooling connects outputs back to governance, Azure DevOps, and documentation."
      ];
}

export function withEditorialSections(
  digest: DigestInput,
  editorialContexts?: EditorialContexts,
  narrative?: NarrativeExtraction,
  brief?: EditorialBrief
): Digest {
  const contractMode = Boolean(editorialContexts);
  const resources = enrichResources(digest.resources, contractMode);
  // Explicit null means the caller decided no artifact qualifies as the lead
  // reading, so Editor's Pick is omitted. Only undefined triggers auto-selection.
  const provisionalEditorsPick =
    digest.editorsPick === null
      ? null
      : digest.editorsPick
        ? enrichResources([digest.editorsPick], contractMode)[0]
        : selectEditorsPick(resources);
  const contexts =
    editorialContexts ??
    buildEditorialContexts({
      leadSignal: digest.leadSignal,
      editorsPick: provisionalEditorsPick,
      resources
    });
  const deliberation = buildEditorialDeliberation(contexts, resources, provisionalEditorsPick);
  const deliberatedResources = enrichResources(resources, contractMode, deliberation, narrative, brief);
  const deliberatedEditorsPick = applyEditorsPickContext(provisionalEditorsPick, contexts.editorsPickContext, contractMode, deliberation, narrative, brief);
  const theSignal = polishSignal(digest.theSignal ?? digest.executiveBrief ?? buildSignal(contexts.signalContext, contractMode, deliberation, narrative, brief));
  const supportingSignals =
    digest.supportingSignals ??
    digest.thisWeeksSignals ??
    buildSupportingSignals(contexts.supportingSignalsContext, contractMode, deliberation, narrative, brief);

  return {
    date: digest.date,
    trend_summary: digest.trend_summary,
    theSignal,
    executiveBrief: digest.executiveBrief ?? theSignal,
    editorsPick: deliberatedEditorsPick,
    supportingSignals,
    thisWeeksSignals: supportingSignals,
    suggestedExperiment: digest.suggestedExperiment ?? buildSuggestedExperiment(contexts.moveContext, contractMode, deliberation, narrative, brief),
    teamDiscussionQuestions: digest.teamDiscussionQuestions ?? buildTeamQuestions(contexts.impactContext, contractMode, narrative, brief),
    nextWeekWatchlist: digest.nextWeekWatchlist ?? buildNextWeekWatchlist(contexts.horizonContext, contractMode, narrative, brief),
    ...(digest.leadSignal !== undefined ? { leadSignal: digest.leadSignal } : {}),
    resources: deliberatedResources
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
