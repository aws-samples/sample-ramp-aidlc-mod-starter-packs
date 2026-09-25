# Test Strategy for .NET Services

A strategy answers: *what do we test, at what level, and how does it gate delivery?* The goal is fast, trustworthy feedback that lets a team merge to trunk many times a day without breaking it.

## The test pyramid

Shape the suite so most tests are cheap and few are expensive:

```
        /\        E2E / system            (fewest — slow, brittle, whole system)
       /  \
      /----\      Integration             (some — real DB/HTTP/broker via WebApplicationFactory,
     /      \                              Testcontainers)
    /--------\    Unit                     (many — isolated, no I/O, milliseconds each)
```

- **Unit (base):** the bulk of tests. Pure logic, isolated with fakes/mocks, run in milliseconds. See `unit-testing-xunit.md` and `mocking-moq.md`.
- **Integration (middle):** fewer. Verify wiring against real components. See `integration-testing.md`.
- **E2E (top):** fewest. Full deployed system; reserve for a handful of critical user journeys.

Anti-pattern (the "ice-cream cone"): mostly slow E2E tests and few unit tests → slow, flaky, painful to diagnose. Push logic down so it can be unit-tested.

## One test per requirement — traceability

- Derive tests from **requirements / acceptance criteria**, so each behavior the product promises has a test that proves it.
- Name tests as specifications (`MethodName_Scenario_ExpectedBehavior`) so a failing test names the violated behavior.
- Aim for a readable mapping from acceptance criterion → test. Coverage becomes *deliberate* (we tested this because it's required) rather than *incidental* (this line happened to run).
- This traceability is what lets QA move from manual scripts to executable specifications: each former manual test case becomes one automated test.

## Test project structure & naming

- One test project per production project: `<ProjectName>.Tests` (e.g. `Orders.Api` → `Orders.Api.Tests`, `Orders.Domain` → `Orders.Domain.Tests`).
- Separate slow suites from fast ones so the fast unit suite can run on every save/push and heavier integration suites can run on their own cadence. Options: a dedicated `<ProjectName>.IntegrationTests` project, or `[Trait("Category","Integration")]` (xUnit) / categories to filter with `dotnet test --filter`.
- Mirror the folder/namespace layout of the code under test.
- Keep test-only packages (Moq, Testcontainers, coverage collectors) in test projects only.

## CI integration & keeping trunk green

In a trunk-based workflow, the suite is the gate that protects `main`:

- Run `dotnet test` on **every push and every pull request**. A red suite blocks the merge.
- Run the **fast unit suite** on every change for quick feedback; run **integration tests** in the same pipeline (they need Docker for Testcontainers) or a parallel stage.
- Fail the build on any failing test. Treat a broken trunk as a stop-the-line event.
- Collect coverage in the same run (`--collect:"XPlat Code Coverage"`) and surface it on the PR — as information, not a hard block unless the team has agreed a stable threshold. See `coverage-coverlet.md`.
- Keep the gating suite **fast and deterministic**. A slow or flaky suite gets bypassed, and then it protects nothing. Quarantine or fix flaky tests immediately rather than re-running blindly.

Example GitHub Actions step:

```yaml
- run: dotnet test --configuration Release --collect:"XPlat Code Coverage"
```

## Sources
- .NET testing overview — https://learn.microsoft.com/en-us/dotnet/core/testing/
- Unit testing best practices (.NET) — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices
- Unit testing with `dotnet test` — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-dotnet-test
