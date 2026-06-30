import assert from "node:assert/strict";
import { collectCandidatesWithDiagnostics } from "./collectCandidates.js";
import { withEditorialSections } from "./editorial.js";
import { renderEmail } from "./emailTemplate.js";

const releaseHtml = `
<h2>What's Changed</h2>
<ul>
  <li><a data-hovercard-type="pull_request" href="https://github.com/storybookjs/storybook/pull/123">#123</a> Add Storybook AI docs for MCP component testing.</li>
  <li>Dependency bump by @dependabot in pull request metadata.</li>
  <li>Fix unrelated build scripts.</li>
</ul>
`;

globalThis.fetch = async (input: string | URL | Request) => {
  const sourceUrl = String(input);
  const body = `<?xml version="1.0"?>
<feed>
  <entry>
    <title>v10.5.0-alpha.7</title>
    <link rel="alternate" href="${sourceUrl}/release/v10.5.0-alpha.7" />
    <updated>2026-06-25T10:00:00Z</updated>
    <content type="html"><![CDATA[${releaseHtml}]]></content>
  </entry>
</feed>`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/atom+xml" }
  });
};

const { candidates } = await collectCandidatesWithDiagnostics();
const storybookRelease = candidates.find((candidate) => candidate.source === "Storybook Releases");

assert.ok(storybookRelease, "Expected Storybook release candidate.");
assert.equal(storybookRelease.title, "Storybook release: v10.5.0-alpha.7");
assert.ok(storybookRelease.cleanSummary.length <= 280, "Expected clean summary to be limited to 280 chars.");
assert.match(storybookRelease.cleanSummary, /Storybook AI docs for MCP component testing/i);
assert.doesNotMatch(storybookRelease.cleanSummary, /<h2|<ul|<li|data-hovercard|pull request metadata/i);

const html = renderEmail(withEditorialSections({
  date: "2026-06-25",
  trend_summary: "Testing release sanitization.",
  resources: [
    {
      title: storybookRelease.title,
      url: storybookRelease.url,
      source: storybookRelease.source,
      type: "Article",
      published_date: storybookRelease.published_date,
      summary: releaseHtml,
      cleanSummary: storybookRelease.cleanSummary,
      why_it_matters_to_our_team:
        "This deliberately long explanation should be cleaned and shortened because the email card should stay readable for Design System teams reviewing release notes.",
      directDesignSystemEvidence: storybookRelease.directDesignSystemEvidence
    }
  ]
}));

assert.match(html, /Storybook release: v10\.5\.0-alpha\.7/);
assert.match(html, /Storybook AI docs for MCP component testing/i);
assert.doesNotMatch(html, /&lt;h2|&lt;ul|&lt;li|data-hovercard|pull request metadata/i);
assert.ok(
  html.indexOf("The Signal") < html.indexOf("Editor&#039;s Pick") &&
    html.indexOf("Editor&#039;s Pick") < html.indexOf("Supporting Signals") &&
    html.indexOf("Supporting Signals") < html.indexOf("1 resource · supporting resources") &&
    html.indexOf("1 resource · supporting resources") < html.indexOf("Suggested Experiment") &&
    html.indexOf("Suggested Experiment") < html.indexOf("Questions for our Team") &&
    html.indexOf("Questions for our Team") < html.indexOf("Next Week Watchlist"),
  "Expected v4 editorial sections to render in the requested order."
);

const htmlWithLearningRecommendation = renderEmail({
  ...withEditorialSections({
    date: "2026-06-25",
    trend_summary: "Testing learning recommendation.",
    resources: []
  }),
  learningRecommendation: {
    title: "How AI-ready component docs change Design System work",
    url: "https://medium.com/design-systems/ai-ready-component-docs-design-system-work",
    author: "Medium Design Systems",
    source: "Medium Design Systems",
    format: "Essay",
    estimatedMinutes: 12,
    readerGain: "A clearer mental model for how the shift changes Design System practice.",
    whyRecommended: "It teaches the thesis instead of merely proving that it is true.",
    confidence: 0.86,
    relationshipToThesis: "Explains why AI-ready component docs matter."
  }
});

assert.ok(
  htmlWithLearningRecommendation.indexOf("Editor&#039;s Pick") <
    htmlWithLearningRecommendation.indexOf("If you read one thing this week") &&
    htmlWithLearningRecommendation.indexOf("If you read one thing this week") <
      htmlWithLearningRecommendation.indexOf("Supporting Signals"),
  "Expected Learning Recommendation to render after Editor's Pick and before Supporting Signals."
);
assert.match(htmlWithLearningRecommendation, /Why this is worth your time/i);
assert.match(htmlWithLearningRecommendation, /Reader takeaway/i);

const htmlWithoutOptionalSections = renderEmail({
  date: "2026-06-25",
  trend_summary: "Testing optional editorial sections.",
  theSignal: "Brief only.",
  executiveBrief: "Brief only.",
  editorsPick: null,
  supportingSignals: [],
  thisWeeksSignals: [],
  suggestedExperiment: "",
  teamDiscussionQuestions: [],
  nextWeekWatchlist: [],
  resources: []
});

assert.doesNotMatch(htmlWithoutOptionalSections, /Editor&#039;s Pick|If you read one thing this week|Suggested Experiment|Questions for our Team|Next Week Watchlist/);

console.log("Email sanitization test passed.");

globalThis.fetch = async (input: string | URL | Request) => {
  const sourceUrl = String(input);
  const body = `<?xml version="1.0"?>
<feed>
  <entry>
    <title>v10.5.0-alpha.8</title>
    <link rel="alternate" href="${sourceUrl}/release/v10.5.0-alpha.8" />
    <updated>2026-06-25T11:00:00Z</updated>
    <content type="html"><![CDATA[
      <h2>What's Changed</h2>
      <ul>
        <li>Dependency bump by @dependabot.</li>
        <li>Fix unrelated build scripts.</li>
      </ul>
    ]]></content>
  </entry>
</feed>`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/atom+xml" }
  });
};

const irrelevantResult = await collectCandidatesWithDiagnostics();
const irrelevantStorybookRelease = irrelevantResult.candidates.find(
  (candidate) => candidate.source === "Storybook Releases"
);

assert.equal(
  irrelevantStorybookRelease,
  undefined,
  "Expected irrelevant GitHub release to be rejected before candidate selection."
);

console.log("Irrelevant GitHub release rejection test passed.");
