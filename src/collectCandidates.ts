import { curatedSources, type CuratedSource } from "./sources.js";
import { cleanText, decodeHtmlEntities, stripHtmlTags, summarizeReleaseText, truncateText } from "./textUtils.js";

export type CandidateResource = {
  title: string;
  url: string;
  source: string;
  published_date: string;
  snippet: string;
  cleanSummary: string;
  rawText: string;
  sourceTier: 1 | 2 | 3;
  sourceScore: number;
  relevanceScore: number;
  recencyScore: number;
  technicalDepthScore: number;
  practicalityScore: number;
  noveltyScore: number;
  worthYourTimeScore: number;
  directDesignSystemEvidence: string;
};

export type SourceResult = {
  source: string;
  success: boolean;
  candidatesFound: number;
  error: string | null;
};

export type CandidateCollectionResult = {
  candidates: CandidateResource[];
  sourceResults: SourceResult[];
};

type UnscoredCandidateResource = Omit<
  CandidateResource,
  | "relevanceScore"
  | "recencyScore"
  | "technicalDepthScore"
  | "practicalityScore"
  | "noveltyScore"
  | "worthYourTimeScore"
  | "directDesignSystemEvidence"
>;

const maxCandidates = 30;
const requestTimeoutMs = 8000;

function stripTags(value: string): string {
  return stripHtmlTags(decodeHtmlEntities(value)).replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  return decodeHtmlEntities(value).trim();
}

