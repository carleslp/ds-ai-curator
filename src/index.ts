import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";

const ResourceSchema = z.object({
  title: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
  publishedDate: z.string().min(1),
  whyItMatters: z.string().min(1),
  designSystemsAngle: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1).max(4)
});

const NewsletterSchema = z.object({
  date: z.string().min(1),
  topic: z.literal("AI applied to Design Systems"),
  trendSummary: z.string().min(1),
  resources: z.array(ResourceSchema).length(5)
});

type NewsletterData = z.infer<typeof NewsletterSchema>;
type Newsletter = NewsletterData & { html: string };

const outputDir = path.join(process.cwd(), "outputs");

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.NEWSLETTER_TIME_ZONE ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function newsletterPrompt(date: string): string {
  return `
Generate a daily curated newsletter about AI applied to Design Systems for ${date}.

Use current web search results. Return exactly 5 resources.

The output must be valid JSON only, with this shape:
{
  "date": "YYYY-MM-DD",
  "topic": "AI applied to Design Systems",
  "trendSummary": "One concise trend summary for the day.",
  "resources": [
    {
      "title": "Resource title",
      "source": "Publisher or author",
      "url": "https://...",
      "publishedDate": "Publication date or best available date",
      "whyItMatters": "Why this matters to teams working on design systems.",
      "designSystemsAngle": "Specific connection to components, tokens, governance, documentation, accessibility, tooling, or operations.",
      "tags": ["AI", "Design Systems"]
    }
  ]
}

Resource requirements:
- Prefer primary sources, official announcements, product updates, research papers, standards, conference talks, or substantive expert analysis.
- Avoid duplicate stories.
- Make each resource clearly relevant to AI applied to Design Systems.
- Keep summaries concise and practical.
`;
}

function newsletterJsonSchema() {
  return {
    type: "object",
    properties: {
      date: { type: "string" },
      topic: { type: "string", enum: ["AI applied to Design Systems"] },
      trendSummary: { type: "string" },
      resources: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            source: { type: "string" },
            url: { type: "string" },
            publishedDate: { type: "string" },
            whyItMatters: { type: "string" },
            designSystemsAngle: { type: "string" },
            tags: {
              type: "array",
              minItems: 1,
              maxItems: 4,
              items: { type: "string" }
            }
          },
          required: [
            "title",
            "source",
            "url",
            "publishedDate",
            "whyItMatters",
            "designSystemsAngle",
            "tags"
          ],
          additionalProperties: false
        }
      }
    },
    required: ["date", "topic", "trendSummary", "resources"],
    additionalProperties: false
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTags(tags: string[]): string {
  return tags
    .map(
      (tag) => `
        <span style="display:inline-block;margin:0 6px 6px 0;padding:4px 8px;background-color:#efe9ff;color:#3b1768;border-radius:12px;font-size:12px;line-height:16px;">${escapeHtml(tag)}</span>`
    )
    .join("");
}

function renderResourceCards(resources: NewsletterData["resources"]): string {
  return resources
    .map(
      (resource, index) => `
        <tr>
          <td style="padding:0 24px 16px 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #e5e0eb;">
              <tr>
                <td style="padding:20px;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;color:#6f627a;text-transform:uppercase;">Resource ${index + 1} · ${escapeHtml(resource.source)} · ${escapeHtml(resource.publishedDate)}</div>
                  <h2 style="margin:8px 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:26px;color:#24112f;">
                    <a href="${escapeHtml(resource.url)}" style="color:#3b1768;text-decoration:none;">${escapeHtml(resource.title)}</a>
                  </h2>
                  <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#3e3348;"><strong>Why it matters:</strong> ${escapeHtml(resource.whyItMatters)}</p>
                  <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#3e3348;"><strong>Design systems angle:</strong> ${escapeHtml(resource.designSystemsAngle)}</p>
                  <div>${renderTags(resource.tags)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    )
    .join("");
}

function renderHtml(newsletter: NewsletterData): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>DS × AI Curator - ${escapeHtml(newsletter.date)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f3f8;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:#f6f3f8;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;max-width:680px;background-color:#f6f3f8;">
            <tr>
              <td style="padding:28px 24px;background-color:#251033;">
                <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:34px;color:#ffffff;">DS × AI Curator</h1>
                <p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#d8c8ea;">${escapeHtml(newsletter.topic)} · ${escapeHtml(newsletter.date)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background-color:#e9ddf6;border-left:1px solid #d6c5e6;border-right:1px solid #d6c5e6;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2f173e;"><strong>Trend summary:</strong> ${escapeHtml(newsletter.trendSummary)}</p>
              </td>
            </tr>
            ${renderResourceCards(newsletter.resources)}
            <tr>
              <td align="center" style="padding:12px 24px 28px 24px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6f627a;">Curated by DS × AI Curator</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

async function generateNewsletter(): Promise<Newsletter> {
  const date = todayIsoDate();
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.5",
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    input: newsletterPrompt(date),
    text: {
      format: {
        type: "json_schema",
        name: "ds_ai_newsletter",
        strict: true,
        schema: newsletterJsonSchema()
      }
    }
  });

  const parsed = JSON.parse(response.output_text);
  const newsletterData = NewsletterSchema.parse(parsed);
  return {
    ...newsletterData,
    html: renderHtml(newsletterData)
  };
}

async function saveNewsletter(newsletter: Newsletter): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "newsletter.json");
  const htmlPath = path.join(outputDir, "newsletter.html");

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(newsletter, null, 2)}\n`, "utf8"),
    writeFile(htmlPath, newsletter.html, "utf8")
  ]);

  console.log(`Saved structured JSON to ${jsonPath}`);
  console.log(`Saved Gmail-compatible HTML to ${htmlPath}`);
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Copy .env.example to .env and add your key.");
  }

  const newsletter = await generateNewsletter();
  await saveNewsletter(newsletter);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
