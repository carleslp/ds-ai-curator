import OpenAI from "openai";
import { z } from "zod";
import type { Digest } from "./emailTemplate.js";

const categories = [
  "AI + Design Systems",
  "AI component generation",
  "Design tokens + AI",
  "Figma AI tools",
  "LLM + UI patterns"
] as const;

const ResourceSchema = z.object({
  title: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
  type: z.enum(categories),
  published_date: z.string().min(1),
  summary: z.string().min(1)
});

const DigestSchema = z.object({
  date: z.string().min(1),
  trend_summary: z.string().min(1),
  resources: z.array(ResourceSchema).length(5)
});

let lastSuccessfulDigest: Digest = createColdStartDigest();

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function buildSubject(date: string): string {
  return `DS × AI Curator — ${date}`;
}

function createColdStartDigest(): Digest {
  const today = todayIsoDate();

  return {
    date: today,
    trend_summary:
      "AI is reshaping design systems through component generation, token workflows, Figma-native tooling, and LLM-driven interface patterns.",
    resources: categories.map((category) => ({
      title: `${category}: digest fallback`,
      url: "https://example.com",
      source: "DS × AI Curator",
      type: category,
      published_date: today,
      summary:
        "Fallback item used only when live curation is unavailable before a successful digest has been cached."
    }))
  };
}

function digestJsonSchema() {
  return {
    type: "object",
    properties: {
      date: { type: "string" },
      trend_summary: { type: "string" },
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
            type: { type: "string", enum: [...categories] },
            published_date: { type: "string" },
            summary: { type: "string" }
          },
          required: ["title", "source", "url", "type", "published_date", "summary"],
          additionalProperties: false
        }
      }
    },
    required: ["date", "trend_summary", "resources"],
    additionalProperties: false
  };
}

function prompt(date: string): string {
  return `
Search the web for fresh English-language resources about AI applied to Design Systems.

Return valid JSON only with this exact shape:
{
  "date": "${date}",
  "trend_summary": "One concise synthesis of today's signals.",
  "resources": [
    {
      "title": "Resource title",
      "source": "Publisher, product, author, or organization",
      "url": "https://...",
      "type": "One of the required categories",
      "published_date": "Publication date or best available date",
      "summary": "Why this matters for design system practitioners."
    }
  ]
}

Return exactly 5 resources, one for each category:
${categories.map((category) => `- ${category}`).join("\n")}

Requirements:
- English resources only.
- Prefer fresh, substantive resources from primary sources, product updates, research, standards, conference talks, or expert analysis.
- Avoid duplicates.
- Keep summaries practical and tied to design systems work.
`;
}

async function fetchDigestFromOpenAI(): Promise<Digest> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  const client = new OpenAI({ apiKey });
  const date = todayIsoDate();

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.5",
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    input: prompt(date),
    text: {
      format: {
        type: "json_schema",
        name: "ds_ai_daily_digest",
        strict: true,
        schema: digestJsonSchema()
      }
    }
  });

  const parsed = JSON.parse(response.output_text);
  return DigestSchema.parse(parsed);
}

export async function getDailyDigest(): Promise<Digest> {
  try {
    const digest = await fetchDigestFromOpenAI();
    lastSuccessfulDigest = digest;
    return digest;
  } catch (error) {
    console.error("Daily digest curation failed; returning last successful digest.", error);
    return lastSuccessfulDigest;
  }
}
