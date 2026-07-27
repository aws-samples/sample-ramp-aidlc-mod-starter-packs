# Common Pitfalls Reference

Known issues encountered when externalizing .NET configuration to SSM Parameter Store and Secrets Manager, with root causes and fixes.

## Runtime Issues

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| App crashes on startup in deployed env | Missing IAM permissions | Attach the IAM policy from the summary guide to the task role |
| `ParameterNotFound` exception | Parameter doesn't exist or wrong path | Create the parameter using CLI commands from the guide |
| `AccessDeniedException` on GetParameter | Task role missing SSM permissions | Add `ssm:GetParameter` for the specific parameter ARN |
| SecureString returns encrypted blob | `WithDecryption` not set to `true` | Always use `WithDecryption = true` |
| Local dev tries to call AWS | No environment guard | Use `appsettings.Development.json` with actual values or check `IsDevelopment()` |
| Secrets Manager `ResourceNotFoundException` | Secret name mismatch | Verify name matches exactly (case-sensitive) |
| High latency on every request | SSM called per-request without caching | Add in-memory cache with TTL in the helper class |
| Parameter already exists error | Re-running creation commands | Use `--overwrite` flag |
| ECS task can't resolve AWS region | `AWS_REGION` not set in Fargate container | Add `AWS_REGION` env var to task definition (Fargate doesn't set it automatically) |
| DbContext fails — IAWSConfig not in DI yet | Connection string needed before DI container built | Create temporary `AWSConfig` instance in Program.cs with bootstrap logger |

## Compile-Time Issues

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| CS0104 ambiguous `ResourceNotFoundException` | Both `Amazon.SecretsManager.Model` and `Amazon.SimpleSystemsManagement.Model` define this type | Fully qualify as `Amazon.SecretsManager.Model.ResourceNotFoundException` |
| `NU1605` package downgrade error | New SecretsManager package requires higher AWSSDK.Core than what's pinned | Bump `AWSSDK.Core` to match the highest transitive dependency |
| Helper catch blocks never fire | `.Result` wraps exceptions in `AggregateException` | Use `catch (AggregateException ex) when (ex.InnerException is ...)` pattern |
| NuGet version not found | Skill used `3.*` but project is on SDK v4 | Always check existing `AWSSDK.*` package versions and match the major version |
