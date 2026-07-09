import type { Digest, Resource } from "./emailTemplate.js";
import type { CandidateSignal } from "./editorialThesis.js";

type SectionName =
  | "theSignal"
  | "editorsPick"
  | "supportingSignals"
  | "suggestedExperiment"
  | "questionsForOurTeam"
  | "watchlist"
  | "supportingResources";

export type OwnershipCheck = {
  label: string;
  pass: boolean;
};

export type SectionContractResult = {
  machineryLeakPass: boolean;
  offendingTerms: string[];
  ownershipPresencePass: boolean;
  ownershipChecks: OwnershipCheck[];
  evaluatedText: string;
  notes: string[];
};

export type RedundancyMatrixEntry = {
  pair: string;
  score: number;
  warning: boolean;
};

export type TensionHonestyResult = {
  hadContradictingEvidence: boolean;
  surfacedTension: boolean;
  conformant: boolean;
};

export type SectionContractsDebug = {
  sectionContracts: Record<SectionName, SectionContractResult>;
  redundancyMatrix: RedundancyMatrixEntry[];
  tensionHonesty: TensionHonestyResult;
  sectionContractViolations: string[];
  sectionContractWarnings: string[];
};

const bannedTerms = [
  "selected",
  "candidate",
  "evidence",
  "evidence item",
  "lead evidence",
  "supporting evidence",
  "resource",
  "ranked",
  "ranking",
  "rating",
  "rated",
  "score",
  "scored",
  "editorial read",
  "editorial score",
  "workflow-impact",
  "workflow score",
  "quality-adjusted",
  "quality-adjusted score",
  "cluster",
  "pipeline",
  "formation",
  "grounded in",
  "M0",
  "M1",
  "M2",
  "M2.5",
  "M2.6",
  "M2.7",
  "thesis path",
  "debug",
  "prompt",
  "LLM reasoning",
  "selection reason",
  "rejection reason",
  "source marker",
  "independence marker",
  "relevance_score",
  "worth_your_time",
  "actionability"
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
  "our",
  "their",
  "about",
  "because",
  "before",
  "after",
  "than",
  "then",
  "today",
  "week"
]);

// Abbreviations whose trailing period is not a sentence boundary. Kept short
// and lower-cased; matching is case-insensitive.
const nonTerminalAbbreviations = [
  "e.g",
  "i.e",
  "vs",
  "etc",
  "approx",
  "no",
  "fig",
  "inc",
  "ltd",
  "corp",
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "ph.d",
  "u.s",
  "u.k",
  "a.i"
];

// Counts sentences without treating decimal numbers or common abbreviations as
// terminators. The naive `split(/[.!?]+/)` counted "Cursor 2.5" and "e.g." as
// extra sentences, which made every Signal that named a versioned tool/model
// (i.e. nearly every real week) exceed the two-sentence ownership check and get
// silently replaced by the deterministic template. We mask those interior dots
// before splitting so the count reflects actual sentences.
function sentenceCount(value: string): number {
  // Drop the interior dots in decimals and abbreviations so they cannot
  // terminate a sentence, then count what remains.
  let masked = value.replace(/(\d)\.(?=\d)/g, "$1");
  for (const abbreviation of nonTerminalAbbreviations) {
    const pattern = new RegExp(`\\b${abbreviation.replace(/\./g, "\\.")}\\.`, "gi");
    masked = masked.replace(pattern, (match) => match.replace(/\./g, ""));
  }
  return masked.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
}

function uniqueTerms(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^a-z0-9\s-]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
  );
}

function overlapScore(a: string, b: string): number {
  const left = uniqueTerms(a);
  const right = uniqueTerms(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const term of left) {
    if (right.has(term)) shared += 1;
  }

  return Math.round((shared / Math.min(left.size, right.size)) * 100) / 100;
}

function offendingTermsFor(value: string): string[] {
  const text = value.toLowerCase();
  return bannedTerms.filter((term) => {
    const normalized = term.toLowerCase();
    if (/^[a-z0-9_]+$/.test(normalized)) {
      return new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(value);
    }

    return text.includes(normalized);
  });
}

function resourceContractText(resource: Resource): string {
  return [
    resource.editorialTitle,
    resource.cleanSummary,
    resource.summary,
    resource.why_selected,
    resource.expected_impact_on_workflow,
    resource.why_it_matters_to_our_team,
    resource.ignore_risk
  ]
    .filter(Boolean)
    .join(" ");
}

function sectionResult(text: string, ownershipChecks: OwnershipCheck[], notes: string[]): SectionContractResult {
  const offendingTerms = offendingTermsFor(text);
  return {
    machineryLeakPass: offendingTerms.length === 0,
    offendingTerms,
    ownershipPresencePass: ownershipChecks.every((check) => check.pass),
    ownershipChecks,
    evaluatedText: text,
    notes
  };
}

function editorsPickText(resource: Resource | null): string {
  if (!resource) return "";
  return `${resource.cleanSummary ?? ""} ${resource.summary} ${resource.why_selected ?? ""} ${resource.expected_impact_on_workflow ?? ""}`;
}

function questionsText(questions: string[]): string {
  return questions.join(" ");
}

function watchlistText(watchlist: string[]): string {
  return watchlist.join(" ");
}

function isFutureLooking(value: string): boolean {
  return /\b(watch|look|track|whether|when|if|until|ships|adopts|moves|starts|emerges|confirms|complicates|breaks)\b/i.test(value);
}

