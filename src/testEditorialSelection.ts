import assert from "node:assert/strict";
import type { CandidateResource } from "./collectCandidates.js";
import { selectEditorialCandidates } from "./editorialSelection.js";

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
  })
]);

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

assert.ok(
  result.selectedDecisions.some((decision) => decision.title.includes("Figma2Code")),
  "Expected Figma2Code to remain selectable."
);
assert.ok(
  result.selectedDecisions.some((decision) => decision.title.includes("Storybook AI MCP")),
  "Expected Storybook AI/MCP to remain selectable."
);

console.log("Editorial selection test passed.");
