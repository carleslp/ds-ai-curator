import OpenAI from "openai";
import { z } from "zod";
import type { CandidateResource } from "./collectCandidates.js";
import { withEditorialSections } from "./editorial.js";
import type { Digest } from "./emailTemplate.js";
import { aiEvidenceForText, designSystemEvidenceForText, maturityLevelForText } from "./filterCandidates.js";
import { cleanText } from "./textUtils.js";

export type ProviderName = "openAI" | "gemini";

// Gemini's responseSchema (PR-18) has no maxLength support and this PR does
// not touch it, so these caps are enforced only through the prompt's stated
// budget (see the field writing rubric below) plus this zod check — there is
// no API-level guarantee. Probing live output showed Gemini 2.5 Flash treats a
// stated character count as a rough target, not a hard ceiling, and the
// overshoot varies run to run: one probe measured why_it_matters_to_our_team
// up to 306 chars against a 220 target; a later live run put summary over 400
// against a 280 target. A max close to the stated target just turns ordinary
// run-to-run variance into a zod rejection, degrading the whole run to
// candidateFallback — the exact outcome this PR exists to avoid. So these caps
// are deliberately not "the render budget": they are a generous backstop
// against genuinely degenerate output (a runaway/repeating generation), sized
// with wide margin above anything observed. The prompt's stated target (not
// this max) is what actually keeps typical output near the render budget;
// emailTemplate.ts's CSS line-clamp (not a JS truncateText/ellipsis) is what
// visually crops a supporting card if a resource writes close to the ceiling.
const RankedResourceSchema = z.object({
  title: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["Article", "Tool", "Research", "Video", "Docs"]),
  published_date: z.string().min(1),
  summary: z.string().min(1).max(600),
  design_system_angle: z.string().min(1).max(500),
  // Unlike the other fields above, this max IS the render budget, not a
  // generous backstop (PR-20a). emailTemplate.ts's why_it_matters box has no
  // reliable ellipsis fallback across email clients: -webkit-line-clamp is
  // WebKit-only and many clients ignore it, so text past the box's capacity
  // is hard-clipped mid-sentence with nothing to show for it. The box's
  // capacity, from its actual CSS (renderResourceCard): ~483px usable text
  // width (1200px container - 80px section padding, /2 columns - 20px
  // gutter - 40px card padding - 24px div padding - 3px border), 3 lines at
  // line-height 1.55 x 12px font, ~78 chars/line at ~6.2px/char for the
  // -apple-system/Segoe UI/Helvetica Neue/Arial stack, minus ~59 chars eaten
  // off line 1 by the bold "Why it matters:" label — about 215 chars total.
  // 185 leaves margin for that estimate's uncertainty (character mix affects
  // width). The prompt target below is set low enough that Gemini's observed
  // overshoot (up to ~1.4x a stated target) still lands under this max most
  // of the time; when it doesn't, a zod rejection (honest degradation) beats
  // a silently clipped card.
  why_it_matters_to_our_team: z.string().min(1).max(185),
  why_selected: z.string().min(1).max(350),
  expected_impact_on_workflow: z.string().min(1).max(350),
  who_should_read: z.string().min(1).max(100),
  estimated_reading_time: z.string().min(1).max(20),
  // Same reasoning as why_it_matters_to_our_team above (PR-20a) — this max IS
  // the render budget, not a generous backstop — but this box's CSS never got
  // brought down to match when why_it_matters was fixed (PR-21). Its box
  // (renderResourceCard's ignore_risk div) has no extra padding/border of its
  // own, so it gets the full ~510px card interior width (unlike
  // why_it_matters's 483px), at font-size 11px, line-height 1.55, and only
  // -webkit-line-clamp:2 (max-height:35px = 2 lines, not 3). ~5.7px/char for
  // the font stack -> ~89 chars/line; line 1 loses ~57px to the bold "If we
  // ignore this:" label (18 chars bold) + a space, leaving ~67 chars. Total
  // capacity: 67 + 89 = 156 chars. All 3 cards on a live run measured 157-173
  // chars and all three clipped onto a hidden 3rd line. 130 leaves margin for
  // the estimate's uncertainty, same as why_it_matters's ~14% margin below
  // its calculated capacity.
  ignore_risk: z.string().min(1).max(130),
  impact_score: z.number().min(1).max(5),
  affected_workflow_areas: z
    .array(
      z.enum([
        "Figma",
        "Storybook",
        "React",
        "React Native",
        "Azure DevOps",
        "Governance",
        "Documentation",
        "Accessibility",
        "Internal Design System Agent",
        "Internal QA Agent"
      ])
    )
    .min(1),
  directDesignSystemEvidence: z.string().min(1).max(700),
  relevance_score: z.number().min(1).max(5),
  worth_your_time_score: z.number().min(1).max(5)
});

