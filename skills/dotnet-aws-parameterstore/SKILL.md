---
name: dotnet-aws-parameterstore
description: Enhances a .NET application to externalize configuration into AWS Systems Manager Parameter Store and/or AWS Secrets Manager. Migrates hardcoded values (DB connection strings, API URLs, account IDs, feature flags) from appsettings.json or code into SSM parameters and Secrets Manager secrets, wires the app to resolve them at runtime via a helper class, and produces a summary guide with next steps. NOT for AppConfig feature-flag rollouts, Lambda-only apps, or greenfield apps that already use Parameter Store.
version: 1
allowed-tools: [Read, Write, Shell]
---

# Externalize .NET Configuration to SSM Parameter Store & Secrets Manager

## When to Use This Skill

**Use this skill when:**
- A .NET application stores secrets (DB passwords, API keys) in `appsettings.json`, environment variables, or hardcoded strings
- The developer wants to centralize configuration in AWS for a deployed workload
- The application needs different config per environment (dev/staging/prod) without rebuilding
- Connection strings, account IDs, API base URLs, or resource names need to move out of source control

**Do NOT use this skill for:**
- Applications that already read all config from Parameter Store / Secrets Manager
- Controlled rollout of feature flags (use AWS AppConfig instead)
- Lambda-only applications (use Lambda environment variables or the Parameters & Secrets extension)
- Greenfield apps where the developer wants to design config from scratch

## Objective

By the end of this skill the application will:

1. Store **SSM parameter paths** in `appsettings.json` (the parameter name, not the value)
2. Resolve actual values at runtime via a helper class that calls SSM / Secrets Manager
3. Store credentials in **Secrets Manager** by default, or SSM **SecureString** if the user overrides
4. Still work locally via `appsettings.Development.json` fallback
5. Include a **markdown summary guide** with parameter inventory, IAM policy definition, and CLI commands
6. Optionally generate **IaC** (CloudFormation or CDK) and/or **create parameters directly** via AWS CLI

## Recommended MCP Server

This skill works best when the **AWS Knowledge MCP** server is configured. It provides access to up-to-date AWS documentation for SSM Parameter Store, Secrets Manager, and IAM.

- **URL**: `https://knowledge-mcp.global.api.aws`
- **Usage**: When generating IAM policies, resolving SDK issues, or looking up API behavior, use the AWS Knowledge MCP to verify current API actions, resource ARN formats, and SDK usage patterns (e.g., `search_documentation` for `ssm:GetParameter` conditions, Secrets Manager rotation configuration, or `AWSSDK.SimpleSystemsManagement` .NET examples).

If the MCP is not configured, the skill will still work using embedded guidance in the reference files, but results may not reflect the latest AWS service changes.

## Phases

Work through phases sequentially. Each depends on the previous being complete.

### Phase 0 — Inventory Configuration

Audit the app's configuration surface and classify every value.

Read [references/inventory-and-classification.md](references/inventory-and-classification.md) for:
- How to scan `appsettings.json`, hardcoded strings, and `DbContext` registration
- Classification rules (Secrets Manager vs. SSM String vs. keep in appsettings)
- Naming convention (`/app/<service>/<category>/<key>`)
- The confirmation prompt to present to the developer (including the override option for SecureString)

### Phase 1 — Add NuGet Packages

Install the required AWS SDK packages.

Read [references/configuration-wiring.md](references/configuration-wiring.md) for the package list and conditional additions.

### Phase 2 — Create or Update the Config Helper Class

Create an `IAWSConfig` / `AWSConfig` helper class that resolves SSM parameter paths and Secrets Manager secrets at runtime.

Read [references/configuration-wiring.md](references/configuration-wiring.md) for:
- Interface and implementation patterns
- `GetStringFromSSM` with `WithDecryption = true`
- `GetSecretValue` for Secrets Manager
- Region resolution, caching, and error handling
- Registration in Program.cs

### Phase 3 — Update appsettings.json with Parameter Paths

Replace hardcoded values with SSM parameter path references. Preserve `appsettings.Development.json` with actual local values.

Read [references/secrets-cleanup.md](references/secrets-cleanup.md) for:
- Before/after config examples
- Rules for path values vs. actual values
- Development fallback patterns
- `.gitignore` updates

### Phase 4 — Update Consuming Code

