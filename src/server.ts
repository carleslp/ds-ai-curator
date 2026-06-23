import http from "node:http";
import { renderEmail } from "./emailTemplate.js";
import { buildSubject, getDailyDigest } from "./digestService.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

function jsonResponse(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
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

  if (url.pathname !== "/daily-digest" && url.pathname !== "/api/daily-digest") {
    jsonResponse(response, 404, {
      error: "Not found",
      available_routes: ["/api/daily-digest", "/daily-digest", "/health"]
    });
    return;
  }

  const result = await getDailyDigest();
  const { digest } = result;

  jsonResponse(response, 200, {
    subject: buildSubject(digest.date),
    html: renderEmail(digest),
    digest,
    ...(process.env.NODE_ENV !== "production"
      ? {
          debug: {
            usedFallback: result.usedFallback,
            ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {})
          }
        }
      : {})
  });
});

server.listen(port, host, () => {
  console.log(`DS AI Curator API listening on http://${host}:${port}`);
  console.log(`Daily digest endpoint: http://${host}:${port}/api/daily-digest`);
});
