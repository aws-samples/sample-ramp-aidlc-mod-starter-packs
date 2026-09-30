---
description: Requirements traceability & fidelity for document/FSD-driven work. Use whenever generating or reviewing requirements from FSDs, functional specs, screenshots, or a migration/rewrite of an existing app (e.g. OutSystems): ground every requirement in an FSD/screen anchor, produce a Traceability Matrix with bidirectional coverage, and tag NEW / NEEDS-CLARIFICATION instead of inventing or dropping behavior. Applies during Phase 1 requirements.md generation and its approval gate. Skip for pure greenfield with no source documents.
---
# Requirements Traceability & Fidelity

**Applies when** the input includes **FSDs / functional documents or screenshots**
(Document or Hybrid mode from Phase 0). For **pure greenfield** with no source
documents, this does not apply — skip it.

Every requirement must be **grounded in the Phase 0 analysis artifacts and the
source documents — never invented.** Applies Phase 0 → Phase 1 and downstream.

## Source anchors (the canonical IDs)
- Establish a **stable anchor scheme** from whatever the inputs provide and use it
  verbatim thereafter — e.g. FSD requirement/section IDs, screen names or numbers,
  a figure index, or ticket IDs.
- If the documents already carry IDs (requirement codes, screen numbers, figure
  indices), those are **authoritative** — preserve them exactly; do not renumber or
  invent IDs.
- If they don't, assign your own stable IDs once (e.g. `SCR-01`, `FR-01`) and record
  the mapping in the Phase 0 inventory so every later reference is consistent.

## Phase 0 (Reverse Engineering / Input Analysis) obligations
- Preserve the source anchors **verbatim** in every analysis artifact
  (`business-overview.md`, `bounded-contexts.md`, `api-documentation.md`,
  `component-inventory.md`).
- Emit a **screen / anchor inventory** (the UI/screen catalog plus any requirement /
  FSD IDs) that Phase 1 can map requirements against.

## Phase 1 (Requirements) obligations
- Every user story and functional requirement carries a **Source** field naming its
  anchor (FSD ID / screen / figure).
- A requirement with no source anchor is tagged **`NEW`** with a one-line rationale —
  this deliberately surfaces enhancements and platform-isms (e.g. OutSystems-specific
  behavior) for an explicit decision rather than letting them slip in silently.
- `requirements.md` includes a **Traceability Matrix**:

  | Req ID | Source (FSD ID / Screen) | Bounded Context | In / Out of Scope |
  |---|---|---|---|

- **Bidirectional coverage:** every in-scope anchor maps to ≥1 requirement, **or**
  appears under an explicit *Out-of-Scope* list. No silent drops.
- **Fidelity:** requirement wording must reflect the behavior documented in the cited
  source/analysis. Do **not** invent rules absent from the documents/analysis. If a
  rule is ambiguous, tag it **`NEEDS-CLARIFICATION`** and add it to the human decision
  log — never guess.
- The **In / Out of Scope** column is the natural home for the **domain scoping**
  decision (which bounded contexts this build covers) — keep it consistent with the
  Phase 2 domain model.

## Visual grounding (screenshots) — text-first, image-on-demand
The document **text** (field lists, button logic, rules) is the primary source and is
what you read by default. Embedded screenshots/wireframes are **not** ingested just by
reading the markdown — you must open the image file to see it.

- **Default:** derive requirements from the document text around each figure; cite the
  figure/screen anchor.
- **Open the referenced screenshot** (vision read of the image file) **when** the text
  is thin, ambiguous, or a field/control appears only in the UI — then reconcile what
  you see with the text before writing the requirement.
- Do **not** bulk-open all screenshots; open only the figures a requirement actually
  depends on. Note in the requirement when a detail came from the screenshot rather
  than the text.

## Gate check — run before approving `requirements.md`
- [ ] Every requirement has a **Source** or a **`NEW`** tag.
- [ ] Traceability Matrix present and complete.
- [ ] Coverage report: list any in-scope anchor with **no** requirement (gaps) and any
      requirement with **no** source (unsourced).
- [ ] All `NEW` / `NEEDS-CLARIFICATION` items collected for the human to decide at the
      approval gate.

> Present this as a natural part of the requirements review, not as procedural
> overhead. The goal is a requirements set a reviewer can check screen-by-screen
> against the current app.
