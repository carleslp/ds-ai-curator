import { cleanText, truncateText } from "./textUtils.js";
import { machineryTermsIn } from "./editorialContracts.js";
import type { CandidateSignal } from "./editorialThesis.js";
import type { LearningRecommendation } from "./learningRecommendation.js";

export type Resource = {
  title: string;
  original_title?: string;
  editorialTitle?: string;
  url: string;
  source: string;
  type: string;
  published_date?: string;
  date?: string;
  summary: string;
  cleanSummary?: string;
  design_system_angle?: string;
  why_it_matters_to_our_team?: string;
  why_selected?: string;
  expected_impact_on_workflow?: string;
  who_should_read?: string;
  estimated_reading_time?: string;
  ignore_risk?: string;
  impact_score?: number;
  affected_workflow_areas?: string[];
  directDesignSystemEvidence?: string;
  is_real_source?: boolean;
  relevance_score?: number;
  worth_your_time_score?: number;
  actionabilityScore?: number;
  // Set by candidateToResource() (digestService.ts) — true for a resource
  // built straight from a candidate with zero LLM involvement (PR-25). Its
  // why_it_matters_to_our_team/expected_impact_on_workflow/ignore_risk are
  // fixed deterministic strings with no real per-article content behind
  // them, so editorialWritingLayer.ts's sanitizeResource() skips attempting
  // to "regenerate" them — there is nothing to regenerate from, and the
  // attempt was landing back on the same generic text anyway.
  isDeterministicFallback?: boolean;
};

export type Digest = {
  date: string;
  trend_summary: string;
  theSignal: string;
  executiveBrief: string;
  editorsPick: Resource | null;
  supportingSignals: string[];
  thisWeeksSignals: string[];
  suggestedExperiment: string;
  teamDiscussionQuestions: string[];
  nextWeekWatchlist: string[];
  leadSignal?: CandidateSignal | null;
  learningRecommendation?: LearningRecommendation | null;
  resources: Resource[];
};

// Brand palette (PR-31 asset infra, PR-32 visual direction: light, single-column).
const COLOR_DARK = "#210D0C"; // headline / body text
const COLOR_ACCENT = "#F27F33"; // labels, links, CTA
const COLOR_MAROON = "#6E2D27"; // header gradient anchor only — no card fills in PR-32
const COLOR_MUTED = "#645655"; // metadata, italic captions, footer
const COLOR_BORDER = "#BCB6B6"; // thin dividers only — no panel fills in PR-32
const COLOR_WHITE = "#FFFFFF";

const FONTS_BASE_URL = "https://ds-ai-curator.vercel.app/fonts";

// Headlines, quotes, section labels.
const FONT_HEAD = "font-family:'Messapia',Georgia,'Times New Roman',serif;";
// Body copy, metadata, links, buttons — everything else.
const FONT_BODY = "font-family:'Source Sans 3',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;";
// Secondary/supporting lines (attribution, source/date, reading time) — italic, muted, small.
const FONT_CAPTION = `font-style:italic;color:${COLOR_MUTED};${FONT_BODY}`;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value: unknown): string {
  const url = String(value ?? "").trim();
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "#";
}

// Whitespace between sections — no card borders or background panels per PR-32.
function renderDivider(): string {
  return `<div style="border-top:1px solid ${COLOR_BORDER};margin:28px 0;font-size:0;line-height:0;">&nbsp;</div>`;
}

function renderSectionLabel(label: string): string {
  return `
                    <div style="font-size:10px;font-weight:700;color:${COLOR_ACCENT};letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;${FONT_HEAD}">
                      ${escapeHtml(label)}
                    </div>`;
}

