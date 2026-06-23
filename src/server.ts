import "dotenv/config";
import http from "node:http";
import { renderEmail, type Digest } from "./emailTemplate.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

function jsonResponse(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function buildSubject(date: string): string {
  return `DS × AI Curator — ${date}`;
}

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.NEWSLETTER_TIME_ZONE ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function createMockDigest(): Digest {
  return {
    date: todayIsoDate(),
    trend_summary:
      "AI in design systems is moving from one-off generation toward governed workflows for tokens, documentation, accessibility checks, and design-to-code review.",
    resources: [
      {
        title: "AI-assisted component governance for enterprise design systems",
        url: "https://example.com/ai-component-governance",
        source: "Example Lab",
        type: "Research",
        published_date: todayIsoDate(),
        summary:
          "A practical look at how teams can use AI to audit component usage patterns and identify documentation gaps before they scale."
      },
      {
        title: "Design tokens meet automated implementation checks",
        url: "https://example.com/design-tokens-ai-checks",
        source: "Example Tools",
        type: "Tooling",
        published_date: todayIsoDate(),
        summary:
          "Shows how token changes can be reviewed against implementation output before they reach production."
      },
      {
        title: "Using AI to maintain design system documentation",
        url: "https://example.com/ai-design-system-docs",
        source: "Example Studio",
        type: "Case Study",
        published_date: todayIsoDate(),
        summary:
          "Explores editorial workflows for keeping component guidance current as libraries and product surfaces evolve."
      },
      {
        title: "Automated accessibility notes for reusable components",
        url: "https://example.com/ai-accessibility-components",
        source: "Example Accessibility",
        type: "Accessibility",
        published_date: todayIsoDate(),
        summary:
          "Covers AI-supported review patterns for common component states and interaction guidance."
      },
      {
        title: "From design intent to production-ready UI with human review",
        url: "https://example.com/design-intent-ai-ui",
        source: "Example Product",
        type: "Workflow",
        published_date: todayIsoDate(),
        summary:
          "Frames AI as a workflow assistant that proposes UI changes while preserving review gates for system teams."
      }
    ]
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method !== "GET") {
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }

  if (url.pathname === "/health") {
    jsonResponse(response, 200, { ok: true });
    return;
  }

  if (url.pathname !== "/daily-digest") {
    jsonResponse(response, 404, {
      error: "Not found",
      available_routes: ["/daily-digest", "/health"]
    });
    return;
  }

  try {
    const digest = createMockDigest();

    jsonResponse(response, 200, {
      subject: buildSubject(digest.date),
      html: renderEmail(digest),
      digest
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    jsonResponse(response, 500, {
      error: "Failed to generate daily digest",
      message
    });
  }
});

server.listen(port, host, () => {
  console.log(`DS AI Curator API listening on http://${host}:${port}`);
  console.log(`Daily digest endpoint: http://${host}:${port}/daily-digest`);
});
