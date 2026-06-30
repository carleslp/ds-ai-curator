import type { CandidateResource } from "./collectCandidates.js";
import type { EditorialQualification } from "./editorialQualification.js";
import type { EditorialSelectionDecision } from "./editorialSelection.js";
import type { TopicClassification } from "./topicClassifier.js";
import { cleanText } from "./textUtils.js";

export type EditorialRole =
  | "Evidence"
  | "Teaching"
  | "Practice"
  | "Counterpoint"
  | "Watchlist"
  | "Ignore"
  | "Reference";

export type EditorialRoleFit = {
  role: EditorialRole;
  fit: "strong" | "medium" | "weak";
  reason: string;
  readerJob: string;
  shouldBeReaderFacing: boolean;
};

export type EditorialRoleAssignment = {
  title: string;
  url: string;
  source: string;
  primaryRole: EditorialRole;
  possibleEditorialRoles: EditorialRoleFit[];
};

export type EditorialRoleDebug = {
  roleAssignments: EditorialRoleAssignment[];
  summary: {
    evaluatedCount: number;
    qualifiedCount: number;
    rejectedCount: number;
    roleCounts: Record<EditorialRole, number>;
    readerFacingCount: number;
    notes: string[];
  };
};

type AssignEditorialRolesParams = {
  candidates: CandidateResource[];
  editorialQualification: EditorialQualification[];
  editorialSelection: EditorialSelectionDecision[];
  topicClassifications: TopicClassification[];
};

const roleOrder: EditorialRole[] = [
  "Ignore",
  "Evidence",
  "Teaching",
  "Practice",
  "Counterpoint",
  "Watchlist",
  "Reference"
];

const fitWeight: Record<EditorialRoleFit["fit"], number> = {
  strong: 3,
  medium: 2,
  weak: 1
};

function emptyRoleCounts(): Record<EditorialRole, number> {
  return {
    Evidence: 0,
    Teaching: 0,
    Practice: 0,
    Counterpoint: 0,
    Watchlist: 0,
    Ignore: 0,
    Reference: 0
  };
}