function renderResourceItem(resource: Resource): string {
  const date = cleanText(resource.published_date || resource.date || "Recent");
  const displayTitle = cleanText(resource.editorialTitle || resource.title);
  // The model is prompted to target summary at 280, why_it_matters_to_our_team
  // at 220, and ignore_risk at 180 (this card's render budget), with a much
  // more generous RankedResourceSchema max as a backstop, not a render-time
  // cut — see the comment on RankedResourceSchema for why. So this only
  // normalizes whitespace/entities; it does not enforce the render budget.
  const summary = cleanText(resource.cleanSummary ?? resource.summary);
  const whyItMatters = resource.why_it_matters_to_our_team ? cleanText(resource.why_it_matters_to_our_team) : "";
  const ignoreRisk = resource.ignore_risk ? cleanText(resource.ignore_risk) : "";

  return `
<div style="margin-bottom:6px;font-size:11px;${FONT_CAPTION}">
  ${escapeHtml(cleanText(resource.type))} · ${escapeHtml(date)}
</div>
<div style="font-size:17px;font-weight:700;color:${COLOR_DARK};line-height:1.4;margin-bottom:8px;${FONT_HEAD}">
  <a href="${safeUrl(resource.url)}" style="color:${COLOR_DARK};text-decoration:none;">
    ${escapeHtml(displayTitle)}
  </a>
</div>
<div style="font-size:14px;color:${COLOR_DARK};line-height:1.7;margin-bottom:10px;${FONT_BODY}">
  ${escapeHtml(summary)}
</div>
${
  whyItMatters
    ? `<div style="font-size:12px;line-height:1.6;margin-bottom:8px;${FONT_CAPTION}">
  <span style="color:${COLOR_ACCENT};font-weight:700;font-style:normal;">Why it matters —</span> ${escapeHtml(whyItMatters)}
</div>`
    : ""
}
${
  ignoreRisk
    ? `<div style="font-size:12px;line-height:1.6;margin-bottom:8px;${FONT_CAPTION}">
  <span style="font-weight:700;font-style:normal;">If we ignore this —</span> ${escapeHtml(ignoreRisk)}
</div>`
    : ""
}
<div style="font-size:12px;${FONT_BODY}">
  <span style="color:${COLOR_MUTED};font-style:italic;">${escapeHtml(cleanText(resource.source))}</span>
  &nbsp;&nbsp;
  <a href="${safeUrl(resource.url)}" style="color:${COLOR_ACCENT};font-weight:700;text-decoration:none;">Read →</a>
</div>`;
}

function renderResourceList(resources: Resource[]): string {
  return resources
    .map(
      (resource, index) => `
                      <tr>
                        <td style="padding:${index === 0 ? "0" : "22px"} 0 0;">
                          ${index > 0 ? `<div style="border-top:1px solid ${COLOR_BORDER};margin-bottom:22px;font-size:0;line-height:0;">&nbsp;</div>` : ""}
                          ${renderResourceItem(resource)}
                        </td>
                      </tr>`
    )
    .join("");
}

function renderTheSignal(theSignal: string): string {
  const brief = cleanText(theSignal);
  if (!brief) return "";

  return `
                    ${renderSectionLabel("The Signal")}
                    <div style="font-size:15px;color:${COLOR_DARK};line-height:1.75;${FONT_BODY}">
                      ${escapeHtml(brief)}
                    </div>`;
}

function renderCurationMode(trendSummary: string): string {
  const summary = cleanText(trendSummary);
  if (!summary) return "";

  return `
                    ${renderSectionLabel("Curation Mode")}
                    <div style="font-size:14px;color:${COLOR_DARK};line-height:1.7;${FONT_BODY}">
                      ${escapeHtml(summary)}
                    </div>`;
}

