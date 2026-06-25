import OpenAI from "openai";
import { z } from "zod";
import type { CandidateResource } from "./collectCandidates.js";
import type { Digest } from "./emailTemplate.js";

export type ProviderName = "openAI" | "gemini";

const RankedResourceSchema = z.object({
  title: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["Article", "Tool", "Research", "Video", "Docs"]),
  published_date: z.string().min(1),
  summary: z.string().min(1),
  design_system_angle: z.string().min(1),
  why_it_matters_to_our_team: z.string().min(1),
  relevance_score: z.number().min(1).max(5),
  worth_your_time_score: z.number().min(1).max(5)
});

const RankedDigestSchema = z.object({
  date: z.string().min(1),
  trend_summary: z.string().max(900),
  needsMoreSources: z.boolean(),
  resources: z.array(RankedResourceSchema).max(5)
});

type RankedDigest = z.infer<typeof RankedDigestSchema>;

const openAIModel = process.env.OPENAI_MODEL ?? "gpt-5.5";
const geminiModel = "gemini-1.5-pro";

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function buildPrompt(candidates: CandidateResource[]): string {
  return `
You are DS × AI Curator, an expert analyst focused exclusively on AI applied to Design Systems.

Audience:
A Design System Designer in an enterprise team.

Team context:
- Designers work in Figma
- Developers work in Storybook, Visual Studio Code, React, and React Native
- The development team has an internal Design System Agent
- The development team has an internal QA Design System Agent
- The team maintains components, tokens, documentation, governance, accessibility, and Figma-to-Storybook alignment

Select the best resources from the provided candidates.

Only select resources that directly help improve a Figma -> Design Tokens -> Storybook -> React / React Native Design System workflow.

The digest should feel like a "Worth Your Time" briefing for a senior enterprise Design System Designer, not a generic AI/UX content roundup.

Prioritize:
- AI-assisted Design System workflows
- Figma AI and Figma MCP
- Storybook AI or Storybook MCP workflows
- AI agents consuming Design System documentation
- AI agents consuming component APIs
- Design tokens + AI
- Component generation constrained by Design Systems
- AI-assisted design-to-code
- AI-assisted Design QA
- Accessibility validation
- Documentation generation
- Governance automation
- RAG over Design System docs
- Model Context Protocol and MCP servers
- AI-ready documentation and machine-readable Design Systems
- AI-assisted visual regression, UI testing, and design reviews

Reject:
- generic AI news
- generic UX/UI articles
- generic coding assistant articles
- generic prompt engineering
- generic productivity tools
- marketing fluff
- SEO listicles
- funding announcements
- career advice
- freelancer-only content

For every candidate ask:
1. Would this help improve a Figma -> Design Tokens -> Storybook -> React / React Native Design System workflow?
2. Is this worth one of only five reading slots today?

Use this internal final ranking formula:
finalScore =
worthYourTimeScore * 0.35 +
relevanceScore * 0.25 +
practicalityScore * 0.15 +
sourceScore * 0.10 +
technicalDepthScore * 0.10 +
noveltyScore * 0.05

Use recencyScore as a tiebreaker.

Do not select a resource with:
- relevance_score < 4
- worth_your_time_score < 4
- sourceScore < 3 unless it is exceptionally relevant

Editorial diversity:
- Maximum 2 resources from the same publisher.
- Prefer at least 4 different publishers.
- Avoid five resources about exactly the same topic.
- Prefer a mix of official docs/product updates, engineering blogs, research, tools, and workflow articles when quality allows.

For each selected resource return:
{
  "title": "",
  "source": "",
  "url": "",
  "type": "Article | Tool | Research | Video | Docs",
  "published_date": "",
  "summary": "",
  "design_system_angle": "",
  "why_it_matters_to_our_team": "",
  "relevance_score": 1-5,
  "worth_your_time_score": 1-5
}

Rules:
- Do not invent titles.
- Do not invent URLs.
- Use only candidates provided.
- Keep exactly the original URL.
- If fewer than 5 candidates are worth reading, return fewer than 5 and set needsMoreSources: true.
- Never fabricate resources.
- Trend summary must be max 120 words and focus only on AI impact on Design Systems, Figma, Storybook, tokens, documentation, governance, QA, or agents.

Return valid JSON only with:
{
  "date": "${todayIsoDate()}",
  "trend_summary": "",
  "needsMoreSources": false,
  "resources": []
}

Candidates:
${JSON.stringify(candidates, null, 2)}
`;
}

