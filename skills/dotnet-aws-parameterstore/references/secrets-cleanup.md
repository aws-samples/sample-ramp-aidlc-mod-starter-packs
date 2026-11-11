# Secrets Cleanup Guide

How to migrate configuration values from appsettings.json into SSM parameter paths and update consuming code.

## Updating appsettings.json

Replace actual values with SSM parameter paths. The path becomes the value — it's what the helper class will pass to `GetParameter`.

### Before

```json
{
  "AWS": {
    "Region": "ap-southeast-1",
    "S3": {
      "BucketName": "my-actual-bucket-name",
      "UploadFolder": "uploads/incoming"
    },
    "EventBridge": {
      "EventbusName": "my-event-bus"
    }
  },
  "ConnectionStrings": {
    "Default": "Server=mydb.example.com;Database=AppDb;User Id=admin;Password=s3cret;"
  }
}
```

### After

```json
{
  "AWS": {
    "Region": "ap-southeast-1",
    "S3": {
      "BucketName": "/app/myservice/s3/bucketname",
      "UploadFolder": "/app/myservice/s3/uploadfolder"
    },
    "EventBridge": {
      "EventbusName": "/app/myservice/eventbridge/busname"
    }
  },
  "ConnectionStrings": {
    "Default": "/app/myservice/db/connectionstring"
  }
}
```

### Rules

- The value is now an SSM parameter **path** (starts with `/`), not the actual value.
- `AWS:Region` stays as a real value — it's needed before the SSM client can be constructed.
- Static values (`Logging`, `AllowedHosts`, `ServiceName`) stay unchanged.
- For Secrets Manager values, use the same path format — the code distinguishes by calling `GetSecretValue` instead of `GetStringFromSSM`.

---

## Preserving Local Development

### appsettings.Development.json

Keep actual values here for local dev:

```json
{
  "AWS": {
    "Region": "ap-southeast-1",
    "S3": {
      "BucketName": "my-local-test-bucket",
      "UploadFolder": "test-uploads"
    },
    "EventBridge": {
      "EventbusName": "local-test-bus"
    }
  },
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=AppDb;Trusted_Connection=True;"
  }
}
```

### .gitignore

Ensure development settings are not committed:

```gitignore
appsettings.Development.json
```

If already tracked:
```bash
git rm --cached appsettings.Development.json
```

---

## Updating Consuming Code

### Pattern: Read path from config, resolve via helper

```csharp
// Before — value was the actual bucket name
var bucketName = _configuration["AWS:S3:BucketName"];

// After — value is an SSM path, resolve it
var bucketName = _awsConfig.GetStringFromSSM(_configuration["AWS:S3:BucketName"]);
```

### Pattern: Connection strings with Secrets Manager

Connection strings are special because `AddDbContext` is called during startup **before the DI container is built**. You cannot inject `IAWSConfig` — you must resolve early:

```csharp
// In Program.cs — before builder.Build()
var connStr = builder.Configuration.GetConnectionString("Default");

if (!builder.Environment.IsDevelopment() && connStr != null && connStr.StartsWith("/"))
{
    // Create a temporary helper (DI not available yet)
    var awsConfig = new AWSConfig(
        LoggerFactory.Create(b => b.AddConsole()).CreateLogger<AWSConfig>(),
        builder.Configuration);
    connStr = awsConfig.GetSecretValue(connStr);
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connStr));
```

The `StartsWith("/")` guard is critical — in Development, `appsettings.Development.json` overrides the path with a real connection string, so this check prevents calling Secrets Manager locally.

### Pattern: Connection strings with SecureString (user override)

```csharp
// Same call — WithDecryption handles SecureString transparently
var connStr = _awsConfig.GetStringFromSSM(_configuration["ConnectionStrings:Default"]);
```

---

## Development Environment Guard

Three approaches — pick one based on the app's needs:

### Approach 1: Dual appsettings files (simplest)

`appsettings.Development.json` has real values. Since it loads after `appsettings.json`, it overrides the paths. But consuming code still calls `GetStringFromSSM` — so you need one of the following guards:

### Approach 2: Environment check in consuming code

```csharp
string bucketName;
if (_environment.IsDevelopment())
{
    bucketName = _configuration["AWS:S3:BucketName"];  // actual value from Development.json
}
else
{
    bucketName = _awsConfig.GetStringFromSSM(_configuration["AWS:S3:BucketName"]);  // SSM path
}
```

### Approach 3: Path detection in helper class

```csharp
public string ResolveValue(string configValue)
{
    if (string.IsNullOrEmpty(configValue)) return configValue;

    // If it starts with /, it's an SSM path — resolve it
    if (configValue.StartsWith("/"))
    {
        return GetStringFromSSM(configValue);
    }

    // Otherwise return as-is (actual value from Development.json)
    return configValue;
}
```

This is the most transparent approach — callers always call `ResolveValue` and the helper decides whether to call SSM based on whether the value looks like a path.

---

## Handling Multiple API Paths

When an app calls multiple API endpoints, store each path as a separate parameter:

```json
{
  "AWS": {
    "ApiGateway": {
      "InvokeUrl": "/app/myservice/api/invokeurl",
      "ApplicationPath": "/app/myservice/api/paths/application",
      "CustomerPath": "/app/myservice/api/paths/customer",
      "FilePath": "/app/myservice/api/paths/file"
    }
  }
}
```

This decouples the consumer from the provider — when the API URL changes, only the parameter value is updated. No code change or redeployment of the consuming service needed.

---

## Verification Checklist

- [ ] All environment-specific values replaced with SSM paths in `appsettings.json`
- [ ] Credential values use Secrets Manager (or SecureString if user chose)
- [ ] `appsettings.Development.json` has working local values
- [ ] `appsettings.Development.json` is in `.gitignore`
- [ ] `dotnet build` passes
- [ ] Consuming code updated to resolve via helper class
- [ ] Helper class uses `WithDecryption = true`
- [ ] Development environment works without AWS credentials
