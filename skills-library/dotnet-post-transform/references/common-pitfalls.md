# Common Pitfalls Reference

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| All static files 404 | No `wwwroot`, `UseStaticFiles` serves nothing | Set `WebRootPath = "Content"` via `WebApplicationOptions` |
| CSS 404 but /Content/... works | WebRootPath set after CreateBuilder | Use `WebApplicationOptions` instead of post-construction assignment |
| Scripts 404 | Scripts folder outside web root | Add separate `UseStaticFiles` with `PhysicalFileProvider` for Scripts |
| Images 404 but CSS works | URLs use `/Content/images/...` but web root IS Content | Add backward-compat `/Content` mapping |
| DI exception on page load | Service not registered | Register all interfaces → implementations |
| `ArgumentNullException: ClientId` | OIDC registered unconditionally in local mode | Conditionally register OIDC only when `Services:Authentication == "aws"` |
| `SqlNullValueException` on query | Nullable DB column → non-nullable `string` property | Make property `string?` (check `<Nullable>enable</Nullable>` in Domain csproj) |
| `ConfigurationManager` null ref / KeyNotFound | Shim doesn't translate `/` → `:` for nested keys | Fix shim to fall back to `IConfiguration[key.Replace("/", ":")]` |
| jQuery validation fails | Wrong library folder name | Match path to actual folder on disk |
| Area routes 404 | Area route not mapped | Add `{area:exists}` route pattern |
| DB seed images broken | Seeded URLs use old `/Content/...` path | Add backward-compat mapping at `/Content` |
| Empty pages (no data) | DB seeder hosted service not registered | Add `builder.Services.AddHostedService<BookstoreDbInitializer>()` |
| WebOptimizer bundles 404 | `UseWebOptimizer()` placed after `UseStaticFiles()` | Move `UseWebOptimizer()` before `UseStaticFiles()` |
| Currency shows `¤` instead of `$` | Container culture is `InvariantCulture` | Set `CultureInfo.DefaultThreadCurrentCulture` to `en-US` (or appropriate locale) at app startup |
| Static images 404 on Linux but work on Windows | File path case mismatch (e.g., `/images/` vs `/Images/`) | Match view references exactly to on-disk folder casing — Linux is case-sensitive |
