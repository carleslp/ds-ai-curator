import assert from "node:assert/strict";
import type { CandidateResource } from "./collectCandidates.js";
import { buildEditorialBrief, emptyEditorialBrief } from "./editorialBrief.js";
import { evaluateEditorialQualification, qualifyEditorialCandidates } from "./editorialQualification.js";
import { assignEditorialRoles } from "./editorialRoles.js";
import { selectEditorialCandidates } from "./editorialSelection.js";
import { selectEditorialThesis } from "./editorialThesis.js";
import { selectLearningRecommendation } from "./learningRecommendation.js";
import { extractNarrativeFrame } from "./narrativeExtraction.js";
import { classifyCandidatesTopics } from "./topicClassifier.js";

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
    readerValue: 60,
    learningValue: 60,
    sourceCategory: "Official",
    rankingExplanation: "Official source. Reader value 60/100 and learning value 60/100 from test fixture.",
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

const islandFarmersQualification = evaluateEditorialQualification(
  candidate({
    title: "AI Planning for Island Smallholder Farmers",
    url: "https://arxiv.org/abs/4444.4444",
    source: "arXiv",
    snippet: "A generic AI planning paper about agriculture, farming and island smallholder farmers.",
    cleanSummary: "A generic AI planning paper about agriculture, farming and island smallholder farmers.",
    rawText: "A generic AI planning paper about agriculture, farming and island smallholder farmers.",
    directDesignSystemEvidence: "",
    sourceCategory: "Research",
    readerValue: 20,
    learningValue: 20
  })
);

assert.equal(islandFarmersQualification.qualificationDecision, "rejected");
assert.equal(islandFarmersQualification.domainAffinity, 0);
assert.match(islandFarmersQualification.qualificationReason, /unrelated domain/i);

const figmaDocsIndexQualification = evaluateEditorialQualification(
  candidate({
    title: "Figma Help Center search results",
    url: "https://help.figma.com/hc/en-us/search?query=MCP",
    source: "Figma MCP Documentation",
    snippet: "Figma Help Center documentation index and search results.",
    cleanSummary: "Figma Help Center documentation index and search results.",
    rawText: "Figma Help Center documentation index and search results.",
    directDesignSystemEvidence: "",
    readerValue: 36,
    learningValue: 30
  })
);

assert.equal(figmaDocsIndexQualification.qualificationDecision, "rejected");
assert.match(figmaDocsIndexQualification.qualificationReason, /documentation or search index/i);

const eqePipelineResult = qualifyEditorialCandidates([
  candidate({
    title: "AI Planning for Island Smallholder Farmers",
    url: "https://arxiv.org/abs/4444.4444",
    source: "arXiv",
    snippet: "A generic AI planning paper about agriculture and island smallholder farmers.",
    cleanSummary: "A generic AI planning paper about agriculture and island smallholder farmers.",
    rawText: "A generic AI planning paper about agriculture and island smallholder farmers.",
    directDesignSystemEvidence: "",
    sourceCategory: "Research",
    readerValue: 20,
    learningValue: 20
  }),
  candidate({
    title: "Storybook AI MCP component metadata for DS agents",
    url: "https://storybook.js.org/releases/ai-mcp",
    source: "Storybook Releases",
    snippet: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    cleanSummary: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    rawText: "Storybook AI MCP component metadata, docgen, docs automation and component APIs.",
    directDesignSystemEvidence: "Storybook workflow anchor evidence in title/snippet."
  })
]);

assert.equal(eqePipelineResult.qualifiedCandidates.length, 1);
assert.equal(eqePipelineResult.qualifiedCandidates[0].url, "https://storybook.js.org/releases/ai-mcp");
assert.ok(
  eqePipelineResult.editorialQualification.every(
    (qualification) =>
      typeof qualification.domainAffinity === "number" &&
      typeof qualification.audienceFit === "number" &&
      typeof qualification.teachingValue === "number" &&
      typeof qualification.practicalRelevance === "number" &&
      qualification.qualificationReason.length > 0
  ),
  "EQE debug should expose full qualification scoring for every evaluated resource."
);

