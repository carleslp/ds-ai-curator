import assert from "node:assert/strict";
import type { CandidateResource } from "./collectCandidates.js";
import { buildEditorialBrief } from "./editorialBrief.js";
import { selectEditorialCandidates } from "./editorialSelection.js";
import { selectEditorialThesis } from "./editorialThesis.js";
import { extractNarrativeFrame } from "./narrativeExtraction.js";

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

const releaseClusterResult = selectEditorialThesis([
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
    snippet: "Storybook AI MCP component metadata and docgen updates for component documentation automation.",
    cleanSummary: "Storybook AI MCP component metadata and docgen updates for component documentation automation.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet."
  })
]);

assert.ok(releaseClusterResult.leadSignal, "Release cluster should still create a Lead Signal.");
assert.ok(releaseClusterResult.leadSignal.evidenceCount > 1, "Full Evidence set should remain intact internally.");
assert.ok(releaseClusterResult.representativeLeadEvidence, "Representative lead Evidence should be exposed.");
assert.ok(releaseClusterResult.representativeSelectionReasons.length >= 1, "Representative selection reasons should be exposed.");
assert.ok(releaseClusterResult.hiddenEvidenceCount >= 2, "Near-identical release evidence should be hidden from rendered resources.");
assert.ok(
  releaseClusterResult.selectionResult.selectedCandidates.length < releaseClusterResult.leadSignal.evidenceCount,
  "Rendered resources should use representative Evidence, not the full Evidence set."
);
assert.deepEqual(
  releaseClusterResult.renderedResourceTitles,
  releaseClusterResult.selectionResult.selectedCandidates.map((candidate) => candidate.title),
  "Rendered resource debug titles should match selected representative resources."
);
assert.ok(
  releaseClusterResult.evidenceReasoning.discardedCount >= 1,
  "Evidence Reasoning should discard duplicate editorial contributions in near-identical release evidence."
);
assert.ok(
  releaseClusterResult.evidenceReasoning.entries.some((entry) => entry.status === "discarded" && entry.duplicateWith),
  "Discarded Evidence should name the Evidence item that already covered the contribution."
);

const evidenceReasoningResult = selectEditorialThesis([
  candidate({
    title: "Storybook AI MCP component metadata for executable docs",
    url: "https://storybook.js.org/releases/ai-mcp-executable-docs",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP component metadata, component manifest, docgen and machine-readable documentation automation.",
    cleanSummary: "Storybook AI MCP component metadata, component manifest, docgen and machine-readable documentation automation.",
    directDesignSystemEvidence: "Storybook component metadata and MCP evidence in title/snippet."
  }),
  candidate({
    title: "Another Storybook MCP metadata article",
    url: "https://example.com/another-storybook-mcp-metadata",
    source: "Storybook Blog",
    snippet: "Storybook MCP component metadata and machine-readable documentation for AI agents.",
    cleanSummary: "Storybook MCP component metadata and machine-readable documentation for AI agents.",
    directDesignSystemEvidence: "Storybook component metadata and MCP evidence in title/snippet."
  }),
  candidate({
    title: "Figma metadata design-to-code AI component generation",
    url: "https://example.com/figma-metadata-design-to-code-ai-reasoning",
    source: "Design Systems Weekly",
    snippet:
      "Figma metadata drives AI design-to-code, code generation, component generation, production-ready UI and component reuse.",
    cleanSummary:
      "Figma metadata drives AI design-to-code, code generation, component generation, production-ready UI and component reuse.",
    directDesignSystemEvidence: "Figma metadata and design-to-code evidence in title/snippet."
  })
]);

