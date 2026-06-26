import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  appendThesisLedgerEntry,
  createLedgerPreview,
  readThesisLedger,
  type ThesisLedgerEntry
} from "./thesisLedger.js";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "ds-ai-curator-ledger-"));
const ledgerPath = path.join(tempDir, "thesis-ledger.json");
process.env.THESIS_LEDGER_PATH = ledgerPath;
delete process.env.VERCEL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;

const missingLedger = await readThesisLedger();
assert.deepEqual(missingLedger, [], "Missing ledger file should read as an empty ledger.");

const entry: ThesisLedgerEntry = {
  id: "ledger-test-1",
  themeAnchor: "AI-ready component metadata",
  claimAsPublished: "Component metadata is becoming the substrate for Design System agents.",
  confidenceAtPublication: 0.72,
  confidenceDrivers: ["Storybook MCP activity", "Figma metadata workflows"],
  convictionAtPublication: 0.84,
  convictionDrivers: ["Direct workflow impact", "Reusable enterprise pattern"],
  catalyst: "Storybook exposes component metadata to AI workflows.",
  counterOpposingClaim: "Teams may continue relying on static documentation.",
  opportunityMove: "Prototype component metadata retrieval for the internal DS Agent.",
  outcome: "open",
  publishedAt: "2026-06-26T00:00:00.000Z",
  evidenceRefs: ["https://storybook.js.org/"]
};

await appendThesisLedgerEntry(entry);
assert.deepEqual(await readThesisLedger(), [entry], "Appended ledger entry should persist to the ledger adapter.");

const preview = await createLedgerPreview();
assert.equal(preview.totalEntries, 1);
assert.equal(preview.latestPublishedAt, entry.publishedAt);
assert.equal(preview.latestClaimAsPublished, entry.claimAsPublished);
assert.equal(preview.latestThemeAnchor, entry.themeAnchor);
assert.equal(preview.latestOutcome, entry.outcome);

await writeFile(ledgerPath, "{ invalid json", "utf8");
assert.deepEqual(await readThesisLedger(), [], "Corrupt ledger data should not crash and should read as empty.");
assert.deepEqual(
  await createLedgerPreview(),
  {
    totalEntries: 0,
    latestPublishedAt: null,
    latestClaimAsPublished: null,
    latestThemeAnchor: null,
    latestOutcome: null
  },
  "Corrupt ledger data should not crash the digest-facing preview."
);

await rm(tempDir, { recursive: true, force: true });

console.log("Thesis Ledger test passed.");
