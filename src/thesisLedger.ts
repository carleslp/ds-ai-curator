import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ThesisLedgerOutcome = "open" | "confirmed" | "complicated" | "overturned" | "faded";

export type ThesisLedgerEntry = {
  id: string;
  themeAnchor: string | null;
  claimAsPublished: string | null;
  confidenceAtPublication: number | null;
  confidenceDrivers: string[];
  convictionAtPublication: number | null;
  convictionDrivers: string[];
  catalyst: string | null;
  counterOpposingClaim: string | null;
  opportunityMove: string | null;
  outcome: ThesisLedgerOutcome;
  publishedAt: string | null;
  evidenceRefs: string[];
  // --- Graph-ready fields (optional; older entries omit them and still validate). ---
  // canonicalKey is the order-insensitive identity of the thesis (the "@key" idea):
  // it lets "test of system readiness" and "system readiness test" resolve to the
  // same node so continuity does not silently fragment on wording.
  canonicalKey?: string;
  // continuesThesisId: the strongest prior thesis this one develops (a "continues" edge).
  continuesThesisId?: string | null;
  // relatedThesisIds: all prior theses this one is connected to by identity/term overlap.
  relatedThesisIds?: string[];
  // alreadyCitedEvidenceRefs: evidence URLs cited in a prior issue (dedup signal).
  alreadyCitedEvidenceRefs?: string[];
  // isLikelyRepeat: same thesis + same evidence as a prior issue, i.e. nothing developed.
  isLikelyRepeat?: boolean;
};

export type ThesisContinuity = {
  canonicalKey: string;
  continuesThesisId: string | null;
  relatedThesisIds: string[];
  alreadyCitedEvidenceRefs: string[];
  isLikelyRepeat: boolean;
  reason: string;
};

export type ThesisLedgerPreview = {
  totalEntries: number;
  latestPublishedAt: string | null;
  latestClaimAsPublished: string | null;
  latestThemeAnchor: string | null;
  latestOutcome: ThesisLedgerOutcome | null;
};

const inMemoryLedger: ThesisLedgerEntry[] = [];

function isServerlessRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
}

