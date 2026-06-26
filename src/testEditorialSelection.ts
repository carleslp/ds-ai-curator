import assert from "node:assert/strict";
import type { CandidateResource } from "./collectCandidates.js";
import { selectEditorialCandidates } from "./editorialSelection.js";
import { selectEditorialThesis } from "./editorialThesis.js";

function candidate(overrides: Partial<CandidateResource>): CandidateResource {
  return {
    title: "Untitled",
    url: "https://example.com/untitled",
    source: "Example",
    published_date: "2026-06-25",
    snippet: "",
    cleanSummary: "",
    rawText: "",
    sourceTier: 1,
    sourceScore: 8,
    relevanceScore: 5,
    recencyScore: 5,
    technicalDepthScore: 5,
    practicalityScore: 5,
    noveltyScore: 5,
    worthYourTimeScore: 5,
    directDesignSystemEvidence: "Direct mature workflow evidence.",
    ...overrides
  };
}

const result = selectEditorialCandidates([
  candidate({
    title: "Reasoning for Mobile User Experience with LLM Agents",
    url: "https://arxiv.org/abs/3333.3333",
    source: "arXiv",
    snippet: "LLM agent reasoning for mobile user experience workflows and automation.",
    cleanSummary: "LLM agent reasoning for mobile user experience workflows and automation.",
    directDesignSystemEvidence: ""
  }),
  candidate({
    title: "Figma2Code: LLM automation from design mockups to code",
    url: "https://arxiv.org/abs/2222.2222",
    source: "arXiv",
    snippet: "Uses Figma metadata for UI code generation, design-to-code, component generation and production-ready UI.",
    cleanSummary: "Uses Figma metadata for UI code generation, design-to-code, component generation and production-ready UI.",
    directDesignSystemEvidence: "Design-to-code evidence in title/snippet. Uses Figma metadata for UI code generation."
  }),
  candidate({
    title: "Storybook AI MCP component metadata for DS agents",
    url: "https://storybook.js.org/releases/ai-mcp",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    cleanSummary: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    directDesignSystemEvidence: "Storybook workflow anchor evidence in title/snippet."
  }),
  candidate({
    title: "What is a Design System governance model?",
    url: "https://example.com/design-system-governance",
    source: "Design Systems Weekly",
    snippet: "Design system governance, component ownership and documentation review for system teams.",
    cleanSummary: "Design system governance, component ownership and documentation review for system teams.",
    directDesignSystemEvidence: "Design system governance evidence in title/snippet."
  }),
  candidate({
    title: "New LLM benchmark for agent reasoning",
    url: "https://example.com/llm-agent-benchmark",
    source: "AI Research Blog",
    snippet: "LLM agent benchmark for reasoning, RAG, automation and tool use without UI or Design System impact.",
    cleanSummary: "LLM agent benchmark for reasoning, RAG, automation and tool use without UI or Design System impact.",
    directDesignSystemEvidence: ""
  }),
  candidate({
    title: "Frontend performance checklist for React teams",
    url: "https://example.com/frontend-react-performance",
    source: "Frontend Blog",
    snippet: "React frontend performance checklist for product engineering teams.",
    cleanSummary: "React frontend performance checklist for product engineering teams.",
    directDesignSystemEvidence: ""
  })
]);
const thesisInput = [
  candidate({
    title: "Reasoning for Mobile User Experience with LLM Agents",
    url: "https://arxiv.org/abs/3333.3333",
    source: "arXiv",
    snippet: "LLM agent reasoning for mobile user experience workflows and automation.",
    cleanSummary: "LLM agent reasoning for mobile user experience workflows and automation.",
    directDesignSystemEvidence: ""
  }),
  candidate({
    title: "Figma2Code: LLM automation from design mockups to code",
    url: "https://arxiv.org/abs/2222.2222",
    source: "arXiv",
    snippet: "Uses Figma metadata for UI code generation, design-to-code, component generation and production-ready UI.",
    cleanSummary: "Uses Figma metadata for UI code generation, design-to-code, component generation and production-ready UI.",
    directDesignSystemEvidence: "Design-to-code evidence in title/snippet. Uses Figma metadata for UI code generation."
  }),
  candidate({
    title: "Storybook AI MCP component metadata for DS agents",
    url: "https://storybook.js.org/releases/ai-mcp",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    cleanSummary: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    directDesignSystemEvidence: "Storybook workflow anchor evidence in title/snippet."
  }),
  candidate({
    title: "What is a Design System governance model?",
    url: "https://example.com/design-system-governance",
    source: "Design Systems Weekly",
    snippet: "Design system governance, component ownership and documentation review for system teams.",
    cleanSummary: "Design system governance, component ownership and documentation review for system teams.",
    directDesignSystemEvidence: "Design system governance evidence in title/snippet."
  }),
  candidate({
    title: "New LLM benchmark for agent reasoning",
    url: "https://example.com/llm-agent-benchmark",
    source: "AI Research Blog",
    snippet: "LLM agent benchmark for reasoning, RAG, automation and tool use without UI or Design System impact.",
    cleanSummary: "LLM agent benchmark for reasoning, RAG, automation and tool use without UI or Design System impact.",
    directDesignSystemEvidence: ""
  }),
  candidate({
    title: "Frontend performance checklist for React teams",
    url: "https://example.com/frontend-react-performance",
    source: "Frontend Blog",
    snippet: "React frontend performance checklist for product engineering teams.",
    cleanSummary: "React frontend performance checklist for product engineering teams.",
    directDesignSystemEvidence: ""
  })
];
const thesisResult = selectEditorialThesis(thesisInput);