const roleFixtureCandidates = [
  candidate({
    title: "Storybook release: v10.5.0-alpha.7",
    url: "https://github.com/storybookjs/storybook/releases/tag/v10.5.0-alpha.7",
    source: "Storybook Releases",
    snippet: "Release notes changelog introducing Storybook AI MCP component metadata, docgen and component manifests.",
    cleanSummary: "Release notes changelog introducing Storybook AI MCP component metadata, docgen and component manifests.",
    rawText: "Release notes changelog introducing Storybook AI MCP component metadata, docgen and component manifests.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet.",
    sourceCategory: "Official",
    readerValue: 42,
    learningValue: 38
  }),
  candidate({
    title: "Who Are We Writing For Now?",
    url: "https://medium.com/design-systems/who-are-we-writing-for-now",
    source: "Medium Design Systems",
    snippet:
      "Deep essay and explainer about writing Design System documentation for designers, engineers and AI agents using Storybook metadata and component examples.",
    cleanSummary:
      "Deep essay and explainer about writing Design System documentation for designers, engineers and AI agents using Storybook metadata and component examples.",
    rawText:
      "Deep essay and explainer about writing Design System documentation for designers, engineers and AI agents using Storybook metadata and component examples.",
    directDesignSystemEvidence: "AI and Design System anchor evidence in title/snippet.",
    sourceCategory: "Practical",
    readerValue: 94,
    learningValue: 95
  }),
  candidate({
    title: "Figma Help Center search results",
    url: "https://help.figma.com/hc/en-us/search?query=MCP",
    source: "Figma MCP Documentation",
    snippet: "Figma Help Center documentation index and search results.",
    cleanSummary: "Figma Help Center documentation index and search results.",
    rawText: "Figma Help Center documentation index and search results.",
    directDesignSystemEvidence: "",
    sourceCategory: "Official",
    readerValue: 36,
    learningValue: 30
  }),
  candidate({
    title: "AI Planning for Island Smallholder Farmers",
    url: "https://arxiv.org/abs/4444.4444",
    source: "arXiv",
    snippet: "A generic AI planning paper about agriculture, farming and island smallholder farmers.",
    cleanSummary: "A generic AI planning paper about agriculture, farming and island smallholder farmers.",
    rawText: "A generic AI planning paper about agriculture, farming and island smallholder farmers.",
    directDesignSystemEvidence: "",
    sourceCategory: "Research",
    readerValue: 20,
    learningValue: 20
  })
];
const roleQualification = qualifyEditorialCandidates(roleFixtureCandidates);
const roleSelection = selectEditorialCandidates(roleQualification.qualifiedCandidates);
const editorialRoles = assignEditorialRoles({
  candidates: roleFixtureCandidates,
  editorialQualification: roleQualification.editorialQualification,
  editorialSelection: roleSelection.decisions,
  topicClassifications: classifyCandidatesTopics(roleFixtureCandidates)
});
const roleByTitle = new Map(editorialRoles.roleAssignments.map((assignment) => [assignment.title, assignment]));
const storybookReleaseRoles = roleByTitle.get("Storybook release: v10.5.0-alpha.7");
const writingForRoles = roleByTitle.get("Who Are We Writing For Now?");
const docsIndexRoles = roleByTitle.get("Figma Help Center search results");
const farmersRoles = roleByTitle.get("AI Planning for Island Smallholder Farmers");

