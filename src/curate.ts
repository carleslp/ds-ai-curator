import "dotenv/config";
import OpenAI from "openai";
import { z } from "zod";

const ResourceSchema = z.object({
  title: z.string().min(1),
  source: z.string().min(1),
  type: z.string().min(1),
  url: z.string().url(),
  published_date: z.string().min(1),
  summary: z.string().min(1)
});

const CuratedResourcesSchema = z.object({
  date: z.string().min(1),
  trend_summary: z.string().min(1),
  resources: z.array(ResourceSchema).length(5)
});

export type CuratedResources = z.infer<typeof CuratedResourcesSchema>;

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.NEWSLETTER_TIME_ZONE ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function curatedResourcesJsonSchema() {
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
            type: { type: "string" },
            url: { type: "string" },
            published_date: { type: "string" },
            summary: { type: "string" }
          },
          required: [
            "title",
            "source",
            "type",
            "url",
            "published_date",
            "summary"
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
Use web search to find exactly 5 English-language resources about AI + Design Systems for ${date}.

Return valid JSON only with:
- date
- trend_summary
- resources

Each resource must include:
- title
- source
- type
- url
- published_date
- summary

Use a concise type label such as Research, Tooling, Product, Case Study, Standards, Accessibility, or Workflow.
Prefer current, substantive resources from primary sources, official product updates, standards bodies, research papers, conference talks, or expert analysis. Avoid duplicates and make the design systems connection explicit in the summary.
`;
}

export async function curateResources(): Promise<CuratedResources> {
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
        name: "curated_ai_design_systems_resources",
        strict: true,
        schema: curatedResourcesJsonSchema()
      }
    }
  });

  const parsed = JSON.parse(response.output_text);
  return CuratedResourcesSchema.parse(parsed);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  curateResources()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
