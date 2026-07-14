import assert from "node:assert/strict";
import { scrapingArtifactReason, titleFromCardHtml } from "./collectCandidates.js";

// PR-10: reject scraping artifacts (nav/breadcrumb fragments from HTML doc
// pages) before they become candidates, using structural signals rather than
// a topic keyword blocklist.

// Real examples from a live run — all scraped from Storybook Documentation /
// Figma AI (kind: "html") via parseHtmlItems, which treats every <a> tag on
// a docs page as if it were an article.
const droppedExamples = [
  "Visual Test. .",
  "Enterprise. .",
  ". . Docs. . . Storybook can analyze your components to automatically create documentation alongside your stories. This automatic documentation makes it easier for you to create UI library usage guidelines, design system sites, and more..",
  "Design systems"
];

for (const title of droppedExamples) {
  const reason = scrapingArtifactReason(title);
  assert.ok(reason.length > 0, `Expected "${title}" to be dropped as a scraping artifact, but it was accepted.`);
}

// Borderline cases: legitimate short real article titles must survive.
// "Design Tokens" is nearly identical in shape/length to the rejected bare
// "Design systems" fragment above — the discriminator is that it isn't a
// site-chrome label, not its length.
const retainedExamples = ["Design Tokens", "Accessibility Automation", "Figma Code Connect"];

for (const title of retainedExamples) {
  const reason = scrapingArtifactReason(title);
  assert.equal(reason, "", `Expected "${title}" to be retained as a plausible article title, but it was dropped: ${reason}`);
}

// A bare bona fide sentence-ending title should not be penalized just for
// having a period.
assert.equal(
  scrapingArtifactReason("Why Design Systems Need AI-Ready Documentation."),
  "",
  "A single trailing period on an otherwise normal title should not trigger the stray-punctuation check."
);

// PR-11: extract the real headline from HTML cards instead of feeding the
// whole card through stripHtmlTags. Fixtures below reproduce the actual
// markup shapes found live on react.dev, anthropic.com, vercel.com, and
// crewai.com (verified 2026-07-14).

// react.dev/blog: <h2> headline, sibling date + <p> summary + "Read more".
const reactCard =
  '<div class="justify-between"><div class="flex flex-row"><h2 class="font-semibold">React Compiler v1.0</h2></div>' +
  '<div><div class="flex flex-row">October 7, 2025</div><span><p>We’re releasing the compiler’s first stable release today.</p></span>' +
  '<div class="text-link">Read more</div></div></div>';
assert.equal(
  titleFromCardHtml(reactCard),
  "React Compiler v1.0",
  "Should extract the <h2> headline instead of the whole card."
);

// anthropic.com/news: headline is an <h4>, not <h1>-<h3>.
const anthropicCard =
  '<div class="meta"><span class="caption bold">Product</span><time class="date">Jun 30, 2026</time></div>' +
  '<h4 class="headline-6">Introducing Claude Sonnet 5</h4>' +
  '<p class="body-3">Sonnet 5 delivers frontier performance across coding, agents, and professional work at scale.</p>';
assert.equal(
  titleFromCardHtml(anthropicCard),
  "Introducing Claude Sonnet 5",
  "Should extract the <h4> headline — not every site uses <h1>-<h3> for card titles."
);

// vercel.com/blog: category label + <h3> headline + summary, all as siblings.
const vercelCard =
  '<div>30 June General</div><h3>Run any Dockerfile on Vercel</h3>' +
  '<p>Vercel now runs any HTTP server straight from a Dockerfile.</p>';
assert.equal(
  titleFromCardHtml(vercelCard),
  "Run any Dockerfile on Vercel",
  "Should extract the <h3> headline instead of the category label + summary run-on."
);

// crewai.com/blog: byline/date prefix before the headline, no wrapping div.
const crewaiCard = "Crew AI Enterprise . <h2>Stop giving your agents database credentials</h2> . João (Joe) Moura | June 22, 2026.";
assert.equal(
  titleFromCardHtml(crewaiCard),
  "Stop giving your agents database credentials",
  "Should extract the heading even when byline text sits outside it in the same card."
);

// Regression: a card with NO heading element must parse EXACTLY as before —
// falls through to the original whole-block stripTags behavior unchanged.
// Real fixture from react.dev/blog: a version-number link with no wrapping
// tags at all, just an SSR comment placeholder between the text nodes.
const noHeadingCard = "v<!-- -->19.2";
assert.equal(
  titleFromCardHtml(noHeadingCard),
  "v 19.2",
  "A card with no heading element should be unaffected by PR-11 and parse exactly as before."
);

console.log("Collect candidates test passed.");
