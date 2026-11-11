# Configuration Wiring Guide

Helper class implementation, NuGet packages, and Program.cs registration.

## NuGet Packages

### Version Detection

**Before adding packages, check the project's existing `AWSSDK.*` references** to determine the major version in use:
- If existing packages are `4.x`, use `4.*` versions
- If existing packages are `3.x`, use `3.*` versions
- Match the `AWSSDK.Core` version to the highest transitive requirement to avoid `NU1605` downgrade errors

### Required

```xml
<PackageReference Include="AWSSDK.SimpleSystemsManagement" Version="<match-existing-major>.*" />
```

### Conditional (only if using Secrets Manager)

```xml
<PackageReference Include="AWSSDK.SecretsManager" Version="<match-existing-major>.*" />
```

### Common (if not already present)

```xml
<PackageReference Include="AWSSDK.Extensions.NETCore.Setup" Version="<match-existing-major>.*" />
```

### Post-Add Verification

After adding packages:
1. Run `dotnet restore` and check for version conflicts
2. If `NU1605` (package downgrade) errors appear, bump `AWSSDK.Core` to the version required by the newest dependency
3. Run `dotnet build` to confirm no compile errors before proceeding

---

## Helper Class Interface

```csharp
public interface IAWSConfig
{
    /// <summary>
    /// Retrieves a value from SSM Parameter Store.
    /// Works for both String and SecureString types.
    /// </summary>
    string GetStringFromSSM(string parameterName);

    /// <summary>
    /// Retrieves a secret value from AWS Secrets Manager.
    /// Use for credentials stored as Secrets Manager secrets.
    /// </summary>
    string GetSecretValue(string secretName);
}
```

## Helper Class Implementation

> **IMPORTANT — Compile-time pitfalls:**
> 1. Both `Amazon.SecretsManager.Model` and `Amazon.SimpleSystemsManagement.Model` define `ResourceNotFoundException`. You **must** fully qualify it (e.g., `Amazon.SecretsManager.Model.ResourceNotFoundException`) to avoid CS0104.
> 2. Since the implementation uses `.Result` (blocking async), exceptions are wrapped in `AggregateException`. Catch blocks must use `AggregateException ex when (ex.InnerException is ...)` pattern, not the raw exception type.

```csharp
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using System.Collections.Concurrent;

public class AWSConfig : IAWSConfig
{
    private readonly AmazonSimpleSystemsManagementClient _ssmClient;
    private readonly AmazonSecretsManagerClient _secretsClient;
    private readonly ILogger<AWSConfig> _logger;
    private readonly ConcurrentDictionary<string, (string Value, DateTime Expiry)> _cache = new();
    private readonly TimeSpan _cacheTtl = TimeSpan.FromMinutes(5);

    public AWSConfig(ILogger<AWSConfig> logger, IConfiguration configuration)
    {
        _logger = logger;

        var region = Amazon.RegionEndpoint.GetBySystemName(
            Environment.GetEnvironmentVariable("AWS_REGION")
            ?? configuration["AWS:Region"]
            ?? throw new ArgumentNullException(
                "AWS Region not found in environment variables or configuration"));

        _ssmClient = new AmazonSimpleSystemsManagementClient(region);
        _secretsClient = new AmazonSecretsManagerClient(region);
    }

    public string GetStringFromSSM(string parameterName)
    {
        if (_cache.TryGetValue(parameterName, out var cached) && cached.Expiry > DateTime.UtcNow)
            return cached.Value;

        try
        {
            var response = _ssmClient.GetParameterAsync(new GetParameterRequest
            {
                Name = parameterName,
                WithDecryption = true
            }).Result;

            var value = response.Parameter.Value;
            _cache[parameterName] = (value, DateTime.UtcNow.Add(_cacheTtl));
            return value;
        }
        catch (AggregateException ex) when (ex.InnerException is ParameterNotFoundException)
        {
            _logger.LogError("SSM Parameter not found: {Name}. Has it been created?", parameterName);
            throw new InvalidOperationException(
                $"Required SSM parameter '{parameterName}' does not exist. " +
                "See PARAMETER-STORE-GUIDE.md for setup instructions.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving SSM parameter: {Name}", parameterName);
            throw;
        }
    }

    public string GetSecretValue(string secretName)
    {
        if (_cache.TryGetValue(secretName, out var cached) && cached.Expiry > DateTime.UtcNow)
            return cached.Value;

        try
        {
            var response = _secretsClient.GetSecretValueAsync(new GetSecretValueRequest
            {
                SecretId = secretName
            }).Result;

            var value = response.SecretString;
            _cache[secretName] = (value, DateTime.UtcNow.Add(_cacheTtl));
            return value;
        }
        // MUST fully qualify — both SSM and SecretsManager define ResourceNotFoundException
        catch (AggregateException ex) when (ex.InnerException is Amazon.SecretsManager.Model.ResourceNotFoundException)
        {
            _logger.LogError("Secret not found: {Name}. Has it been created?", secretName);
            throw new InvalidOperationException(
                $"Required secret '{secretName}' does not exist. " +
                "See PARAMETER-STORE-GUIDE.md for setup instructions.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving secret: {Name}", secretName);
            throw;
        }
    }
}
```

