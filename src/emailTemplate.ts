import { cleanText, truncateText } from "./textUtils.js";

export type Resource = {
  title: string;
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
  resources: Resource[];
};

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

function renderResourceCard(resource: Resource): string {
  const date = cleanText(resource.published_date || resource.date || "Recent");
  const summary = truncateText(resource.cleanSummary ?? resource.summary, 280);
  const whyItMatters = resource.why_it_matters_to_our_team
    ? truncateText(resource.why_it_matters_to_our_team, 220)
    : "";
  const ignoreRisk = resource.ignore_risk ? truncateText(resource.ignore_risk, 180) : "";
  const affectedAreas = resource.affected_workflow_areas?.length ? resource.affected_workflow_areas.join(", ") : "";
  const impactScore = resource.impact_score ? `${resource.impact_score}/5` : "";

  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #ede9f3;border-radius:14px;">
  <tr>
    <td style="padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
        <tr>
          <td>
            <span style="font-size:9px;font-weight:800;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:#ede9fe;color:#6d28d9;">
              ${escapeHtml(cleanText(resource.type))}
            </span>
          </td>
          <td style="text-align:right;font-size:10px;color:#9ca3af;white-space:nowrap;">
            ${escapeHtml(date)}
          </td>
        </tr>
      </table>

      <div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:6px;line-height:1.35;">
        <a href="${safeUrl(resource.url)}" style="color:#111827;text-decoration:none;">
          ${escapeHtml(cleanText(resource.title))}
        </a>
      </div>

      <div style="font-size:13px;color:#4b5563;line-height:1.65;margin-bottom:10px;">
        ${escapeHtml(summary)}
      </div>

      ${
        whyItMatters
          ? `<div style="font-size:12px;color:#312e81;line-height:1.55;margin-bottom:12px;padding:10px 12px;background:#f5f3ff;border-left:3px solid #8b5cf6;border-radius:8px;">
        <strong style="color:#5b21b6;">Why it matters:</strong> ${escapeHtml(whyItMatters)}
      </div>`
          : ""
      }

      ${
        impactScore || affectedAreas
          ? `<div style="font-size:11px;color:#4b5563;line-height:1.55;margin-bottom:10px;padding:9px 11px;background:#fafafa;border:1px solid #f3f4f6;border-radius:8px;">
        <strong style="color:#111827;">Impact on our team:</strong> ${escapeHtml(impactScore)}${impactScore && affectedAreas ? " · " : ""}${escapeHtml(affectedAreas)}
      </div>`
          : ""
      }

      ${
        ignoreRisk
          ? `<div style="font-size:11px;color:#6b21a8;line-height:1.55;margin-bottom:12px;">
        <strong>If we ignore this:</strong> ${escapeHtml(ignoreRisk)}
      </div>`
          : ""
      }

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:11px;color:#9ca3af;font-style:italic;">
            ${escapeHtml(cleanText(resource.source))}
          </td>
          <td style="text-align:right;">
            <a href="${safeUrl(resource.url)}" style="font-size:11px;color:#7c3aed;font-weight:800;text-decoration:none;">
              Read →
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function renderResourceGrid(resources: Resource[]): string {
  const rows: string[] = [];

  for (let index = 0; index < resources.length; index += 2) {
    const left = resources[index];
    const right = resources[index + 1];

    rows.push(`
                      <tr>
                        <td class="resource-column" width="50%" valign="top" style="width:50%;padding:0 10px 20px 0;">
                          ${renderResourceCard(left)}
                        </td>
                        <td class="resource-column" width="50%" valign="top" style="width:50%;padding:0 0 20px 10px;">
                          ${right ? renderResourceCard(right) : ""}
                        </td>
                      </tr>`);
  }

  return rows.join("");
}

function renderSectionLabel(label: string): string {
  return `
                    <div style="font-size:9px;font-weight:900;color:#7c3aed;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:14px;padding-bottom:9px;border-bottom:1px solid #f3f4f6;">
                      ${escapeHtml(label)}
                    </div>`;
}

function renderTheSignal(theSignal: string): string {
  const brief = cleanText(theSignal);
  if (!brief) return "";

  return `
                    ${renderSectionLabel("The Signal")}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
                      <tr>
                        <td style="padding:20px;background:#fbfaff;border:1px solid #ede9fe;border-radius:14px;">
                          <div style="font-size:14px;color:#374151;line-height:1.7;">
                            ${escapeHtml(brief)}
                          </div>
                        </td>
                      </tr>
                    </table>
`;
}

function renderEditorsPick(editorsPick: Resource | null): string {
  if (!editorsPick) return "";

  const summary = truncateText(editorsPick.cleanSummary ?? editorsPick.summary, 220);
  const whyItMatters = editorsPick.why_it_matters_to_our_team
    ? truncateText(editorsPick.why_it_matters_to_our_team, 180)
    : "";
  const date = cleanText(editorsPick.published_date || editorsPick.date || "Recent");
  const detailRows = [
    ["Why this was selected", editorsPick.why_selected],
    ["Expected impact on our workflow", editorsPick.expected_impact_on_workflow],
    ["Who should read it", editorsPick.who_should_read],
    ["Estimated reading time", editorsPick.estimated_reading_time]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return `
                    ${renderSectionLabel("Editor's Pick")}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;background:#2d1054;border-radius:16px;">
                      <tr>
                        <td style="padding:22px;border-left:4px solid #a78bfa;border-radius:16px;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                            <tr>
                              <td>
                                <span style="font-size:9px;font-weight:800;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:#ede9fe;color:#6d28d9;">
                                  ${escapeHtml(cleanText(editorsPick.type))}
                                </span>
                              </td>
                              <td style="text-align:right;font-size:10px;color:#c4b5fd;white-space:nowrap;">
                                ${escapeHtml(date)}
                              </td>
                            </tr>
                          </table>
                          <div style="font-size:18px;font-weight:900;line-height:1.35;margin-bottom:8px;">
                            <a href="${safeUrl(editorsPick.url)}" style="color:#ffffff;text-decoration:none;">
                              ${escapeHtml(cleanText(editorsPick.title))}
                            </a>
                          </div>
                          <div style="font-size:13px;color:#ddd6fe;line-height:1.65;margin-bottom:10px;">
                            ${escapeHtml(summary)}
                          </div>
                          ${
                            whyItMatters
                              ? `<div style="font-size:12px;color:#f5f3ff;line-height:1.55;margin-bottom:12px;padding:10px 12px;background:#3b1a68;border-left:3px solid #c4b5fd;border-radius:8px;">
                            <strong style="color:#ffffff;">Why it matters:</strong> ${escapeHtml(whyItMatters)}
                          </div>`
                              : ""
                          }
                          ${
                            detailRows.length > 0
                              ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                            ${detailRows
                              .map(
                                ([label, value]) => `
                            <tr>
                              <td style="padding:5px 0;font-size:11px;color:#c4b5fd;font-weight:800;width:38%;vertical-align:top;">
                                ${escapeHtml(label)}
                              </td>
                              <td style="padding:5px 0;font-size:11px;color:#f5f3ff;line-height:1.5;vertical-align:top;">
                                ${escapeHtml(value)}
                              </td>
                            </tr>`
                              )
                              .join("")}
                          </table>`
                              : ""
                          }
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="font-size:11px;color:#c4b5fd;font-style:italic;">
                                ${escapeHtml(cleanText(editorsPick.source))}
                              </td>
                              <td style="text-align:right;">
                                <a href="${safeUrl(editorsPick.url)}" style="font-size:11px;color:#ffffff;font-weight:800;text-decoration:none;">
                                  Read →
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>`;
}

function renderSupportingSignals(signals: string[]): string {
  const cleanSignals = signals.map((signal) => cleanText(signal)).filter(Boolean).slice(0, 3);
  if (cleanSignals.length === 0) return "";

  return `
                    ${renderSectionLabel("Supporting Signals")}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                      <tr>
                        ${cleanSignals
                          .map(
                            (signal, index) => `
                        <td class="resource-column" width="33.33%" valign="top" style="width:33.33%;padding:${index === 0 ? "0 10px 0 0" : index === cleanSignals.length - 1 ? "0 0 0 10px" : "0 10px"};">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbfaff;border:1px solid #ede9fe;border-radius:12px;">
                            <tr>
                              <td style="padding:14px;font-size:12px;color:#374151;line-height:1.55;">
                                ${escapeHtml(signal)}
                              </td>
                            </tr>
                          </table>
                        </td>`
                          )
                          .join("")}
                      </tr>
                    </table>`;
}

function renderResourcesSection(resources: Resource[], resourceLabel: string): string {
  if (resources.length === 0) return "";

  return `
                    ${renderSectionLabel(`${resourceLabel} · supporting resources`)}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                      ${renderResourceGrid(resources)}
                    </table>`;
}

function renderSuggestedExperiment(suggestedExperiment: string): string {
  const experiment = cleanText(suggestedExperiment);
  if (!experiment) return "";

  return `
                    ${renderSectionLabel("Suggested Experiment")}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
                      <tr>
                        <td style="padding:18px;background:#ffffff;border:1px solid #ede9f3;border-radius:14px;">
                          <div style="font-size:13px;color:#374151;line-height:1.65;">
                            ${escapeHtml(experiment)}
                          </div>
                        </td>
                      </tr>
                    </table>`;
}

function renderTeamQuestions(teamDiscussionQuestions: string[]): string {
  const questions = teamDiscussionQuestions.map((question) => cleanText(question)).filter(Boolean).slice(0, 3);
  if (questions.length === 0) return "";

  return `
                    ${renderSectionLabel("Questions for our Team")}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="padding:18px;background:#f9fafb;border:1px solid #f3f4f6;border-radius:14px;">
                          ${questions
                            .map(
                              (question) => `
                          <div style="font-size:13px;color:#374151;line-height:1.6;margin-bottom:8px;">
                            ${escapeHtml(question)}
                          </div>`
                            )
                            .join("")}
                        </td>
                      </tr>
                    </table>`;
}

function renderNextWeekWatchlist(nextWeekWatchlist: string[]): string {
  const items = nextWeekWatchlist.map((item) => cleanText(item)).filter(Boolean).slice(0, 3);
  if (items.length === 0) return "";

  return `
                    ${renderSectionLabel("Next Week Watchlist")}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="padding:18px;background:#fbfaff;border:1px solid #ede9fe;border-radius:14px;">
                          ${items
                            .map(
                              (item) => `
                          <div style="font-size:13px;color:#374151;line-height:1.6;margin-bottom:8px;">
                            ${escapeHtml(item)}
                          </div>`
                            )
                            .join("")}
                        </td>
                      </tr>
                    </table>`;
}

export function renderEmail(digest: Digest): string {
  const resources = digest.resources.slice(0, 5);
  const resourceCount = digest.resources.length;
  const resourceLabel = `${resourceCount} ${resourceCount === 1 ? "resource" : "resources"}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DS × AI Curator</title>
</head>
<body style="margin:0;padding:24px 16px;background:#F0EEF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">

        <table class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:1200px;">
          <tr>
            <td>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a0533;border-radius:18px 18px 0 0;">
                <tr>
                  <td class="email-padding" style="padding:30px 40px 22px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;min-width:40px;line-height:40px;background:#7c3aed;border-radius:12px;text-align:center;vertical-align:middle;font-size:18px;color:#ffffff;mso-line-height-rule:exactly;">
                                <span style="display:inline-block;line-height:40px;mso-line-height-rule:exactly;">⚡</span>
                              </td>
                              <td width="16" style="width:16px;font-size:0;line-height:0;">&nbsp;</td>
                              <td height="40" valign="middle" style="height:40px;font-size:21px;line-height:40px;font-weight:900;color:#ffffff;vertical-align:middle;mso-line-height-rule:exactly;">
                                <span style="line-height:40px;mso-line-height-rule:exactly;">DS × AI Curator</span>
                              </td>
                            </tr>
                          </table>
                          <div style="font-size:11px;color:#a78bfa;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-top:9px;padding-left:56px;">
                            Design Systems · Artificial Intelligence
                          </div>
                        </td>
                        <td style="text-align:right;vertical-align:top;font-size:12px;color:#c4b5fd;font-weight:600;white-space:nowrap;">
                          ${escapeHtml(digest.date)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2d1054;border-left:4px solid #7c3aed;">
                <tr>
                  <td class="email-padding" style="padding:17px 40px;">
                    <div style="font-size:9px;font-weight:900;color:#c4b5fd;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:7px;">
                      Curation Mode
                    </div>
                    <div style="font-size:13px;color:#ddd6fe;line-height:1.65;">
                      ${escapeHtml(cleanText(digest.trend_summary))}
                    </div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
                <tr>
                  <td class="email-padding" style="padding:30px 40px;">
                    ${renderTheSignal(digest.theSignal || digest.executiveBrief)}
                    ${renderEditorsPick(digest.editorsPick)}
                    ${renderSupportingSignals(digest.supportingSignals ?? digest.thisWeeksSignals)}
                    ${renderResourcesSection(resources, resourceLabel)}
                    ${renderSuggestedExperiment(digest.suggestedExperiment)}
                    ${renderTeamQuestions(digest.teamDiscussionQuestions)}
                    ${renderNextWeekWatchlist(digest.nextWeekWatchlist ?? [])}
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 18px 18px;">
                <tr>
                  <td class="email-padding" style="padding:20px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:11px;color:#9ca3af;">
                          Curated by <strong style="color:#6b7280;">DS × AI Curator</strong>
                        </td>
                        <td style="text-align:right;font-size:11px;color:#7c3aed;font-weight:700;">
                          Built for better system thinking
                        </td>
                      </tr>
                    </table>
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
