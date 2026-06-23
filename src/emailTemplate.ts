export type Resource = {
  title: string;
  url: string;
  source: string;
  type: string;
  published_date?: string;
  date?: string;
  summary: string;
};

export type Digest = {
  date: string;
  trend_summary: string;
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
  const date = resource.published_date || resource.date || "Recent";

  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #ede9f3;border-radius:14px;">
  <tr>
    <td style="padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
        <tr>
          <td>
            <span style="font-size:9px;font-weight:800;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:#ede9fe;color:#6d28d9;">
              ${escapeHtml(resource.type)}
            </span>
          </td>
          <td style="text-align:right;font-size:10px;color:#9ca3af;white-space:nowrap;">
            ${escapeHtml(date)}
          </td>
        </tr>
      </table>

      <div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:6px;line-height:1.35;">
        <a href="${safeUrl(resource.url)}" style="color:#111827;text-decoration:none;">
          ${escapeHtml(resource.title)}
        </a>
      </div>

      <div style="font-size:13px;color:#4b5563;line-height:1.65;margin-bottom:10px;">
        ${escapeHtml(resource.summary)}
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:11px;color:#9ca3af;font-style:italic;">
            ${escapeHtml(resource.source)}
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

export function renderEmail(digest: Digest): string {
  const resources = digest.resources.slice(0, 5);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DS × AI Curator</title>
  <style>
    @media only screen and (max-width: 700px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }

      .email-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }

      .resource-column {
        display: block !important;
        width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
    }
  </style>
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
                              <td style="width:40px;height:40px;background:#7c3aed;border-radius:12px;text-align:center;vertical-align:middle;font-size:18px;color:#ffffff;">
                                ⚡
                              </td>
                              <td style="width:16px;"></td>
                              <td style="font-size:21px;font-weight:900;color:#ffffff;vertical-align:middle;">
                                DS × AI Curator
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
                      Trends today
                    </div>
                    <div style="font-size:13px;color:#ddd6fe;line-height:1.65;">
                      ${escapeHtml(digest.trend_summary)}
                    </div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
                <tr>
                  <td class="email-padding" style="padding:30px 40px;">
                    <div style="font-size:9px;font-weight:900;color:#7c3aed;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:16px;padding-bottom:9px;border-bottom:1px solid #f3f4f6;">
                      5 resources · AI + Design Systems
                    </div>

                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${renderResourceGrid(resources)}
                    </table>
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