assert.ok(thesisResult.leadSignal, "THESIS_ENGINE=true path should create a deterministic Lead Signal.");
assert.equal(thesisResult.leadSignal.role, "lead");
assert.ok(thesisResult.leadSignal.claim.length > 0, "Lead Signal should have a claim.");
assert.ok(thesisResult.leadSignal.evidence.length >= 1, "Lead Signal should have at least one evidence item.");
assert.equal(thesisResult.leadSignal.evidenceCount, thesisResult.leadSignal.evidence.length);
assert.ok(thesisResult.leadSignal.evidenceCount >= 1, "Lead Signal evidenceCount should be at least one.");
assert.equal(
  thesisResult.leadSignal.evidence.filter((evidence) => evidence.role === "lead").length,
  1,
  "Lead Signal should have exactly one lead Evidence item."
);
assert.equal(
  thesisResult.leadSignal.evidence.filter((evidence) => evidence.role === "lead" && evidence.stance === "supports").length,
  1,
  "Lead Signal should have exactly one lead supporting Evidence item."
);
assert.equal(thesisResult.leadSignal.evidence[0].role, "lead");
assert.equal(thesisResult.leadSignal.evidence[0].stance, "supports");
assert.equal(
  thesisResult.leadSignal.evidence[0].resourceRef.url,
  thesisResult.leadSignal.resourceUrl,
  "Lead Signal evidence should wrap the selected resource."
);
const selectedCandidateUrls = new Set(thesisResult.selectionResult.selectedCandidates.map((candidate) => candidate.url));
for (const evidence of thesisResult.leadSignal.evidence) {
  assert.ok(evidence.stance, "Every Evidence item should have a stance.");
  assert.ok(evidence.role, "Every Evidence item should have a role.");
  assert.ok(evidence.contribution.length > 0, "Every Evidence item should have a contribution.");
  assert.ok(evidence.independenceMarker.length > 0, "Every Evidence item should have an independence marker.");
  assert.ok(evidence.resourceRef.title.length > 0, "Every Evidence item should reference a resource title.");
  assert.ok(evidence.resourceRef.url.length > 0, "Every Evidence item should reference a resource URL.");
  assert.ok(evidence.resourceRef.source.length > 0, "Every Evidence item should reference a resource source.");
  assert.ok(selectedCandidateUrls.has(evidence.resourceRef.url), "Every Evidence item should reference a selected qualified candidate.");
}
assert.equal(
  thesisResult.leadSignal.contradictingEvidenceCount,
  thesisResult.leadSignal.evidence.filter((evidence) => evidence.stance === "contradicts").length,
  "contradictingEvidenceCount should match the Evidence set."
);
assert.equal(thesisResult.evidenceSetSummary.evidenceCount, thesisResult.leadSignal.evidenceCount);
assert.equal(thesisResult.degenerateEvidenceSet, thesisResult.leadSignal.evidenceCount === 1);
assert.ok(thesisResult.evidenceFormationReasons.length >= 1, "Evidence formation reasons should be exposed for debug.");
assert.equal(
  thesisResult.selectionResult.selectedCandidates[0].url,
  thesisResult.leadSignal.resourceUrl,
  "THESIS_ENGINE=true should drive selection ordering through the Lead Signal."
);
assert.deepEqual(
  new Set(thesisResult.selectionResult.selectedCandidates.map((candidate) => candidate.url)),
  new Set(thesisResult.leadSignal.evidence.map((evidence) => evidence.resourceRef.url)),
  "M2.5 should derive selected resources from the selected Lead Signal evidence set."
);
assert.ok(thesisResult.candidateSignals.length >= 1, "Qualified selected candidates should form candidate Signals.");
assert.ok(thesisResult.rejectedSignals.length >= 1, "Rejected selection decisions should be exposed as rejected Signals.");
assert.ok(thesisResult.signalFormationReasons.length >= 1, "Signal formation reasons should be exposed for debug.");

