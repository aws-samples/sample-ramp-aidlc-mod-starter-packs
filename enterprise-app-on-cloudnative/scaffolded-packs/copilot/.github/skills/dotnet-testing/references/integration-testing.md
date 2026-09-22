# Integration Testing in .NET

Integration tests verify that units work *together* and against *real* infrastructure — the HTTP pipeline, the database, the message broker — where unit tests deliberately stub those out. They catch wiring, serialization, configuration, and query bugs that mocks hide.

Keep them **fewer than unit tests** (see the pyramid in `test-strategy.md`): they are slower and more expensive to run. Reserve them for behavior that only emerges when real components interact.

## ASP.NET Core APIs — `WebApplicationFactory`

`Microsoft.AspNetCore.Mvc.Testing` spins up your app in-memory with its real DI container, middleware, routing, and serialization, then hands you an `HttpClient` that calls it without opening a socket.

```bash
dotnet add Orders.Api.Tests package Microsoft.AspNetCore.Mvc.Testing
```

```csharp
public class OrdersApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrdersApiTests(WebApplicationFactory<Program> factory)
        => _client = factory.CreateClient();

    [Fact]
    public async Task GetOrder_UnknownId_Returns404()
    {
        var response = await _client.GetAsync("/orders/does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```

Override services (swap a real dependency for a test one, or point at a test database) via `factory.WithWebHostBuilder(b => b.ConfigureServices(...))`. This is the sanctioned way to substitute external systems while keeping the rest of the pipeline real.

## Real dependencies — Testcontainers for .NET

For dependencies you shouldn't mock (a database, DynamoDB Local, LocalStack, Kafka, Redis), Testcontainers starts them as throwaway Docker containers scoped to the test run, so tests hit a real engine and clean up automatically. Requires a running Docker-compatible runtime.

```bash
dotnet add Orders.Api.Tests package Testcontainers
```

```csharp
public class OrderRepositoryTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _db =
        new PostgreSqlBuilder().WithImage("postgres:16-alpine").Build();

    public Task InitializeAsync() => _db.StartAsync();
    public Task DisposeAsync()    => _db.DisposeAsync().AsTask();

    [Fact]
    public async Task Save_ThenLoad_RoundTripsOrder()
    {
        var repo = new OrderRepository(_db.GetConnectionString());
        await repo.SaveAsync(new Order(id: "o-1", amount: 42m));

        var loaded = await repo.GetAsync("o-1");

        Assert.Equal(42m, loaded.Amount);
    }
}
```

Testcontainers ships pre-built modules for many engines (PostgreSQL, MySQL, MSSQL, Kafka, Redis, LocalStack, and more). For AWS-backed services, run **LocalStack** or a service-local image (e.g. DynamoDB Local) in a container and point the SDK client at its endpoint. Use `IAsyncLifetime` to start/stop the container, and share it via `IClassFixture`/collection fixture when startup cost matters.

## When to write an integration test

- Serialization / model binding across the HTTP boundary.
- Real database queries, migrations, and mapping (LINQ that behaves differently against a real provider).
- Message publish/consume round-trips.
- Configuration and DI wiring — that the app actually composes and starts.

Do **not** re-test pure business logic here that a unit test already covers; that just makes the suite slow.

## Sources
- Integration tests in ASP.NET Core — https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests
- Testcontainers for .NET — https://dotnet.testcontainers.org/
- .NET testing overview — https://learn.microsoft.com/en-us/dotnet/core/testing/
