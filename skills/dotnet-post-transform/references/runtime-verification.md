# Phase 5 — Runtime Verification

Confirm the application starts and serves pages correctly. This is about local execution only — not production deployment.

## Steps

### 1. Start the Application
```bash
dotnet run --project <WebProjectPath>
```

### 2. Check for Startup Exceptions
Watch console output for:
- `InvalidOperationException` — missing DI registrations
- `FileNotFoundException` — missing config files or assemblies
- `ArgumentException` / `ArgumentNullException` — invalid configuration values (e.g., OIDC `ClientId` is null)
- Database connection failures
- `SqlNullValueException` — nullable property mismatch (see step 6)

If any exception occurs, fix the root cause and restart.

### 3. Verify Home Page Loads
Request the root URL and confirm:
- HTTP 200 response (not 500)
- HTML content renders (not an exception page)

### 4. Check Static Assets
Verify no 404s for:
- CSS files (`~/css/site.css`, `~/lib/bootstrap/...`)
- JavaScript files (`~/Scripts/jquery/...`, `~/lib/jquery/...`)
- Favicon

### 5. Verify Images Render
Check that images serve correctly:
- Banner/background images on home page
- Book cover images (if seeded data exists)
- Fallback/placeholder images (onerror handlers)

### 6. Fix EF Core Nullable Property Exceptions (SqlNullValueException)

**This is a very common post-transform runtime issue.** If the Domain project has `<Nullable>enable</Nullable>` in its csproj, EF Core treats `string` properties as non-nullable columns. When the database has NULL values in those columns (common for optional fields like `Summary`, `CoverImageUrl`, `Comment`, `Phone`, `Email`), EF Core throws:

```
System.Data.SqlTypes.SqlNullValueException: Data is Null. This method or property cannot be called on Null values.
```

**Fix**: Make properties that can be NULL in the database explicitly nullable:

```csharp
// Before (crashes when DB column is NULL)
public string Summary { get; set; }
public string CoverImageUrl { get; set; }

// After (matches DB nullability)
public string? Summary { get; set; }
public string? CoverImageUrl { get; set; }
```

**How to identify affected properties**:
1. Look at the entity constructor — parameters with `= null` default values indicate nullable columns.
2. Look at seed data — if a field is passed as `null`, its property must be `string?`.
3. Check the `Entity` base class — `byte[] RowVersion` with `[Timestamp]` should be `byte[]?` since it's null until the row is first saved.
4. Check relational properties — navigation properties loaded via `Include()` are often null when not loaded; make them `T?` or use the null-forgiving operator in the private constructor.

**Common nullable candidates across bookstore-style apps**:
- `Book.Summary`, `Book.CoverImageUrl`
- `Customer.Email`, `Customer.Phone`
- `Address.AddressLine2`
- `Offer.FrontUrl`, `Offer.Summary`, `Offer.Comment`
- `Entity.RowVersion` (byte[]?)

### 7. Test Basic Navigation
Verify key routes work:
- Home page
- Book listing / search
- Admin area (if applicable)
- Login/logout flow in local mode

## Common Pitfalls Reference Table

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All static files 404 | WebRootPath not set | Set `WebRootPath = "Content"` in WebApplicationOptions |
| CSS 404 but images at /Content/... work | WebRootPath set after CreateBuilder | Use `WebApplicationOptions` instead |
| Scripts 404 | Scripts folder outside web root | Add separate `UseStaticFiles` with PhysicalFileProvider |
| Images 404 but CSS works | `/Content` prefix in image URLs | Add backward-compat `/Content` mapping OR remove prefix |
| DI exception on page load | Missing service registration | Register the missing interface → implementation |
| `ArgumentNullException: ClientId` | OIDC registered in local mode | Conditionally register OIDC only for `Services:Authentication == "aws"` |
| `SqlNullValueException` on page load | Nullable column → non-nullable property | Make property `string?` in the entity |
| `KeyNotFoundException` in BookstoreConfiguration | Nested config key with `/` separator | Fix shim to translate `/` → `:` and fall back to IConfiguration |
| jQuery validation fails | Script path doesn't match folder name | Match `<script src=` to actual folder name on disk |
| Area routes 404 | Missing area route pattern | Add `{area:exists}` route before default route |
| DB seed images broken | Old `/Content/...` URLs in DB | Add backward-compat `/Content` static file mapping |
| CSS/JS loads but looks wrong | Incorrect `~/` path resolution | Verify `_Layout.cshtml` paths relative to WebRootPath |
| Startup crash: no DB | Connection string missing/wrong | Check appsettings.json ConnectionStrings section |
| Empty pages (no data) | DB seeder not registered | Register `BookstoreDbInitializer` as `AddHostedService<>()` |
| WebOptimizer bundles 404 | `UseWebOptimizer()` after `UseStaticFiles()` | Move `UseWebOptimizer()` before `UseStaticFiles()` |
| Currency shows `¤` instead of `$` | Container culture is `InvariantCulture` | Set `CultureInfo.DefaultThreadCurrentCulture` to `en-US` (or appropriate locale) at app startup |
| Static images 404 on Linux but work on Windows | File path case mismatch (e.g., `/images/` vs `/Images/`) | Match view references exactly to on-disk folder casing — Linux is case-sensitive |

## What NOT to Fix at This Stage

- Build warnings (nullable, deprecated APIs, package pruning)
- Security headers or HTTPS certificate issues
- AWS Cognito / real OIDC authentication (local auth bypass is fine)
- EF Core migration baseline (not needed for local dev DB)
- Performance or caching concerns

## Linux Container Gotchas

These issues only manifest when deployed to Linux containers (Docker, ECS Fargate, etc.) but work fine on Windows locally:

### Case-Sensitive File Paths
Linux filesystems are case-sensitive. A Razor view referencing `/images/photo.jpg` will 404 if the physical folder is `Images/` (capital I). Always verify that path casing in `.cshtml` files matches the on-disk folder names exactly.

### Currency Symbol Shows ¤ Instead of $
The .NET `InvariantCulture` uses `¤` as its currency symbol. On Linux containers without a locale configured, `decimal.ToString("C")` will render `¤123.45` instead of `$123.45`. Fix by setting the default culture at application startup:

```csharp
var culture = new CultureInfo("en-US");
CultureInfo.DefaultThreadCurrentCulture = culture;
CultureInfo.DefaultThreadCurrentUICulture = culture;
```

Add `using System.Globalization;` and place this before `WebApplication.CreateBuilder()`.

**Note**: The `aspnet:10.0-noble-chiseled-extra` base image includes ICU globalization data, so culture-aware formatting works — but the *default* culture must still be set explicitly.

## Phase Gate
✅ Application starts without exceptions.
✅ Home page returns HTTP 200.
✅ CSS, JS, and images load without 404s.
✅ Database queries succeed (no SqlNullValueException).
✅ Basic navigation between pages works.
✅ Login/logout works in local mode.