const degenerateThesisResult = selectEditorialThesis([
  candidate({
    title: "Storybook AI MCP component metadata for DS agents",
    url: "https://storybook.js.org/releases/ai-mcp",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    cleanSummary: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    directDesignSystemEvidence: "Storybook workflow anchor evidence in title/snippet."
  })
]);

assert.ok(degenerateThesisResult.leadSignal, "Single qualified candidate should still create a Lead Signal.");
assert.equal(degenerateThesisResult.leadSignal.evidenceCount, 1);
assert.equal(degenerateThesisResult.degenerateEvidenceSet, true);

const evidenceBeforeSelectionResult = selectEditorialThesis([
  candidate({
    title: "AI semantic mapping for design tokens",
    url: "https://example.com/ai-design-token-semantics",
    source: "Design Tokens Lab",
    snippet: "AI semantic mapping for design tokens and component library governance.",
    cleanSummary: "AI semantic mapping for design tokens and component library governance.",
    directDesignSystemEvidence: "AI and design tokens evidence in title/snippet.",
    sourceScore: 4,
    worthYourTimeScore: 4,
    practicalityScore: 2
  })
]);

assert.ok(
  evidenceBeforeSelectionResult.leadSignal,
  "THESIS_ENGINE=true should promote Evidence from the qualified candidate pool even when final selection would reject a Monday-empty item."
);
assert.equal(evidenceBeforeSelectionResult.evidencePromotionInputCount, 1);
assert.equal(evidenceBeforeSelectionResult.promotedEvidenceCount, 1);
assert.equal(evidenceBeforeSelectionResult.evidenceSetSummary.evidenceCount, 1);
assert.equal(evidenceBeforeSelectionResult.selectionResult.selectedCandidates.length, 1);
assert.equal(evidenceBeforeSelectionResult.selectionResult.selectedCandidates[0].url, "https://example.com/ai-design-token-semantics");
assert.equal(evidenceBeforeSelectionResult.leadSignal.evidence[0].resourceRef.url, "https://example.com/ai-design-token-semantics");

const diversityResult = selectEditorialThesis([
  candidate({
    title: "Storybook release: v10.5.0-alpha.1",
    url: "https://github.com/storybookjs/storybook/releases/tag/v10.5.0-alpha.1",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP preset metadata for component docs.",
    cleanSummary: "Storybook AI MCP preset metadata for component docs.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet."
  }),
  candidate({
    title: "Storybook release: v10.5.0-alpha.2",
    url: "https://github.com/storybookjs/storybook/releases/tag/v10.5.0-alpha.2",
    source: "Storybook Releases",
    snippet: "Storybook AI CLI MCP passthrough for component docs.",
    cleanSummary: "Storybook AI CLI MCP passthrough for component docs.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet."
  }),
  candidate({
    title: "Storybook release: v10.5.0-alpha.3",
    url: "https://github.com/storybookjs/storybook/releases/tag/v10.5.0-alpha.3",
    source: "Storybook Releases",
    snippet: "Storybook component manifest docgen for AI-readable docs.",
    cleanSummary: "Storybook component manifest docgen for AI-readable docs.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet."
  }),
  candidate({
    title: "Storybook release: v10.5.0-alpha.4",
    url: "https://github.com/storybookjs/storybook/releases/tag/v10.5.0-alpha.4",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP component metadata for documentation automation.",
    cleanSummary: "Storybook AI MCP component metadata for documentation automation.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet."
  }),
  candidate({
    title: "Storybook release: v10.5.0-alpha.5",
    url: "https://github.com/storybookjs/storybook/releases/tag/v10.5.0-alpha.5",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP component docs updates.",
    cleanSummary: "Storybook AI MCP component docs updates.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet."
  }),
  candidate({
    title: "Figma2Code: LLM automation from design mockups to code",
    url: "https://arxiv.org/abs/2222.2222",
    source: "arXiv",
    snippet: "Uses Figma metadata for UI code generation, design-to-code, component generation and production-ready UI.",
    cleanSummary: "Uses Figma metadata for UI code generation, design-to-code, component generation and production-ready UI.",
    directDesignSystemEvidence: "Design-to-code evidence in title/snippet. Uses Figma metadata for UI code generation."
  }),
  candidate({
    title: "Figma metadata checklist for AI design-to-code governance",
    url: "https://example.com/figma-ai-design-to-code-governance",
    source: "Design Systems Weekly",
    snippet: "Figma metadata checklist for AI design-to-code governance, component reuse and production-ready UI.",
    cleanSummary: "Figma metadata checklist for AI design-to-code governance, component reuse and production-ready UI.",
    directDesignSystemEvidence: "Design-to-code evidence in title/snippet. Figma metadata checklist for component reuse."
  })
]);