assert.ok(evidenceReasoningResult.leadSignal, "Evidence Reasoning fixture should still produce a Lead Signal.");
assert.ok(
  evidenceReasoningResult.evidenceReasoning.entries.some(
    (entry) => entry.status === "kept" && /component metadata becoming executable knowledge/i.test(entry.uniqueContribution)
  ),
  "Evidence Reasoning should keep one metadata contribution."
);
assert.ok(
  evidenceReasoningResult.evidenceReasoning.entries.some(
    (entry) => entry.status === "kept" && /Figma metadata shaping/i.test(entry.uniqueContribution)
  ),
  "Evidence Reasoning should keep distinct Figma/design-to-code contribution."
);
assert.ok(
  evidenceReasoningResult.evidenceReasoning.entries.some(
    (entry) => entry.status === "discarded" && /component metadata becoming executable knowledge/i.test(entry.uniqueContribution)
  ),
  "Evidence Reasoning should discard repeated metadata contribution."
);
assert.ok(
  new Set(
    evidenceReasoningResult.representativeSupportingEvidence.map((evidence) =>
      evidenceReasoningResult.evidenceReasoning.entries.find((entry) => entry.url === evidence.resourceRef.url)?.uniqueContribution
    )
  ).size === evidenceReasoningResult.representativeSupportingEvidence.length,
  "Representative supporting Evidence should have unique editorial contributions."
);

const narrativeFrame = extractNarrativeFrame({
  leadSignal: evidenceReasoningResult.leadSignal,
  editorialDeliberation: evidenceReasoningResult.editorialDeliberation,
  evidenceReasoning: evidenceReasoningResult.evidenceReasoning,
  representativeLeadEvidence: evidenceReasoningResult.representativeLeadEvidence,
  representativeSupportingEvidence: evidenceReasoningResult.representativeSupportingEvidence
});

assert.ok(narrativeFrame.headline.length > 0, "Narrative Extraction should produce a headline.");
assert.ok(narrativeFrame.oldAssumption.length > 0, "Narrative Extraction should identify the old assumption.");
assert.ok(narrativeFrame.newReality.length > 0, "Narrative Extraction should identify the new reality.");
assert.notEqual(narrativeFrame.oldAssumption, narrativeFrame.newReality, "Narrative tension should distinguish old assumption from new reality.");
assert.ok(narrativeFrame.leadProof.length > 0, "Narrative Extraction should use selected Lead Evidence as proof.");
assert.ok(
  narrativeFrame.sourceInputsUsed.includes("evidenceReasoning.keptEntries"),
  "Narrative Extraction debug should show it used kept Evidence Reasoning entries."
);
assert.ok(
  !/\b(cluster|score|candidate|evidence reasoning|pipeline|selected because|thesis engine)\b/i.test(
    `${narrativeFrame.headline} ${narrativeFrame.oldAssumption} ${narrativeFrame.newReality} ${narrativeFrame.narrativeThesis} ${narrativeFrame.readerTakeaway}`
  ),
  "Narrative frame reader-facing fields should avoid internal machinery vocabulary."
);

const editorialBrief = buildEditorialBrief({
  narrativeFrame,
  evidenceReasoning: evidenceReasoningResult.evidenceReasoning,
  representativeLeadEvidence: evidenceReasoningResult.representativeLeadEvidence,
  representativeSupportingEvidence: evidenceReasoningResult.representativeSupportingEvidence
});

