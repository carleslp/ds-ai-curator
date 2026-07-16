import assert from "node:assert/strict";
import { validateSectionContracts } from "./editorialContracts.js";
import type { Digest, Resource } from "./emailTemplate.js";

// PR-17: whyItMatters() used to embed resource.directDesignSystemEvidence
// directly into reader copy -- collectCandidates.ts's evidenceSentence()
// shape ("${label}: ${terms} evidence in title/snippet. ${sourceText}").
// publicationSafeText() launders the standalone word "evidence" to "signal"
// before this check ever runs, so the check must catch the surrounding
// machinery ("anchor:", "in title/snippet") on its own.

function resource(overrides: Partial<Resource>): Resource {
  return {
    title: "Untitled",
    url: "https://example.com/untitled",
    source: "Example",
    type: "article",
    summary: "A clean, reader-facing summary of the article.",
    cleanSummary: "A clean, reader-facing summary of the article.",
    why_it_matters_to_our_team: "This changes how the team documents component states before AI-assisted review.",
    why_selected: "It connects a concrete workflow implication to the week's thesis.",
    expected_impact_on_workflow: "Review one component's documentation for machine-readable gaps.",
    ignore_risk: "We may keep relying on undocumented tribal knowledge.",
    ...overrides
  };
}

function digestWith(resources: Resource[]): Digest {
  return {
    date: "2026-07-16",
    trend_summary: "",
    theSignal: "AI-assisted work only earns trust when system context is explicit enough to verify against.",
    executiveBrief: "AI-assisted work only earns trust when system context is explicit enough to verify against.",
    editorsPick: null,
    supportingSignals: ["One observation that supports the thesis."],
    thisWeeksSignals: ["One observation that supports the thesis."],
    suggestedExperiment: "Pick one component and document the assumptions an agent should not have to infer.",
    teamDiscussionQuestions: ["Which workflow still depends on interpretation rather than an explicit rule?"],
    nextWeekWatchlist: ["Watch for tools that expose component metadata directly to AI agents."],
    resources
  };
}

// The leak: real shape produced by collectCandidates.ts's evidenceSentence().
const leakedResource = resource({
  title: "Storybook ships component metadata for AI agents",
  url: "https://example.com/storybook-metadata",
  why_it_matters_to_our_team:
    "Use this to find where Figma and Storybook need clearer machine-readable guidance; the useful clue is " +
    "Direct Design System anchor: design system signal in title/snippet."
});

const leakedResult = validateSectionContracts(digestWith([leakedResource]), null);
assert.equal(
  leakedResult.sectionContracts.supportingResources.machineryLeakPass,
  false,
  "machineryLeakPass should fail when reader copy contains evidenceSentence() machinery text."
);
assert.ok(
  leakedResult.sectionContracts.supportingResources.offendingTerms.some((term) => term.includes("anchor") || term.includes("title/snippet")),
  "offendingTerms should name the anchor/title-snippet machinery, not just the already-laundered word 'evidence'."
);

// Regression: clean, reader-facing copy with no machinery vocabulary must
// still pass. The check should catch the leak, not become a false-positive
// trap for ordinary prose.
const cleanResult = validateSectionContracts(digestWith([resource({})]), null);
assert.equal(
  cleanResult.sectionContracts.supportingResources.machineryLeakPass,
  true,
  "Clean resource copy with no machinery vocabulary should still pass machineryLeakPass."
);

console.log("Editorial contracts test passed.");
