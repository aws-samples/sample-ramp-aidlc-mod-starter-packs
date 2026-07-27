# Summary Guide Template

Structure for the `SESSION-STATE-GUIDE.md` file generated at the end of the skill.

## Output Location

```
<project-root>/SESSION-STATE-GUIDE.md
```

---

## Template

```markdown
# Session State Migration Guide

## Summary

This guide documents the migration of ASP.NET Core session state from in-memory to Amazon ElastiCache (<Engine>).

### What Changed

| File | Change |
|------|--------|
| `<WebProject>.csproj` | Added `Microsoft.Extensions.Caching.StackExchangeRedis` package |
| `Program.cs` | Replaced `AddDistributedMemoryCache()` with `AddStackExchangeRedisCache()` |
| `appsettings.json` | Added `ElastiCache` connection string |
| `appsettings.Development.json` | Empty connection string (triggers in-memory fallback for local dev) |

## Connection Configuration

### Connection String Format

```
<endpoint>:<port>,ssl=true,abortConnect=false
```

### Where to Set It

- **appsettings.json**: For direct configuration
- **Environment variable**: `ConnectionStrings__ElastiCache` (double underscore for nested keys)
- **AWS Parameter Store**: If using externalized configuration (see dotnet-aws-parameterstore skill)

### ElastiCache Endpoint

<If new cluster was provisioned>
After deploying the CloudFormation/CDK stack, retrieve the endpoint:

```bash
aws cloudformation describe-stacks \
  --stack-name <stack-name> \
  --query "Stacks[0].Outputs[?OutputKey=='ConnectionString'].OutputValue" \
  --output text
```

<If existing cluster>
Use the endpoint provided: `<existing-endpoint>`

## Network Requirements

### Security Group Rules

The application must be able to reach ElastiCache on port 6379:

| Source | Destination | Port | Protocol |
|--------|-------------|------|----------|
| Application SG (ECS tasks / EC2) | ElastiCache SG | 6379 | TCP |

### VPC Placement

- ElastiCache runs in **private subnets only** (no public access)
- Application must be in the **same VPC** as ElastiCache, or connected via VPC peering / Transit Gateway
- Ensure the application's subnets have routes to the ElastiCache subnets

## Local Development

### Option 1: In-Memory Fallback (no external dependencies)

When `ConnectionStrings:ElastiCache` is empty or missing AND the environment is `Development`, the app automatically uses `AddDistributedMemoryCache()`.

This means:
- No Docker or Redis/Valkey needed locally
- Sessions work but are NOT distributed (single-instance only)
- Suitable for most local development scenarios

### Option 2: Local Valkey Container

For testing distributed session behavior:

```bash
docker run -d --name local-valkey -p 6379:6379 valkey/valkey:latest
```

Set in `appsettings.Development.json`:
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

## Session Behavior Notes

### Key Prefix

All session keys are prefixed with `Session:` (configured via `InstanceName`). This prevents collisions if the same ElastiCache cluster is shared across applications.

### Expiration

Session entries expire automatically based on `IdleTimeout` (currently <timeout> minutes). The ASP.NET Core session middleware handles TTL — no manual configuration needed on the cache side.

### Serialization

Session values must be serializable:
- Use `SetString()` / `GetString()` for text
- Use `SetInt32()` / `GetInt32()` for integers
- Serialize complex objects to JSON before storing

### Sticky Sessions

With a distributed session store, **sticky sessions (session affinity) are NOT required**. Any instance can serve any request since all instances read from the same cache. Remove any ALB sticky session configuration if present.

## Infrastructure (if provisioned)

### Stack: `<stack-name>`

| Resource | Type | Purpose |
|----------|------|---------|
| ElastiCache Serverless | `<Engine>` | Distributed session store |
| Security Group | EC2 SG | Controls inbound access to cache |
| <Subnet Group> | ElastiCache Subnet Group | Places cache in private subnets |

### Deploy

```bash
aws cloudformation deploy \
  --template-file infra/elasticache-session.yaml \
  --stack-name <env>-session-cache \
  --parameter-overrides EnvironmentName=<env> Engine=<engine> AppSecurityGroupId=<sg-id>
```

### Destroy

```bash
aws cloudformation delete-stack --stack-name <env>-session-cache
```

## Cost Estimation

### ElastiCache Serverless (default)

| Component | Estimated Cost |
|-----------|---------------|
| Data storage (per GB/hr) | ~$0.125/GB/hr |
| ECPU (per million) | ~$0.0034/million |
| **Dev estimate** (< 1 GB, light traffic) | **< $5/month** |

### Cluster Mode (cache.t4g.micro × 2)

| Component | Estimated Cost |
|-----------|---------------|
| 2 × cache.t4g.micro | ~$18/node/month |
| **Total** | **~$36/month** |

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `RedisConnectionException` on startup | Can't reach ElastiCache | Check SG rules, VPC placement, endpoint correctness |
| Sessions lost between requests | Still using in-memory provider | Verify `AddStackExchangeRedisCache` is registered |
| Works locally, fails in ECS | Local uses in-memory fallback | Set connection string in ECS task environment/config |
| `No connection available` | Wrong endpoint or DNS issue | Verify endpoint from stack outputs; confirm same VPC |
| TLS handshake failure | Missing `ssl=true` | Add `ssl=true` to connection string |
| Timeout errors | Cross-AZ latency or underprovisioned | Check ECPU usage; increase limits if needed |
| `MOVED` errors | Cluster mode misconfiguration | Not applicable to Serverless; check client config for cluster mode |

## Next Steps

- [ ] Verify session works end-to-end after deployment
- [ ] Remove any ALB sticky session configuration (no longer needed)
- [ ] Consider adding a health check that verifies cache connectivity
- [ ] Set up CloudWatch alarms on ElastiCache metrics (CPU, memory, connections)
- [ ] For production: review capacity limits and adjust `CacheUsageLimits`
- [ ] If sharing cache across apps: ensure unique `InstanceName` per application
```

---

## Generation Rules

When generating the guide:

1. Replace all `<placeholders>` with actual values from the user's context
2. Remove sections that don't apply (e.g., "Infrastructure" section if using existing cluster)
3. Fill in the actual session timeout from the app's `AddSession()` configuration
4. Include the actual engine choice (Valkey or Redis) throughout
5. If IaC was generated, include the correct stack name and deploy commands
6. If using existing cluster, include the provided endpoint directly
7. Keep the troubleshooting table — it's always relevant