function normalizeTitle(value: string): string {
  return decodeEntities(stripTags(value)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function textForScoring(candidate: Pick<CandidateResource, "title" | "source" | "snippet" | "rawText">): string {
  return ` ${candidate.title} ${candidate.source} ${candidate.snippet} ${candidate.rawText} `.toLowerCase();
}

function countMatches(text: string, terms: string[]): number {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function containsAll(text: string, terms: string[]): boolean {
  return terms.every((term) => text.includes(term));
}

function evidenceSentence(candidate: UnscoredCandidateResource, label: string, matchedTerms: string[]): string {
  const sourceText = compactText(`${candidate.title}. ${candidate.snippet || candidate.rawText}`.slice(0, 260));
  return `${label}: ${matchedTerms.join(" + ")} evidence in title/snippet. ${sourceText}`;
}

function directDesignSystemEvidenceFor(candidate: UnscoredCandidateResource): string {
  const combined = ` ${candidate.title} ${candidate.snippet} ${candidate.rawText} `.toLowerCase();
  const title = candidate.title.toLowerCase();
  const evidenceRules: Array<{ label: string; terms: string[] }> = [
    { label: "Direct Design System anchor", terms: ["design system"] },
    { label: "Direct Design System anchor", terms: ["design systems"] },
    { label: "Component library anchor", terms: ["component library"] },
    { label: "Component library anchor", terms: ["component libraries"] },
    { label: "Design tokens anchor", terms: ["design tokens"] },
    { label: "Storybook workflow anchor", terms: ["storybook"] },
    { label: "Figma component anchor", terms: ["figma", "component"] },
    { label: "Figma library anchor", terms: ["figma", "library"] },
    { label: "Design-to-code anchor", terms: ["design-to-code"] },
    { label: "Design-to-code anchor", terms: ["design to code"] },
    { label: "Design System Agent anchor", terms: ["design system agent"] },
    { label: "QA Design System Agent anchor", terms: ["qa design system agent"] },
    { label: "MCP and Figma anchor", terms: ["mcp", "figma"] },
    { label: "MCP and Figma anchor", terms: ["model context protocol", "figma"] },
    { label: "MCP and Storybook anchor", terms: ["mcp", "storybook"] },
    { label: "MCP and Storybook anchor", terms: ["model context protocol", "storybook"] },
    { label: "AI and Design System anchor", terms: ["ai", "design system"] },
    { label: "AI and Design System anchor", terms: ["artificial intelligence", "design system"] },
    { label: "AI and component library anchor", terms: ["ai", "component library"] },
    { label: "AI and design tokens anchor", terms: ["ai", "design tokens"] }
  ];

  if (title.includes("fine-grained music retrieval")) {
    return "";
  }

  const match = evidenceRules.find((rule) => containsAll(combined, rule.terms));
  if (!match) {
    return "";
  }

  return evidenceSentence(candidate, match.label, match.terms);
}

function calculateRecencyScore(publishedDate: string): number {
  if (!publishedDate) {
    return 3;
  }

  const published = Date.parse(publishedDate);
  if (Number.isNaN(published)) {
    return 3;
  }

  const daysOld = (Date.now() - published) / (1000 * 60 * 60 * 24);
  if (daysOld <= 30) return 5;
  if (daysOld <= 90) return 4;
  if (daysOld <= 365) return 3;
  if (daysOld <= 730) return 2;
  return 1;
}

function scoreCandidate(candidate: UnscoredCandidateResource): CandidateResource {
  const text = textForScoring(candidate);
  const directDsSignals = [
    "design system",
    "design systems",
    "component library",
    "design tokens",
    "storybook",
    "figma",
    "design-to-code",
    "accessibility",
    "governance",
    "design qa",
    "visual regression",
    "model context protocol",
    " mcp "
  ];
  const actionSignals = [
    "release",
    "changelog",
    "documentation",
    "docs",
    "guide",
    "workflow",
    "integration",
    "testing",
    "qa",
    "automation",
    "migration",
    "api",
    "tokens",
    "agent"
  ];
  const technicalSignals = [
    "api",
    "github",
    "storybook",
    "react",
    "react native",
    "code",
    "component",
    "tokens",
    "mcp",
    "schema",
    "metadata",
    "testing",
    "architecture"
  ];
  const noveltySignals = [
    "new",
    "introducing",
    "launch",
    "release",
    "beta",
    "mcp",
    "agent",
    "ai",
    "automation",
    "generation",
    "design-to-code"
  ];

  const relevanceScore = clampScore(2 + Math.min(3, countMatches(text, directDsSignals)));
  const technicalDepthScore = clampScore(2 + Math.min(3, countMatches(text, technicalSignals)));
  const practicalityScore = clampScore(2 + Math.min(3, countMatches(text, actionSignals)));
  const noveltyScore = clampScore(2 + Math.min(3, countMatches(text, noveltySignals)));
  const recencyScore = calculateRecencyScore(candidate.published_date);
  const directDesignSystemEvidence = directDesignSystemEvidenceFor(candidate);
  const worthYourTimeScore = clampScore(
    relevanceScore * 0.35 +
      practicalityScore * 0.25 +
      candidate.sourceScore * 0.2 +
      technicalDepthScore * 0.1 +
      noveltyScore * 0.1
  );

  return {
    ...candidate,
    relevanceScore,
    recencyScore,
    technicalDepthScore,
    practicalityScore,
    noveltyScore,
    worthYourTimeScore,
    directDesignSystemEvidence
  };
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
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
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
  const escapedTag = tag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return match ? cleanText(match[1]) : undefined;
}

function rawTextBetween(xml: string, tag: string): string | undefined {
  const escapedTag = tag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return match ? decodeEntities(match[1]) : undefined;
}

function feedLink(block: string, sourceUrl: string): string | undefined {
  const rssLink = textBetween(block, "link");
  if (rssLink?.startsWith("http")) {
    return rssLink;
  }

  const alternateLink =
    block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1] ??
    block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*\/?>/i)?.[1];

  if (alternateLink) {
    return absoluteUrl(alternateLink, sourceUrl);
  }

  const hrefLink = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1];
  return hrefLink ? absoluteUrl(hrefLink, sourceUrl) : undefined;
}

