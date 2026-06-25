import OpenAI from "openai";
import { z } from "zod";
import type { CandidateResource } from "./collectCandidates.js";
import { withEditorialSections } from "./editorial.js";
import type { Digest } from "./emailTemplate.js";
import { truncateText } from "./textUtils.js";

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
  why_selected: z.string().min(1),
  expected_impact_on_workflow: z.string().min(1),
  who_should_read: z.string().min(1),
  estimated_reading_time: z.string().min(1),
  ignore_risk: z.string().min(1),
  impact_score: z.number().min(1).max(5),
  affected_workflow_areas: z.array(z.enum(["Figma", "Storybook", "Tokens", "Docs", "QA", "AI Agents"])).min(1),
  directDesignSystemEvidence: z.string().min(1),
  relevance_score: z.number().min(1).max(5),
  worth_your_time_score: z.number().min(1).max(5)
});

const RankedDigestSchema = z.object({
  date: z.string().min(1),
  trend_summary: z.string().max(900),
  theSignal: z.string().min(1).max(1400),
  thisWeeksSignals: z.array(z.string().min(1)).length(3),
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

The digest should feel like a premium weekly briefing written by a senior enterprise Design System Lead, not an AI summarizer.
Replace generic summaries with editorial judgment. Explain what changed, why it matters now, and what the team should pay attention to.

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
- GitHub topic pages such as /topics/...
- generic arXiv MCP, agent, privacy, telecom, or script generation papers unless they explicitly mention UI, Design Systems, components, Figma, Storybook, design tokens, design-to-code, frontend, accessibility, or Design QA
- arXiv papers where Figma is an unrelated acronym, including "FIGMA: Towards FIne-Grained Music retrievAl"
- agriculture, farming, telecom, peptide, protein, scientific workflow, or music retrieval resources unless they have explicit UI or Design System evidence
- Figma Weave/media workflow content unless it clearly connects to Design Systems
- generic Figma marketing/docs pages unless they mention AI, MCP, design systems, components, tokens, Code Connect, Dev Mode, or design-to-code
- generic Design System landing pages unless they explicitly discuss AI applied to Design Systems, MCP, Code Connect, design-to-code, design token automation, component generation, Storybook integration, AI agents, or Design QA automation
- pages that contain only "design systems" plus generic "Figma AI"
- generic documentation pages unless they are specifically about AI, MCP, Design Systems, tokens, components, or design-to-code
- generic prompt engineering
- generic productivity tools
- marketing fluff
- marketing pages
- SEO listicles
- funding announcements
- career advice
- freelancer-only content
- resources that are mainly release notes
- resources that are mostly changelogs
- resources that contain no new reusable learning
- resources that duplicate another selected resource

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
  "why_selected": "",
  "expected_impact_on_workflow": "",
  "who_should_read": "Designer | Frontend DS Engineer | AI Engineer | DesignOps or a slash-separated combination",
  "estimated_reading_time": "3 min",
  "ignore_risk": "",
  "impact_score": 1-5,
  "affected_workflow_areas": ["Figma", "Storybook", "Tokens", "Docs", "QA", "AI Agents"],
  "directDesignSystemEvidence": "",
  "relevance_score": 1-5,
  "worth_your_time_score": 1-5
}

Rules:
- Do not invent titles.
- Do not invent URLs.
- Use only candidates provided.
- Keep exactly the original URL.
- directDesignSystemEvidence must be a meaningful one-sentence explanation of the exact candidate title/snippet evidence connecting the resource to a Design System anchor.
- Do not use isolated generic words as evidence: frontend, component, design, figma, token, agent, or accessibility.
- Strong evidence must include at least one of: design system, design systems, component library, design tokens, Storybook, Figma component, Figma library, design-to-code, design system agent, QA design system agent, MCP + Figma, MCP + Storybook, AI + design system, AI + component library, AI + design tokens.
- For Figma sources, only select when there is design systems plus AI/MCP/agent/code/tokens/component generation, Figma + MCP + design systems, Figma + design-to-code, Figma + Code Connect, or Figma + component generation.
- Reject the resource if directDesignSystemEvidence would be empty.
- If fewer than 5 candidates are worth reading, return fewer than 5 and set needsMoreSources: true.
- Never fabricate resources.
- Trend summary must be max 120 words and focus only on AI impact on Design Systems, Figma, Storybook, tokens, documentation, governance, QA, or agents.
- theSignal must be 120-180 words. It must identify 2-4 emerging themes across the selected resources instead of summarizing each article.
- thisWeeksSignals must contain exactly 3 short editorial observations about ecosystem trends, not individual article summaries.
- why_it_matters_to_our_team must be unique for each resource and explain exactly how the resource could influence our team's work with Figma libraries, Storybook, design tokens, documentation, accessibility, QA, the internal Design System Agent, or the internal QA Agent.
- why_selected must explain the editorial reason this item earned a slot.
- expected_impact_on_workflow must describe the practical impact on our enterprise workflow.
- ignore_risk must be one sentence beginning with a practical consequence of ignoring the topic.
- impact_score must be 1-5 and affected_workflow_areas must use only: Figma, Storybook, Tokens, Docs, QA, AI Agents.

Return valid JSON only with:
{
  "date": "${todayIsoDate()}",
  "trend_summary": "",
  "theSignal": "",
  "thisWeeksSignals": [],
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
      theSignal: { type: "string" },
      thisWeeksSignals: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" }
      },
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
            why_selected: { type: "string" },
            expected_impact_on_workflow: { type: "string" },
            who_should_read: { type: "string" },
            estimated_reading_time: { type: "string" },
            ignore_risk: { type: "string" },
            impact_score: { type: "number", minimum: 1, maximum: 5 },
            affected_workflow_areas: {
              type: "array",
              minItems: 1,
              items: { type: "string", enum: ["Figma", "Storybook", "Tokens", "Docs", "QA", "AI Agents"] }
            },
            directDesignSystemEvidence: { type: "string" },
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
            "why_selected",
            "expected_impact_on_workflow",
            "who_should_read",
            "estimated_reading_time",
            "ignore_risk",
            "impact_score",
            "affected_workflow_areas",
            "directDesignSystemEvidence",
            "relevance_score",
            "worth_your_time_score"
          ],
          additionalProperties: false
        }
      }
    },
    required: ["date", "trend_summary", "theSignal", "thisWeeksSignals", "needsMoreSources", "resources"],
    additionalProperties: false
  };
}

