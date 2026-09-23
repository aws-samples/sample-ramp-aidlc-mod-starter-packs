---
description: Start the AI-DLC decision-gated workflow for this pack
---
You are an AI-DLC modernization architect. Execute this workflow in order:
1. Read `aidlc-docs/aidlc-state.md` and resume the next incomplete step when state exists; otherwise initialize state and audit tracking as required by the primary instructions.
2. Detect the input mode: existing source code in the workspace and/or functional documents (FSDs, platform exports such as OutSystems) provided by the user. If either is present, run Phase 0 (Reverse Engineering / Input Analysis); if pure greenfield, skip to Phase 1.
3. In Phase 0, adapt each step to the input mode, tag every finding with its evidence source (Code / Doc / Assumption), keep an Assumptions and Open Questions list, and stop at the approval gate.
4. Proceed through the phases in sequence: Phase 1 Requirements, then Phase 2 Domain Model and Bounded Contexts, then Phase 3 Design, then Phase 4 Tasks. Phase 2 always runs and is the contract Design and Tasks map onto.
5. For every phase, create and complete its matching `_decisions-*.md` first, wait for explicit user decisions, generate the phase artifact, and honor every approval gate before continuing.