const RankedDigestSchema = z.object({
  date: z.string().min(1),
  trend_summary: z.string().max(900),
  theSignal: z.string().min(1).max(1000),
  supportingSignals: z.array(z.string().min(1)).length(3),
  thisWeeksSignals: z.array(z.string().min(1)).length(3).optional(),
  nextWeekWatchlist: z.array(z.string().min(1)).min(2).max(3),
  needsMoreSources: z.boolean(),
  resources: z.array(RankedResourceSchema).max(5)
});

type RankedDigest = z.infer<typeof RankedDigestSchema>;

const openAIModel = process.env.OPENAI_MODEL ?? "gpt-5.5";
const geminiModel = "gemini-2.5-flash";

const editorialVoiceGuidance = `
Editorial voice:
- Write like a premium industry briefing for senior Design System, product, and engineering leaders.
- Be concise, analytical, and specific. Prefer a clear editorial read over a neutral recap.
- Open with the thesis, not the topic. Make the reader understand what changed, why now, and what it means for teams.
- Synthesize across sources. Look for agreements, contradictions, missing pieces, and second-order implications.
- Treat every selected item as part of the same market/workflow story unless the evidence genuinely does not connect.
- Use confident language when the source supports it. Avoid vague hedging such as "may be important" or "could be useful" unless uncertainty is the point.
- Avoid generic AI-summary phrasing: "This article discusses", "delves into", "explores", "highlights the importance of", "in today's fast-paced landscape", "game-changer", "leveraging", and "unlocking".
- Do not use bullets as a substitute for synthesis inside prose fields. Each field should read like edited newsletter copy.
- Vary sentence openings and verbs. Do not repeat "shows", "highlights", "underscores", or "matters" across cards.
- Preserve executive tone: sharp, practical, plain-spoken, and easy to skim.
- Never end a field with an ellipsis ("…" or "...") or trail off as if there were more to say. Every field is a complete, self-contained thought that ends with terminal punctuation (. ! or ?). If a sentence is running long, end it earlier — do not let it hang unfinished.

Field writing rubric:
Every field below gives a target length and an absolute maximum. Write to the
target as complete sentences. The maximum is a hard limit that will reject the
whole response if any field exceeds it — never write past it and rely on
truncation to fit; a cut-off field is worse than a shorter one. Count
characters including spaces and punctuation.
- trend_summary: a compact market/workflow read. Name the shift and the implication for DS × AI work. Target 700 characters, absolute max 900.
- theSignal: 1-2 sentences that connect the week’s strongest sources into one thesis. No article-by-article recap. Target 800 characters, absolute max 1000.
- supportingSignals: three short observations that add nuance: what reinforces the thesis, what genuinely complicates it when the evidence supports tension, and what teams should monitor. Target 150 characters each, absolute max 170.
- summary: answer "what changed?" and "what is the useful takeaway?" Do not merely describe the article. Target 280 characters, absolute max 600.
- design_system_angle: explain the exact Design System workflow surface affected. Target 260 characters, absolute max 500.
- why_it_matters_to_our_team: answer "why should we care on Monday morning?" with a practical team consequence. This field renders in a small fixed-height box with no room to overflow — target 110 characters, absolute max 185. Going over the max is rejected, not trimmed to fit, so stay well under it.
- why_selected: state the editorial judgment in reader-facing language, not ranking mechanics. Target 160 characters, absolute max 350.
- expected_impact_on_workflow: name the behavior, artifact, or review habit likely to change. Name ONE specific change, not a list of examples. Target 180 characters, absolute max 350.
- who_should_read: a slash-separated combination drawn from Designer, Frontend DS Engineer, AI Engineer, DesignOps. Target 30 characters, absolute max 100.
- estimated_reading_time: Target 5 characters, absolute max 20.
- ignore_risk: begin with the consequence of ignoring the topic, then explain the operational cost. Name ONE specific consequence, not a list. Do not write open-ended enumerations like "leading to X, Y, and Z" — naming a growing list is what causes a field to run long and trail off unfinished. Pick the single most important consequence, state it, and stop. This field renders in a small fixed-height box with no room to overflow — target 50 characters, absolute max 130. Going over the max is rejected, not trimmed to fit, so stay well under it.
- directDesignSystemEvidence: Target 300 characters, absolute max 700.
`;

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
You are DS × AI Curator, an expert analyst focused exclusively on the intersection where Artificial Intelligence changes mature Design System work.