Update code that previously read values directly from `IConfiguration` to resolve via the helper class.

Read [references/secrets-cleanup.md](references/secrets-cleanup.md) for:
- The consumption pattern (read path from config, resolve via helper)
- Development environment guard approaches
- Handling connection strings specifically

### Phase 5 — Generate Summary Guide

Produce a `PARAMETER-STORE-GUIDE.md` at the project root. This guide **must include an IAM policy definition** scoped to the parameters and secrets identified in Phase 0.

Read [references/summary-guide-template.md](references/summary-guide-template.md) for the full template including:
- Summary of changes
- Parameter inventory table
- **IAM policy document** (JSON) granting `ssm:GetParameter`, `secretsmanager:GetSecretValue`, and `kms:Decrypt` scoped to the app's parameter prefix
- Ready-to-run AWS CLI commands for creating parameters and secrets
- Local development setup notes
- Next steps

### Phase 6 — Offer IaC Generation and/or CLI Provisioning (Optional)

After generating the guide, ask the developer two questions:

1. **"Would you like me to generate Infrastructure-as-Code to provision these parameters, secrets, and IAM policy? Options: new CloudFormation (YAML), new CDK (C#), or enhance your existing IaC?"**

2. **"Would you like me to create these parameters directly in your AWS account now via the CLI?"**

If the project already has existing IaC (e.g., an ECS CloudFormation template in `infra/`), **prefer enhancing it** by adding IAM policies to the existing task role and adding `AWS_REGION` to the container environment. This is safer and avoids managing separate stacks for permissions.

Read [references/iac-generation.md](references/iac-generation.md) for:
- CloudFormation template structure (parameters, secrets, IAM managed policy)
- CDK stack structure (C#)
- **Enhancing existing templates** (adding policies to existing roles, adding env vars)
- **Deployment order** (stack update → image push → force new deployment)
- Output location (`<project-root>/infra/`)
- What to include (SSM parameters, Secrets Manager secrets, IAM policy for the app role)

Read [references/summary-guide-template.md](references/summary-guide-template.md) for:
- Pre-flight checks for CLI provisioning (`aws --version`, `aws sts get-caller-identity`)
- Permission verification
- Creation commands and overwrite handling

## Constraints

- Do NOT delete `appsettings.json` — it holds the parameter paths as structural reference.
- Keep `appsettings.Development.json` working for local dev without AWS credentials.
- Use `WithDecryption = true` on all `GetParameter` calls.
- Do NOT introduce abstractions beyond the helper class — keep the pattern explicit.
- Follow the naming convention: `/app/<service-name>/<category>/<key>`.
- Default to Secrets Manager for any value containing credentials. If user overrides, use SecureString.
- Do NOT store secrets as plain String type in Parameter Store.
- IaC output goes in `<project-root>/infra/` — do not mix with application source.
- The IAM policy must always be included in the summary guide (Phase 5), regardless of whether IaC is generated.

## Output Structure

```
<project-root>/
├── PARAMETER-STORE-GUIDE.md           # Summary guide with inventory, IAM policy, and CLI commands
├── infra/                             # Only if user chose IaC generation
│   ├── parameters.yaml               # CloudFormation template (if chosen)
│   └── ParameterStore.Cdk/           # CDK project (if chosen)
├── <WebProject>/
│   ├── Program.cs                     # Updated with IAWSConfig registration
│   ├── <WebProject>.csproj            # New NuGet references
│   ├── appsettings.json               # Values replaced with SSM parameter paths
│   ├── appsettings.Development.json   # Local-dev values preserved
│   ├── Helpers/ (or Util/)
│   │   ├── IAWSConfig.cs              # Interface for config resolution
│   │   └── AWSConfig.cs               # Implementation
│   └── <consuming code>               # Updated to resolve via helper
```

## Reporting

After completing all phases, summarize:
- Number of values moved to Parameter Store vs. Secrets Manager
- Naming convention applied
- Any values intentionally left in appsettings.json (and why)
- IAM permissions required (always listed)
- Whether IaC was generated (and which format)
- Whether parameters were created via CLI (or user deferred)
- Link to the generated `PARAMETER-STORE-GUIDE.md`

## Troubleshooting

If issues arise during implementation or at runtime, read [references/common-pitfalls.md](references/common-pitfalls.md) for known issues covering compile errors, runtime exceptions, and deployment problems.
