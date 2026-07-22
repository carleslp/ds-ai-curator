# DS × AI Curator — Session Handoff

**Purpose of this document:** transfer an in-progress editorial-engineering collaboration to a new chat. Read it fully before advising on anything.

---

## 1. What this project is

**DS × AI Curator** — a weekly intelligence briefing on where AI meets *mature Design Systems*. Personal project of Carles Llavina (Senior DS Designer at PepsiCo; publishes independently as *llavina design lab*).

- **Audience:** Principal DS Designers, Design Engineers, UX/frontend engineers who own part of a system, DesignOps leads. Senior. Never beginners.
- **Format:** one email, Friday, 15–20 minutes.
- **It is NOT:** a newsletter, link aggregator, trend report, or collection of interesting AI articles. It is a publication with editorial judgement.
- **Mission is narrow on purpose:** AI × *mature design systems*, not AI generally. Widening the mission to grow reach is an explicit failure mode.

**Editorial Promise:** after reading, the reader can take a **defensible position** they couldn't before — not merely "know what happened."

---

## 2. Roles in this collaboration

| Where | Job |
|---|---|
| **This chat** | Editorial judgement. What the week is about, whether a gate is editorially correct, whether output is good, reviewing what Claude Code built, and **saying no to architecture.** |
| **Claude Code** (terminal, `~/dev/ds-ai-curator`) | Implementation. Never asked "what should the publication be?" — only "implement this specified change." |

**Handoff artifact between them:** a brief (`/tmp/PRnn.md`), not a conversation. What to change, what NOT to touch, acceptance criteria.

**Standing instruction:** Carles brings proposed new architecture *here first* so it can be argued against. The project has a documented pattern of proposing a new orchestration layer (Editorial Deliberation → Editorial Roles → Issue Composer) as "the thing that will finally make judgement real." Each time, the real fix was smaller and structural. **Do not build the Issue Composer.**

---

## 3. Frozen editorial foundations — do not relitigate

Both documents exist and are treated as immutable:

- `docs/EDITORIAL_CONSTITUTION.md` — mission, reader, promise, 10 principles, resource philosophy, rejection catalogue, voice, failure modes.
- **Editorial Decision Model** — the operational playbook for judgement without scores.

**The principles that keep coming up in practice:**

- **Teach, don't inform.** Teaching value ≠ actionability. (This is why the Monday Morning Test must not apply to Teaching candidates — PR-8.)
- **Judgement is the product.** Anyone can aggregate.
- **Zero beats filler.** Run a thin issue or nothing rather than pad.
- **Consequence over novelty.** New is easy; new-and-it-changes-something is the job.
- **Release notes are evidence that something is real, almost never the thing to read.** (PR-7 Rule 2.)
- **Tell them what to ignore** — "the most valuable and most under-supplied thing we offer." **Still not built.**
- **Invisible machinery.** The reader sees a publication, never its workings. No scores, no match counts, no role labels, no enum-joined lists, no internal vocabulary.

**From the Decision Model:**
- Value is **relational and contextual**, not intrinsic. Comparison > scoring.
- **Eliminate on questions, compare on taste.** Taste enters *late*, after disciplined elimination.
- The machine's characteristic failure: collapsing the final judgement back into a score, measuring what's measurable (authority, reach, keyword density) instead of what matters.
- Two-stage funnel: **eliminate on cheap metadata-reliable signals (genre via URL, beginner markers), judge on the fetched body.** Never ask a title to support a teaching judgement.

---

## 4. Current technical state

**Repo:** `github.com/carleslp/ds-ai-curator` · **Working dir:** `~/dev/ds-ai-curator` · **Deployed:** `ds-ai-curator.vercel.app`
**Git identity:** `carleslp` / `carlesllavina2@gmail.com`
**Stack:** TypeScript/Node, Vercel, Gemini 2.5-flash (OpenAI quota exhausted — Gemini is the live provider), Make for email delivery.

### Environment gotchas (these cost hours — do not rediscover them)