Mission:
Identify the most important weekly developments where Artificial Intelligence changes how mature Design Systems are designed, documented, governed, implemented, tested, maintained, or consumed.

This is not a Design Systems newsletter.
This is not an AI newsletter.
Only consider a resource when BOTH are true:
1. It is about AI or AI-powered tooling.
2. It has a direct impact on Design System work.

Audience:
A Design System Designer in an enterprise team.

Team context:
- Designers work in Figma
- Developers work in Storybook, Visual Studio Code, React, and React Native
- The development team has an internal Design System Agent
- The development team has an internal QA Design System Agent
- The team maintains components, tokens, documentation, governance, accessibility, and Figma-to-Storybook alignment
- The team already has a mature enterprise Design System. Do not select beginner Design System education.

Select the best resources from the provided candidates.

Only select resources that directly help improve a Figma -> Design Tokens -> Storybook -> React / React Native Design System workflow.

The digest should feel like a premium weekly briefing written by an experienced editor inside an enterprise Design System team.
Replace generic summaries with editorial judgment. Explain what changed, why it matters now, and what the team should pay attention to.
Never write "As Principal Design System Lead" or "I would".

${editorialVoiceGuidance}

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
- resources that are only about Design Systems without AI or AI-powered tooling
- resources that are only about AI without direct Design System workflow impact
- resources that are only about UX, Product Design, or Frontend unless they clearly intersect with mature Design System workflows
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
- beginner/basic Design System content such as "101", "basics", "beginner", "introduction", "getting started", "building blocks", "guide to design tokens", "what are design tokens", "typography as a system", or "motion design tokens" unless it explicitly discusses AI, MCP, agents, automation, design-to-code, Storybook integration, QA automation, or token intelligence
- Storybook release notes unless they explicitly mention Storybook AI, MCP, component manifest, docgen, AI checklist, component metadata, docs automation, QA automation, or accessibility automation

	For every candidate ask:
	1. Would this help improve a Figma -> Design Tokens -> Storybook -> React / React Native Design System workflow?
	2. Is this worth one of only five reading slots today?
	3. Would this teach something new to a Design System Designer working on a mature enterprise DS?
	4. Is it readable and useful for Design System Designers, Product Designers, or UX Engineers rather than primarily for AI researchers, compiler engineers, or maintainers?

	Use this internal final ranking formula:
	finalScore =
	worthYourTimeScore * 0.28 +
	relevanceScore * 0.20 +
	practicalityScore * 0.14 +
	sourceScore * 0.08 +
	technicalDepthScore * 0.08 +
	noveltyScore * 0.04 +
	(readerValue / 20) * 0.09 +
	(learningValue / 20) * 0.09

	Use recencyScore as a tiebreaker.
	Use sourceCategory to balance the list:
	- Official sources are strong evidence.
	- Practical sources are often better recommended reading.
	- Talk sources are useful explainers.
	- Community sources are adoption signals.
	- Research sources are trend detection and should not outrank clearer teaching resources when evidence quality is similar.
	- Social sources are weak signals only.

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
  "affected_workflow_areas": ["Figma", "Storybook", "React", "React Native", "Azure DevOps", "Governance", "Documentation", "Accessibility", "Internal Design System Agent", "Internal QA Agent"],
  "directDesignSystemEvidence": "",
  "relevance_score": 1-5,
  "worth_your_time_score": 1-5
}