function normalizeUrl(url: string): string {
  return url.replace(/[#?].*$/, "").replace(/\/$/, "");
}

function textForCandidate(candidate: CandidateResource): string {
  return cleanText(
    `${candidate.title} ${candidate.source} ${candidate.url} ${candidate.snippet} ${candidate.cleanSummary} ${candidate.rawText} ${candidate.directDesignSystemEvidence}`
  ).toLowerCase();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function fit(
  role: EditorialRole,
  strength: EditorialRoleFit["fit"],
  reason: string,
  readerJob: string,
  shouldBeReaderFacing: boolean
): EditorialRoleFit {
  return {
    role,
    fit: strength,
    reason,
    readerJob,
    shouldBeReaderFacing
  };
}

function isReleaseOrPrimary(text: string, candidate: CandidateResource): boolean {
  return (
    candidate.sourceCategory === "Official" ||
    candidate.sourceCategory === "Research" ||
    hasAny(text, [
      "release notes",
      "changelog",
      "/releases",
      "releases.atom",
      "rfc",
      "api reference",
      "reference documentation",
      "official docs",
      "github.com/releases",
      "arxiv"
    ])
  );
}

function isTeachingArtifact(text: string, candidate: CandidateResource): boolean {
  return (
    candidate.sourceCategory === "Practical" ||
    candidate.sourceCategory === "Talk" ||
    hasAny(text, [
      "essay",
      "talk",
      "video",
      "conference",
      "session",
      "deep dive",
      "explainer",
      "guide",
      "walkthrough",
      "medium",
      "smashing",
      "frontend masters",
      "practitioner"
    ])
  );
}

function isPracticeArtifact(text: string): boolean {
  return hasAny(text, [
    "case study",
    "implementation",
    "workflow",
    "playbook",
    "process",
    "team",
    "engineering blog",
    "migration",
    "integration",
    "how we",
    "example"
  ]);
}

function isWatchlistSignal(text: string): boolean {
  return hasAny(text, [
    "alpha",
    "beta",
    "preview",
    "experiment",
    "prototype",
    "rfc",
    "early",
    "emerging",
    "new",
    "introducing"
  ]);
}

function isReferenceDoc(text: string): boolean {
  return hasAny(text, [
    "documentation",
    "docs",
    "api reference",
    "reference documentation",
    "help center",
    "search results",
    "documentation index",
    "docs index"
  ]);
}

function isCounterpoint(text: string): boolean {
  return hasAny(text, [
    "risk",
    "limitation",
    "limits",
    "fails",
    "failure",
    "concern",
    "trade-off",
    "tradeoff",
    "critique",
    "against",
    "security",
    "privacy",
    "governance risk"
  ]);
}

function roleFitsFor(
  candidate: CandidateResource,
  qualification: EditorialQualification | undefined,
  selection: EditorialSelectionDecision | undefined,
  topics: TopicClassification | undefined
): EditorialRoleFit[] {
  const text = textForCandidate(candidate);
  const rejected = qualification?.qualificationDecision === "rejected";
  const selectionRejected = Boolean(selection?.rejectionReason);
  const releaseOrPrimary = isReleaseOrPrimary(text, candidate);
  const referenceDoc = isReferenceDoc(text);
  const teachingArtifact = isTeachingArtifact(text, candidate) && !releaseOrPrimary;
  const practiceArtifact = isPracticeArtifact(text);
  const watchlistSignal = isWatchlistSignal(text);
  const fits: EditorialRoleFit[] = [];

  if (rejected) {
    fits.push(
      fit(
        "Ignore",
        "strong",
        qualification?.qualificationReason || selection?.rejectionReason || "Rejected by prior editorial qualification.",
        "Keep keyword-only or off-domain material out of the reader experience.",
        false
      )
    );
  }

  if (releaseOrPrimary && !rejected) {
    fits.push(
      fit(
        "Evidence",
        candidate.sourceCategory === "Official" || candidate.sourceCategory === "Research" ? "strong" : "medium",
        "Primary-source format can prove that something happened or changed.",
        "Verify the thesis with the source closest to the change.",
        true
      )
    );
  }

  if (teachingArtifact && !rejected) {
    fits.push(
      fit(
        "Teaching",
        candidate.learningValue >= 80 || candidate.readerValue >= 80 ? "strong" : "medium",
        "Explainer, essay, talk, or practitioner source helps a senior DS reader understand the thesis.",
        "Help the reader understand the underlying shift.",
        true
      )
    );
  } else if (releaseOrPrimary && hasAny(text, ["release notes", "changelog", "/releases"])) {
    fits.push(
      fit(
        "Teaching",
        "weak",
        "Release-note formats can provide context but should almost never teach the thesis.",
        "Provide minimal background only when no better teaching artifact exists.",
        false
      )
    );
  }

  if (practiceArtifact && !rejected) {
    fits.push(
      fit(
        "Practice",
        hasAny(text, ["case study", "implementation", "workflow", "migration"]) ? "strong" : "medium",
        "Practical workflow or implementation material can translate the thesis into team behavior.",
        "Show how a Design System team might act on the shift.",
        true
      )
    );
  }

  if (isCounterpoint(text) && !rejected) {
    fits.push(
      fit(
        "Counterpoint",
        "medium",
        "The candidate introduces a real limitation, risk, critique, or governance concern.",
        "Complicate the thesis without inventing tension.",
        true
      )
    );
  }

  if (watchlistSignal && !rejected) {
    fits.push(
      fit(
        "Watchlist",
        releaseOrPrimary ? "strong" : "medium",
        "Early-stage or experimental signal is worth monitoring before recommendation.",
        "Help the reader know what to track next.",
        true
      )
    );
  }

  if (referenceDoc) {
    fits.push(
      fit(
        "Reference",
        rejected ? "medium" : "strong",
        "Documentation/reference material may support background lookup but should not be treated as recommended reading.",
        "Serve as background material when a reader needs implementation details.",
        !rejected && !hasAny(text, ["search results", "documentation index", "docs index"])
      )
    );
  }

  if (selectionRejected && !rejected && fits.length === 0) {
    fits.push(
      fit(
        "Ignore",
        "medium",
        selection?.rejectionReason || "Selection did not find a clear reader-facing job for this candidate.",
        "Keep technically relevant but weak material out of the current reader experience.",
        false
      )
    );
  }

  if (fits.length === 0) {
    const hasDsTopic = Boolean(topics?.designSystemTopics.length || topics?.workflowTopics.length);
    fits.push(
      fit(
        hasDsTopic ? "Watchlist" : "Ignore",
        hasDsTopic ? "weak" : "medium",
        hasDsTopic
          ? "Relevant enough to monitor, but no strong reader-facing editorial job is clear yet."
          : "No clear Design System editorial job was inferred.",
        hasDsTopic ? "Track cautiously until its editorial job is clearer." : "Keep it out of the newsletter.",
        false
      )
    );
  }

  return fits.sort((a, b) => {
    const weightDifference = fitWeight[b.fit] - fitWeight[a.fit];
    if (weightDifference !== 0) return weightDifference;
    return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
  });
}

function primaryRoleFor(fits: EditorialRoleFit[]): EditorialRole {
  return fits[0]?.role ?? "Ignore";
}

export function assignEditorialRoles(params: AssignEditorialRolesParams): EditorialRoleDebug {
  const qualificationByUrl = new Map(params.editorialQualification.map((item) => [normalizeUrl(item.url), item]));
  const selectionByUrl = new Map(params.editorialSelection.map((item) => [normalizeUrl(item.url), item]));
  const topicsByUrl = new Map(params.topicClassifications.map((item) => [normalizeUrl(item.url), item]));
  const roleCounts = emptyRoleCounts();

  const roleAssignments = params.candidates.map((candidate): EditorialRoleAssignment => {
    const fits = roleFitsFor(
      candidate,
      qualificationByUrl.get(normalizeUrl(candidate.url)),
      selectionByUrl.get(normalizeUrl(candidate.url)),
      topicsByUrl.get(normalizeUrl(candidate.url))
    );
    const primaryRole = primaryRoleFor(fits);
    roleCounts[primaryRole] += 1;

    return {
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      primaryRole,
      possibleEditorialRoles: fits
    };
  });

  const qualifiedCount = params.editorialQualification.filter((item) => item.qualificationDecision === "qualified").length;
  const rejectedCount = params.editorialQualification.filter((item) => item.qualificationDecision === "rejected").length;
  const readerFacingCount = roleAssignments.filter((assignment) =>
    assignment.possibleEditorialRoles.some((role) => role.shouldBeReaderFacing)
  ).length;

  return {
    roleAssignments,
    summary: {
      evaluatedCount: roleAssignments.length,
      qualifiedCount,
      rejectedCount,
      roleCounts,
      readerFacingCount,
      notes: [
        "M8 PR1 only assigns roles for debug; it does not change selection, ranking, rendering, or newsletter output.",
        "Editorial principle: candidates are evaluated by the jobs they can fill, not only by score."
      ]
    }
  };
}
