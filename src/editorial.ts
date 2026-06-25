import type { Digest, Resource } from "./emailTemplate.js";
import { cleanText, truncateText } from "./textUtils.js";

type EditorialFields = Pick<
  Digest,
  "theSignal" | "executiveBrief" | "editorsPick" | "thisWeeksSignals" | "suggestedExperiment" | "teamDiscussionQuestions"
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

const workflowAreas = ["Figma", "Storybook", "Tokens", "Docs", "QA", "AI Agents"] as const;

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
  if (text.includes("storybook") || text.includes("react")) areas.add("Storybook");
  if (text.includes("token")) areas.add("Tokens");
  if (text.includes("doc") || text.includes("documentation") || text.includes("mcp")) areas.add("Docs");
  if (text.includes("qa") || text.includes("test") || text.includes("accessibility") || text.includes("regression")) {
    areas.add("QA");
  }
  if (text.includes("ai") || text.includes("agent") || text.includes("mcp") || text.includes("llm")) {
    areas.add("AI Agents");
  }

  if (areas.size === 0) {
    areas.add("Docs");
    areas.add("AI Agents");
  }

  return workflowAreas.filter((area) => areas.has(area));
}

function impactScore(resource: Resource, areas: string[]): number {
  const score = Math.round(((resource.relevance_score ?? 4) + (resource.worth_your_time_score ?? 4)) / 2);
  return Math.max(1, Math.min(5, Math.max(score, areas.length >= 4 ? 5 : areas.length >= 3 ? 4 : score)));
}

