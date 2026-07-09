import type { CandidateResource } from "./collectCandidates.js";
import type { EditorialBrief } from "./editorialBrief.js";
import type { EditorialQualification } from "./editorialQualification.js";
import type { EditorialRoleAssignment, EditorialRoleDebug, EditorialRoleFit } from "./editorialRoles.js";
import type { EditorialSelectionDecision } from "./editorialSelection.js";
import type { CandidateSignal, SignalEvidence } from "./editorialThesis.js";
import { machineryTermsIn } from "./editorialContracts.js";
import { cleanText, decodeHtmlEntities, stripHtmlTags, truncateText } from "./textUtils.js";

export type LearningRecommendation = {
  title: string;
  url: string;
  author: string;
  source: string;
  format: string;
  estimatedMinutes: number;
  readerGain: string;
  whyRecommended: string;
  confidence: number;
  relationshipToThesis: string;
};

export type LearningRecommendationDebug = {
  recommendation: LearningRecommendation | null;
  recommendedReading: LearningRecommendation | null;
  recommendedReadingSelectionReason: string;
  teachingCandidatesConsidered: TeachingCandidateDebug[];
  teachingCandidatesRejected: TeachingCandidateRejectionDebug[];
  evidenceVsTeachingSeparation: string;
  whyItWon: string;
  alternativesLost: Array<{
    title: string;
    url: string;
    source: string;
    sourceCategory: CandidateResource["sourceCategory"];
    score: number;
    reason: string;
  }>;
  nullConsidered: boolean;
  nullReason: string;
};

export type TeachingCandidateDebug = {
  title: string;
  url: string;
  source: string;
  primaryRole: EditorialRoleAssignment["primaryRole"];
  teachingFit: EditorialRoleFit["fit"];
  qualified: boolean;
  connectedToThesis: boolean;
  score: number;
  reason: string;
};

export type TeachingCandidateRejectionDebug = {
  title: string;
  url: string;
  source: string;
  primaryRole: EditorialRoleAssignment["primaryRole"];
  reason: string;
};

// Stage 2 fetches the full article body for the shortlisted Teaching candidates
// and judges them on that body, not the feed snippet. The fetch is injected so
// the selection logic stays deterministic and unit-testable with fixtures;
// production supplies the real network fetcher (see defaultArticleBodyFetcher).
// A resolved value of null means the body could not be fetched or extracted.
export type ArticleBodyFetcher = (url: string) => Promise<string | null>;

export type LearningRecommendationOptions = {
  fetchArticleBody?: ArticleBodyFetcher;
  maxTeachingFetches?: number;
};

// A Stage 1 survivor: it cleared every metadata-reliable eliminator and is
// eligible for the expensive Stage 2 body fetch. Note there is no teaching
// score here on purpose — a title cannot support one, so Stage 1 only decides
// eligibility, never ranking.
type Stage1Survivor = {
  assignment: EditorialRoleAssignment;
  candidate: CandidateResource;
  teachingFit: EditorialRoleFit;
};

// A Stage 2 result: thesis-connection and teaching comparison computed against
// the fetched body.
type Stage2Judged = {
  survivor: Stage1Survivor;
  bodyFetched: boolean;
  // The extracted article body, retained so the reader-facing justification can
  // be written from it rather than from the selection counts.
  body: string;
  thesisTermMatches: number;
  connectedToThesis: boolean;
  teachingSignalCount: number;
  score: number;
  reason: string;
};

const defaultMaxTeachingFetches = 8;
const articleFetchTimeoutMs = 6000;

type LearningRecommendationInput = {
  editorialBrief: EditorialBrief;
  thesis: CandidateSignal | null;
  evidence: SignalEvidence[];
  qualifiedResources: CandidateResource[];
  editorialQualification?: EditorialQualification[];
  allResources?: CandidateResource[];
  selectionDecisions: EditorialSelectionDecision[];
  editorialRoles?: EditorialRoleDebug;
};

type ScoredLearningCandidate = {
  candidate: CandidateResource;
  score: number;
  relationScore: number;
  teachingScore: number;
  avoidPenalty: number;
  reasons: string[];
};

const preferredCategories = new Set<CandidateResource["sourceCategory"]>(["Practical", "Talk", "Community"]);

const teachingTerms = [
  "guide",
  "tutorial",
  "walkthrough",
  "essay",
  "explainer",
  "talk",
  "lesson",
  "course",
  "how to",
  "example",
  "examples",
  "checklist",
  "playbook",
  "pattern",
  "case study",
  "deep dive"
];

const avoidedTerms = [
  "release notes",
  "changelog",
  "releases.atom",
  "github.com/releases",
  "api reference",
  "reference documentation",
  "rfc",
  "specification"
];

const stopWords = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "into",
  "where",
  "what",
  "when",
  "which",
  "will",
  "would",
  "should",
  "could",
  "about",
  "because",
  "before",
  "after",
  "than",
  "then",
  "week",
  "teams",
  "system",
  "systems"
]);

// Beginner markers — metadata-reliable: a title/URL that advertises 101,
// getting-started, or crash-course material is education for newcomers, not a
// senior-team teaching artifact. Mirrors the beginner penalty in editorialEngine.
const beginnerMarkers = [
  "101",
  "beginner",
  "beginner's",
  "beginners",
  "for beginners",
  "getting started",
  "intro to",
  "introduction to",
  "crash course",
  "from scratch",
  "step-by-step guide for new"
];

// Teaching cues we look for in the fetched body (Stage 2). Unlike title cues,
// these are read against the full article text, where they actually mean the
// piece explains something rather than merely names a topic.
const teachingBodySignals = [
  "for example",
  "for instance",
  "step ",
  "first,",
  "next,",
  "here's how",
  "here is how",
  "how to",
  "walkthrough",
  "walk through",
  "let's",
  "in practice",
  "the key idea",
  "the takeaway",
  "consider",
  "imagine",
  "case study",
  "lesson",
  "pattern",
  "principle",
  "rule of thumb"
];

function hostAndPath(url: string): { host: string; path: string } {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname.toLowerCase(), path: parsed.pathname.toLowerCase() };
  } catch {
    const lower = url.toLowerCase();
    return { host: lower, path: lower };
  }
}

// Stage 1 metadata-reliable genre classifier. Returns a human-readable genre
// label when the URL/format alone proves the artifact can never be Teaching,
// otherwise null. Deliberately conservative: it keys off URL structure and
// unambiguous format words, never off teaching "quality", which a title cannot
// carry.
function nonTeachingGenre(candidate: CandidateResource): string | null {
  const { host, path } = hostAndPath(candidate.url);
  const text = textForCandidate(candidate);

  // Changelogs / release notes.
  if (
    /\/(releases?|changelog|release-notes|tags?)(\/|$)/.test(path) ||
    path.endsWith("releases.atom") ||
    hasAny(text, ["release notes", "changelog", "releases.atom", "github.com/releases"])
  ) {
    return "changelog/release notes (Evidence, not Teaching)";
  }

  // Documentation / reference / help-center / search-result pages.
  if (
    /\/(docs?|documentation|reference|api|manual|handbook)(\/|$)/.test(path) ||
    /\/(search|hc)(\/|$|\?)/.test(path) ||
    host.startsWith("help.") ||
    hasAny(text, ["api reference", "reference documentation", "documentation index", "docs index", "help center", "help center search"])
  ) {
    return "documentation/reference page (Reference, not Teaching)";
  }

  // Event / ticket / RSVP pages.
  if (
    ["eventbrite.com", "lu.ma", "meetup.com", "ti.to", "hopin.com"].some((eventHost) => host === eventHost || host.endsWith(`.${eventHost}`)) ||
    /\/(events?|tickets?|register|rsvp)(\/|$)/.test(path) ||
    hasAny(text, ["buy tickets", "register now", "rsvp", "get your ticket"])
  ) {
    return "event/ticket page (not Teaching)";
  }

  // GitHub topic / org / collection listing pages (and bare user/topic landings),
  // which are indexes, not articles.
  if (host === "github.com" || host.endsWith(".github.com")) {
    const segments = path.split("/").filter(Boolean);
    if (segments[0] === "topics" || segments[0] === "orgs" || segments[0] === "collections" || segments.length <= 1) {
      return "GitHub topic/listing page (not Teaching)";
    }
  }

  return null;
}

