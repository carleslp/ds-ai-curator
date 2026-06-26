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