- **No `dotenv` import anywhere.** A local `.env` is NOT read. Must export:
  ```bash
  export GEMINI_API_KEY="…"
  export THESIS_ENGINE=true
  claude
  ```
- **`THESIS_ENGINE=true` is mandatory for any verification.** With it off, `applyRepresentativeRenderingAssembly` short-circuits to `emptyEditorialWritingLayerDebug()` and `checkedCardCount` is always 0 — you'd be testing a stub. `.env.example` ships `false`.
- **`.npmrc`** in repo root points npm at the public registry (machine's global config points at PepsiCo Artifactory; `npm install` 404s without it). It's gitignored.
- **`/api/debug-digest` and `/api/daily-digest` each trigger their OWN separate digest run** with independent provider outcomes. Never compare one endpoint's debug to the other endpoint's email.
- **Make's HTTP module times out at 40s**; the digest takes longer. Needs raising to 300s. Not yet done.

### PRs landed (all verified on live runs)

| PR | What |
|---|---|
| **PR-7** | Role-conditional qualification. Evidence = strict DS×AI. Teaching/Practice = strong DS relevance + thesis support, **need NOT mention AI**. Rule 2: releases/changelogs/docs are eligible only as Evidence, never surfaced as reading. |
| **PR-8** | Actionability gate (Monday Morning Test) no longer applies to Teaching candidates. |
| **PR-9** | Beginner-penalty false positive: "Typography as a System: **Beyond** Font Choices and Scale" was penalized as 101 content by a blind substring match. Now backs off when a depth qualifier is present. |
| **PR-10** | Structural scraping-artifact filter at collection. Drops nav fragments ("Design systems", "Docs", "Enterprise"). Discriminator is exact-match against a chrome-label set, **not** length. |
| **PR-11** | `parseHtmlItems` prefers the first `<h1>`–`<h6>` inside the card as title. Was feeding the whole card through `stripHtmlTags`, which turns every block-closing tag into a literal `". "`. |
| **PR-12** | **Source list overhaul, 97 → 69.** Cut GitHub/YouTube search-result pages, Figma marketing pages, docs navs, conference homepages. Added `medium.com/feed/design-systems-collective`, `uxdesign.cc/feed`, `sparkbox.com/foundry/feed`. |
| **PR-13** | Cut two more nav-draggers: Figma Releases, Atlassian Design System. 69 → 67. |
| **PR-14** | **`success` now means "extracted >0 candidates", not "HTTP 200".** Four sources had contributed nothing for the project's whole life while reporting success. Cut Shopify Polaris (dead), replaced IBM Carbon / Adobe Spectrum / Material Design with GitHub `releases.atom` feeds. 67 → 66. |
| **PR-16** | Made `whyItMatters` fire for every resource. **Introduced a leak** (see PR-17). |
| **PR-17** | Fixed the leak: `why_it_matters_to_our_team` now uses `resource.X ?? template(...)` like its siblings; `whyItMatters()` skips raw `directDesignSystemEvidence`; banned terms extended. |
| **PR-18** | **THE BIG ONE.** Added `responseSchema` to the Gemini call. `rankAndSummarizeWithGemini` set only `responseMimeType: "application/json"` with no schema, so Gemini intermittently dropped `relevance_score`/`worth_your_time_score` → zod invalid_type → whole run silently degraded. **This is why runs alternated between `liveGemini` and `candidateFallback` with nothing changed. It was never quota or 503s.** |
| **PR-19** | Length budgets: `.max()` on LLM-authored Zod fields + budgets stated in the generation prompt. Removed render-time ellipsis truncation of engine-authored prose. |

### Key metrics — the arc

```
filteredCandidateCount:   1  →  10 (peak)  →  4 (current, pool variance)
candidateCount:          30 (maxCandidates cap — unchanged)
Pipeline:  rawCount 4,379 → deduped 2,149 → plausible 1,647 → capped 30
```

The pool was **never thin**. It was 2,149 items competing for 30 slots, ~25 of which were Figma nav links and Storybook doc sections. **One source-list change (PR-12) did more than PR-7 through PR-11 combined.** The gates were never the problem.

### Latest verified live run (2026-07-17 09:33)

```
mode: liveGemini · degraded: false · thesisEngineEnabled: true
fallbackApplied: [false ×7]     ← every section is Gemini's prose
thesisLedgerEntryCount: 1 · filteredCandidateCount: 4 · promotedEvidenceCount: 10
```

The issue now carries **zero changelogs** — three real articles from Design Systems Collective, UX Collective, Brad Frost. The lead rotates (it was "Agentic Design Systems" for days, now "From vibe to specs: reclaiming the design process with SAID framework"). That was pool variance, **not a pin** — no diagnostic needed.

---

## 5. Open work

### In flight

**PR-20a** — `why_it_matters` overflows its card. PR-19 removed ellipsis truncation and set prompt budgets, but the budget is **larger than the card renders**. Text is now complete in the data and **visually clipped mid-sentence by CSS** in three cards, with no ellipsis. Measure the real render budget in `emailTemplate.ts`, bring the Zod `.max()` + prompt budget down to match. **Verify by rendering the email HTML, not by counting JSON field length.**

### Next

**PR-20** — the lead card (Editor's Pick) has the exact bug PR-17 fixed on the resource cards, in the most-read position:
- `whyWorthYourTime` renders the article's **title + its own excerpt**, not a judgment. ("From vibe to specs: reclaiming the design process with SAID framework. How AI-native workflows and Git are replacing static handoffs…")
- `readerTakeaway` renders an identical template in **every issue for weeks**: "A sharper mental model for how this week's shift changes Design System practice, not just whether the claim holds."

Both must be written per-artifact from the fetched body, using PR-17's `resource.X ?? template(...)` pattern. Omit rather than repeat. Respect PR-20a's budgets.

### Backlog (not scoped, roughly by value)

- **The ignore list.** The Constitution's "most valuable and most under-supplied thing we offer." Rejection reasons are computed every run and thrown away. **Caution:** the raw dismissal strings are keyword-rejections ("Skipped because the Monday Morning Test produced no concrete team change") — surfacing them cheaply would expose machinery as judgement and destroy trust faster than it builds it.
- **Thesis ledger is in-memory on Vercel** (`isServerlessRuntime()` → array that dies on cold start). It writes (`thesisLedgerEntryCount: 1`) but doesn't persist week-to-week. Needs a durable `THESIS_LEDGER_PATH`. Continuity edges + repeat detection (`resolveThesisContinuity`, `canonicalizeAnchor`) are built and working but **not yet consumed** by thesis formation.
- **Dead feeds:** Figma Blog, Storybook Blog, Tokens Studio Blog all 404 (confirmed). This is why a Storybook *changelog* led every issue — the Storybook *blog* feed is dead. Was scoped as PR-15; unclear if it ran.
- **Sparkbox feed uses `<dc:date>`**, which `parseFeedItems` doesn't read (only `pubDate`/`published`/`updated`) → items arrive dateless → recency filter drops them. Source is inert.
- **`test:selection` fails on unmodified `main`** — pre-existing, confirmed via `git stash`. A quietly-red test.
- **Product Disrupt contributes ~140 items**, more than anything else. `kind: "html"`. Nav-drag suspect.
- **`publicationSafeText()` half-launders** — swaps `evidence`→`signal` but misses `anchor:` and `in title/snippet`. A sanitizer doing its job incompletely; worth an audit.
- **Make timeout** 40s → 300s.
- **16 AI-industry sources** (OpenAI, Anthropic, Vercel, Cursor, Windsurf, LangGraph, CrewAI…) produce clean real headlines that are **not about design systems**. Recommendation was to cut all 16; Carles hasn't decided. It's a mission call.

---

## 6. Hard-won learnings — read these

### The signature failure mode of this codebase

**Components fail while reporting success.** Every major bug has been this shape:
- A 429 produced a confident-looking newsletter with a fabricated Signal.
- A validator silently swapped LLM prose for a template and passed.
- Four sources contributed zero for months while `sourceResults` said `success: true`.
- Gemini dropped required fields and the run degraded without anyone noticing.
- `spectrum.adobe.com/feed` returns **HTTP 200 with `content-type: text/html`** — an SPA catch-all shell pretending to be a feed.

**Principle:** `success` must mean "produced the thing," never "the request completed." **Verify content-type, not status code. Verify the render, not the JSON.**

### Verification discipline

- **Never compare a live run to a fallback run.** This caused a real misdiagnosis (`ignore_risk` was blamed on PR-16; the diff was byte-identical — the difference was synthesis mode). Claude Code caught it by checking the diff line-by-line instead of trusting the claim.
- **A "prefer LLM content" fix cannot be verified on a degraded run** — there's no LLM content to prefer; the `??` always takes the template branch.
- **Verify by rendering the HTML.** Twice a fix passed its acceptance criteria and broke the page (PR-19 passed "no ellipsis found" while introducing CSS clipping).
- **Require `checkedCardCount > 0`** — it proves `enrichResources` actually ran.

### Process

- **One change per PR. Non-negotiable.** PR-2 bundled four asks and delivered one. PR-4 asked for four cosmetic fixes in one file and delivered all four. PR-5 asked for one thing and nailed it. **Bundled briefs silently drop items** — the `3/5` line, the missing space, and the `.?` each survived three consecutive briefs that asked for their removal, then all landed the moment they got a PR to themselves.
- **Ask Claude Code to show the mechanism before proposing a fix.** Every hard bug was solved the moment the actual code/text was visible, and none were solved by theorizing.
- **When Claude Code says it can't reproduce something, believe it and dig.** It was right about the "missing space" (the space was in the source; Gmail was collapsing whitespace across a newline between `</strong>` and the text — fix was `&nbsp;`).
- **Claude Code has network access; this chat doesn't.** Let it verify feed URLs. It found 4 of 5 suggested URLs were 404s or dormant.
- **A source must be ACTIVE, not just good.** EightShapes (Nathan Curtis — the most-cited DS essayist alive) is dormant: newest post 2024-03-11. A dormant feed is dead weight.
- **Publication feeds > individual practitioner feeds.** Publications aggregate practitioners and are consistently active. Design Systems Collective gave 10 recent items including two directly on-thesis; a personal blog gives one good post a quarter.

### Editorial calls Carles made (his judgement, respect them)

- **Accepted the Evidence/Teaching split** (PR-7): Evidence strict DS×AI; Teaching/Practice = DS-relevant + supports the thesis's implied work, no AI mention required.
- **"I can't digest a Storybook release."** This became PR-7 Rule 2 — releases are evidence, never reading. He arrived at the Constitution's Resource Philosophy independently, from reading his own output.
- **Spotted that `ignore_risk` is engine-authored, not excerpted**, and therefore should never be truncated — the ellipsis promises a continuation that doesn't exist. This became PR-19.

---

## 7. How to pick up

1. Ask for the current `git log --oneline -5` and the latest debug + email.
2. Parse the debug: `mode`, `degraded`, `fallbackApplied` per section, `filteredCandidateCount`, `checkedCardCount`. **If `degraded: true` or `mode: candidateFallback`, most conclusions about editorial quality are void** — you're reading the deterministic fallback.
3. Confirm PR-20a landed (cards render fully, no clipping). Then PR-20.
4. **Read the email as an editor, not a mechanic.** The Constitution's test: *could a Principal take a defensible position they couldn't before?*

**The framing that matters:** this engine spent months producing template fallbacks that Carles evaluated as editorial decisions. It wasn't making bad calls — it was making *no* calls, then pretending. Everything since has been about making the machine honest first, then making it good. It is now honest. It is becoming good.

---

*Handoff written 2026-07-17. Latest verified live run: 09:33 — `liveGemini`, `degraded: false`, all 7 sections LLM-authored, zero changelogs in the issue.*