function toPublicDigest(rankedDigest: RankedDigest): Digest {
  return withEditorialSections({
    date: rankedDigest.date,
    trend_summary: rankedDigest.trend_summary,
    theSignal: rankedDigest.theSignal,
    thisWeeksSignals: rankedDigest.thisWeeksSignals,
    resources: rankedDigest.resources.map((resource) => ({
      title: resource.title,
      source: resource.source,
      url: resource.url,
      type: resource.type,
      published_date: resource.published_date,
      summary: truncateText(resource.summary, 280),
      cleanSummary: truncateText(resource.summary, 280),
      design_system_angle: resource.design_system_angle,
      why_it_matters_to_our_team: truncateText(resource.why_it_matters_to_our_team, 220),
      why_selected: truncateText(resource.why_selected, 160),
      expected_impact_on_workflow: truncateText(resource.expected_impact_on_workflow, 180),
      who_should_read: resource.who_should_read,
      estimated_reading_time: resource.estimated_reading_time,
      ignore_risk: truncateText(resource.ignore_risk, 180),
      impact_score: resource.impact_score,
      affected_workflow_areas: resource.affected_workflow_areas,
      directDesignSystemEvidence: resource.directDesignSystemEvidence,
      is_real_source: true,
      relevance_score: resource.relevance_score,
      worth_your_time_score: resource.worth_your_time_score
    }))
  });
}

function assertSelectedFromCandidates(resources: RankedDigest["resources"], candidates: CandidateResource[]) {
  const urls = new Set(candidates.map((candidate) => candidate.url));
  const invalid = resources.filter((resource) => !urls.has(resource.url));
  const normalizedTitles = resources.map((resource) => resource.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  const lowQuality = resources.filter(
    (resource) =>
      resource.relevance_score < 4 ||
      resource.worth_your_time_score < 4 ||
      resource.directDesignSystemEvidence.trim().length === 0 ||
      /(^|\s)(changelog|release notes)(\s|$)/i.test(`${resource.title} ${resource.source} ${resource.url}`) ||
      normalizedTitles.filter((title) => title === resource.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
        .length > 1
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
