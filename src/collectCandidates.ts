import { curatedSources, type CuratedSource } from "./sources.js";

export type CandidateResource = {
  title: string;
  url: string;
  source: string;
  published_date?: string;
  snippet: string;
  rawText?: string;
};

const maxCandidates = 30;
const requestTimeoutMs = 8000;

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function normalizeTitle(value: string): string {
  return decodeEntities(stripTags(value)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function absoluteUrl(href: string, baseUrl: string): string | undefined {
  try {
    return new URL(decodeEntities(href), baseUrl).toString();
  } catch {
    return undefined;
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "DS-AI-Curator/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function textBetween(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(stripTags(match[1])) : undefined;
}

function parseFeedItems(xml: string, source: CuratedSource): CandidateResource[] {
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)
  ].map((match) => match[0]);

  return blocks
    .map((block): CandidateResource | undefined => {
      const title = textBetween(block, "title");
      const directLink = textBetween(block, "link");
      const hrefLink = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
      const url = directLink?.startsWith("http")
        ? directLink
        : hrefLink
          ? absoluteUrl(hrefLink, source.url)
          : undefined;
      const publishedDate =
        textBetween(block, "pubDate") ?? textBetween(block, "published") ?? textBetween(block, "updated");
      const snippet =
        textBetween(block, "description") ?? textBetween(block, "summary") ?? textBetween(block, "content") ?? "";

      if (!title || !url) {
        return undefined;
      }

      return {
        title,
        url,
        source: source.name,
        published_date: publishedDate,
        snippet,
        rawText: snippet
      };
    })
    .filter((candidate): candidate is CandidateResource => Boolean(candidate));
}

function parseHtmlItems(html: string, source: CuratedSource): CandidateResource[] {
  const pageTitle = textBetween(html, "title") ?? source.name;
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  return links
    .map((match): CandidateResource | undefined => {
      const url = absoluteUrl(match[1], source.url);
      const title = decodeEntities(stripTags(match[2]));

      if (!url || !title || title.length < 12) {
        return undefined;
      }

      return {
        title,
        url,
        source: source.name,
        snippet: pageTitle,
        rawText: `${title} ${pageTitle}`
      };
    })
    .filter((candidate): candidate is CandidateResource => Boolean(candidate));
}

function parseSourceItems(body: string, source: CuratedSource): CandidateResource[] {
  if (source.kind === "rss" || source.kind === "arxiv") {
    return parseFeedItems(body, source);
  }

  return parseHtmlItems(body, source);
}

function isProbablyEnglish(candidate: CandidateResource): boolean {
  const text = `${candidate.title} ${candidate.snippet}`;
  const asciiChars = text.replace(/[^\x00-\x7F]/g, "").length;
  return text.length === 0 || asciiChars / text.length > 0.85;
}

function isRecentEnough(candidate: CandidateResource): boolean {
  if (!candidate.published_date) {
    return true;
  }

  const published = Date.parse(candidate.published_date);
  if (Number.isNaN(published)) {
    return true;
  }

  const daysOld = (Date.now() - published) / (1000 * 60 * 60 * 24);
  return daysOld <= 730;
}

function dedupeCandidates(candidates: CandidateResource[]): CandidateResource[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: CandidateResource[] = [];

  for (const candidate of candidates) {
    const urlKey = candidate.url.replace(/[#?].*$/, "").replace(/\/$/, "");
    const titleKey = normalizeTitle(candidate.title);
    const similarTitleKey = titleKey.split(" ").slice(0, 8).join(" ");

    if (seenUrls.has(urlKey) || seenTitles.has(similarTitleKey)) {
      continue;
    }

    seenUrls.add(urlKey);
    seenTitles.add(similarTitleKey);
    deduped.push(candidate);
  }

  return deduped;
}

export async function collectCandidates(): Promise<CandidateResource[]> {
  const settled = await Promise.allSettled(
    curatedSources.map(async (source) => {
      const body = await fetchText(source.url);
      return parseSourceItems(body, source);
    })
  );

  const candidates = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    console.error(`Candidate source failed: ${curatedSources[index].name} - ${result.reason}`);
    return [];
  });

  return dedupeCandidates(candidates)
    .filter(isProbablyEnglish)
    .filter(isRecentEnough)
    .slice(0, maxCandidates);
}
