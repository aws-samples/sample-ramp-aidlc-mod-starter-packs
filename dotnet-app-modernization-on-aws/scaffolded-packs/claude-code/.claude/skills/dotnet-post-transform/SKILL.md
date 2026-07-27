---
name: dotnet-post-transform
description: Fixes build errors, wires dependency injection, and resolves static file serving issues in ASP.NET Framework apps transformed to ASP.NET Core by AWS Transform for .NET. Use after running AWS Transform to get a transformed project from compiling to running correctly. Works through five sequential phases automatically. ALSO USE for missing DI registrations, broken images/CSS/JS after migration, middleware pipeline ordering, Content folder vs wwwroot mismatch, and ConfigurationManager shim creation. NOT for greenfield ASP.NET Core apps, EF Core migration authoring, or production deployment hardening.
version: 1
allowed-tools: [Read, Write, Shell]
---

# Post-Transform Fixup

## Objective

Get a transformed ASP.NET Core application **running locally** with zero build errors, functional dependency injection, and working static file serving. Do NOT fix warnings, security blockers, or cloud-native concerns — only what's needed to run.

## When to Use

- Immediately after AWS Transform for .NET completes
- Transformed solution crashes or misbehaves at runtime
- Static files 404, DI exceptions, or middleware ordering issues

**Do NOT use for:** greenfield apps, EF Core migrations, or production hardening.

## Phase 0 — Read ATX Artifacts

Search for `*_Report.md`, `*_Plan.md`, `nextsteps.md` in the workspace root and common folders (`artifactWorkspace/`, `atx-artefacts/`, `artifacts/`, `transform-output/`). Extract context about what was transformed and what gaps remain. Only fix what blocks local execution.

## Phases

Work sequentially. Each phase depends on the previous being complete.

1. **Phase 1 — Resolve Build Errors**: Zero compile errors.
2. **Phase 2 — Wire Dependency Injection**: All service registrations in Program.cs.
3. **Phase 3 — Fix Static File Serving**: CSS, JS, and images serve correctly.
4. **Phase 4 — Fix Middleware Pipeline**: Correct middleware ordering.
5. **Phase 5 — Runtime Verification**: App starts and pages render.

## Constraints

- Do NOT rename or restructure existing folders.
- Do NOT change database schema or seed data.
- Maintain backward compatibility with database-stored URLs.
- Match folder casing for Linux/container compatibility.
- Use Microsoft DI container unless Autofac is explicitly required.

## References

- [references/resolve-build-errors.md](references/resolve-build-errors.md) — Phase 1
- [references/wire-dependency-injection.md](references/wire-dependency-injection.md) — Phase 2
- [references/fix-static-files.md](references/fix-static-files.md) — Phase 3
- [references/fix-middleware-pipeline.md](references/fix-middleware-pipeline.md) — Phase 4
- [references/runtime-verification.md](references/runtime-verification.md) — Phase 5
- [references/common-pitfalls.md](references/common-pitfalls.md) — Quick-lookup table for common issues and fixes

## Reporting

After each phase, summarize what was changed and confirm the phase gate criteria before moving to the next phase.
