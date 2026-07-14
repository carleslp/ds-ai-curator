import assert from "node:assert/strict";
import { scrapingArtifactReason } from "./collectCandidates.js";

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

console.log("Collect candidates test passed.");