function renderEditorsPick(editorsPick: Resource | null): string {
  if (!editorsPick) return "";

  const displayTitle = cleanText(editorsPick.editorialTitle || editorsPick.title);
  // Same fields as renderResourceItem, targeted at 280/220 — see the comment
  // there. This hero section has no CSS line-clamp, so it shows the same
  // text uncropped.
  const summary = cleanText(editorsPick.cleanSummary ?? editorsPick.summary);
  const whyItMatters = editorsPick.why_it_matters_to_our_team ? cleanText(editorsPick.why_it_matters_to_our_team) : "";
  const date = cleanText(editorsPick.published_date || editorsPick.date || "Recent");
  const detailRows = [
    ["Why this is evidence", editorsPick.why_selected],
    ["Expected impact on our workflow", editorsPick.expected_impact_on_workflow],
    ["Who should read it", editorsPick.who_should_read],
    ["Estimated reading time", editorsPick.estimated_reading_time]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return `
                    ${renderSectionLabel("Editor's Pick")}
                    <div style="margin-bottom:8px;font-size:11px;${FONT_CAPTION}">
                      ${escapeHtml(cleanText(editorsPick.type))} · ${escapeHtml(date)}
                    </div>
                    <div style="font-size:22px;font-weight:700;color:${COLOR_DARK};line-height:1.3;margin-bottom:12px;${FONT_HEAD}">
                      <a href="${safeUrl(editorsPick.url)}" style="color:${COLOR_DARK};text-decoration:none;">
                        ${escapeHtml(displayTitle)}
                      </a>
                    </div>
                    <div style="font-size:15px;color:${COLOR_DARK};line-height:1.75;margin-bottom:14px;${FONT_BODY}">
                      ${escapeHtml(summary)}
                    </div>
                    ${
                      whyItMatters
                        ? `<div style="font-size:13px;line-height:1.6;margin-bottom:14px;${FONT_CAPTION}">
                      <span style="color:${COLOR_ACCENT};font-weight:700;font-style:normal;">Why it matters —</span> ${escapeHtml(whyItMatters)}
                    </div>`
                        : ""
                    }
                    ${
                      detailRows.length > 0
                        ? detailRows
                            .map(
                              ([label, value]) => `
                    <div style="font-size:12px;line-height:1.7;margin-bottom:4px;${FONT_BODY}">
                      <span style="color:${COLOR_MUTED};font-weight:700;text-transform:uppercase;letter-spacing:0.03em;">${escapeHtml(label)}:</span>
                      <span style="color:${COLOR_DARK};">${escapeHtml(value)}</span>
                    </div>`
                            )
                            .join("")
                        : ""
                    }
                    <div style="font-size:12px;margin-top:10px;${FONT_CAPTION}">
                      ${escapeHtml(cleanText(editorsPick.source))}
                    </div>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center">
                          <a href="${safeUrl(editorsPick.url)}" style="display:block;width:220px;border-radius:25px;background-color:${COLOR_ACCENT};margin:24px auto 0;padding:10px 16px;color:${COLOR_WHITE};font-size:0.9em;letter-spacing:0.08em;text-align:center;text-transform:uppercase;text-decoration:none;font-weight:700;${FONT_BODY}">
                            Read the full story →
                          </a>
                        </td>
                      </tr>
                    </table>`;
}

// Hard invariant: no reader-facing string may expose the selection machinery.
// Template-generated copy used to bypass the section-contract validator; this
// holds it to the same term list and fails loudly rather than shipping a leak.
function assertNoReaderFacingMachinery(field: string, text: string): void {
  const leaked = machineryTermsIn(text);
  if (leaked.length > 0) {
    throw new Error(
      `Reader-facing machinery leak in Recommended Reading "${field}": ${leaked
        .map((term) => `"${term}"`)
        .join(", ")}. Reader copy must never expose selection mechanics. Offending text: ${text}`
    );
  }
}

function renderLearningRecommendation(recommendation: LearningRecommendation | null | undefined): string {
  if (!recommendation) return "";

  const title = cleanText(recommendation.title);
  const source = cleanText(recommendation.source);
  const minutes = `${recommendation.estimatedMinutes} min`;
  const whyRecommended = truncateText(recommendation.whyRecommended, 220);
  const readerGain = truncateText(recommendation.readerGain, 190);

  assertNoReaderFacingMachinery("whyRecommended", whyRecommended);
  assertNoReaderFacingMachinery("readerGain", readerGain);

  // An honest gap beats a mechanical sentence: if either justification could
  // not be written per-artifact from the body it is omitted, not templated
  // (readerGain used to be the same fixed sentence every issue — PR-20).
  const whyBlock = whyRecommended
    ? `
                    <div style="font-size:14px;color:${COLOR_DARK};line-height:1.7;margin-bottom:10px;${FONT_BODY}">
                      <strong style="color:${COLOR_ACCENT};">Why this is worth your time:</strong> ${escapeHtml(whyRecommended)}
                    </div>`
    : "";
  const readerGainBlock = readerGain
    ? `
                    <div style="font-size:14px;color:${COLOR_DARK};line-height:1.7;margin-bottom:12px;${FONT_BODY}">
                      <strong style="color:${COLOR_ACCENT};">Reader takeaway:</strong> ${escapeHtml(readerGain)}
                    </div>`
    : "";

  return `
                    ${renderSectionLabel("If you read one thing this week")}
                    <div style="margin-bottom:8px;font-size:11px;${FONT_CAPTION}">
                      ${escapeHtml(source)} · ${escapeHtml(minutes)}
                    </div>
                    <div style="font-size:18px;font-weight:700;color:${COLOR_DARK};line-height:1.35;margin-bottom:10px;${FONT_HEAD}">
                      <a href="${safeUrl(recommendation.url)}" style="color:${COLOR_DARK};text-decoration:none;">
                        ${escapeHtml(title)}
                      </a>
                    </div>
                    ${whyBlock}
                    ${readerGainBlock}
                    <a href="${safeUrl(recommendation.url)}" style="font-size:12px;color:${COLOR_ACCENT};font-weight:700;text-decoration:none;${FONT_BODY}">
                      Read →
                    </a>`;
}

function renderSupportingSignals(signals: string[]): string {
  const cleanSignals = signals.map((signal) => cleanText(signal)).filter(Boolean).slice(0, 3);
  if (cleanSignals.length === 0) return "";

  return `
                    ${renderSectionLabel("Supporting Signals")}
                    ${cleanSignals
                      .map(
                        (signal, index) => `
                    <div style="font-size:14px;color:${COLOR_DARK};line-height:1.65;margin-bottom:${index === cleanSignals.length - 1 ? "0" : "10px"};${FONT_BODY}">
                      <span style="color:${COLOR_ACCENT};">—</span> ${escapeHtml(signal)}
                    </div>`
                      )
                      .join("")}`;
}

function renderResourcesSection(resources: Resource[], resourceLabel: string): string {
  if (resources.length === 0) return "";

  return `
                    ${renderSectionLabel(`${resourceLabel} · supporting resources`)}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${renderResourceList(resources)}
                    </table>`;
}

function renderSuggestedExperiment(suggestedExperiment: string): string {
  const experiment = cleanText(suggestedExperiment);
  if (!experiment) return "";

  return `
                    ${renderSectionLabel("Suggested Experiment")}
                    <div style="font-size:14px;color:${COLOR_DARK};line-height:1.7;${FONT_BODY}">
                      ${escapeHtml(experiment)}
                    </div>`;
}

function renderTeamQuestions(teamDiscussionQuestions: string[]): string {
  const questions = teamDiscussionQuestions.map((question) => cleanText(question)).filter(Boolean).slice(0, 3);
  if (questions.length === 0) return "";

  return `
                    ${renderSectionLabel("Questions for our Team")}
                    ${questions
                      .map(
                        (question, index) => `
                    <div style="font-size:14px;color:${COLOR_DARK};line-height:1.65;margin-bottom:${index === questions.length - 1 ? "0" : "10px"};${FONT_BODY}">
                      <span style="color:${COLOR_ACCENT};">—</span> ${escapeHtml(question)}
                    </div>`
                      )
                      .join("")}`;
}

function renderNextWeekWatchlist(nextWeekWatchlist: string[]): string {
  const items = nextWeekWatchlist.map((item) => cleanText(item)).filter(Boolean).slice(0, 3);
  if (items.length === 0) return "";

  return `
                    ${renderSectionLabel("Next Week Watchlist")}
                    ${items
                      .map(
                        (item, index) => `
                    <div style="font-size:14px;color:${COLOR_DARK};line-height:1.65;margin-bottom:${index === items.length - 1 ? "0" : "10px"};${FONT_BODY}">
                      <span style="color:${COLOR_ACCENT};">—</span> ${escapeHtml(item)}
                    </div>`
                      )
                      .join("")}`;
}

export function renderEmail(digest: Digest): string {
  const resources = digest.resources.slice(0, 5);
  const resourceCount = digest.resources.length;
  const resourceLabel = `${resourceCount} ${resourceCount === 1 ? "resource" : "resources"}`;

  const sections = [
    renderCurationMode(digest.trend_summary),
    renderTheSignal(digest.theSignal || digest.executiveBrief),
    renderEditorsPick(digest.editorsPick),
    renderLearningRecommendation(digest.learningRecommendation),
    renderSupportingSignals(digest.supportingSignals ?? digest.thisWeeksSignals),
    renderResourcesSection(resources, resourceLabel),
    renderSuggestedExperiment(digest.suggestedExperiment),
    renderTeamQuestions(digest.teamDiscussionQuestions),
    renderNextWeekWatchlist(digest.nextWeekWatchlist ?? [])
  ].filter(Boolean);

  const sectionsHtml = sections.join(renderDivider());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DS × AI Curator</title>
  <style>
    @font-face {
      font-family: 'Messapia';
      src: url('${FONTS_BASE_URL}/Messapia-Regular.woff2') format('woff2'),
           url('${FONTS_BASE_URL}/Messapia-Regular.woff') format('woff');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Messapia';
      src: url('${FONTS_BASE_URL}/Messapia-Bold.woff2') format('woff2'),
           url('${FONTS_BASE_URL}/Messapia-Bold.woff') format('woff');
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: 'Source Sans 3';
      src: url('${FONTS_BASE_URL}/SourceSans3-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Source Sans 3';
      src: url('${FONTS_BASE_URL}/SourceSans3-SemiBold.woff2') format('woff2');
      font-weight: 600;
      font-style: normal;
    }
    @font-face {
      font-family: 'Source Sans 3';
      src: url('${FONTS_BASE_URL}/SourceSans3-Bold.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
    }
  </style>
</head>
<body style="margin:0;padding:24px 16px;background:${COLOR_WHITE};${FONT_BODY}">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">

        <table class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <tr>
            <td>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR_MAROON};background-image:linear-gradient(0deg, rgba(242, 127, 51, 0.80) 0%, rgba(242, 127, 51, 0.60) 0.01%, ${COLOR_MAROON} 68.75%);border-radius:18px 18px 0 0;">
                <tr>
                  <td align="center" style="padding:40px 40px 32px;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;min-width:40px;line-height:40px;background:${COLOR_WHITE};border-radius:12px;text-align:center;vertical-align:middle;font-size:18px;mso-line-height-rule:exactly;">
                          <span style="display:inline-block;line-height:40px;mso-line-height-rule:exactly;">⚡</span>
                        </td>
                        <td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>
                        <td valign="middle" style="font-size:22px;line-height:40px;font-weight:700;color:${COLOR_WHITE};vertical-align:middle;mso-line-height-rule:exactly;${FONT_HEAD}">
                          <span style="line-height:40px;mso-line-height-rule:exactly;">DS × AI Curator</span>
                        </td>
                      </tr>
                    </table>
                    <div style="font-size:11px;color:${COLOR_WHITE};font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-top:10px;${FONT_BODY}">
                      Design Systems · Artificial Intelligence
                    </div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:6px;${FONT_BODY}">
                      ${escapeHtml(digest.date)}
                    </div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR_WHITE};">
                <tr>
                  <td class="email-padding" style="padding:40px;">
                    ${sectionsHtml}
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR_WHITE};border-top:1px solid ${COLOR_BORDER};border-radius:0 0 18px 18px;">
                <tr>
                  <td style="padding:24px 40px 8px;text-align:center;font-size:11px;color:${COLOR_MUTED};line-height:1.6;${FONT_BODY}">
                    Curated by <strong style="color:${COLOR_DARK};">DS × AI Curator</strong> — Built for better system thinking
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px 32px;text-align:center;font-size:11px;${FONT_BODY}">
                    <a href="#linkedin-placeholder" style="color:${COLOR_MUTED};text-decoration:underline;">LinkedIn</a>
                    <span style="color:${COLOR_BORDER};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
                    <a href="#portfolio-placeholder" style="color:${COLOR_MUTED};text-decoration:underline;">Portfolio</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