Rules:
- Every field has a target and an absolute max length stated in the field writing rubric above. A response that exceeds any field's absolute max is rejected outright, not trimmed — write to the target, never the max.
- No field may end in "…" or "..." or otherwise trail off. Finish the thought inside the target length instead of running long and cutting it short.
- Do not invent titles.
- Do not invent URLs.
- Use only candidates provided.
- Keep exactly the original URL.
- directDesignSystemEvidence must be a meaningful one-sentence explanation of the exact candidate title/snippet evidence connecting the resource to a Design System anchor.
- Do not use isolated generic words as evidence: frontend, component, design, figma, token, agent, or accessibility.
- Strong evidence must include at least one of: design system, design systems, component library, design tokens, Storybook, Figma component, Figma library, design-to-code, design system agent, QA design system agent, MCP + Figma, MCP + Storybook, AI + design system, AI + component library, AI + design tokens.
- For Figma sources, only select when there is design systems plus AI/MCP/agent/code/tokens/component generation, Figma + MCP + design systems, Figma + design-to-code, Figma + Code Connect, or Figma + component generation.
- Reject the resource if directDesignSystemEvidence would be empty.
- Every selected resource must include at least one AI anchor: AI, artificial intelligence, LLM, agent, MCP, automation, generative, design-to-code, code generation, QA automation, accessibility automation, AI-assisted, machine-readable, RAG, or Copilot.
- Every selected resource must include at least one Design System workflow anchor: design system, design systems, design tokens, component library, Storybook, Figma library, Figma components, Figma metadata, UI code generation, component generation, production-ready UI, component reuse, design mockups to code, component APIs, UI implementation, Code Connect, design QA, governance, documentation, accessibility, React, or React Native.
- Treat design-to-code as a valid mature Design System workflow when it explicitly involves Figma metadata, UI code generation, component generation, production-ready UI, component reuse, design mockups to code, Storybook, component APIs, React, or React Native.
- Do not require the literal phrase "design system" when the resource clearly affects mature DS workflows through Storybook component metadata, Figma metadata, design-to-code, token automation, component generation, QA automation, accessibility automation, documentation automation, or AI agents consuming component APIs.
- Figma2Code-style resources should pass when they connect Figma, design-to-code, LLM/automation, and UI implementation workflow.
- Reject resources with maturityLevel "basic"; prefer advanced signals about improving, automating, validating, governing, or integrating mature Design System workflows.
- If fewer than 5 candidates are worth reading, return fewer than 5 and set needsMoreSources: true.
- Never fabricate resources.
- Trend summary must be max 120 words and focus only on AI impact on Design Systems, Figma, Storybook, tokens, documentation, governance, QA, or agents.
- theSignal must be maximum 140 words. It must identify emerging themes across the selected resources instead of summarizing each article. It must never sound like ChatGPT.
- supportingSignals must contain exactly 3 short editorial observations about selected evidence and ecosystem trends, not individual article summaries.
- nextWeekWatchlist must contain 2-3 short items to watch next week.
- why_it_matters_to_our_team must be unique for each resource and explain exactly how the resource could influence our team's work with Figma libraries, Storybook, design tokens, documentation, accessibility, QA, the internal Design System Agent, or the internal QA Agent.
- why_selected must explain the editorial reason this item earned a slot.
- expected_impact_on_workflow must describe the practical impact on our enterprise workflow.
- ignore_risk must be one sentence beginning with a practical consequence of ignoring the topic.
- impact_score must be 1-5 and affected_workflow_areas must use only: Figma, Storybook, React, React Native, Azure DevOps, Governance, Documentation, Accessibility, Internal Design System Agent, Internal QA Agent.

Return valid JSON only with:
{
  "date": "${todayIsoDate()}",
  "trend_summary": "",
  "theSignal": "",
  "supportingSignals": [],
  "nextWeekWatchlist": [],
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
      supportingSignals: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" }
      },
      nextWeekWatchlist: {
        type: "array",
        minItems: 2,
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
              items: {
                type: "string",
                enum: [
                  "Figma",
                  "Storybook",
                  "React",
                  "React Native",
                  "Azure DevOps",
                  "Governance",
                  "Documentation",
                  "Accessibility",
                  "Internal Design System Agent",
                  "Internal QA Agent"
                ]
              }
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
    required: ["date", "trend_summary", "theSignal", "supportingSignals", "nextWeekWatchlist", "needsMoreSources", "resources"],
    additionalProperties: false
  };
}

