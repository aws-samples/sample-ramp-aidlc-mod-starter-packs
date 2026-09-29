---
name: dotnet-aspnet-sessionstate-aws
description: Externalizes ASP.NET Core session state to Amazon ElastiCache (Valkey or Redis). Modifies the application to use a distributed cache for session storage, optionally generates IaC (CloudFormation or CDK) to provision a new ElastiCache cluster, and produces a summary guide. NOT for output caching, response caching, or applications that don't use ASP.NET session state.
version: 1
allowed-tools: [Read, Write, Shell]
---

# Externalize ASP.NET Session State to Amazon ElastiCache

## When to Use This Skill

**Use this skill when:**
- An ASP.NET Core application uses in-memory session state (`AddSession` / `UseSession`)
- The application will be deployed across multiple instances (ECS tasks, EKS, Elastic Beanstalk, EC2, etc.) and needs shared session state
- The developer wants to replace in-process session with a distributed cache backed by ElastiCache

**Do NOT use this skill for:**
- Applications that don't use session state at all
- Output caching or response caching (different mechanism)
- Serverless (Lambda) applications where sessions are atypical

## Objective

By the end of this skill the application will:

1. Use `Microsoft.Extensions.Caching.StackExchangeRedis` as the distributed cache provider for session state
2. Connect to an Amazon ElastiCache cluster (Valkey by default, Redis optional)
3. Optionally have IaC (CloudFormation or CDK) to provision the ElastiCache cluster
4. Include a summary guide with connection details, IAM/security group configuration, and deployment notes

## Recommended MCP Server

This skill works best when the **AWS Knowledge MCP** server is configured.

- **URL**: `https://knowledge-mcp.global.api.aws`
- **Usage**: Look up ElastiCache Valkey/Redis configuration, security group rules, VPC subnet group requirements, and .NET SDK caching patterns.

If the MCP is not configured, the skill will still work using embedded guidance in the reference files.

## Phases

### Phase 0 — Gather Information

Before making changes, determine:

1. **Session usage** — find `AddSession()` and `UseSession()` in `Program.cs` or `Startup.cs`; identify session configuration (timeout, cookie name, etc.)
2. **Existing distributed cache** — check if `AddDistributedMemoryCache()` or another distributed provider is already registered
3. **Application structure** — read `.csproj` for TargetFramework, check for existing Redis/caching NuGet packages
4. **Deployment target** — determine if the app will run in a VPC (ECS, EC2) where ElastiCache is accessible

### Ask the Developer

Present these questions:

- **Cache engine**: "The default is **Valkey** (AWS-managed, Redis-compatible, no license concerns). Would you prefer **Redis OSS** instead? Both use the same .NET client library."
- **Cluster source**: "Do you want to connect to an **existing ElastiCache cluster**, or should I generate IaC to **create a new one**?"
  - If **existing cluster**: ask for the cluster's primary endpoint (host:port).
  - If **new cluster**:
    - **IaC format**: "Do you prefer **CloudFormation** (YAML, default) or **CDK** (C#)?"
    - **VPC selection**: "Should the cluster be created in a **new VPC** or an **existing VPC**?"
      - If existing VPC, ask for VPC ID and private subnet IDs (minimum 2 AZs).
      - Optionally offer to list VPCs via AWS CLI (with user approval).
- **Target AWS region** (default to `ap-southeast-1` if not specified)
- **Environment name** (default to `dev` if not specified)

### Phase 1 — Modify Application Code

Update the application to use ElastiCache as the distributed session store.

Read [references/application-wiring.md](references/application-wiring.md) for:
- NuGet package to add (`Microsoft.Extensions.Caching.StackExchangeRedis`)
- How to replace `AddDistributedMemoryCache()` with `AddStackExchangeRedisCache()`
- Configuration pattern (connection string from `appsettings.json`)
- Preserving existing session options (timeout, cookie settings)
- Local development fallback (`AddDistributedMemoryCache()` when no Redis is available)

### Phase 2 — Generate IaC (if creating a new cluster)

Skip this phase if the user chose to connect to an existing cluster.