function jsonSchema() {
  return {
    type: "object",
    properties: {
      date: { type: "string" },
      trend_summary: { type: "string" },
      needsMoreSources: { type: "boolean" },
      resources: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            source: { type: "string" },
            url: { type: "string" },
            type: { type: "string", enum: ["Article", "Tool", "Research", "Video", "Docs"] },
            published_date: { type: "string" },
            summary: { type: "string" },
            design_system_angle: { type: "string" },
            why_it_matters_to_our_team: { type: "string" },
            relevance_score: { type: "number", minimum: 1, maximum: 5 },
            worth_your_time_score: { type: "number", minimum: 1, maximum: 5 }
          },
          required: [
            "title",
            "source",
            "url",
            "type",
            "published_date",
            "summary",
            "design_system_angle",
            "why_it_matters_to_our_team",
            "relevance_score",
            "worth_your_time_score"
          ],
          additionalProperties: false
        }
      }
    },
    required: ["date", "trend_summary", "needsMoreSources", "resources"],
    additionalProperties: false
  };
}

function toPublicDigest(rankedDigest: RankedDigest): Digest {
  return {
    date: rankedDigest.date,
    trend_summary: rankedDigest.trend_summary,
    resources: rankedDigest.resources.map((resource) => ({
      title: resource.title,
      source: resource.source,
      url: resource.url,
      type: resource.type,
      published_date: resource.published_date,
      summary: resource.summary,
      design_system_angle: resource.design_system_angle,
      why_it_matters_to_our_team: resource.why_it_matters_to_our_team,
      is_real_source: true,
      relevance_score: resource.relevance_score,
      worth_your_time_score: resource.worth_your_time_score
    }))
  };
}

function assertSelectedFromCandidates(resources: RankedDigest["resources"], candidates: CandidateResource[]) {
  const urls = new Set(candidates.map((candidate) => candidate.url));
  const invalid = resources.filter((resource) => !urls.has(resource.url));
  const lowQuality = resources.filter(
    (resource) => resource.relevance_score < 4 || resource.worth_your_time_score < 4
  );

  if (invalid.length > 0) {
    throw new Error(`LLM selected URLs not present in candidates: ${invalid.map((item) => item.url).join(", ")}`);
  }

  if (lowQuality.length > 0) {
    throw new Error(
      `LLM selected resources below editorial threshold: ${lowQuality.map((item) => item.title).join(", ")}`
    );
  }
}

export async function rankAndSummarizeWithOpenAI(candidates: CandidateResource[]): Promise<Digest> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: openAIModel,
    input: buildPrompt(candidates),
    text: {
      format: {
        type: "json_schema",
        name: "ds_ai_ranked_digest",
        strict: true,
        schema: jsonSchema()
      }
    }
  });

  const rankedDigest = RankedDigestSchema.parse(JSON.parse(response.output_text));
  assertSelectedFromCandidates(rankedDigest.resources, candidates);
  return toPublicDigest(rankedDigest);
}

export async function rankAndSummarizeWithGemini(candidates: CandidateResource[]): Promise<Digest> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(candidates) }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with HTTP ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini response did not include text.");
  }

  const rankedDigest = RankedDigestSchema.parse(JSON.parse(text));
  assertSelectedFromCandidates(rankedDigest.resources, candidates);
  return toPublicDigest(rankedDigest);
}