// Gemini's responseSchema is the OpenAPI 3.0 Schema subset, not raw JSON
// Schema: "type" values are uppercase enum names and "additionalProperties"
// isn't part of the dialect. Derive it from jsonSchema() so OpenAI and Gemini
// stay constrained by the same field list instead of two hand-maintained copies.
function toGeminiSchema(node: Record<string, unknown>): Record<string, unknown> {
  const { additionalProperties: _additionalProperties, ...rest } = node;
  const converted: Record<string, unknown> = { ...rest };
  if (typeof converted.type === "string") {
    converted.type = converted.type.toUpperCase();
  }
  if (converted.properties && typeof converted.properties === "object") {
    converted.properties = Object.fromEntries(
      Object.entries(converted.properties as Record<string, Record<string, unknown>>).map(([key, value]) => [
        key,
        toGeminiSchema(value)
      ])
    );
  }
  if (converted.items && typeof converted.items === "object") {
    converted.items = toGeminiSchema(converted.items as Record<string, unknown>);
  }
  return converted;
}

function toPublicDigest(rankedDigest: RankedDigest): Digest {
  return withEditorialSections({
    date: rankedDigest.date,
    trend_summary: rankedDigest.trend_summary,
    theSignal: rankedDigest.theSignal,
    supportingSignals: rankedDigest.supportingSignals,
    thisWeeksSignals: rankedDigest.supportingSignals,
    nextWeekWatchlist: rankedDigest.nextWeekWatchlist,
    resources: rankedDigest.resources.map((resource) => ({
      title: resource.title,
      source: resource.source,
      url: resource.url,
      type: resource.type,
      published_date: resource.published_date,
      // RankedResourceSchema's max() is a generous backstop, not a render-time
      // cut (see the comment there), so this must not re-truncate — that was
      // the original bug (PR-19). Only normalize whitespace/entities.
      summary: cleanText(resource.summary),
      cleanSummary: cleanText(resource.summary),
      design_system_angle: cleanText(resource.design_system_angle),
      why_it_matters_to_our_team: cleanText(resource.why_it_matters_to_our_team),
      why_selected: cleanText(resource.why_selected),
      expected_impact_on_workflow: cleanText(resource.expected_impact_on_workflow),
      who_should_read: resource.who_should_read,
      estimated_reading_time: resource.estimated_reading_time,
      ignore_risk: cleanText(resource.ignore_risk),
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
  const storybookReleaseSignals = [
    "storybook ai",
    "mcp",
    "model context protocol",
    "component manifest",
    "docgen",
    "ai checklist",
    "component metadata",
    "docs automation",
    "documentation automation",
    "qa automation",
    "accessibility automation"
  ];
  const lowQuality = resources.filter(
    (resource) => {
      const text = `${resource.title} ${resource.source} ${resource.url} ${resource.summary} ${
        resource.design_system_angle
      } ${resource.directDesignSystemEvidence}`.toLowerCase();
      const isReleaseNote = /(^|\s)(changelog|release notes?|releases?)(\s|$)/i.test(
        `${resource.title} ${resource.source} ${resource.url}`
      );
      const relevantStorybookRelease =
        isReleaseNote &&
        text.includes("storybook") &&
        storybookReleaseSignals.some((signal) => text.includes(signal));

      return (
        resource.relevance_score < 4 ||
        resource.worth_your_time_score < 4 ||
        resource.directDesignSystemEvidence.trim().length === 0 ||
        !aiEvidenceForText(text) ||
        !designSystemEvidenceForText(text) ||
        maturityLevelForText(text) === "basic" ||
        (isReleaseNote && !relevantStorybookRelease) ||
        normalizedTitles.filter((title) => title === resource.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
          .length > 1
      );
    }
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
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(jsonSchema())
        }
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