function hasBeginnerMarker(candidate: CandidateResource): boolean {
  const text = `${candidate.title} ${candidate.url}`.toLowerCase();
  return beginnerMarkers.some((marker) => text.includes(marker));
}

function lowTierOrThinSource(candidate: CandidateResource): string | null {
  if (candidate.sourceTier === 3) {
    return "tier-3 source (too low-authority to be the week's recommended reading)";
  }
  if (candidate.sourceCategory === "Social") {
    return "social source (too thin for a teaching recommendation)";
  }
  return null;
}

// ≤8 cap ordering: prefer the most authoritative tier first, then the source
// categories best suited to teaching. No teaching score is involved — this only
// decides which survivors are worth the fetch budget when more than the cap
// clear Stage 1.
function fetchCategoryRank(category: CandidateResource["sourceCategory"]): number {
  if (category === "Practical") return 0;
  if (category === "Talk") return 1;
  if (category === "Community") return 2;
  return 3;
}

function orderSurvivorsForFetch(survivors: Stage1Survivor[]): Stage1Survivor[] {
  return [...survivors].sort((a, b) => {
    if (a.candidate.sourceTier !== b.candidate.sourceTier) {
      return a.candidate.sourceTier - b.candidate.sourceTier;
    }
    return fetchCategoryRank(a.candidate.sourceCategory) - fetchCategoryRank(b.candidate.sourceCategory);
  });
}

function countTeachingBodySignals(bodyText: string): number {
  const lower = bodyText.toLowerCase();
  let count = 0;
  for (const signal of teachingBodySignals) {
    if (lower.includes(signal)) count += 1;
  }
  return count;
}

// Lightweight HTML → article-body extraction. Prefers the semantic <article> or
// <main> region, drops non-content chrome, strips tags/entities, and caps length
// so a single huge page cannot dominate term counting.
function extractArticleBody(html: string): string {
  const withoutChrome = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");

  const articleMatch = withoutChrome.match(/<article[\s\S]*?<\/article>/i);
  const mainMatch = withoutChrome.match(/<main[\s\S]*?<\/main>/i);
  const region = articleMatch?.[0] ?? mainMatch?.[0] ?? withoutChrome;

  const text = cleanText(stripHtmlTags(decodeHtmlEntities(region)));
  return text.slice(0, 20000);
}

async function defaultArticleBodyFetcher(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), articleFetchTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ds-ai-curator/1.0 (+recommended-reading body fetch)",
        accept: "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && contentType !== "") return null;
    const html = await response.text();
    const body = extractArticleBody(html);
    return body.length >= 200 ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function emptyLearningRecommendation(): LearningRecommendationDebug {
  return {
    recommendation: null,
    recommendedReading: null,
    recommendedReadingSelectionReason: "",
    teachingCandidatesConsidered: [],
    teachingCandidatesRejected: [],
    evidenceVsTeachingSeparation: "",
    whyItWon: "",
    alternativesLost: [],
    nullConsidered: true,
    nullReason: "Learning Recommendation did not run because no qualified resources were available."
  };
}

