export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

export function stripHtmlTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(h[1-6]|p|div|section|article|ul|ol|li|br|tr|td|th)\b[^>]*>/gi, ". ")
    .replace(/<[^>]+>/g, " ");
}

export function cleanText(value: unknown): string {
  const decoded = decodeHtmlEntities(String(value ?? ""));
  const withoutTags = stripHtmlTags(decoded);
  return decodeHtmlEntities(withoutTags)
    .replace(/\s*\.\s*\.\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value: unknown, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safeCut = lastSpace > 120 ? truncated.slice(0, lastSpace) : truncated;
  return `${safeCut.trimEnd()}…`;
}

const releaseRelevantKeywords = [
  "ai",
  "mcp",
  "storybook ai",
  "design system",
  "design systems",
  "component",
  "components",
  "docs",
  "documentation",
  "accessibility",
  "testing",
  "test",
  "qa"
];

export function summarizeReleaseText(value: unknown, maxLength = 280): string {
  const text = cleanText(value);
  const sentences = text
    .split(/(?<=[.!?])\s+|(?:\s[-*]\s)+/g)
    .map((sentence) => cleanText(sentence))
    .filter(Boolean);
  const relevant = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return releaseRelevantKeywords.some((keyword) => lower.includes(keyword));
  });
  const selected = relevant.length > 0 ? relevant : sentences;
  return truncateText(selected.slice(0, 3).join(" "), maxLength);
}