## Registration in Program.cs

```csharp
builder.Services.AddSingleton<IAWSConfig, AWSConfig>();
```

Register as Singleton — the SDK clients are thread-safe and reusable.

---

## Early-Startup Resolution (Connection Strings)

Connection strings for `DbContext` registration are needed **before the DI container is built**. The standard pattern of injecting `IAWSConfig` into a service doesn't work here. Use this pattern in `Program.cs`:

```csharp
var connectionString = builder.Configuration.GetConnectionString("Default");

// Resolve from Secrets Manager in non-development environments
if (!builder.Environment.IsDevelopment() && connectionString != null && connectionString.StartsWith("/"))
{
    var awsConfig = new AWSConfig(
        LoggerFactory.Create(b => b.AddConsole()).CreateLogger<AWSConfig>(),
        builder.Configuration);
    connectionString = awsConfig.GetSecretValue(connectionString);
}

builder.Services.AddSingleton<IAWSConfig, AWSConfig>();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));
```

Key points:
- Create a temporary `AWSConfig` instance manually (DI isn't available yet)
- Use `LoggerFactory.Create()` for a bootstrap logger
- The `StartsWith("/")` guard ensures local dev (where the value is an actual connection string from `appsettings.Development.json`) skips the Secrets Manager call
- The singleton `IAWSConfig` registered afterward shares the same caching benefit for later runtime calls

---

## Region Resolution

The helper resolves the AWS region in this order:

1. `AWS_REGION` environment variable (set automatically by ECS, Lambda, EC2)
2. `AWS:Region` from `appsettings.json` (fallback for local dev)
3. Throw if neither is available

---

## Consumption Pattern

Callers read the parameter **path** from `IConfiguration`, then pass it to the helper:

```csharp
public class MyService
{
    private readonly IAWSConfig _awsConfig;
    private readonly IConfiguration _configuration;

    public MyService(IConfiguration configuration, IAWSConfig awsConfig)
    {
        _configuration = configuration;
        _awsConfig = awsConfig;
    }

    public void DoWork()
    {
        // appsettings.json has: "AWS:S3:BucketName": "/app/myservice/s3/bucketname"
        var bucketName = _awsConfig.GetStringFromSSM(_configuration["AWS:S3:BucketName"]);

        // For Secrets Manager credentials:
        var dbConnStr = _awsConfig.GetSecretValue(_configuration["Secrets:DbConnectionString"]);
    }
}
```

---

## Caching (Included by Default)

The helper class implementation above includes in-memory caching with a 5-minute TTL using `ConcurrentDictionary`. This prevents throttling and latency from calling SSM/Secrets Manager on every request.

- Cache is per-parameter/secret name
- TTL of 5 minutes balances freshness with performance
- Stable values (bucket names, API URLs) benefit most from caching
- If a secret is rotated, the app picks up the new value within 5 minutes

To adjust the TTL, change `_cacheTtl` in the helper class. For very short-lived secrets, consider reducing or disabling caching for those specific keys.

---

## WithDecryption Explained

`WithDecryption = true` on `GetParameterRequest` is safe for ALL parameter types:
- **String** type: returns the value as-is (flag is ignored)
- **SecureString** type: decrypts using the associated KMS key, returns plaintext

Always set it to `true` — simplifies code and handles both types transparently.

---

## If Secrets Manager Is Not Needed

When the user chose SSM SecureString for all credentials instead of Secrets Manager:
- Remove `AWSSDK.SecretsManager` from packages
- Remove `GetSecretValue` from the interface and implementation
- All values (including credentials) use `GetStringFromSSM` — the `WithDecryption = true` handles SecureString transparently