function normalizeUrl(url: string): string {
  return url.replace(/[#?].*$/, "").replace(/\/$/, "");
}

function uniqueQualifiedResources(resources: CandidateResource[]): CandidateResource[] {
  const seen = new Set<string>();
  const qualified: CandidateResource[] = [];

  for (const resource of resources) {
    const key = normalizeUrl(resource.url);
    if (seen.has(key)) continue;
    qualified.push(resource);
    seen.add(key);
  }

  return qualified;
}

function textForCandidate(candidate: CandidateResource): string {
  return cleanText(`${candidate.title} ${candidate.source} ${candidate.url} ${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText}`).toLowerCase();
}

function relationTerms(input: LearningRecommendationInput): Set<string> {
  const text = cleanText(
    [
      input.editorialBrief.thesis,
      input.editorialBrief.narrativeHeadline,
      input.editorialBrief.newReality,
      input.editorialBrief.whyNow,
      input.editorialBrief.editorialPosition,
      input.thesis?.claim,
      input.thesis?.whyNow
    ]
      .filter(Boolean)
      .join(" ")
  )
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ");

  return new Set(text.split(/\s+/).filter((term) => term.length > 3 && !stopWords.has(term)));
}

function countMatchingTerms(text: string, terms: Set<string>): number {
  let count = 0;
  for (const term of terms) {
    if (text.includes(term)) count += 1;
  }
  return count;
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function baseLearningDebug(overrides: Partial<LearningRecommendationDebug>): LearningRecommendationDebug {
  const recommendation = overrides.recommendation ?? null;
  return {
    recommendation,
    recommendedReading: overrides.recommendedReading ?? recommendation,
    recommendedReadingSelectionReason: overrides.recommendedReadingSelectionReason ?? overrides.whyItWon ?? "",
    teachingCandidatesConsidered: overrides.teachingCandidatesConsidered ?? [],
    teachingCandidatesRejected: overrides.teachingCandidatesRejected ?? [],
    evidenceVsTeachingSeparation:
      overrides.evidenceVsTeachingSeparation ??
      "Recommended Reading is reserved for Teaching candidates; Evidence and Watchlist candidates remain proof signals.",
    whyItWon: overrides.whyItWon ?? "",
    alternativesLost: overrides.alternativesLost ?? [],
    nullConsidered: overrides.nullConsidered ?? true,
    nullReason: overrides.nullReason ?? ""
  };
}

function candidateByUrl(resources: CandidateResource[]): Map<string, CandidateResource> {
  return new Map(resources.map((resource) => [normalizeUrl(resource.url), resource]));
}

function qualificationSet(resources: CandidateResource[]): Set<string> {
  return new Set(resources.map((resource) => normalizeUrl(resource.url)));
}

function qualifiedUrlSet(input: LearningRecommendationInput): Set<string> {
  if (input.editorialQualification) {
    return new Set(
      input.editorialQualification
        .filter((qualification) => qualification.qualificationDecision === "qualified")
        .map((qualification) => normalizeUrl(qualification.url))
    );
  }

  return qualificationSet(input.qualifiedResources);
}

function connectedResourceUrls(input: LearningRecommendationInput): Set<string> {
  const urls = new Set<string>();
  if (input.thesis?.resourceUrl) urls.add(normalizeUrl(input.thesis.resourceUrl));
  for (const evidence of input.evidence) {
    urls.add(normalizeUrl(evidence.resourceRef.url));
  }
  for (const decision of input.selectionDecisions) {
    if (decision.selectionReason && !decision.rejectionReason) {
      urls.add(normalizeUrl(decision.url));
    }
  }
  return urls;
}

function teachingFitFor(assignment: EditorialRoleAssignment): EditorialRoleFit | null {
  return (
    assignment.possibleEditorialRoles.find((role) => role.role === "Teaching" && role.shouldBeReaderFacing) ?? null
  );
}

function survivorRef(survivor: Stage1Survivor): TeachingCandidateRejectionDebug {
  return {
    title: survivor.assignment.title,
    url: survivor.assignment.url,
    source: survivor.assignment.source,
    primaryRole: survivor.assignment.primaryRole,
    reason: ""
  };
}

// Stage 1 — metadata-reliable elimination only. No teaching score exists here on
// purpose: a title cannot support one. This decides eligibility using URL/genre
// patterns (changelogs, docs/reference, event/ticket, GitHub topic pages →
// never Teaching), beginner markers, and source tier. Thesis-connection and
// teaching comparison are deferred to Stage 2, where the body is available.
function stage1MetadataShortlist(
  input: LearningRecommendationInput,
  resourcesByUrl: Map<string, CandidateResource>,
  qualifiedUrls: Set<string>
): { survivors: Stage1Survivor[]; rejected: TeachingCandidateRejectionDebug[] } {
  const survivors: Stage1Survivor[] = [];
  const rejected: TeachingCandidateRejectionDebug[] = [];

  for (const assignment of input.editorialRoles?.roleAssignments ?? []) {
    const candidate = resourcesByUrl.get(normalizeUrl(assignment.url));
    const teachingFit = teachingFitFor(assignment);
    const reject = (reason: string) =>
      rejected.push({ title: assignment.title, url: assignment.url, source: assignment.source, primaryRole: assignment.primaryRole, reason });

    if (!candidate) {
      reject("Skipped because the source resource was not available to the recommendation engine.");
      continue;
    }
    if (!teachingFit) {
      reject(`Skipped because its reader-facing role is ${assignment.primaryRole}, not Teaching.`);
      continue;
    }
    if (assignment.primaryRole !== "Teaching") {
      reject("Skipped because Recommended Reading requires Teaching as the primary role.");
      continue;
    }
    if (!qualifiedUrls.has(normalizeUrl(candidate.url))) {
      reject("Skipped because it did not pass Editorial Qualification.");
      continue;
    }

    const genre = nonTeachingGenre(candidate);
    if (genre) {
      reject(`Skipped by Stage 1 metadata: ${genre}.`);
      continue;
    }
    if (hasBeginnerMarker(candidate)) {
      reject("Skipped by Stage 1 metadata: beginner marker (101 / getting started / intro), which is newcomer education, not senior-team Teaching.");
      continue;
    }
    const lowTier = lowTierOrThinSource(candidate);
    if (lowTier) {
      reject(`Skipped by Stage 1 metadata: ${lowTier}.`);
      continue;
    }

    survivors.push({ assignment, candidate, teachingFit });
  }

  return { survivors, rejected };
}

// Stage 2 — for the shortlisted survivors only, fetch and extract the article
// body and run thesis-connection + teaching comparison against that body (never
// the snippet). Fetches run in parallel within the ≤8 budget. A survivor whose
// body cannot be fetched, or whose body is not about the thesis, is excluded
// honestly rather than judged on its title/snippet.
async function stage2BodyJudgment(
  shortlist: Stage1Survivor[],
  connectedUrls: Set<string>,
  thesisTerms: Set<string>,
  fetchArticleBody: ArticleBodyFetcher
): Promise<{ judged: Stage2Judged[]; rejected: TeachingCandidateRejectionDebug[] }> {
  const rejected: TeachingCandidateRejectionDebug[] = [];
  const bodies = await Promise.all(
    shortlist.map((survivor) => fetchArticleBody(survivor.candidate.url).catch(() => null))
  );

  const judged: Stage2Judged[] = [];
  shortlist.forEach((survivor, index) => {
    const body = bodies[index];
    const directlyConnected = connectedUrls.has(normalizeUrl(survivor.candidate.url));

    if (!body) {
      rejected.push({
        ...survivorRef(survivor),
        reason: "Skipped in Stage 2 because the article body could not be fetched or extracted; Recommended Reading is judged on the body, not the snippet."
      });
      return;
    }

    const bodyText = body.toLowerCase();
    const thesisTermMatches = countMatchingTerms(bodyText, thesisTerms);
    const connectedToThesis = directlyConnected || thesisTermMatches >= 3;
    const teachingSignalCount = countTeachingBodySignals(body);

    if (!connectedToThesis) {
      rejected.push({
        ...survivorRef(survivor),
        reason: `Skipped in Stage 2 because the fetched body is not about this week's thesis (only ${thesisTermMatches} thesis term(s) present in the article).`
      });
      return;
    }

    const score = thesisTermMatches * 8 + teachingSignalCount * 5 + (directlyConnected ? 15 : 0);
    judged.push({
      survivor,
      bodyFetched: true,
      body,
      thesisTermMatches,
      connectedToThesis,
      teachingSignalCount,
      score,
      reason: `body carries ${thesisTermMatches} thesis-term match(es) and ${teachingSignalCount} teaching cue(s)${directlyConnected ? ", and is directly part of the evidence set" : ""}`
    });
  });

  return { judged, rejected };
}

async function selectRoleBasedRecommendation(
  input: LearningRecommendationInput,
  options: LearningRecommendationOptions
): Promise<LearningRecommendationDebug | null> {
  if (!input.editorialRoles) return null;

  const allResources = uniqueQualifiedResources([...(input.allResources ?? []), ...input.qualifiedResources]);
  const resourcesByUrl = candidateByUrl(allResources);
  const qualifiedUrls = qualifiedUrlSet(input);
  const connectedUrls = connectedResourceUrls(input);
  const thesisTerms = relationTerms(input);
  const fetchArticleBody = options.fetchArticleBody ?? defaultArticleBodyFetcher;
  const maxFetches = Math.max(1, options.maxTeachingFetches ?? defaultMaxTeachingFetches);

  // Stage 1: metadata-only elimination → eligible Teaching survivors.
  const { survivors, rejected: stage1Rejected } = stage1MetadataShortlist(input, resourcesByUrl, qualifiedUrls);
  const ordered = orderSurvivorsForFetch(survivors);
  const shortlist = ordered.slice(0, maxFetches);
  const overflow = ordered.slice(maxFetches);

  const rejected: TeachingCandidateRejectionDebug[] = [...stage1Rejected];
  for (const survivor of overflow) {
    rejected.push({
      ...survivorRef(survivor),
      reason: `Skipped because the Stage 1 shortlist is capped at ${maxFetches}; higher-tier Teaching candidates were fetched first.`
    });
  }

  // Stage 2: body-based thesis-connection + teaching comparison, shortlist only.
  const { judged, rejected: stage2Rejected } = await stage2BodyJudgment(shortlist, connectedUrls, thesisTerms, fetchArticleBody);
  rejected.push(...stage2Rejected);

  const considered: TeachingCandidateDebug[] = judged.map((item) => ({
    title: item.survivor.assignment.title,
    url: item.survivor.assignment.url,
    source: item.survivor.assignment.source,
    primaryRole: item.survivor.assignment.primaryRole,
    teachingFit: item.survivor.teachingFit.fit,
    qualified: true,
    connectedToThesis: item.connectedToThesis,
    score: item.score,
    reason: `Stage 2 (body): ${item.reason}`
  }));

  judged.sort((a, b) => b.score - a.score);
  const best = judged[0] ?? null;
  const nullReason =
    "No Teaching candidate survived Stage 2 body analysis (thesis-connection + teaching comparison on the fetched article), so Recommended Reading was omitted instead of falling back to evidence, docs, or changelogs.";

  if (!best) {
    return baseLearningDebug({
      recommendation: null,
      recommendedReading: null,
      recommendedReadingSelectionReason: nullReason,
      teachingCandidatesConsidered: considered,
      teachingCandidatesRejected: rejected,
      whyItWon: "",
      alternativesLost: [],
      nullConsidered: true,
      nullReason
    });
  }

  const recommendation = recommendationFor(
    {
      candidate: best.survivor.candidate,
      score: best.score,
      relationScore: best.thesisTermMatches,
      teachingScore: best.teachingSignalCount,
      avoidPenalty: 0,
      reasons: [`the fetched article ${best.reason}`, best.survivor.teachingFit.reason]
    },
    input,
    writeTeachingJustification(best.body)
  );
  const whyItWon = `${best.survivor.candidate.title} became Recommended Reading because its fetched article body ${best.reason} — the strongest thesis-connected teaching artifact after Stage 2.`;

  return baseLearningDebug({
    recommendation,
    recommendedReading: recommendation,
    recommendedReadingSelectionReason: whyItWon,
    teachingCandidatesConsidered: considered,
    teachingCandidatesRejected: rejected,
    whyItWon,
    alternativesLost: judged.slice(1, 6).map((item) => ({
      title: item.survivor.candidate.title,
      url: item.survivor.candidate.url,
      source: item.survivor.candidate.source,
      sourceCategory: item.survivor.candidate.sourceCategory,
      score: item.score,
      reason: `Stage 2 (body): ${item.reason}`
    })),
    nullConsidered: true,
    nullReason: "Null was considered because Recommended Reading should disappear rather than fall back to evidence, docs, or changelogs."
  });
}

function formatFor(candidate: CandidateResource): string {
  const text = textForCandidate(candidate);
  if (candidate.sourceCategory === "Talk" || text.includes("youtube") || text.includes("conference") || text.includes("session")) {
    return "Talk";
  }
  if (candidate.sourceCategory === "Research") return "Research";
  if (text.includes("docs") || text.includes("documentation")) return "Docs";
  if (text.includes("course") || text.includes("frontend masters")) return "Course";
  if (text.includes("essay") || candidate.sourceCategory === "Practical") return "Essay";
  return "Article";
}

function estimateMinutes(candidate: CandidateResource, format: string): number {
  if (format === "Talk") return 20;
  if (format === "Course") return 20;
  const textLength = `${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText}`.split(/\s+/).filter(Boolean).length;
  return Math.max(6, Math.min(20, Math.ceil(textLength / 140) + 5));
}

function scoreCandidate(candidate: CandidateResource, thesisTerms: Set<string>): ScoredLearningCandidate {
  const text = textForCandidate(candidate);
  const reasons: string[] = [];
  const relationScore = Math.min(20, countMatchingTerms(text, thesisTerms) * 4);
  const teachingScore = Math.round(candidate.readerValue * 0.35 + candidate.learningValue * 0.45);
  let categoryScore = 0;
  let avoidPenalty = 0;

  if (preferredCategories.has(candidate.sourceCategory)) {
    categoryScore += 18;
    reasons.push(`${candidate.sourceCategory} source is better suited to teaching than proving`);
  } else if (candidate.sourceCategory === "Official") {
    categoryScore += 2;
    reasons.push("official source is useful evidence but weaker as a learning artifact");
  } else if (candidate.sourceCategory === "Research") {
    categoryScore -= 14;
    reasons.push("research source is stronger for trend detection than designer learning");
  } else if (candidate.sourceCategory === "Social") {
    categoryScore -= 18;
    reasons.push("social source is too thin for a learning recommendation");
  }

  if (hasAny(text, teachingTerms)) {
    categoryScore += 14;
    reasons.push("contains teaching cues such as examples, guide, talk, or walkthrough");
  }

  if (hasAny(text, avoidedTerms)) {
    avoidPenalty += 26;
    reasons.push("release-note, RFC, API, or reference format is avoided unless no teaching artifact exists");
  }

  if (relationScore > 0) {
    reasons.push("shares language with this week's thesis");
  }

  return {
    candidate,
    score: teachingScore + categoryScore + relationScore - avoidPenalty,
    relationScore,
    teachingScore,
    avoidPenalty,
    reasons
  };
}

function relationshipToThesisFor(candidate: CandidateResource, input: LearningRecommendationInput): string {
  const thesis = input.editorialBrief.thesis || input.thesis?.claim || "this week's thesis";
  return truncateText(`${candidate.title} helps unpack the practical meaning of ${thesis.charAt(0).toLowerCase()}${thesis.slice(1)}`, 180);
}

// Writes the reader-facing "why this is worth your time" line from the fetched
// article body — what the piece argues, in the article's own words — not from
// selection counts or genre labels. Sentences that carry any machinery
// vocabulary are skipped so the reader never sees the workings; if none of the
// body's sentences qualify the justification is omitted rather than templated.
function writeTeachingJustification(body: string): string {
  const sentences = cleanText(body)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      const wordCount = sentence.split(/\s+/).filter(Boolean).length;
      return wordCount >= 8 && sentence.length <= 240 && machineryTermsIn(sentence).length === 0;
    });

  if (sentences.length === 0) return "";
  return truncateText(sentences.slice(0, 2).join(" "), 220);
}

function recommendationFor(
  scored: ScoredLearningCandidate,
  input: LearningRecommendationInput,
  whyWorthYourTime: string
): LearningRecommendation {
  const format = formatFor(scored.candidate);
  return {
    title: scored.candidate.title,
    url: scored.candidate.url,
    author: scored.candidate.source,
    source: scored.candidate.source,
    format,
    estimatedMinutes: estimateMinutes(scored.candidate, format),
    readerGain: truncateText(
      `A sharper mental model for how this week's shift changes Design System practice, not just whether the claim holds.`,
      170
    ),
    whyRecommended: whyWorthYourTime,
    confidence: Math.max(0.5, Math.min(0.95, Math.round((scored.score / 100) * 100) / 100)),
    relationshipToThesis: relationshipToThesisFor(scored.candidate, input)
  };
}

export async function selectLearningRecommendation(
  input: LearningRecommendationInput,
  options: LearningRecommendationOptions = {}
): Promise<LearningRecommendationDebug> {
  if (!input.editorialBrief.thesis && !input.thesis?.claim) {
    return baseLearningDebug({
      recommendation: null,
      whyItWon: "",
      alternativesLost: [],
      nullConsidered: true,
      nullReason: "Learning Recommendation returned null because no editorial thesis was available to teach."
    });
  }

  const roleBasedRecommendation = await selectRoleBasedRecommendation(input, options);
  if (roleBasedRecommendation) return roleBasedRecommendation;

  const qualified = uniqueQualifiedResources(input.qualifiedResources);
  if (qualified.length === 0) {
    return emptyLearningRecommendation();
  }

  const thesisTerms = relationTerms(input);
  const scored = qualified.map((candidate) => scoreCandidate(candidate, thesisTerms)).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const nullReason = "Null was considered because the recommendation should disappear rather than downgrade to mediocre documentation.";
  const threshold = 72;
  const bestIsAvoidedOfficial = best.candidate.sourceCategory === "Official" && best.avoidPenalty > 0;

  if (!best || best.score < threshold || bestIsAvoidedOfficial) {
    return baseLearningDebug({
      recommendation: null,
      whyItWon: "",
      alternativesLost: scored.slice(0, 5).map((item) => ({
        title: item.candidate.title,
        url: item.candidate.url,
        source: item.candidate.source,
        sourceCategory: item.candidate.sourceCategory,
        score: item.score,
        reason: item.score < threshold ? "Did not clear the teaching threshold." : item.reasons.join("; ")
      })),
      nullConsidered: true,
      nullReason
    });
  }

  // Legacy path (no editorial roles, so no Stage 2 body fetch). Without a body
  // there is nothing to write the justification from, so it is honestly omitted
  // rather than templated.
  const recommendation = recommendationFor(best, input, "");

  return baseLearningDebug({
    recommendation,
    whyItWon: `${best.candidate.title} won because it best balances clarity, learning value, and relationship to the thesis, independent of Evidence selection.`,
    alternativesLost: scored.slice(1, 6).map((item) => ({
      title: item.candidate.title,
      url: item.candidate.url,
      source: item.candidate.source,
      sourceCategory: item.candidate.sourceCategory,
      score: item.score,
      reason: item.avoidPenalty > 0 ? "Lost because the format is closer to release/reference material than teaching." : item.reasons.join("; ")
    })),
    nullConsidered: true,
    nullReason
  });
}