function parseFeedItems(xml: string, source: CuratedSource): UnscoredCandidateResource[] {
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)
  ].map((match) => match[0]);

  return blocks
    .map((block): UnscoredCandidateResource | undefined => {
      const title = textBetween(block, "title");
      const url = feedLink(block, source.url);
      const publishedDate =
        textBetween(block, "pubDate") ?? textBetween(block, "published") ?? textBetween(block, "updated");
      const rawSnippet =
        rawTextBetween(block, "description") ??
        rawTextBetween(block, "summary") ??
        rawTextBetween(block, "content:encoded") ??
        rawTextBetween(block, "content") ??
        "";

      if (!title || !url) {
        return undefined;
      }

      const isStorybookRelease = source.name === "Storybook Releases";
      const cleanSummary = isStorybookRelease ? summarizeReleaseText(rawSnippet) : truncateText(rawSnippet, 280);
      const displayTitle = isStorybookRelease ? `Storybook release: ${title}` : title;

      if (isStorybookRelease && !cleanSummary) {
        return undefined;
      }

      return {
        title: displayTitle,
        url,
        source: source.name,
        published_date: publishedDate ?? "",
        snippet: cleanSummary,
        cleanSummary,
        rawText: cleanText(rawSnippet),
        sourceTier: source.tier,
        sourceScore: source.sourceScore
      };
    })
    .filter((candidate): candidate is UnscoredCandidateResource => Boolean(candidate));
}

function parseHtmlItems(html: string, source: CuratedSource): UnscoredCandidateResource[] {
  const pageTitle = textBetween(html, "title") ?? source.name;
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  return links
    .map((match): UnscoredCandidateResource | undefined => {
      const url = absoluteUrl(match[1], source.url);
      const title = decodeEntities(stripTags(match[2]));

      if (!url || !title || title.length < 12) {
        return undefined;
      }

      return {
        title,
        url,
        source: source.name,
        published_date: "",
        snippet: pageTitle,
        cleanSummary: truncateText(pageTitle, 280),
        rawText: `${title} ${pageTitle}`,
        sourceTier: source.tier,
        sourceScore: source.sourceScore
      };
    })
    .filter((candidate): candidate is UnscoredCandidateResource => Boolean(candidate));
}

function parseSourceItems(body: string, source: CuratedSource): UnscoredCandidateResource[] {
  if (source.kind === "rss" || source.kind === "arxiv") {
    return parseFeedItems(body, source);
  }

  return parseHtmlItems(body, source);
}

function isProbablyEnglish(candidate: Pick<CandidateResource, "title" | "snippet">): boolean {
  const text = `${candidate.title} ${candidate.snippet}`;
  const asciiChars = text.replace(/[^\x00-\x7F]/g, "").length;
  return text.length === 0 || asciiChars / text.length > 0.85;
}

function isRecentEnough(candidate: Pick<CandidateResource, "published_date">): boolean {
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

function dedupeCandidates<T extends Pick<CandidateResource, "url" | "title">>(candidates: T[]): T[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: T[] = [];

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

function finalizeCandidates(candidates: UnscoredCandidateResource[]): CandidateResource[] {
  return dedupeCandidates(candidates)
    .filter(isProbablyEnglish)
    .filter(isRecentEnough)
    .map(scoreCandidate)
    .sort((a, b) => {
      const scoreDifference =
        b.worthYourTimeScore +
        b.relevanceScore +
        b.sourceScore +
        b.recencyScore -
        (a.worthYourTimeScore + a.relevanceScore + a.sourceScore + a.recencyScore);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return a.sourceTier - b.sourceTier;
    })
    .slice(0, maxCandidates);
}

export async function collectCandidatesWithDiagnostics(): Promise<CandidateCollectionResult> {
  const settled = await Promise.allSettled(
    curatedSources.map(async (source) => {
      const body = await fetchText(source.url);
      const sourceCandidates = parseSourceItems(body, source);
      return { source, candidates: sourceCandidates };
    })
  );

  const sourceResults: SourceResult[] = [];
  const candidates = settled.flatMap((result, index): UnscoredCandidateResource[] => {
    const source = curatedSources[index];

    if (result.status === "fulfilled") {
      const candidatesFound = result.value.candidates.length;
      console.log(`Candidate source fetched: ${source.name} (${candidatesFound} candidates).`);
      sourceResults.push({
        source: source.name,
        success: true,
        candidatesFound,
        error: null
      });
      return result.value.candidates;
    }

    const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.error(`Candidate source failed: ${source.name} - ${error}`);
    sourceResults.push({
      source: source.name,
      success: false,
      candidatesFound: 0,
      error
    });
    return [];
  });

  return {
    candidates: finalizeCandidates(candidates),
    sourceResults
  };
}

export async function collectCandidates(): Promise<CandidateResource[]> {
  const { candidates } = await collectCandidatesWithDiagnostics();
  return candidates;
}