assert.equal(editorialBrief.thesis, narrativeFrame.narrativeThesis, "Editorial Brief should inherit the narrative thesis.");
assert.equal(editorialBrief.narrativeFrame, narrativeFrame, "Editorial Brief should carry the internal Narrative Extraction frame.");
assert.ok(editorialBrief.editorialPosition.length > 0, "Editorial Brief should form an editorial position for the writer.");
assert.ok(editorialBrief.leadEvidence.length > 0, "Editorial Brief should preserve the lead proof.");
assert.ok(editorialBrief.consequences.immediate.length > 0, "Editorial Brief should define the immediate consequence.");
assert.ok(editorialBrief.experiment.length > 0, "Editorial Brief should define a concrete experiment.");
assert.ok(editorialBrief.discussionQuestions.length >= 2, "Editorial Brief should provide discussion prompts.");
assert.ok(editorialBrief.watchlist.length >= 2, "Editorial Brief should provide a watchlist.");
assert.equal(
  editorialBrief.evidenceMapping.length,
  1 + evidenceReasoningResult.representativeSupportingEvidence.length,
  "Editorial Brief should map each rendered Evidence item to a resource-card role."
);
assert.ok(
  editorialBrief.evidenceMapping.every((mapping) => mapping.evidentialRole.length > 0 && mapping.supportsBrief.length > 0),
  "Every Editorial Brief evidence mapping should explain how the resource supports the argument."
);
assert.ok(
  !/\b(cluster|score|candidate|evidence reasoning|pipeline|selected because|thesis engine)\b/i.test(
    `${editorialBrief.thesis} ${editorialBrief.editorialPosition} ${editorialBrief.leadEvidence} ${editorialBrief.supportingEvidence.join(" ")} ${editorialBrief.consequences.immediate} ${editorialBrief.experiment}`
  ),
  "Editorial Brief reader-facing inputs should avoid internal machinery vocabulary."
);

const deliberationResult = selectEditorialThesis([
  candidate({
    title: "Storybook AI MCP component metadata for executable docs",
    url: "https://storybook.js.org/releases/ai-mcp-executable-docs",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP component metadata, component manifest, docgen and machine-readable documentation automation.",
    cleanSummary: "Storybook AI MCP component metadata, component manifest, docgen and machine-readable documentation automation.",
    directDesignSystemEvidence: "Storybook component metadata and MCP evidence in title/snippet."
  }),
  candidate({
    title: "Figma metadata design-to-code AI component generation",
    url: "https://example.com/figma-metadata-design-to-code-ai",
    source: "Design Systems Weekly",
    snippet:
      "Figma metadata drives AI design-to-code, code generation, component generation, production-ready UI and component reuse.",
    cleanSummary:
      "Figma metadata drives AI design-to-code, code generation, component generation, production-ready UI and component reuse.",
    directDesignSystemEvidence: "Figma metadata and design-to-code evidence in title/snippet."
  }),
  candidate({
    title: "AI accessibility automation for Design System QA",
    url: "https://example.com/ai-accessibility-design-system-qa",
    source: "Accessibility Engineering",
    snippet: "AI accessibility automation validates React component library QA, governance and WCAG review rules.",
    cleanSummary: "AI accessibility automation validates React component library QA, governance and WCAG review rules.",
    directDesignSystemEvidence: "Design System QA, React component library and accessibility automation evidence in title/snippet."
  })
]);

assert.ok(deliberationResult.editorialDeliberation.dominantStory, "Editorial Deliberation should always pick one dominant story.");
assert.notEqual(deliberationResult.editorialDeliberation.dominantStory?.story, "No story this week");
assert.ok(
  deliberationResult.editorialDeliberation.detectedStories.length >= 3,
  "Editorial Deliberation should receive Theme Discovery clusters without replacing them."
);
assert.ok(
  deliberationResult.editorialDeliberation.mergedClusters.some((merge) => merge.clusterClaims.length >= 2),
  "Related Storybook metadata and design-to-code clusters should merge into one narrative candidate."
);
assert.ok(
  deliberationResult.editorialDeliberation.secondaryStories.length >= 1,
  "Unrelated clusters should be preserved as secondary stories."
);
assert.ok(
  deliberationResult.editorialDeliberation.reasoning.some((reason) => /does not decide publication readiness/i.test(reason)),
  "Editorial Deliberation debug should state that publication gating remains outside this stage."
);
assert.ok(
  deliberationResult.evidenceGroups.some((group) => /Storybook/i.test(group.claim)) &&
    deliberationResult.evidenceGroups.some((group) => /Figma metadata|Design-to-Code/i.test(group.claim)),
  "Theme Discovery output should remain available as separate groups even when deliberation merges the story."
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
