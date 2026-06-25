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
