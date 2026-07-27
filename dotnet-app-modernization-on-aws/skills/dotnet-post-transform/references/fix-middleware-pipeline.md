# Phase 4 — Fix Middleware Pipeline

Ensure correct middleware ordering in Program.cs. Order matters — incorrect ordering causes silent failures.

## Required Order

```csharp
var app = builder.Build();

// 1. Developer exception page (dev only)
if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();
else
    app.UseExceptionHandler("/Home/Error");

// 2. HTTPS redirection
app.UseHttpsRedirection();

// 3. WebOptimizer (if used) — MUST come before UseStaticFiles
app.UseWebOptimizer();

// 4. Static files (before routing, so static assets don't hit MVC pipeline)
app.UseStaticFiles();

// 4b. Additional static file mappings (Scripts folder, backward-compat /Content, etc.)
app.UseStaticFiles(new StaticFileOptions { ... });

// 5. Local authentication middleware (if applicable, before UseAuthentication)
if (configuration["Services:Authentication"] != "aws")
    app.UseMiddleware<LocalAuthenticationMiddleware>();

// 6. Routing
app.UseRouting();

// 7. Authentication
app.UseAuthentication();

// 8. Authorization
app.UseAuthorization();

// 9. Area route (must come before default route)
app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

// 10. Default route
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// 11. Run
app.Run();
```

## Key Points

- **`UseWebOptimizer()` MUST come before `UseStaticFiles()`** — WebOptimizer intercepts requests for bundled assets and must process them before the static file handler tries to find them on disk.
- `UseStaticFiles()` MUST come before `UseRouting()` — otherwise static file requests fall through to MVC and return 404.
- `UseAuthentication()` MUST come before `UseAuthorization()`.
- Area routes MUST be registered before the default route, otherwise area controllers will match the default pattern incorrectly.
- The `{area:exists}` constraint ensures the route only matches when an area actually exists.
- **Local authentication middleware** should be placed BEFORE `UseRouting()` but AFTER static files, so it can set `HttpContext.User` before the auth/authz middleware validates it.

## Conditional Authentication Registration

A common post-transform crash: OpenID Connect is registered unconditionally, but `ClientId` is null in local mode. ASP.NET Core validates OIDC options on first request and throws `ArgumentNullException`.

**Fix**: Register OIDC only when `Services:Authentication == "aws"`:

```csharp
if (builder.Configuration["Services:Authentication"] == "aws")
{
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
    })
    .AddCookie()
    .AddOpenIdConnect(options =>
    {
        builder.Configuration.GetSection("OpenIdConnect").Bind(options);
    });
}
else
{
    // Local mode: cookie-only auth with LocalAuthenticationMiddleware
    builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
        .AddCookie(options =>
        {
            options.LoginPath = "/Authentication/Login";
        });
}
```

**Why this matters**: The transform tool often converts OWIN OpenIdConnect registration as an unconditional call. Since local appsettings.json has placeholder values (not real Cognito settings), the OIDC handler will crash on the first request with `Value cannot be null. (Parameter 'ClientId')`.

## Verification

After reordering:
1. Confirm `dotnet build` still passes.
2. Review Program.cs to ensure no duplicate middleware calls.
3. Ensure no middleware was accidentally removed.

## Phase Gate
✅ Middleware is in correct order.
✅ Area routes and default routes are both registered.
✅ Authentication is conditionally registered (no crash in local mode).
✅ `dotnet build` passes.