function audienceFor(resource: Resource, areas: string[]): string {
  const readers = new Set<string>();
  if (areas.includes("Figma") || areas.includes("Tokens")) readers.add("Designer");
  if (areas.includes("Storybook") || areas.includes("QA")) readers.add("Frontend DS Engineer");
  if (areas.includes("AI Agents") || resourceText(resource).includes("mcp")) readers.add("AI Engineer");
  if (areas.includes("Docs") || resourceText(resource).includes("governance")) readers.add("DesignOps");
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
  return truncateText(
    `If we ignore this, AI-assisted work around ${workflowPhrase(
      areas
    )} will keep relying on tribal knowledge instead of explicit Design System rules.`,
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

function buildSignal(resources: Resource[], editorsPick: Resource | null): string {
  if (resources.length === 0) {
    return "The signal this week is restraint. When the source set does not produce reliable, reusable resources, the premium move is to avoid padding the briefing with generic AI noise. That matters because an enterprise Design System team should be training attention toward trustworthy operating patterns: structured Figma libraries, token decisions that survive implementation, Storybook examples that agents can read, documentation that reduces ambiguity, and QA checks that preserve accessibility. The gap is useful because it exposes the work still ahead of us. If our own system is not explicit enough for an internal Design System Agent or QA Agent to reason from, external AI content will not fix the workflow. The team should use this moment to audit one component page and ask whether its props, tokens, states, examples, and guardrails are legible to both humans and agents.";
  }

  const pickTitle = truncateText(editorsPick?.title ?? resources[0].title, 80);
  const allAreas = Array.from(new Set(resources.flatMap((resource) => resource.affected_workflow_areas ?? affectedWorkflowAreas(resource))));
  const themes = allAreas.slice(0, 4);
  const themePhrase = workflowPhrase(themes.length ? themes : ["Docs", "AI Agents"]);
  const brief = `The signal this week is that AI is moving from generic assistance into the operating layer of Design Systems. The selected resources point to ${themePhrase} as the places where small gaps in structure become larger workflow risks. What changed is not simply that tools can generate more UI; it is that agents and copilots increasingly need system rules they can inspect, reuse, and challenge. That matters now because our Figma libraries, Storybook examples, token decisions, documentation, accessibility guidance, and QA routines are becoming inputs to automation, not just references for humans. The strongest item, "${pickTitle}", is worth reading first because it gives the team a concrete way to connect AI capability with system governance. Pay attention to where the resources reveal missing metadata, unclear component intent, or review steps that still depend on tribal knowledge.`;

  if (wordCount(brief) < 120) {
    return `${brief} The goal is not faster output alone; it is safer, more reusable system decisions.`;
  }

  return limitWords(brief, 180);
}

function buildThisWeeksSignals(resources: Resource[]): string[] {
  if (resources.length === 0) {
    return [
      "The absence of strong sources is itself a signal: attention should stay on verified workflows, not generic AI updates.",
      "AI readiness depends on whether our own component docs, tokens, and examples are explicit enough for agents to inspect.",
      "Design System quality will be decided by governance and QA loops as much as by generation speed."
    ];
  }

  const areas = new Set(resources.flatMap((resource) => resource.affected_workflow_areas ?? affectedWorkflowAreas(resource)));
  const signals = [
    areas.has("AI Agents")
      ? "AI agents are becoming consumers of Design System knowledge, which makes structured docs and examples part of the product surface."
      : "AI value is shifting toward reusable workflow improvements rather than broad productivity claims.",
    areas.has("Figma") || areas.has("Tokens")
      ? "Figma libraries and tokens need clearer links to implementation behavior, because generation without constraints creates review debt."
      : "The strongest signals are around making system decisions easier to verify across design and engineering.",
    areas.has("QA") || areas.has("Storybook")
      ? "Storybook, accessibility, and QA evidence are becoming the guardrails that separate useful automation from risky UI output."
      : "Documentation quality is becoming an automation prerequisite, not a cleanup task after components ship."
  ];

  return signals.slice(0, 3);
}

function buildSuggestedExperiment(resources: Resource[], editorsPick: Resource | null): string {
  if (resources.length === 0) {
    return "Spend 30 minutes auditing one component page and mark what an internal Design System Agent would need: props, token usage, accessibility states, examples, and QA rules.";
  }

  const pick = truncateText(editorsPick?.title ?? resources[0].title, 90);
  return `In 30 minutes, use "${pick}" as a prompt for one component audit: identify one missing token note, one Storybook/doc gap, and one QA or accessibility guardrail an AI assistant would need before suggesting changes.`;
}

function buildTeamQuestions(resources: Resource[]): string[] {
  if (resources.length === 0) {
    return [
      "Which component or token page would be most useful to make AI-readable this week?",
      "What Design System guardrail should remain explicitly human-owned even when agents assist?",
      "What evidence would make a future digest item trustworthy enough for team action?"
    ];
  }

  return [
    "Which part of our Figma, tokens, Storybook, and React workflow would these resources change first?",
    "What metadata or documentation would our internal Design System Agent need to use this safely?",
    "What QA, accessibility, or governance check should remain visible before AI-assisted changes ship?"
  ];
}

export function withEditorialSections(digest: DigestInput): Digest {
  const resources = enrichResources(digest.resources);
  const editorsPick = digest.editorsPick
    ? enrichResources([digest.editorsPick])[0]
    : selectEditorsPick(resources);
  const theSignal = digest.theSignal ?? digest.executiveBrief ?? buildSignal(resources, editorsPick);

  return {
    date: digest.date,
    trend_summary: digest.trend_summary,
    theSignal,
    executiveBrief: digest.executiveBrief ?? theSignal,
    editorsPick,
    thisWeeksSignals: digest.thisWeeksSignals ?? buildThisWeeksSignals(resources),
    suggestedExperiment: digest.suggestedExperiment ?? buildSuggestedExperiment(resources, editorsPick),
    teamDiscussionQuestions: digest.teamDiscussionQuestions ?? buildTeamQuestions(resources),
    resources
  };
}

export function hasEditorialSections(digest: Digest): boolean {
  return Boolean(
    digest.theSignal &&
      digest.executiveBrief &&
      Array.isArray(digest.thisWeeksSignals) &&
      digest.thisWeeksSignals.length === 3 &&
      digest.suggestedExperiment &&
      Array.isArray(digest.teamDiscussionQuestions) &&
      digest.teamDiscussionQuestions.length >= 2 &&
      "editorsPick" in digest
  );
}