Read [references/cloudformation-template-guide.md](references/cloudformation-template-guide.md) for CloudFormation, or [references/cdk-template-guide.md](references/cdk-template-guide.md) for CDK.

The IaC provisions:
- ElastiCache subnet group (using private subnets)
- ElastiCache security group (allowing inbound from application security group or CIDR)
- ElastiCache Serverless cache (Valkey or Redis engine, based on user choice)
- Relevant outputs (primary endpoint, port, security group ID)

#### VPC Modes

- **New VPC**: Create VPC, private subnets (2 AZs), route tables. No public subnets or NAT needed (ElastiCache is private-only).
- **Existing VPC**: Accept VPC ID and subnet IDs as parameters. Create only the ElastiCache-specific resources.

#### Output Location

- CloudFormation: `<project-root>/infra/elasticache-session.yaml`
- CDK: `<project-root>/infra/ElastiCacheSession.Cdk/`

### Phase 3 — Generate Summary Guide

Produce a markdown guide with deployment instructions and configuration reference.

Read [references/summary-guide-template.md](references/summary-guide-template.md) for the structure.

The guide must cover:
1. What was changed in the application
2. Connection string format and configuration
3. Security group requirements (app → ElastiCache on port 6379)
4. IAM and network prerequisites
5. Local development setup (fallback to in-memory or local Redis/Valkey container)
6. Session behavior notes (serialization, expiration, key prefix)
7. Cost estimation
8. Troubleshooting

#### Output Location

`<project-root>/SESSION-STATE-GUIDE.md`

## Constraints

- Use `Microsoft.Extensions.Caching.StackExchangeRedis` — it works with both Valkey and Redis since they're wire-protocol compatible
- Do NOT introduce a custom session provider or low-level StackExchange.Redis usage for basic session state
- Keep the `AddSession()` configuration (timeout, cookie options) unchanged unless the user requests modifications
- ElastiCache must be in private subnets only — no public access
- Default to ElastiCache Serverless for simplicity; add comments noting cluster-mode options for production
- Connection string must come from configuration (`appsettings.json`), not hardcoded
- Local development must still work without an ElastiCache cluster available
- If generating IaC, use a single stack — no nested stacks
- Do NOT hardcode account IDs or regions in IaC

## Output Structure

```
<project-root>/
├── SESSION-STATE-GUIDE.md                # Summary guide
├── infra/                                # Only if user chose to create a new cluster
│   ├── elasticache-session.yaml          # CloudFormation (if chosen)
│   └── ElastiCacheSession.Cdk/           # CDK project (if chosen)
├── <WebProject>/
│   ├── <WebProject>.csproj               # Updated with NuGet package
│   ├── Program.cs                        # Updated session/cache registration
│   ├── appsettings.json                  # ElastiCache connection string added
│   └── appsettings.Development.json      # Local fallback configuration
```

## Reporting

After completing all phases, summarize:
- Cache engine chosen (Valkey or Redis)
- Whether connecting to existing cluster or provisioning new infrastructure
- IaC format (if applicable)
- VPC mode (if applicable)
- Changes made to the application
- Estimated monthly cost (if new cluster)
- Any manual steps required (security group rules, VPC peering, etc.)
- Link to the generated `SESSION-STATE-GUIDE.md`

## Common Pitfalls Reference

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `RedisConnectionException` on startup | App can't reach ElastiCache | Verify security group allows inbound on port 6379 from app's SG |
| Session data lost between requests | Still using in-memory cache | Confirm `AddStackExchangeRedisCache` is registered, not `AddDistributedMemoryCache` |
| Serialization errors | Session storing non-serializable objects | Ensure all session values are stored as strings or byte arrays |
| High latency on session access | ElastiCache in different AZ or region | Deploy cache in same AZ as application tasks |
| `No connection available` after deploy | Endpoint wrong or DNS not resolving | Verify endpoint matches ElastiCache output; ensure app is in same VPC |
| Works locally but fails in ECS | Local uses in-memory fallback | Set `ElastiCache__ConnectionString` in task environment or config |
| TLS handshake failure | ElastiCache requires TLS, client not configured | Add `ssl=true` to connection string or set `ConfigurationOptions.Ssl = true` |
