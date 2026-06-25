import type { Digest, Resource } from "./emailTemplate.js";
import { truncateText } from "./textUtils.js";

type EditorialFields = Pick<
  Digest,
  "executiveBrief" | "editorsPick" | "suggestedExperiment" | "teamDiscussionQuestions"
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

function buildExecutiveBrief(resources: Resource[], editorsPick: Resource | null): string {
  if (resources.length === 0) {
    return "As Principal Design System Lead, I would treat today as a quality-control signal rather than an empty digest. The live collector did not produce reliable resources, so the right move is to avoid filling the newsletter with weak or generic AI links. That restraint protects the team's attention and keeps the curator useful. For now, focus on the operating model we want the system to support: Figma libraries, design tokens, Storybook metadata, documentation, accessibility guidance, and QA routines should become easier for AI-assisted workflows to understand without reducing human ownership. Use the gap to check whether our current documentation is specific enough for an internal Design System Agent to answer safely. The practical lesson is simple: fewer verified signals are better than a full list that blurs governance, component quality, and source trust.";
  }

  const pickTitle = truncateText(editorsPick?.title ?? resources[0].title, 80);
  const evidence = truncateText(
    editorsPick?.directDesignSystemEvidence ||
      editorsPick?.design_system_angle ||
      "the selected resources connect AI activity to system documentation, components, tokens, governance, or QA",
    130
  );

  const brief = `As Principal Design System Lead, I would treat today's signal as a prioritization exercise rather than a reading list. The strongest thread is "${pickTitle}", because ${evidence}. Across ${resources.length} resource${resources.length === 1 ? "" : "s"}, the opportunity is to make our system more legible to AI-assisted workflows without weakening governance. For the team, that means checking whether our Figma libraries, design tokens, Storybook metadata, documentation, accessibility guidance, and QA routines expose enough structured context for agents and copilots to use them safely. The useful move today is small: pick one component workflow and test where AI can reduce review effort while preserving human ownership. If the resource set is narrow, that is still useful; fewer high-confidence signals are better than padding the digest with generic AI noise.`;

  if (wordCount(brief) < 120) {
    return `${brief} Keep the conversation grounded in reusable system evidence, not novelty alone.`;
  }

  return limitWords(brief, 180);
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
  const editorsPick = digest.editorsPick ?? selectEditorsPick(digest.resources);

  return {
    date: digest.date,
    trend_summary: digest.trend_summary,
    executiveBrief: digest.executiveBrief ?? buildExecutiveBrief(digest.resources, editorsPick),
    editorsPick,
    suggestedExperiment: digest.suggestedExperiment ?? buildSuggestedExperiment(digest.resources, editorsPick),
    teamDiscussionQuestions: digest.teamDiscussionQuestions ?? buildTeamQuestions(digest.resources),
    resources: digest.resources
  };
}

export function hasEditorialSections(digest: Digest): boolean {
  return Boolean(
    digest.executiveBrief &&
      digest.suggestedExperiment &&
      Array.isArray(digest.teamDiscussionQuestions) &&
      digest.teamDiscussionQuestions.length >= 2 &&
      "editorsPick" in digest
  );
}
