import { renderEmail } from "../src/emailTemplate.js";

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(statusCode: number): VercelResponse;
  json(body: unknown): void;
};

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function buildSubject(date: string): string {
  return `DS × AI Curator — ${date}`;
}

export default function handler(request: VercelRequest, response: VercelResponse): void {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const today = todayIsoDate();
  const digest: Parameters<typeof renderEmail>[0] = {
    date: today,
    trend_summary:
      "AI in design systems is moving from one-off generation toward governed workflows for tokens, documentation, accessibility checks, and design-to-code review.",
    resources: [
      {
        title: "AI-assisted component governance for enterprise design systems",
        url: "https://example.com/ai-component-governance",
        source: "Example Lab",
        type: "Research",
        published_date: today,
        summary:
          "A practical look at how teams can use AI to audit component usage patterns and identify documentation gaps before they scale."
      },
      {
        title: "Design tokens meet automated implementation checks",
        url: "https://example.com/design-tokens-ai-checks",
        source: "Example Tools",
        type: "Tooling",
        published_date: today,
        summary:
          "Shows how token changes can be reviewed against implementation output before they reach production."
      },
      {
        title: "Using AI to maintain design system documentation",
        url: "https://example.com/ai-design-system-docs",
        source: "Example Studio",
        type: "Case Study",
        published_date: today,
        summary:
          "Explores editorial workflows for keeping component guidance current as libraries and product surfaces evolve."
      },
      {
        title: "Automated accessibility notes for reusable components",
        url: "https://example.com/ai-accessibility-components",
        source: "Example Accessibility",
        type: "Accessibility",
        published_date: today,
        summary:
          "Covers AI-supported review patterns for common component states and interaction guidance."
      },
      {
        title: "From design intent to production-ready UI with human review",
        url: "https://example.com/design-intent-ai-ui",
        source: "Example Product",
        type: "Workflow",
        published_date: today,
        summary:
          "Frames AI as a workflow assistant that proposes UI changes while preserving review gates for system teams."
      }
    ]
  };

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    subject: buildSubject(digest.date),
    html: renderEmail(digest),
    digest
  });
}
