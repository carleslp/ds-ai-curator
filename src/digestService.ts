import OpenAI from "openai";
import { z } from "zod";
import type { Digest, Resource } from "./emailTemplate.js";

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
  type: z.enum(["Article", "Tool", "Research", "Video", "Docs"]),
  category: z.enum(categories),
  published_date: z.string().min(1),
  summary: z.string().min(1),
  design_system_angle: z.string().min(1),
  why_it_matters_to_our_team: z.string().min(1),
  relevance_score: z.number().min(1).max(5),
  confidence_score: z.number().min(1).max(5),
  is_real_source: z.boolean()
});

const DigestSchema = z.object({
  date: z.string().min(1),
  trend_summary: z.string().min(1),
  resources: z.array(ResourceSchema).max(5)
});

type DigestMode = "liveOpenAI" | "cachedDigest" | "emergencyFallback";

type DailyDigestResult = {
  digest: Digest;
  mode: DigestMode;
  hasOpenAIKey: boolean;
  fallbackReason?: string;
};

type InternalDigest = z.infer<typeof DigestSchema>;

let cachedDigest: Digest | undefined;

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

function createEmergencyFallbackDigest(): Digest {
  const today = todayIsoDate();

  return {
    date: today,
    trend_summary: "Fallback: live curation is currently unavailable and no cached digest exists.",
    resources: []
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
        minItems: 0,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            source: { type: "string" },
            url: { type: "string" },
            type: { type: "string", enum: ["Article", "Tool", "Research", "Video", "Docs"] },
            category: { type: "string", enum: [...categories] },
            published_date: { type: "string" },
            summary: { type: "string" },
            design_system_angle: { type: "string" },
            why_it_matters_to_our_team: { type: "string" },
            relevance_score: { type: "number", minimum: 1, maximum: 5 },
            confidence_score: { type: "number", minimum: 1, maximum: 5 },
            is_real_source: { type: "boolean" }
          },
          required: [
            "title",
            "source",
            "url",
            "type",
            "category",
            "published_date",
            "summary",
            "design_system_angle",
            "why_it_matters_to_our_team",
            "relevance_score",
            "confidence_score",
            "is_real_source"
          ],
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
You are DS × AI Curator, an expert analyst focused exclusively on the intersection of Artificial Intelligence and Design Systems.

Your audience is a Design System Designer working in a multinational enterprise Design System team.

The design team:
- Maintains a cross-platform Design System.
- Uses Figma as the source of truth.
- Creates and maintains component libraries.
- Maintains design tokens.
- Defines accessibility guidelines.
- Writes Design System documentation.
- Reviews product teams for Design System compliance.
- Performs Design QA against implemented components.
- Maintains alignment between design and code.

The development team:
- Uses Storybook as the component source of truth.
- Builds React and React Native components.
- Uses Visual Studio Code for implementation.
- Maintains an internal Design System Agent.
- Maintains an internal QA Design System Agent.
- Uses AI-assisted workflows for implementation and validation.
- Consumes Design System documentation and component metadata.

The workflow is:
Figma -> Design Tokens -> Components -> Storybook -> React / React Native -> Product Teams

Search the web for fresh English-language resources about AI applied to Design Systems.

Only include resources that would clearly help improve, automate, validate, document, scale, govern, or accelerate this workflow.

Reject generic AI news, generic UX/UI articles, generic frontend articles, generic prompt engineering, generic coding assistant content, generic productivity tools, startup funding announcements, marketing content, SEO listicles, AI-generated design inspiration, and non-technical opinion pieces unless they have a direct explicit Design System connection.

Prefer original sources, official documentation, technical blogs, engineering blogs, research papers, conference talks, product updates, technical videos, and high-quality industry publications.

Return valid JSON only with this exact shape:
{
  "date": "${date}",
  "trend_summary": "One concise synthesis of today's signals.",
  "resources": [
    {
      "title": "Resource title",
      "source": "Publisher, product, author, or organization",
      "url": "https://...",
      "type": "Article | Tool | Research | Video | Docs",
      "category": "One of the required categories",
      "published_date": "Publication date or best available date",
      "summary": "Why this matters for design system practitioners.",
      "design_system_angle": "Specific connection to the Figma -> Storybook -> React Design System workflow.",
      "why_it_matters_to_our_team": "Practical team-specific recommendation.",
      "relevance_score": 5,
      "confidence_score": 5,
      "is_real_source": true
    }
  ]
}

Try to return exactly 5 resources, one for each category:
${categories.map((category) => `- ${category}`).join("\n")}

Requirements:
- English resources only.
- Prefer fresh, substantive resources from primary sources, product updates, research, standards, conference talks, or expert analysis.
- Use real resources discovered through web search. Do not invent URLs.
- Never generate invented article titles.
- Every title must match the actual linked source title.
- Every source must be the real publisher or domain.
- Every resource must include a real working URL.
- Set is_real_source to true only when the URL, title, and publisher/source are real and match the linked source.
- If you cannot find 5 real resources, return fewer than 5 resources. Do not invent resources to fill the list.
- Avoid duplicates.
- Every candidate must answer YES to: "Would this help improve a Figma -> Storybook -> React Design System workflow?"
- Only include resources with relevance_score >= 4 and confidence_score >= 4.
- If fewer than 5 resources qualify, expand the publication window before lowering quality.
- Never include low-quality resources simply to reach 5 items.
- Write why_it_matters_to_our_team as a practical recommendation explaining how the resource could affect our Design System, Figma usage, Storybook usage, Design Tokens, Design QA, and Design System Agents.
- Keep summaries practical and tied to design systems work.
- Do not use the word "fallback" anywhere in the digest.
`;
}

function toPublicDigest(internalDigest: InternalDigest): Digest {
  const rankedResources = [...internalDigest.resources]
    .filter(
      (resource) =>
        resource.is_real_source && resource.relevance_score >= 4 && resource.confidence_score >= 4
    )
    .sort((a, b) => {
      const scoreDifference =
        b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return b.relevance_score - a.relevance_score;
    })
    .slice(0, 5);

  if (rankedResources.length < 5) {
    console.error(
      `OpenAI returned ${rankedResources.length} real high-quality resources after filtering; returning fewer than 5 rather than inventing resources.`
    );
  }

  if (rankedResources.length === 0) {
    console.error("OpenAI returned zero real resources after filtering. Digest resources will be empty.");
  }

  return {
    date: internalDigest.date,
    trend_summary: internalDigest.trend_summary,
    resources: rankedResources.map((resource) => ({
      title: resource.title,
      source: resource.source,
      url: resource.url,
      type: resource.type,
      published_date: resource.published_date,
      summary: resource.summary,
      is_real_source: resource.is_real_source
    }))
  };
}

async function fetchDigestFromOpenAI(): Promise<Digest> {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log(`Step 1: OPENAI_API_KEY exists? ${Boolean(apiKey)}`);

  if (!apiKey) {
    console.error("OPENAI_API_KEY is missing; live curation cannot run.");
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  const client = new OpenAI({ apiKey });
  const date = todayIsoDate();

  console.log(`Step 2: OpenAI request started using model ${openAIModel}.`);
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
  console.log("Step 3: OpenAI response received.");

  const parsed = JSON.parse(response.output_text);
  console.log("Step 4: JSON parsed successfully.");

  const internalDigest = DigestSchema.parse(parsed);
  console.log("Step 5: Resource validation passed.");

  const digest = toPublicDigest(internalDigest);

  if (JSON.stringify(digest).toLowerCase().includes("fallback")) {
    throw new Error("OpenAI returned a digest containing the disallowed word fallback.");
  }

  return digest;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const details: string[] = [error.message];
    const maybeApiError = error as Error & {
      status?: number;
      code?: string;
      type?: string;
      requestID?: string;
    };

    if (maybeApiError.status) {
      details.push(`status=${maybeApiError.status}`);
    }

    if (maybeApiError.code) {
      details.push(`code=${maybeApiError.code}`);
    }

    if (maybeApiError.type) {
      details.push(`type=${maybeApiError.type}`);
    }

    if (maybeApiError.requestID) {
      details.push(`requestID=${maybeApiError.requestID}`);
    }

    return details.join(" | ");
  }

  return String(error);
}

export async function getDailyDigest(): Promise<DailyDigestResult> {
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

  try {
    const digest = await fetchDigestFromOpenAI();
    cachedDigest = digest;
    console.log("Step 6: Digest cached.");
    console.log(`Daily digest mode: liveOpenAI (${digest.resources.length} resources).`);
    return {
      digest,
      mode: "liveOpenAI",
      hasOpenAIKey
    };
  } catch (error) {
    const fallbackReason = getErrorMessage(error);
    console.error(`fallbackReason: ${fallbackReason}`);
    console.error("OpenAI/live curation error object:", error);

    if (cachedDigest) {
      console.error("Daily digest mode: cachedDigest.");
      return {
        digest: cachedDigest,
        mode: "cachedDigest",
        hasOpenAIKey,
        fallbackReason
      };
    }

    console.error("Daily digest mode: emergencyFallback.");
    return {
      digest: createEmergencyFallbackDigest(),
      mode: "emergencyFallback",
      hasOpenAIKey,
      fallbackReason
    };
  }
}

export function toDebugResources(resources: Resource[]) {
  return resources.map((resource) => ({
    title: resource.title,
    url: resource.url,
    source: resource.source,
    is_real_source: Boolean(resource.is_real_source)
  }));
}