assert.ok(diversityResult.leadSignal, "Diversity scoring should still produce a Lead Signal.");
assert.match(diversityResult.leadSignal.claim, /Figma metadata|Design-to-Code/i);
const storybookReleaseGroup = diversityResult.evidenceGroups.find((group) => group.claim.includes("Storybook"));
assert.ok(storybookReleaseGroup, "Expected Storybook release-note group in debug.");
assert.equal(storybookReleaseGroup.uniqueIndependenceMarkerCount, 1);
assert.ok(storybookReleaseGroup.repeatedSourcePenalty > 0, "Same-source release-note group should receive a repeated-source penalty.");
assert.ok(storybookReleaseGroup.contributionSimilarityPenalty > 0, "Similar release-note group should receive a contribution-similarity penalty.");
assert.ok(diversityResult.leadSignalSelectionReason.length > 0, "Lead Signal selection reason should be exposed.");
assert.ok(diversityResult.runnerUpEvidenceGroups.length >= 1, "Runner-up Evidence groups should be exposed.");
assert.ok(
  diversityResult.selectionResult.selectedCandidates.length <= diversityResult.leadSignal.evidence.length,
  "Rendered resources should not exceed the internal Evidence set."
);

const invalidResearchSelection = result.selectedDecisions.find(
  (decision) => decision.topicGroup === "AI Research" && decision.designSystemTopics.length === 0
);

assert.equal(
  invalidResearchSelection,
  undefined,
  "Selected resources must never include AI Research items with empty designSystemTopics."
);

const rejectedMobileUx = result.rejectedDecisions.find((decision) =>
  decision.title.includes("Reasoning for Mobile User Experience")
);

assert.ok(rejectedMobileUx, "Expected weak AI Research item to move to rejectedCandidates.");
assert.equal(
  rejectedMobileUx.rejectionReason,
  "Skipped because AI Research lacks a direct Design System workflow connection."
);
assert.deepEqual(rejectedMobileUx.designSystemTopics, []);

const rejectedDsOnly = result.rejectedDecisions.find((decision) => decision.title.includes("Design System governance"));
assert.ok(rejectedDsOnly, "Expected Design Systems-only item to be rejected.");
assert.equal(rejectedDsOnly.editorialMissionMatch, false);
assert.match(rejectedDsOnly.missionReason, /not about AI or AI-powered tooling/i);

const rejectedAiOnly = result.rejectedDecisions.find((decision) => decision.title.includes("LLM benchmark"));
assert.ok(rejectedAiOnly, "Expected AI-only item to be rejected.");
assert.equal(rejectedAiOnly.editorialMissionMatch, false);
assert.match(rejectedAiOnly.missionReason, /direct impact on mature Design System work/i);

const rejectedFrontendOnly = result.rejectedDecisions.find((decision) => decision.title.includes("Frontend performance"));
assert.ok(rejectedFrontendOnly, "Expected frontend-only item to be rejected.");
assert.equal(rejectedFrontendOnly.editorialMissionMatch, false);

assert.ok(
  result.selectedDecisions.some((decision) => decision.title.includes("Figma2Code") && decision.editorialMissionMatch),
  "Expected Figma2Code to remain selectable."
);
assert.ok(
  result.selectedDecisions.some((decision) => decision.title.includes("Storybook AI MCP") && decision.editorialMissionMatch),
  "Expected Storybook AI/MCP to remain selectable."
);

const figma2Code = result.selectedDecisions.find((decision) => decision.title.includes("Figma2Code"));
assert.ok(figma2Code, "Expected Figma2Code decision.");
assert.equal(figma2Code.editorialTitle, "Why Figma metadata is becoming the bottleneck for Design-to-Code AI");
assert.ok(figma2Code.actionabilityScore >= 6, "Expected selected resources to clear the actionability gate.");
assert.notEqual(figma2Code.mondayMorningChange, "nothing");

const storybookAi = result.selectedDecisions.find((decision) => decision.title.includes("Storybook AI MCP"));
assert.ok(storybookAi, "Expected Storybook AI/MCP decision.");
assert.equal(storybookAi.editorialTitle, "Storybook prepares AI-ready component metadata");

console.log("Editorial selection test passed.");
