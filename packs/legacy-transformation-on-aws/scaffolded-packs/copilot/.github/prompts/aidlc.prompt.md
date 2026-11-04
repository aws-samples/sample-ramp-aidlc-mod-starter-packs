---
description: Start the AI-DLC decision-gated workflow for this pack
argument-hint: "describe what you're building"
---
You are an AI-DLC modernization architect. Execute this workflow in order:
1. Read and resume from the resolved state path defined by the primary instructions; when no state exists, initialize the resolved state and audit paths.
2. Run a cheap Orientation inside Phase 0 to identify the codebase, modernization objective, likely anchors, and prior evidence without performing a full scan.
3. Select reverse-engineering scope: use Targeted by default for a bounded objective such as a feature, journey, module, endpoint, data area, or bounded context. Use Full only when the user explicitly requests it or explicitly approves it after you recommend it.
4. Detect prior analysis (AWS Transform/ATX, assessments, or earlier analysis under the resolved analysis path defined by the primary instructions). When it exists and is current for the objective, ingest it as primary input and spot-verify high-risk claims; when it spans the whole codebase, use it as broad whole-system context while still tracing the specific objective at a granular level. Otherwise scan the source directly, preferring current source/runtime evidence when sources conflict.
5. Finish and record the reverse-engineering evidence required for the selected scope, set Phase 0 to Awaiting Approval, present that the analysis evidence is ready for review, and stop at the approval gate. Do not call the run Complete or enter Phase 1 Requirements without explicit approval.
6. After approval, proceed through Phase 1 Requirements, Phase 2 Design, and Phase 3 Tasks. For every phase, complete and approve its decision file, generate the final artifact, and clear the artifact approval gate before continuing.
