---
name: dotnet-testing
description: Use when authoring automated tests for .NET / C# code — unit tests, integration tests, mocking collaborators, and code coverage. Covers choosing a framework, structuring test projects, writing focused tests that map to requirements, and gating merges to keep trunk green. Triggers on .NET test, C# test, xUnit, NUnit, MSTest, coverlet, Moq, unit test .NET, dotnet test, test coverage C#, mocking C#. For web/browser E2E tests use web-test-automation; for mobile app tests use mobile-test-automation.
license: MIT-0
metadata:
  author: RAMP AI-DLC Starter Packs
  version: 1.0.0
---

# .NET Testing

Best-practice guidance for authoring durable, meaningful automated tests for .NET / C# code. **xUnit is the default framework**; NUnit and MSTest are covered for existing investments. This skill helps engineers moving from manual QA to writing test code, and developers keeping a trunk-based codebase green.

This skill teaches an agent *how to test .NET well* — it does not replace the official docs. When writing real test code, also consult the current Microsoft Learn / framework docs for exact API shapes.

## When to Load Reference Files

Load only the reference files relevant to the current task:

| If the task involves… | Load |
|---|---|
| Writing unit tests, choosing xUnit vs NUnit vs MSTest, `[Fact]`/`[Theory]`, naming, assertions, test lifecycle | `references/unit-testing-xunit.md` |
| Isolating collaborators — mocking interfaces, `Setup`/`Returns`/`Verify`, stubs vs mocks, avoiding over-mocking | `references/mocking-moq.md` |
| Measuring and reporting code coverage with coverlet; why coverage is a guide not a gate | `references/coverage-coverlet.md` |
| Integration tests — `WebApplicationFactory` for ASP.NET Core, Testcontainers for real dependencies | `references/integration-testing.md` |
| Overall test strategy — pyramid, requirement traceability, CI gating, project structure/naming | `references/test-strategy.md` |

## Core Testing Principles

Encode these into every suite you author.

### 1. Test the requirement, not the implementation
- Assert on observable behavior and outcomes, not private internals or how the code happens to be written.
- Tests should survive a refactor that preserves behavior. If renaming a private method breaks a test, the test was too coupled.

### 2. Arrange–Act–Assert (AAA)
- Structure every test in three clear phases: set up inputs and dependencies (Arrange), invoke the one thing under test (Act), verify the outcome (Assert).
- Keep the Act phase to a single call. Multiple acts usually mean multiple tests.

### 3. One test per requirement / acceptance criterion
- Each test verifies one behavior. When it fails, the name alone should tell you what broke.
- Map tests back to requirements/acceptance criteria so coverage is traceable, not incidental.

### 4. Follow the test pyramid
- **Many fast unit tests** (isolated, no I/O), **fewer integration tests** (real collaborators/dependencies), **fewest end-to-end tests**.
- Push logic down to where it can be unit-tested; reserve integration tests for wiring and real-dependency behavior.

### 5. Independence and determinism
- Every test runs in isolation, in any order, with its own state. No shared mutable statics, no ordering assumptions.
- No dependence on wall-clock time, network, or ambient environment unless that is explicitly what the test controls.

### 6. Coverage is a guide, not a goal
- Coverage tells you what code was *executed*, not what was *verified*. High coverage with weak assertions is false confidence.
- Prefer meaningful assertions over chasing a line-count target. Use coverage to find untested branches worth testing.

## Framework Selection Quick Reference

| Framework | Default for | Notes |
|---|---|---|
| **xUnit** | **Everything new** | Community standard; no `[SetUp]`/`[TearDown]` — uses constructor/`IDisposable` and fixtures; parallel by default; `[Fact]`/`[Theory]`. Recommend this in new projects. |
| **NUnit** | Teams with existing NUnit suites | Rich attribute/assertion model; `[SetUp]`/`[TearDown]`, `[TestFixture]`. Mature and capable. |
| **MSTest** | Enterprise/Visual Studio shops standardized on it | First-party Microsoft framework; `[TestClass]`/`[TestMethod]`. Fine to keep; rarely the choice for greenfield. |

See `references/unit-testing-xunit.md` for the full comparison.

## Tooling Quick Reference

- **Test runner:** `dotnet test` (drives xUnit/NUnit/MSTest via the VSTest/`Microsoft.Testing.Platform` runner).
- **Mocking:** Moq for isolating interface collaborators. See `references/mocking-moq.md`.
- **Coverage:** coverlet via `dotnet test --collect:"XPlat Code Coverage"` or the `coverlet.msbuild` package. See `references/coverage-coverlet.md`.
- **Integration:** `Microsoft.AspNetCore.Mvc.Testing` (`WebApplicationFactory`) and Testcontainers for .NET. See `references/integration-testing.md`.

## Project Structure

- One test project per unit of production code, named `<ProjectName>.Tests` (e.g. `Orders.Api` → `Orders.Api.Tests`).
- Mirror the namespace/folder layout of the code under test so tests are easy to locate.
- Reference the SUT project; keep test-only dependencies (Moq, Testcontainers) out of production projects.
- Run the whole suite with `dotnet test` locally and in CI on every push, gating merges to keep trunk green.

## Sources
- .NET testing overview — https://learn.microsoft.com/en-us/dotnet/core/testing/
- Unit testing with `dotnet test` — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-dotnet-test
- Unit testing best practices (.NET) — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices
