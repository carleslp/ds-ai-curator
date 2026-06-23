import { renderEmail } from "../src/emailTemplate.js";
import { buildSubject, createMockDigest } from "../src/mockDigest.js";

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(statusCode: number): VercelResponse;
  json(body: unknown): void;
};

export default function handler(request: VercelRequest, response: VercelResponse): void {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const digest = createMockDigest();

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    subject: buildSubject(digest.date),
    html: renderEmail(digest),
    digest
  });
}
