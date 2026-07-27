# Application Wiring Guide

How to modify an ASP.NET Core application to use ElastiCache (Valkey or Redis) as the distributed session store.

## NuGet Package

Add the following package:

```
Microsoft.Extensions.Caching.StackExchangeRedis
```

This package works with both **Valkey** and **Redis** since Valkey is wire-protocol compatible with Redis. The StackExchange.Redis client connects to either engine identically.

### Installation

```bash
dotnet add <WebProject>.csproj package Microsoft.Extensions.Caching.StackExchangeRedis
```

## Code Changes

### Check Existing Session Configuration

Before modifying, locate the current session setup. Look for:

```csharp
// In Program.cs or Startup.cs
builder.Services.AddDistributedMemoryCache(); // This is the in-memory fallback
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    // ... other options
});
```

**Preserve all existing session options.** Only replace the cache provider, not the session configuration.

### Replace the Cache Provider

Replace `AddDistributedMemoryCache()` with `AddStackExchangeRedisCache()`:

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("ElastiCache");
    options.InstanceName = "Session:";
});
```

The `InstanceName` acts as a key prefix in the cache, preventing collisions if multiple apps share the same cluster.

### Full Example (Minimal API / .NET 8+)

**Before:**
```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

var app = builder.Build();
app.UseSession();
// ...
```

**After:**
```csharp
var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment()
    && string.IsNullOrEmpty(builder.Configuration.GetConnectionString("ElastiCache")))
{
    // Local dev fallback — no ElastiCache needed
    builder.Services.AddDistributedMemoryCache();
}
else
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = builder.Configuration.GetConnectionString("ElastiCache");
        options.InstanceName = "Session:";
    });
}

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

var app = builder.Build();
app.UseSession();
// ...
```

### Startup.cs Pattern (Older Apps)

**ConfigureServices:**
```csharp
public void ConfigureServices(IServiceCollection services)
{
    if (Environment.IsDevelopment()
        && string.IsNullOrEmpty(Configuration.GetConnectionString("ElastiCache")))
    {
        services.AddDistributedMemoryCache();
    }
    else
    {
        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = Configuration.GetConnectionString("ElastiCache");
            options.InstanceName = "Session:";
        });
    }

    services.AddSession(options =>
    {
        options.IdleTimeout = TimeSpan.FromMinutes(30);
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
    });
}
```

## Configuration

### appsettings.json

Add the ElastiCache connection string. This will be populated with the actual endpoint after deployment:

```json
{
  "ConnectionStrings": {
    "ElastiCache": "<elasticache-primary-endpoint>:6379,ssl=true,abortConnect=false"
  }
}
```

### appsettings.Development.json

For local development, either omit the connection string (triggers in-memory fallback) or point to a local container:

```json
{
  "ConnectionStrings": {
    "ElastiCache": ""
  }
}
```

Or, if the developer wants to test with a local Redis/Valkey container:

```json
{
  "ConnectionStrings": {
    "ElastiCache": "localhost:6379,abortConnect=false"
  }
}
```

### Connection String Format

StackExchange.Redis connection string options relevant to ElastiCache:

| Option | Value | Notes |
|--------|-------|-------|
| `ssl` | `true` | Required for ElastiCache in-transit encryption (enabled by default on Serverless) |
| `abortConnect` | `false` | Don't throw on initial connection failure; retry in background |
| `connectTimeout` | `5000` | Milliseconds to wait for connection (default 5000) |
| `syncTimeout` | `3000` | Milliseconds for synchronous operations |

Full format:
```
<primary-endpoint>:6379,ssl=true,abortConnect=false
```

## Local Development Options

### Option 1: In-Memory Fallback (Default)

The environment check in Program.cs automatically falls back to `AddDistributedMemoryCache()` when:
- Running in Development environment AND
- The `ElastiCache` connection string is empty or missing

This means no external dependencies for local dev. Session works but isn't shared across instances.

### Option 2: Local Valkey/Redis Container

For testing distributed behavior locally:

```bash
docker run -d --name local-valkey -p 6379:6379 valkey/valkey:latest
```

Then set the connection string in `appsettings.Development.json`:
```json
{
  "ConnectionStrings": {
    "ElastiCache": "localhost:6379,abortConnect=false"
  }
}
```

Clean up:
```bash
docker rm -f local-valkey
```

## Session Serialization Notes

ASP.NET Core session stores values as byte arrays. The built-in extension methods handle common types:

- `HttpContext.Session.SetString(key, value)`
- `HttpContext.Session.SetInt32(key, value)`
- `HttpContext.Session.GetString(key)`
- `HttpContext.Session.GetInt32(key)`

For complex objects, serialize to JSON before storing:

```csharp
HttpContext.Session.SetString("Cart", JsonSerializer.Serialize(cart));
var cart = JsonSerializer.Deserialize<ShoppingCart>(HttpContext.Session.GetString("Cart"));
```

**Important:** Do NOT store non-serializable objects (database contexts, HTTP clients, etc.) in session. This applies to both in-memory and distributed session, but failures are more visible with a distributed provider.

## TLS Configuration

ElastiCache Serverless enables in-transit encryption by default. The `ssl=true` option in the connection string handles this.

If using a non-Serverless cluster with TLS disabled, remove `ssl=true` from the connection string. Add a comment noting this is not recommended for production.

## Key Expiration

Session expiration is handled by ASP.NET Core's session middleware (`IdleTimeout`). The distributed cache entry TTL is set automatically by the framework to match the session timeout. No manual expiration configuration is needed on the Redis/Valkey side.