assert.ok(storybookReleaseRoles, "Expected Storybook release role assignment.");
assert.ok(
  storybookReleaseRoles.primaryRole === "Evidence" || storybookReleaseRoles.primaryRole === "Watchlist",
  "Storybook release should primarily fill Evidence or Watchlist."
);
assert.equal(
  storybookReleaseRoles.possibleEditorialRoles.some((role) => role.role === "Teaching" && role.fit === "strong"),
  false,
  "Release notes should almost never have Teaching as a strong role."
);
assert.equal(writingForRoles?.primaryRole, "Teaching", "Who Are We Writing For Now? should be classified as Teaching.");
assert.ok(
  docsIndexRoles?.primaryRole === "Ignore" || docsIndexRoles?.primaryRole === "Reference",
  "Generic docs indexes should be Ignore or Reference."
);
assert.equal(farmersRoles?.primaryRole, "Ignore", "arXiv papers unrelated to Design Systems should be Ignore.");
assert.ok(
  editorialRoles.roleAssignments.every((assignment) => assignment.possibleEditorialRoles.length >= 1),
  "Every candidate should receive possible editorial roles."
);
assert.ok(editorialRoles.summary.notes.some((note) => /does not change selection/i.test(note)));
const roleLearningBrief = {
  ...emptyEditorialBrief(),
  thesis: "Design System documentation is shifting from static reference to AI-readable operational knowledge.",
  narrativeHeadline: "AI-readable documentation becomes Design System infrastructure",
  editorialPosition: "Senior Design System teams need writing that teaches both people and agents how components behave.",
  newReality: "Component documentation is becoming structured enough for agents to act on.",
  whyNow: "Storybook metadata and practitioner writing are converging around machine-readable component context."
};
// Stage 2 fetches article bodies; inject fixture bodies so the test stays
// offline and deterministic. The essay's body is rich in this week's thesis
// vocabulary and teaching cues, so it survives Stage 2 body analysis.
const roleFixtureBodies: Record<string, string> = {
  "https://medium.com/design-systems/who-are-we-writing-for-now":
    "Design System documentation is shifting from static reference material into AI-readable operational knowledge. " +
    "For example, when we write component documentation now, we are writing for designers, engineers, and AI agents at the same time. " +
    "Here's how that changes the work in practice: Storybook metadata and component examples become the operational knowledge an agent reads before it acts. " +
    "The takeaway is that documentation is becoming infrastructure. A short walkthrough: start with one component, capture the intent, and let both people and agents verify it the same way. " +
    "This essay explains the pattern and why AI-readable documentation matters for mature Design System teams.".repeat(3)
};
const roleFetcher = async (url: string): Promise<string | null> => roleFixtureBodies[url] ?? null;
const roleLearningRecommendation = await selectLearningRecommendation(
  {
    editorialBrief: roleLearningBrief,
    thesis: null,
    evidence: [],
    qualifiedResources: roleSelection.qualifiedCandidates,
    editorialQualification: roleQualification.editorialQualification,
    allResources: roleFixtureCandidates,
    selectionDecisions: roleSelection.decisions,
    editorialRoles
  },
  { fetchArticleBody: roleFetcher }
);

assert.equal(
  roleLearningRecommendation.recommendedReading?.title,
  "Who Are We Writing For Now?",
  "Recommended Reading should surface the strongest reader-facing Teaching candidate."
);
assert.notEqual(
  roleLearningRecommendation.recommendedReading?.title,
  "Storybook release: v10.5.0-alpha.7",
  "Storybook release evidence should not become Recommended Reading."
);
assert.ok(
  roleLearningRecommendation.teachingCandidatesConsidered.some((candidate) => candidate.title === "Who Are We Writing For Now?"),
  "Debug should show the Teaching candidate considered for reader-facing recommendation."
);
assert.ok(
  roleLearningRecommendation.teachingCandidatesRejected.some((candidate) =>
    candidate.title === "Storybook release: v10.5.0-alpha.7" && /not Teaching|Evidence|Watchlist|Recommended Reading/i.test(candidate.reason)
  ),
  "Debug should explain why Evidence/Watchlist material was separated from Teaching."
);
assert.ok(
  !/no qualified resources were available/i.test(roleLearningRecommendation.nullReason),
  "Learning Recommendation should not claim no qualified resources were available when a Teaching candidate exists."
);
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

const audienceRankingResult = selectEditorialCandidates([
  candidate({
    title: "Figma release notes for AI design-to-code metadata",
    url: "https://www.figma.com/release-notes/ai-design-to-code-metadata",
    source: "Figma Releases",
    snippet: "Release notes: AI design-to-code metadata, component generation, Dev Mode and Figma component library updates.",
    cleanSummary: "Release notes: AI design-to-code metadata, component generation, Dev Mode and Figma component library updates.",
    rawText: "Release notes changelog for Figma AI design-to-code metadata and component generation.",
    directDesignSystemEvidence: "Figma metadata and design-to-code evidence in title/snippet.",
    readerValue: 48,
    learningValue: 44,
    sourceCategory: "Official",
    rankingExplanation: "Official source. Reader value 48/100 and learning value 44/100 from release-note format.",
    worthYourTimeScore: 5
  }),
  candidate({
    title: "How Figma metadata changes AI design-to-code for Design System teams",
    url: "https://medium.com/design-systems/figma-metadata-ai-design-to-code-guide",
    source: "Medium Design Systems",
    snippet: "Guide with examples, workflow checklist and implementation guidance for Figma metadata, design-to-code, component generation and Design System governance.",
    cleanSummary:
      "Guide with examples, workflow checklist and implementation guidance for Figma metadata, design-to-code, component generation and Design System governance.",
    rawText:
      "A practical guide for designers with examples, workflow checklist and implementation guidance for Figma metadata, AI design-to-code and Design System governance.",
    directDesignSystemEvidence: "Figma metadata and design-to-code evidence in title/snippet.",
    readerValue: 94,
    learningValue: 96,
    sourceCategory: "Practical",
    rankingExplanation: "Practical source. Reader value 94/100 and learning value 96/100 from teaching cues.",
    worthYourTimeScore: 5
  })
]);