function supportingSignalsSurfaceTension(signals: string[]): boolean {
  return /\b(tension|counter|however|but|complicate|complicates|although|despite|unless|risk|breaks)\b/i.test(signals.join(" "));
}

export function validateSectionContracts(digest: Digest, leadSignal: CandidateSignal | null): SectionContractsDebug {
  const hadContradictingEvidence = Boolean(leadSignal?.evidence.some((item) => item.stance === "contradicts"));
  const surfacedTension = supportingSignalsSurfaceTension(digest.supportingSignals);
  const tensionHonesty = {
    hadContradictingEvidence,
    surfacedTension,
    conformant: hadContradictingEvidence ? surfacedTension : !surfacedTension
  };
  const supportingResourceText = digest.resources.map(resourceContractText).join(" ");

  const sectionContracts: Record<SectionName, SectionContractResult> = {
    theSignal: sectionResult(
      digest.theSignal,
      [
        { label: "At most two sentences (a thesis, not an article-by-article recap)", pass: sentenceCount(digest.theSignal) <= 2 },
        { label: "No raw URL in the prose", pass: !/https?:\/\//i.test(digest.theSignal) }
      ],
      ["Answers what is newly true this week.", "Must stay abstract and avoid named artifacts."]
    ),
    editorsPick: sectionResult(
      editorsPickText(digest.editorsPick),
      [{ label: "Names a concrete artifact (title and source)", pass: Boolean(digest.editorsPick?.title && digest.editorsPick?.source) }],
      ["Explains the concrete artifact without describing selection mechanics."]
    ),
    supportingSignals: sectionResult(
      digest.supportingSignals.join(" "),
      [{ label: "Between one and three observations", pass: digest.supportingSignals.length >= 1 && digest.supportingSignals.length <= 3 }],
      ["Shows what strengthens or complicates the claim."]
    ),
    suggestedExperiment: sectionResult(
      digest.suggestedExperiment,
      [
        { label: "States a reason ('because')", pass: /\bbecause\b/i.test(digest.suggestedExperiment) },
        { label: "Gives one concrete starting action ('start with')", pass: /\bstart with\b/i.test(digest.suggestedExperiment) }
      ],
      ["Owns localized stakes and exactly one practical action."]
    ),
    questionsForOurTeam: sectionResult(
      questionsText(digest.teamDiscussionQuestions),
      [
        { label: "Two or three questions", pass: digest.teamDiscussionQuestions.length >= 2 && digest.teamDiscussionQuestions.length <= 3 },
        { label: "Every item ends with a question mark", pass: digest.teamDiscussionQuestions.every((question) => question.trim().endsWith("?")) }
      ],
      ["Keeps unresolved team debate separate from action."]
    ),
    watchlist: sectionResult(
      watchlistText(digest.nextWeekWatchlist),
      [
        { label: "Two or three items", pass: digest.nextWeekWatchlist.length >= 2 && digest.nextWeekWatchlist.length <= 3 },
        { label: "Every item is future-looking", pass: digest.nextWeekWatchlist.every(isFutureLooking) }
      ],
      ["Names future triggers that could confirm, complicate, or break the thesis."]
    ),
    supportingResources: sectionResult(
      supportingResourceText,
      [{ label: "Card copy present for machinery scan", pass: true }],
      ["Checks generated card copy for machinery vocabulary."]
    )
  };

  const redundancyMatrix: RedundancyMatrixEntry[] = [
    ["The Signal ↔ Editor's Pick", digest.theSignal, editorsPickText(digest.editorsPick)],
    ["The Signal ↔ Suggested Experiment", digest.theSignal, digest.suggestedExperiment],
    ["Editor's Pick ↔ Suggested Experiment", editorsPickText(digest.editorsPick), digest.suggestedExperiment],
    ["Suggested Experiment ↔ Questions", digest.suggestedExperiment, questionsText(digest.teamDiscussionQuestions)],
    ["Watchlist ↔ The Signal", watchlistText(digest.nextWeekWatchlist), digest.theSignal]
  ].map(([pair, left, right]) => {
    const score = overlapScore(left, right);
    return {
      pair,
      score,
      warning: score >= 0.42
    };
  });

  const sectionContractViolations = Object.entries(sectionContracts).flatMap(([sectionName, result]) => {
    const messages: string[] = [];
    if (!result.machineryLeakPass) {
      messages.push(`${sectionName} contains machinery vocabulary: ${result.offendingTerms.join(", ")}.`);
    }
    if (!result.ownershipPresencePass) {
      const failed = result.ownershipChecks.filter((check) => !check.pass).map((check) => check.label);
      messages.push(`${sectionName} does not satisfy ownership presence checks: ${failed.join("; ")}.`);
    }
    return messages;
  });

  if (!tensionHonesty.conformant) {
    sectionContractViolations.push(
      tensionHonesty.hadContradictingEvidence
        ? "Supporting Signals should surface a real counter-current because contradicting material exists."
        : "Supporting Signals appears to invent tension even though no contradicting material exists."
    );
  }

  const sectionContractWarnings = redundancyMatrix
    .filter((entry) => entry.warning)
    .map((entry) => `${entry.pair} overlap is ${entry.score}.`);

  return {
    sectionContracts,
    redundancyMatrix,
    tensionHonesty,
    sectionContractViolations,
    sectionContractWarnings
  };
}
