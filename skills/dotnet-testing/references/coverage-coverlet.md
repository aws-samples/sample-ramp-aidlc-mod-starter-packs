# Code Coverage with coverlet

coverlet is the cross-platform code coverage tool for .NET. It measures which lines and branches of production code were executed by the test suite. Use it to *discover untested branches worth testing* — not as a number to chase.

## Collecting coverage

Two common integrations:

### 1. VSTest data collector (recommended default)

The `coverlet.collector` package ships in the `dotnet new xunit` template. Collect with:

```bash
dotnet test --collect:"XPlat Code Coverage"
```

This writes a `coverage.cobertura.xml` file under `TestResults/<guid>/`. No source changes needed; works the same locally and in CI.

### 2. MSBuild integration

Add the `coverlet.msbuild` package to the test project, then:

```bash
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura /p:CoverletOutput=./coverage/
```

MSBuild mode is handy when you want thresholds enforced by the build itself:

```bash
dotnet test /p:CollectCoverage=true /p:Threshold=80 /p:ThresholdType=line
```

Prefer the collector for most pipelines; use MSBuild mode when you want inline threshold failure or output-path control.

## Reporting

The raw Cobertura XML is not human-friendly. Generate a browsable HTML report with ReportGenerator:

```bash
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator \
  -reports:"**/coverage.cobertura.xml" \
  -targetdir:"coveragereport" \
  -reporttypes:Html
```

Most CI systems (Azure DevOps, GitHub Actions) can also ingest the Cobertura file directly to render a coverage summary on the build/PR.

## Coverage is a guide, not a gate

- **Coverage measures execution, not verification.** A test that calls a method but asserts nothing will still mark those lines "covered." That is false confidence.
- **Meaningful assertions beat line count.** A suite at 70% coverage with sharp, behavior-focused assertions is worth more than 95% coverage that merely runs code.
- **Watch branch coverage, not just line coverage.** Line coverage can be high while error paths, null cases, and edge conditions go unverified. Branch/condition coverage surfaces those gaps.
- **Use it to find gaps, then decide.** Treat an uncovered branch as a *question* ("is this behavior worth a test?"), not an automatic failure.
- **If you set a threshold, keep it modest and stable.** A ratcheting minimum (don't regress below current) is healthier than an aspirational 100% that pressures teams to write assertion-free tests. Exclude generated code, DTOs, and `Program.cs` bootstrapping from the denominator via `[ExcludeFromCodeCoverage]` or coverlet `--exclude` filters so the number reflects logic you actually intend to test.

## Sources
- coverlet (coverlet-coverage/coverlet) — https://github.com/coverlet-coverage/coverlet
- Use code coverage for unit testing (.NET) — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage
- ReportGenerator — https://github.com/danielpalme/ReportGenerator