const audienceSelected = audienceRankingResult.selectedDecisions.find((decision) => decision.topicGroup === "Figma");
assert.ok(audienceSelected, "Audience-aware ranking fixture should select a Figma item.");
assert.equal(
  audienceSelected.url,
  "https://medium.com/design-systems/figma-metadata-ai-design-to-code-guide",
  "When evidence quality is similar, the resource that teaches Design System designers better should rank higher."
);
assert.equal(audienceSelected.sourceCategory, "Practical");
assert.ok(audienceSelected.readerValue >= 90, "Selected debug should expose readerValue.");
assert.ok(audienceSelected.learningValue >= 90, "Selected debug should expose learningValue.");
assert.match(audienceSelected.rankingExplanation, /Practical source.*Reader value/i);

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

const learningSelectionResult = selectEditorialCandidates([
  candidate({
    title: "Storybook release notes for AI MCP component metadata",
    url: "https://github.com/storybookjs/storybook/releases/tag/v10.5.0-alpha-learning",
    source: "Storybook Releases",
    snippet: "Release notes changelog for Storybook AI MCP component metadata, docgen and component manifests.",
    cleanSummary: "Release notes changelog for Storybook AI MCP component metadata, docgen and component manifests.",
    rawText: "Release notes changelog for Storybook AI MCP component metadata, docgen and component manifests.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet.",
    readerValue: 42,
    learningValue: 38,
    sourceCategory: "Official",
    rankingExplanation: "Official source. Release-note format is useful evidence but weak teaching."
  }),
  candidate({
    title: "How AI-ready component docs change Design System work",
    url: "https://medium.com/design-systems/ai-ready-component-docs-design-system-work",
    source: "Medium Design Systems",
    snippet:
      "Deep essay with examples and a practical walkthrough explaining how AI-ready component documentation, Storybook metadata and MCP change Design System workflows.",
    cleanSummary:
      "Deep essay with examples and a practical walkthrough explaining how AI-ready component documentation, Storybook metadata and MCP change Design System workflows.",
    rawText:
      "Deep essay with examples and a practical walkthrough explaining how AI-ready component documentation, Storybook metadata and MCP change Design System workflows.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet.",
    readerValue: 95,
    learningValue: 96,
    sourceCategory: "Practical",
    rankingExplanation: "Practical source. High reader and learning value from deep essay, examples and walkthrough."
  }),
  candidate({
    title: "Quick notes on Storybook MCP for component docs",
    url: "https://example.com/storybook-mcp-component-docs-notes",
    source: "Practitioner Blog",
    snippet:
      "Practical notes on Storybook MCP, component metadata, documentation automation and Design System workflow changes.",
    cleanSummary:
      "Practical notes on Storybook MCP, component metadata, documentation automation and Design System workflow changes.",
    rawText:
      "Practical notes on Storybook MCP, component metadata, documentation automation and Design System workflow changes.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet.",
    readerValue: 78,
    learningValue: 76,
    sourceCategory: "Practical",
    rankingExplanation: "Practical source. Useful but less explanatory than the deep essay."
  })
]);
const learningRecommendation = await selectLearningRecommendation({
  editorialBrief,
  thesis: evidenceReasoningResult.leadSignal,
  evidence: evidenceReasoningResult.leadSignal?.evidence ?? [],
  qualifiedResources: learningSelectionResult.qualifiedCandidates,
  selectionDecisions: learningSelectionResult.decisions
});

assert.ok(learningRecommendation.recommendation, "Learning Recommendation should select a teaching artifact when one exists.");
assert.equal(
  learningRecommendation.recommendation?.url,
  "https://medium.com/design-systems/ai-ready-component-docs-design-system-work",
  "Learning Recommendation should prefer the artifact that teaches the thesis over release notes."
);
assert.ok(learningRecommendation.whyItWon.length > 0, "Learning Recommendation debug should explain why the winner won.");
assert.ok(learningRecommendation.alternativesLost.length >= 1, "Learning Recommendation debug should explain why alternatives lost.");
assert.equal(learningRecommendation.nullConsidered, true, "Learning Recommendation should explicitly consider null.");

const nullLearningSelection = selectEditorialCandidates([
  candidate({
    title: "Storybook API reference for AI MCP component metadata",
    url: "https://storybook.js.org/docs/api/ai-mcp-component-metadata",
    source: "Storybook Documentation",
    snippet: "API reference documentation for Storybook AI MCP component metadata and component manifest options.",
    cleanSummary: "API reference documentation for Storybook AI MCP component metadata and component manifest options.",
    rawText: "API reference documentation for Storybook AI MCP component metadata and component manifest options.",
    directDesignSystemEvidence: "MCP and Storybook anchor evidence in title/snippet.",
    readerValue: 40,
    learningValue: 42,
    sourceCategory: "Official",
    rankingExplanation: "Official source. Reference documentation is useful evidence but weak teaching."
  })
]);
const nullLearningRecommendation = await selectLearningRecommendation({
  editorialBrief,
  thesis: evidenceReasoningResult.leadSignal,
  evidence: evidenceReasoningResult.leadSignal?.evidence ?? [],
  qualifiedResources: nullLearningSelection.qualifiedCandidates,
  selectionDecisions: nullLearningSelection.decisions
});

assert.equal(
  nullLearningRecommendation.recommendation,
  null,
  "Learning Recommendation should return null instead of downgrading to mediocre documentation."
);
assert.equal(nullLearningRecommendation.nullConsidered, true);
assert.ok(nullLearningRecommendation.nullReason.length > 0, "Null debug should explain why no teaching artifact won.");

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

// Role-conditional gate (PR-7): this Design Systems-only item is not an
// Evidence-format resource, so it no longer needs to mention AI to pass
// mission match. It still ends up rejected, but now on its actual editorial
// weakness (no concrete Monday-morning change) instead of a blanket AI veto.
const rejectedDsOnly = result.rejectedDecisions.find((decision) => decision.title.includes("Design System governance"));
assert.ok(rejectedDsOnly, "Expected Design Systems-only item to be rejected.");
assert.equal(rejectedDsOnly.editorialMissionMatch, true);
assert.equal(
  rejectedDsOnly.rejectionReason,
  "Skipped because the Monday Morning Test produced no concrete team change."
);

const rejectedAiOnly = result.rejectedDecisions.find((decision) => decision.title.includes("LLM benchmark"));
assert.ok(rejectedAiOnly, "Expected AI-only item to be rejected.");
assert.equal(rejectedAiOnly.editorialMissionMatch, false);
assert.match(rejectedAiOnly.missionReason, /direct impact on mature Design System work/i);

// "React" alone trips the topic classifier's loose Design System detection,
// so mission match now passes here too (role-conditional gate no longer
// requires AI). The item still stays rejected downstream because neither
// designSystemScore nor workflowScore clears the real Design System bar.
const rejectedFrontendOnly = result.rejectedDecisions.find((decision) => decision.title.includes("Frontend performance"));
assert.ok(rejectedFrontendOnly, "Expected frontend-only item to be rejected.");
assert.equal(rejectedFrontendOnly.editorialMissionMatch, true);
assert.equal(
  rejectedFrontendOnly.rejectionReason,
  "Skipped because no Design System or UI workflow connection was strong enough."
);

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

// PR-7: role-conditional qualification. Evidence-format resources (release
// notes, changelogs, RFCs, arXiv papers) must still prove the AI thesis
// directly. Teaching/Practice artifacts only need strong Design System
// relevance and need not mention AI themselves.
const roleConditionalResult = selectEditorialCandidates([
  candidate({
    title: "Design Token Governance and Accessibility Workflow for Enterprise Component Libraries",
    url: "https://example.com/design-token-governance-accessibility-workflow",
    source: "Design Systems Weekly",
    snippet:
      "A governance workflow for design tokens, accessibility and component library documentation across enterprise Design System teams.",
    cleanSummary:
      "A governance workflow for design tokens, accessibility and component library documentation across enterprise Design System teams.",
    directDesignSystemEvidence: "Design tokens, accessibility, component library and governance evidence in title/snippet."
  }),
  candidate({
    title: "Storybook 9.2 Release Notes",
    url: "https://storybook.js.org/releases/9.2",
    source: "Storybook Releases",
    snippet: "Release notes for Storybook 9.2 covering new component APIs, accessibility fixes and design tokens support.",
    cleanSummary: "Release notes for Storybook 9.2 covering new component APIs, accessibility fixes and design tokens support.",
    directDesignSystemEvidence: "Component API and design tokens evidence in title/snippet."
  })
]);