function ledgerPath(): string {
  return process.env.THESIS_LEDGER_PATH ?? path.join(process.cwd(), "data", "thesis-ledger.json");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isLedgerOutcome(value: unknown): value is ThesisLedgerOutcome {
  return value === "open" || value === "confirmed" || value === "complicated" || value === "overturned" || value === "faded";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isThesisLedgerEntry(value: unknown): value is ThesisLedgerEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;

  return (
    typeof entry.id === "string" &&
    isNullableString(entry.themeAnchor) &&
    isNullableString(entry.claimAsPublished) &&
    isNullableNumber(entry.confidenceAtPublication) &&
    isStringArray(entry.confidenceDrivers) &&
    isNullableNumber(entry.convictionAtPublication) &&
    isStringArray(entry.convictionDrivers) &&
    isNullableString(entry.catalyst) &&
    isNullableString(entry.counterOpposingClaim) &&
    isNullableString(entry.opportunityMove) &&
    isLedgerOutcome(entry.outcome) &&
    isNullableString(entry.publishedAt) &&
    isStringArray(entry.evidenceRefs)
  );
}

export async function readThesisLedger(): Promise<ThesisLedgerEntry[]> {
  if (isServerlessRuntime()) {
    return [...inMemoryLedger];
  }

  try {
    const raw = await readFile(ledgerPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.error("Thesis Ledger read skipped: ledger JSON is not an array.");
      return [];
    }

    const entries = parsed.filter(isThesisLedgerEntry);
    if (entries.length !== parsed.length) {
      console.error("Thesis Ledger read skipped invalid entries.");
    }

    return entries;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    console.error(`Thesis Ledger read failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export async function appendThesisLedgerEntry(entry: ThesisLedgerEntry): Promise<void> {
  if (isServerlessRuntime()) {
    inMemoryLedger.push(entry);
    return;
  }

  const entries = await readThesisLedger();
  entries.push(entry);

  try {
    const filePath = ledgerPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`Thesis Ledger write failed; using in-memory fallback: ${error instanceof Error ? error.message : String(error)}`);
    inMemoryLedger.push(entry);
  }
}

export async function createLedgerPreview(): Promise<ThesisLedgerPreview> {
  const entries = await readThesisLedger();
  const latest = [...entries]
    .filter((entry) => entry.publishedAt)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))[0] ?? entries.at(-1);

  return {
    totalEntries: entries.length,
    latestPublishedAt: latest?.publishedAt ?? null,
    latestClaimAsPublished: latest?.claimAsPublished ?? null,
    latestThemeAnchor: latest?.themeAnchor ?? null,
    latestOutcome: latest?.outcome ?? null
  };
}

// --- Graph-memory retrieval -------------------------------------------------
// These functions implement the one genuinely transferable idea from the
// graph-based agent-memory approach: store theses as connected, typed
// knowledge and retrieve from that memory through more than one lens. We use
// two cheap lenses here (thesis identity/keyword overlap + evidence overlap)
// and deliberately DO NOT add a vector index or any multi-writer/branch/merge
// machinery — this is a single weekly writer, so that concurrency layer would
// be cost without benefit. A semantic lens can slot in later behind the same
// interface if keyword+traversal proves to miss real matches.

const LEDGER_STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
  "as", "at", "by", "be", "it", "its", "that", "this", "from", "with", "into",
  "than", "not", "we", "our", "us", "they", "them", "their", "how", "what",
  "why", "when", "which", "more", "less", "over", "about", "becoming", "become"
]);

function ledgerTokens(...texts: Array<string | null | undefined>): Set<string> {
  const tokens = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 3) continue;
      if (LEDGER_STOP_WORDS.has(raw)) continue;
      tokens.add(raw);
    }
  }
  return tokens;
}

// Order-insensitive identity for a thesis: significant tokens, sorted and joined.
// "AI as a test of system readiness" and "system readiness test" collapse to the
// same key, so continuity does not fragment on phrasing.
export function canonicalizeAnchor(anchor: string | null | undefined): string {
  return [...ledgerTokens(anchor)].sort().join("-");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const CONTINUITY_STRONG = 0.6; // same thesis, different wording
const CONTINUITY_WEAK = 0.3; // related thesis worth linking
const EVIDENCE_REPEAT_MIN = 2; // shared evidence items that signal "nothing new"

export function resolveThesisContinuity(
  current: {
    themeAnchor: string | null;
    claimAsPublished: string | null;
    evidenceRefs: string[];
  },
  priorEntries: ThesisLedgerEntry[]
): ThesisContinuity {
  const canonicalKey = canonicalizeAnchor(current.themeAnchor ?? current.claimAsPublished);
  const currentTokens = ledgerTokens(current.themeAnchor, current.claimAsPublished);
  const currentEvidence = new Set(current.evidenceRefs);

  // Lens 1 — identity/keyword traversal over prior theses.
  const scored = priorEntries
    .map((entry) => {
      const priorKey = entry.canonicalKey ?? canonicalizeAnchor(entry.themeAnchor ?? entry.claimAsPublished);
      const priorTokens = ledgerTokens(entry.themeAnchor, entry.claimAsPublished);
      const keyMatch = canonicalKey.length > 0 && priorKey === canonicalKey;
      const overlap = keyMatch ? 1 : jaccard(currentTokens, priorTokens);
      return { entry, overlap };
    })
    .filter((item) => item.overlap >= CONTINUITY_WEAK)
    .sort((a, b) => b.overlap - a.overlap);

  const relatedThesisIds = scored.map((item) => item.entry.id);
  const strongest = scored[0] ?? null;
  const continuesThesisId = strongest && strongest.overlap >= CONTINUITY_WEAK ? strongest.entry.id : null;

  // Lens 2 — evidence overlap (dedup): evidence we have already cited before.
  const priorEvidence = new Set<string>();
  for (const entry of priorEntries) {
    for (const ref of entry.evidenceRefs) priorEvidence.add(ref);
  }
  const alreadyCitedEvidenceRefs = [...currentEvidence].filter((ref) => priorEvidence.has(ref));

  // A likely repeat is the same thesis identity AND largely the same evidence:
  // the "same articles every week" signal the Constitution's memory forbids.
  const strongIdentity = Boolean(strongest && strongest.overlap >= CONTINUITY_STRONG);
  const sharedEnoughEvidence = alreadyCitedEvidenceRefs.length >= EVIDENCE_REPEAT_MIN;
  const isLikelyRepeat = strongIdentity && sharedEnoughEvidence;

  const reason = strongest
    ? `Closest prior thesis "${strongest.entry.claimAsPublished ?? strongest.entry.id}" (overlap ${strongest.overlap.toFixed(2)}); ${alreadyCitedEvidenceRefs.length} evidence item(s) already cited.${isLikelyRepeat ? " Flagged as likely repeat — same thesis, same evidence." : ""}`
    : "No prior thesis is connected to this week's thesis; treat as a new thread.";

  return {
    canonicalKey,
    continuesThesisId,
    relatedThesisIds,
    alreadyCitedEvidenceRefs,
    isLikelyRepeat,
    reason
  };
}
