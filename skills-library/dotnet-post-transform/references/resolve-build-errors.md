# Phase 1 — Resolve Build Errors

Run `dotnet build` on the web project and fix all compilation errors iteratively until the build passes.

## Pre-requisite

You should have already completed Phase 0 (reading ATX artifacts). Use the artifact findings to anticipate which errors will appear — the Assessment Report lists incompatible packages and the Modernization Plan lists required work items per project.

## Common Post-Transform Issues

### Missing `using` statements
Add missing imports for new namespaces:
- `Microsoft.Extensions.DependencyInjection`
- `Microsoft.EntityFrameworkCore`
- `Microsoft.AspNetCore.Http`
- `Microsoft.AspNetCore.Mvc`

### System.Web type references
Replace types that no longer exist with ASP.NET Core equivalents:
- `HttpContext.Current` → inject `IHttpContextAccessor`
- `HttpPostedFileBase` → `IFormFile`
- `HttpServerUtility.MapPath` → `IWebHostEnvironment.WebRootPath` / `ContentRootPath`
- `Request.Url` → `HttpContext.Request.GetDisplayUrl()`

### ConfigurationManager references
The old static `ConfigurationManager` class doesn't exist in ASP.NET Core. Either:
1. Use `IConfiguration` injection in services/controllers, OR
2. Create a compatibility shim for code that can't easily be refactored:

```csharp
public class ConfigurationManager
{
    public static IConfiguration Configuration { get; set; }
}
```

And set it in Program.cs:
```csharp
ConfigurationManager.Configuration = builder.Configuration;
```

### HttpContext.Current usage
Replace with `IHttpContextAccessor`:
- Register: `builder.Services.AddHttpContextAccessor();`
- Inject `IHttpContextAccessor` into classes that need the current context.

### Autofac/Unity container references
Convert to built-in `IServiceCollection` registrations. Replace container-specific syntax:
- `builder.RegisterType<T>().As<I>()` → `services.AddTransient<I, T>()`
- `container.Resolve<T>()` → constructor injection

### Missing interface implementations or changed method signatures
- Check for interfaces with new members added during transform
- Implement missing methods with appropriate default behavior
- Fix signature mismatches (e.g., sync → async conversions)

## Process

1. Run `dotnet build` and capture output
2. Parse error list
3. Fix errors by category (using statements first, then type replacements, then logic)
4. Re-run `dotnet build`
5. Repeat until **zero errors**

## Important: Ignore Warnings

Do NOT fix build warnings. Only fix errors. Warnings about deprecated APIs, nullable references, unused variables, or package pruning are irrelevant to the goal of getting the app running.

## Phase Gate
✅ `dotnet build` completes with 0 errors (warnings are acceptable).
