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

export type SectionContractResult = {
  machineryLeakPass: boolean;
  offendingTerms: string[];
  ownershipPresencePass: boolean;
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
  "score",
  "scored",
  "editorial score",
  "workflow score",
  "quality-adjusted score",
  "cluster",
  "pipeline",
  "formation",
  "M2",
  "M2.5",
  "thesis path",
  "debug",
  "prompt",
  "LLM reasoning",
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

function sentenceCount(value: string): number {
  return value.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
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

function sectionResult(text: string, ownershipPresencePass: boolean, notes: string[]): SectionContractResult {
  const offendingTerms = offendingTermsFor(text);
  return {
    machineryLeakPass: offendingTerms.length === 0,
    offendingTerms,
    ownershipPresencePass,
    notes
  };
}

function editorsPickText(resource: Resource | null): string {
  if (!resource) return "";
  return `${resource.title} ${resource.source} ${resource.cleanSummary ?? ""} ${resource.summary} ${resource.why_selected ?? ""} ${
    resource.expected_impact_on_workflow ?? ""
  }`;
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
    theSignal: sectionResult(digest.theSignal, sentenceCount(digest.theSignal) <= 2 && !/https?:\/\//i.test(digest.theSignal), [
      "Answers what is newly true this week.",
      "Must stay abstract and avoid named artifacts."
    ]),
    editorsPick: sectionResult(
      editorsPickText(digest.editorsPick),
      Boolean(digest.editorsPick?.title && digest.editorsPick?.source),
      ["Explains the concrete artifact without describing selection mechanics."]
    ),
    supportingSignals: sectionResult(
      digest.supportingSignals.join(" "),
      digest.supportingSignals.length >= 1 && digest.supportingSignals.length <= 3,
      ["Shows what strengthens or complicates the claim."]
    ),
    suggestedExperiment: sectionResult(
      digest.suggestedExperiment,
      /\bbecause\b/i.test(digest.suggestedExperiment) && /\bstart with\b/i.test(digest.suggestedExperiment),
      ["Owns localized stakes and exactly one practical action."]
    ),
    questionsForOurTeam: sectionResult(
      questionsText(digest.teamDiscussionQuestions),
      digest.teamDiscussionQuestions.length >= 2 &&
        digest.teamDiscussionQuestions.length <= 3 &&
        digest.teamDiscussionQuestions.every((question) => question.trim().endsWith("?")),
      ["Keeps unresolved team debate separate from action."]
    ),
    watchlist: sectionResult(
      watchlistText(digest.nextWeekWatchlist),
      digest.nextWeekWatchlist.length >= 2 &&
        digest.nextWeekWatchlist.length <= 3 &&
        digest.nextWeekWatchlist.every(isFutureLooking),
      ["Names future triggers that could confirm, complicate, or break the thesis."]
    ),
    supportingResources: sectionResult(supportingResourceText, true, ["Checks generated card copy for machinery vocabulary."])
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
      messages.push(`${sectionName} does not satisfy ownership presence checks.`);
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