const teachingNoAi = roleConditionalResult.decisions.find((decision) => decision.title.includes("Design Token Governance"));
assert.ok(teachingNoAi, "Expected the Teaching/Practice candidate to be evaluated.");
assert.equal(
  teachingNoAi.editorialMissionMatch,
  true,
  "A DS-relevant Teaching/Practice artifact should qualify without mentioning AI."
);
assert.equal(teachingNoAi.rejectionReason, "", "Strong DS Teaching/Practice content should not be rejected for lacking AI text.");
assert.ok(
  roleConditionalResult.qualifiedCandidates.some((c) => c.title.includes("Design Token Governance")),
  "Expected the Teaching/Practice candidate to be qualified."
);

const releaseNoAi = roleConditionalResult.decisions.find((decision) => decision.title.includes("Storybook 9.2 Release Notes"));
assert.ok(releaseNoAi, "Expected the release-note candidate to be evaluated.");
assert.equal(
  releaseNoAi.editorialMissionMatch,
  false,
  "Evidence-format resources still require AI relevance to prove the thesis."
);
assert.match(releaseNoAi.missionReason, /not about AI or AI-powered tooling/i);

// PR-8: role-condition the actionability gate. Evidence/Practice must still
// clear the Monday Morning Test — they exist to prove a change happened or
// tell a team what to do about it. Teaching qualifies on editorial value and
// Design System relevance alone, even with zero actionability, because it
// changes how the reader thinks rather than what they do Monday morning.
const actionabilityConditionalResult = selectEditorialCandidates([
  candidate({
    title: "Design Token Semantics and Accessibility Foundations for Component Library Documentation",
    url: "https://example.com/design-token-semantics-accessibility-foundations",
    source: "Design Systems Weekly",
    snippet:
      "A foundational explainer on design tokens, accessibility and component library documentation semantics for Design System teams.",
    cleanSummary:
      "A foundational explainer on design tokens, accessibility and component library documentation semantics for Design System teams.",
    directDesignSystemEvidence: "Design tokens, accessibility and component library evidence in title/snippet.",
    sourceCategory: "Practical",
    readerValue: 85,
    learningValue: 90
  }),
  candidate({
    title: "Storybook 9.3 Release Notes",
    url: "https://storybook.js.org/releases/9.3",
    source: "Storybook Releases",
    snippet: "Release notes for Storybook 9.3: AI design tokens support for component library themes.",
    cleanSummary: "Release notes for Storybook 9.3: AI design tokens support for component library themes.",
    directDesignSystemEvidence: "Design tokens and component library evidence in title/snippet."
  })
]);

const teachingLowActionability = actionabilityConditionalResult.decisions.find((decision) =>
  decision.title.includes("Design Token Semantics")
);
assert.ok(teachingLowActionability, "Expected the Teaching candidate to be evaluated.");
assert.equal(teachingLowActionability.actionabilityScore, 0, "Fixture should genuinely have zero actionability signal.");
assert.equal(teachingLowActionability.mondayMorningChange, "nothing", "Fixture should genuinely fail the Monday Morning Test.");
assert.equal(
  teachingLowActionability.rejectionReason,
  "",
  "A Teaching artifact should qualify on editorial value and DS relevance even with zero actionability."
);
assert.ok(
  actionabilityConditionalResult.qualifiedCandidates.some((c) => c.title.includes("Design Token Semantics")),
  "Expected the Teaching candidate to be qualified."
);

const evidenceLowActionability = actionabilityConditionalResult.decisions.find((decision) =>
  decision.title.includes("Storybook 9.3 Release Notes")
);
assert.ok(evidenceLowActionability, "Expected the release-note candidate to be evaluated.");
assert.equal(evidenceLowActionability.actionabilityScore, 0, "Fixture should genuinely have zero actionability signal.");
assert.equal(
  evidenceLowActionability.rejectionReason,
  "Skipped because the Monday Morning Test produced no concrete team change.",
  "Evidence-format resources must still clear the Monday Morning Test."
);

console.log("Editorial selection test passed.");
