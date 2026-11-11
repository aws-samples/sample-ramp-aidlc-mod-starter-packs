# Application Instrumentation Guide

This reference defines how to add OpenTelemetry instrumentation to a .NET application for use with the ADOT sidecar collector.

## NuGet Packages

Add the following packages to the application's `.csproj`:

```xml
<ItemGroup>
  <!-- OpenTelemetry core -->
  <PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.*" />
  <PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.*" />

  <!-- AWS-specific instrumentation -->
  <PackageReference Include="OpenTelemetry.Contrib.Extensions.AWSXRay" Version="1.*" />
  <PackageReference Include="OpenTelemetry.Contrib.Instrumentation.AWS" Version="1.*" />
</ItemGroup>
```

These packages provide:
- `OpenTelemetry.Exporter.OpenTelemetryProtocol` — OTLP exporter to send telemetry to the ADOT collector
- `OpenTelemetry.Instrumentation.AspNetCore` — automatic instrumentation for ASP.NET Core HTTP requests
- `OpenTelemetry.Contrib.Extensions.AWSXRay` — X-Ray trace ID generator and propagator
- `OpenTelemetry.Contrib.Instrumentation.AWS` — automatic instrumentation for AWS SDK calls

## Instrumentation Interface

Create `Helpers/IInstrumentation.cs`:

```csharp
using System.Diagnostics;

namespace <AppNamespace>.Helpers;

public interface IInstrumentation : IDisposable
{
    ActivitySource ActivitySource { get; }
}
```

## Instrumentation Class

Create `Helpers/Instrumentation.cs`:

```csharp
using System.Diagnostics;
using OpenTelemetry;
using OpenTelemetry.Contrib.Extensions.AWSXRay.Trace;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;

namespace <AppNamespace>.Helpers;

public class Instrumentation : IInstrumentation
{
    private readonly IConfiguration _configuration;

    public Instrumentation(IConfiguration configuration)
    {
        _configuration = configuration;

        var serviceName = Environment.GetEnvironmentVariable("SERVICE_NAME")
            ?? _configuration["ServiceName"]
            ?? "<app-name>";

        string? version = typeof(Instrumentation).Assembly.GetName().Version?.ToString();
        this.ActivitySource = new ActivitySource(serviceName, version);

        InitializeOpenTelemetry(serviceName);
    }

    public ActivitySource ActivitySource { get; }

    private void InitializeOpenTelemetry(string serviceName)
    {
        // Required for unencrypted gRPC to the sidecar on localhost
        AppContext.SetSwitch("System.Net.Http.SocketsHttpHandler.Http2UnencryptedSupport", true);

        // OTLP endpoint — defaults to localhost:4317 (ADOT sidecar in same ECS task)
        string endpoint = _configuration["OpenTelemetry:Endpoint"] ?? "http://localhost:4317";

        // Configure tracer provider
        Sdk.CreateTracerProviderBuilder()
            .AddSource(serviceName)
            .SetResourceBuilder(
                ResourceBuilder.CreateDefault()
                    .AddService(serviceName: serviceName)
                    .AddTelemetrySdk())
            .SetSampler(new AlwaysOnSampler())
            .AddXRayTraceId()
            .AddAWSInstrumentation()
            .AddAspNetCoreInstrumentation()
            .AddOtlpExporter()
            .Build();

        // Configure meter provider
        Sdk.CreateMeterProviderBuilder()
            .AddMeter(serviceName)
            .AddOtlpExporter()
            .Build();

        // Use AWS X-Ray propagator for trace context
        Sdk.SetDefaultTextMapPropagator(new AWSXRayPropagator());
    }

    public void Dispose()
    {
        this.ActivitySource.Dispose();
    }
}
```

### Key Points

- **Service name**: Resolved from `SERVICE_NAME` env var (set in task definition) → `appsettings.json` `ServiceName` key → fallback to app name.
- **Endpoint**: The OTLP exporter defaults to `http://localhost:4317`. In ECS, containers within the same task share the network namespace, so the ADOT sidecar is reachable on localhost.
- **X-Ray trace ID**: `AddXRayTraceId()` generates trace IDs in X-Ray format so they correlate with the X-Ray console.
- **AWS SDK instrumentation**: `AddAWSInstrumentation()` automatically traces AWS SDK calls (DynamoDB, S3, SQS, etc.).
- **ASP.NET Core instrumentation**: `AddAspNetCoreInstrumentation()` traces inbound HTTP requests automatically.

## Program.cs Registration

Add the instrumentation to the DI container in `Program.cs`:

```csharp
// Add after other service registrations
builder.Services.AddSingleton<IInstrumentation, Instrumentation>();
```

The `Instrumentation` class initializes OpenTelemetry in its constructor, so registering it as a singleton ensures telemetry is configured once at startup.

## Configuration (appsettings.json)

Add a `ServiceName` and optional `OpenTelemetry` section:

```json
{
  "ServiceName": "<app-name>",
  "OpenTelemetry": {
    "Endpoint": "http://localhost:4317"
  }
}
```

The endpoint config is optional — it defaults to `http://localhost:4317` in the code. Including it in appsettings makes it overridable for local development (e.g., pointing to a local collector instance).

## Using the ActivitySource

Once instrumentation is registered, controllers or services can inject `IInstrumentation` to create custom spans:

```csharp
public class MyService
{
    private readonly IInstrumentation _instrumentation;

    public MyService(IInstrumentation instrumentation)
    {
        _instrumentation = instrumentation;
    }

    public async Task DoWork()
    {
        using var activity = _instrumentation.ActivitySource.StartActivity("DoWork");
        activity?.SetTag("custom.attribute", "value");
        // ... business logic
    }
}
```

This is optional — ASP.NET Core requests and AWS SDK calls are automatically traced without manual spans.

## Environment Variables for ECS

The task definition should set these environment variables on the application container:

| Variable | Value | Purpose |
|----------|-------|---------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTLP exporter target (ADOT sidecar) |
| `SERVICE_NAME` | `<app-name>` | Service name in traces/metrics |

The `OTEL_EXPORTER_OTLP_ENDPOINT` env var is recognized by the OpenTelemetry SDK automatically. Setting it explicitly ensures the exporter targets the sidecar even if appsettings is not updated.
