# Unit Testing with xUnit

xUnit is the recommended framework for new .NET test suites: it is the de facto community standard, runs tests in parallel by default, and uses idiomatic C# constructs (constructor/`IDisposable`) instead of custom setup attributes.

## Framework choice

| Framework | When to pick it |
|---|---|
| **xUnit** | Default for new work. Modern, minimal, parallel-by-default. Uses `[Fact]`/`[Theory]`, constructor + `IDisposable` for lifecycle, and fixtures for shared context. |
| **NUnit** | Existing NUnit suites, or teams that prefer its rich assertion/attribute model (`[SetUp]`, `[TearDown]`, `[TestFixture]`, parameterized `[TestCase]`). |
| **MSTest** | Shops standardized on the first-party Microsoft framework (`[TestClass]`, `[TestMethod]`, `[DataRow]`), often tied to Visual Studio/Azure DevOps tooling. |

All three run under `dotnet test`. Don't mix frameworks within a single test project.

## Getting started

```bash
dotnet new xunit -n Orders.Api.Tests
dotnet add Orders.Api.Tests reference ../Orders.Api/Orders.Api.csproj
dotnet test
```

## `[Fact]` vs `[Theory]`

- `[Fact]` — a test that is always true; no parameters. Use for a single concrete scenario.
- `[Theory]` + data attributes — one test run once per data row. Use to cover many inputs without duplication.

```csharp
public class PriceCalculatorTests
{
    [Fact]
    public void Total_WithNoItems_IsZero()
    {
        // Arrange
        var calculator = new PriceCalculator();

        // Act
        var total = calculator.Total(items: []);

        // Assert
        Assert.Equal(0m, total);
    }

    [Theory]
    [InlineData(100, 0.10, 90)]
    [InlineData(50, 0.00, 50)]
    public void Total_AppliesDiscount(decimal price, decimal discount, decimal expected)
    {
        var calculator = new PriceCalculator();

        var total = calculator.Total([new Item(price)], discount);

        Assert.Equal(expected, total);
    }
}
```

Data sources for `[Theory]`: `[InlineData]` (literals), `[MemberData]` (a static property/method), `[ClassData]` (an `IEnumerable<object[]>` class) for reusable or complex data.

## Arrange–Act–Assert

Keep the three phases visually separate. One Act per test — if you need two actions, you probably have two tests.

## Naming convention

Use `MethodName_Scenario_ExpectedBehavior`:

- `Total_WithNoItems_IsZero`
- `Withdraw_AmountExceedsBalance_ThrowsInvalidOperationException`
- `Parse_EmptyString_ReturnsNone`

The name should read as a specification. When it fails in CI, the name alone explains what regressed.

## Assertions

- Prefer specific assertions over `Assert.True(...)`: `Assert.Equal`, `Assert.Contains`, `Assert.Empty`, `Assert.Null`, `Assert.IsType<T>`.
- Assert exceptions with `Assert.Throws<T>` (exact type) or `Assert.ThrowsAny<T>`:
  ```csharp
  var ex = Assert.Throws<InvalidOperationException>(() => account.Withdraw(200));
  Assert.Equal("Insufficient funds", ex.Message);
  ```
- Assert one logical outcome per test. Multiple unrelated asserts hide which behavior broke.
- Fluent assertion libraries (e.g. Shouldly) are optional sugar; the built-in `Assert` is sufficient and dependency-free.

## Test lifecycle in xUnit

xUnit deliberately has no `[SetUp]`/`[TearDown]`. Instead:

- **Per-test setup** → the test class **constructor** (runs before every test; a fresh instance is created per test, which is what keeps tests isolated).
- **Per-test teardown** → implement `IDisposable.Dispose()` (or `IAsyncLifetime` for async setup/teardown).
- **Shared context across tests in one class** → `IClassFixture<T>` (the fixture is created once and injected into the constructor). Use for expensive, read-only setup only.
- **Shared context across multiple classes** → a `ICollectionFixture<T>` with `[Collection("name")]`.

```csharp
public class DbFixture : IDisposable
{
    public DbConnection Connection { get; }
    public DbFixture() => Connection = OpenSharedConnection();
    public void Dispose() => Connection.Dispose();
}

public class OrderRepositoryTests : IClassFixture<DbFixture>
{
    private readonly DbFixture _fixture;
    public OrderRepositoryTests(DbFixture fixture) => _fixture = fixture;

    [Fact]
    public void Save_PersistsOrder() { /* ... */ }
}
```

Prefer per-test isolation (constructor) over shared fixtures; reach for fixtures only when setup is genuinely expensive and read-only.

## Parallelism

xUnit runs test *collections* in parallel by default. Because each test gets a fresh class instance, this is safe as long as tests don't share mutable global state. If a test touches a shared resource, put those classes in the same `[Collection]` to serialize them.

## Sources
- xUnit.net documentation — https://xunit.net/
- Getting started / unit testing C# with xUnit — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-csharp-with-dotnet-test
- Unit testing best practices (.NET) — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices
- Unit testing C# with NUnit — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-nunit
- Unit testing C# with MSTest — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-mstest
