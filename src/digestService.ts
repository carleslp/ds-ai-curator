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

const openAIModel = "gpt-5.5";

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
}).superRefine((digest, context) => {
  const seen = new Set(digest.resources.map((resource) => resource.type));

  for (const category of categories) {
    if (!seen.has(category)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Missing required category: ${category}`
      });
    }
  }
});

type DailyDigestResult = {
  digest: Digest;
  usedFallback: boolean;
  fallbackReason?: string;
};

let lastSuccessfulDigest: Digest = createSeedDigest();

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

function createSeedDigest(): Digest {
  const today = todayIsoDate();

  return {
    date: today,
    trend_summary:
      "AI is reshaping design systems through component generation, token workflows, Figma-native tooling, and LLM-driven interface patterns.",
    resources: [
      {
        title: "AI is becoming a design system governance layer",
        url: "https://www.designsystems.com/",
        source: "DS × AI Curator",
        type: "AI + Design Systems",
        published_date: today,
        summary:
          "Teams are using AI to improve documentation, audit component usage, and strengthen system adoption across product surfaces."
      },
      {
        title: "Generated components need system-aware review",
        url: "https://react.dev/",
        source: "DS × AI Curator",
        type: "AI component generation",
        published_date: today,
        summary:
          "AI-generated UI is most useful when constrained by existing component APIs, accessibility rules, and review workflows."
      },
      {
        title: "Design tokens are a practical AI control surface",
        url: "https://tr.designtokens.org/",
        source: "DS × AI Curator",
        type: "Design tokens + AI",
        published_date: today,
        summary:
          "Token metadata gives AI tools a structured way to reason about color, spacing, typography, themes, and brand consistency."
      },
      {
        title: "Figma-native AI workflows are moving closer to production",
        url: "https://www.figma.com/ai/",
        source: "DS × AI Curator",
        type: "Figma AI tools",
        published_date: today,
        summary:
          "Design teams are evaluating AI features for ideation, asset creation, naming, documentation, and faster design system maintenance."
      },
      {
        title: "LLMs are changing how teams describe UI patterns",
        url: "https://www.w3.org/WAI/ARIA/apg/",
        source: "DS × AI Curator",
        type: "LLM + UI patterns",
        published_date: today,
        summary:
          "Pattern libraries and accessibility guidance give language models stronger context for suggesting reusable interaction patterns."
      }
    ]
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
- Use real resources discovered through web search. Do not invent URLs.
- Avoid duplicates.
- Keep summaries practical and tied to design systems work.
- Do not use the word "fallback" anywhere in the digest.
`;
}

async function fetchDigestFromOpenAI(): Promise<Digest> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OPENAI_API_KEY is missing; live curation cannot run.");
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  const client = new OpenAI({ apiKey });
  const date = todayIsoDate();

  const response = await client.responses.create({
    model: openAIModel,
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
  const digest = DigestSchema.parse(parsed);

  if (JSON.stringify(digest).toLowerCase().includes("fallback")) {
    throw new Error("OpenAI returned a digest containing the disallowed word fallback.");
  }

  return digest;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function getDailyDigest(): Promise<DailyDigestResult> {
  try {
    const digest = await fetchDigestFromOpenAI();
    lastSuccessfulDigest = digest;
    return {
      digest,
      usedFallback: false
    };
  } catch (error) {
    const fallbackReason = getErrorMessage(error);
    console.error(`Daily digest curation failed: ${fallbackReason}`);
    console.error("Returning last successful digest instead of HTTP 500.");

    return {
      digest: lastSuccessfulDigest,
      usedFallback: true,
      fallbackReason
    };
  }
}
