# Phase 3 — Fix Static File Serving

ASP.NET Framework uses a `Content` folder; ASP.NET Core expects `wwwroot`. Fix the mismatch without renaming folders.

## Pre-requisite

If ATX artifacts mention static asset path changes (nextsteps.md often has a "Static assets, bundling" section), use that as a guide for which files need attention.

## Steps

### 1. Set WebRootPath

If the project has a `Content` folder but no `wwwroot`, set `WebRootPath` explicitly using `WebApplicationOptions`. Do NOT set it after `CreateBuilder()` — it may not propagate correctly to the static file middleware.

```csharp
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = "Content"
});
```

**Important**: Do NOT use `builder.Environment.WebRootPath = ...` after construction. The internal `IWebHostEnvironment` used by `UseStaticFiles()` may not pick up the late assignment.

### 2. Enable Static File Middleware
Ensure `app.UseStaticFiles()` is in the pipeline (Phase 4 covers ordering).

### 3. Serve Scripts Folder Separately

ASP.NET Framework projects often have a `Scripts/` folder as a sibling to `Content/`. Since it's outside the web root, it won't be served automatically. Add a separate static file mapping:

```csharp
var scriptsPath = Path.Combine(builder.Environment.ContentRootPath, "Scripts");
if (Directory.Exists(scriptsPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(scriptsPath),
        RequestPath = "/Scripts"
    });
}
```

Add `using Microsoft.Extensions.FileProviders;` if not already present.

### 4. Add Backward-Compatibility Mapping
Existing database records and views may reference `/Content/...` URLs. Add a second static files mapping so those URLs still resolve:

```csharp
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(builder.Environment.WebRootPath),
    RequestPath = "/Content"
});
```

This ensures requests to `/Content/Images/book.jpg` still serve correctly even though the web root IS the Content folder.

### 5. Fix Image URL Paths in Views
Since the web root IS the `Content` folder, Razor views should NOT include `/Content` in their paths:
- **Before**: `<img src="/Content/images/banner.jpg">`
- **After**: `<img src="/Images/banner.jpg">` or `<img src="~/Images/banner.jpg">`

Search all `.cshtml` files for hardcoded `/Content/` references and path case mismatches.

Also fix inline CSS background images:
- **Before**: `url(/Content/images/register.jpg)`
- **After**: `url(/Images/register.jpg)`

**However**, if you add the backward-compat `/Content` mapping (step 4), existing `/Content/...` URLs in views and the database will work without modification. In that case, leave the view references as-is to minimize changes.

### 6. Fix LocalFileService.SaveAsync Return URL
The file service returns URLs for saved uploads. Ensure the returned path is consistent with the backward-compat mapping. If the `/Content` backward-compat mapping is in place:
- Physical save: `{WebRootPath}/Images/coverimages/{filename}` (e.g., `Content/Images/coverimages/foo.png`)
- Returned URL: `/Content/Images/coverimages/{filename}` (matches the backward-compat mapping)

When `WebRootPath` is `Content`, the `LocalFileService` constructor should receive `builder.Environment.WebRootPath` directly (NOT `Path.Combine(WebRootPath, "Content")` which would double it).

### 7. Fix _ValidationScriptsPartial.cshtml
jQuery validation script paths must match actual folder names on disk. Check:
- Is the folder named `jquery-validate` or `jquery-validation`?
- Are files in a `dist/` subfolder or directly in the folder?
- Are the scripts in `Content/lib/` (web root) or `Scripts/` (separate mapping)?
- Match the `<script src="...">` paths to the actual physical file paths.

### 8. Verify _Layout.cshtml References
Check that `~/css/...` and `~/lib/...` references in `_Layout.cshtml` resolve correctly given the new web root. The `~` resolves to the WebRootPath, so `~/css/site.css` → `Content/css/site.css`.

Also check `~/Scripts/...` references — if Scripts is outside the web root, the `~` prefix won't resolve them. Use `/Scripts/...` (absolute path without tilde) instead, since it's served via the separate static file mapping.

## Phase Gate
✅ `dotnet build` passes.
✅ Static file paths are internally consistent with the configured WebRootPath.
✅ No `/Content/Content/` doubled path issues exist.
✅ CSS, JS, and images all return HTTP 200 when requested directly.

## Linux Case-Sensitivity Gotcha

On Windows, file paths are case-insensitive so `/images/photo.jpg` and `/Images/photo.jpg` resolve to the same file. On Linux containers (which is what ECS Fargate and most Docker deployments use), the filesystem is **case-sensitive**. A view referencing `/images/register.jpg` will 404 if the folder on disk is `Images/` (capital I).

**How to detect**: Static images load fine locally on Windows but return 404 when deployed to a Linux container.

**Fix**: Audit all `.cshtml` files for static file references and ensure the casing matches the physical folder names exactly. Search for mismatches:

```bash
# Find all image references in views
grep -ri "/images/" Views/
# Compare against actual folder name
ls wwwroot/Content/   # Note: Is it "Images" or "images"?
```

Align the references to match the disk. Prefer fixing the references over renaming folders, since database-seeded URLs (e.g., `/Content/Images/coverimages/...`) also depend on folder casing.
