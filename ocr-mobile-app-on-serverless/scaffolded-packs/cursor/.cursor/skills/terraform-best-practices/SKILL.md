---
name: terraform-best-practices
description: Guidance for writing clean, maintainable, secure Terraform (HCL). Use when authoring or reviewing Infrastructure as Code with Terraform.
---

# Terraform Best Practices

Guidance for writing clean, maintainable, secure Terraform (HCL). Reference when authoring or reviewing Infrastructure as Code with Terraform. Primary source: the [HashiCorp Terraform Style Guide](https://developer.hashicorp.com/terraform/language/style) and [Standard Module Structure](https://developer.hashicorp.com/terraform/language/modules/develop/structure).

> Note: this project's existing backend uses AWS CDK (TypeScript). Use this skill when Terraform is preferred, or for greenfield IaC where Terraform is the chosen tool. For AWS service specifics, still verify against the AWS Knowledge MCP. Terraform, providers, and best practices evolve — confirm current syntax against official HashiCorp docs.

## Formatting & Style

- **Run `terraform fmt` and `terraform validate` before every commit** — automate via a Git pre-commit hook or CI step.
- **Use a linter** such as TFLint to enforce organization-specific rules beyond formatting.
- **Indent two spaces** per nesting level. Align consecutive single-line argument `=` signs.
- **Order within a block:** meta-arguments (`count`/`for_each`) first, then resource arguments, then nested blocks, then `lifecycle`, then `depends_on`. Separate groups with a blank line.
- **Comments:** use `#` for single- and multi-line comments (`//` and `/* */` are non-idiomatic).
- **Build code on itself:** define data sources and dependencies before the resources that reference them.

## Naming Conventions

- **Use underscores `_`, not dashes `-`**, everywhere: resource names, data sources, variables, outputs, locals.
- **Use descriptive nouns; do not repeat the resource type in the name.** The address already includes the type.
  - Bad: `resource "aws_instance" "web_api_aws_instance"`
  - Good: `resource "aws_instance" "web_api"`
- **Wrap resource type and name in double quotes**: `resource "aws_instance" "web" {}`.

## File Structure

Recommended file layout for a configuration or module:

| File | Contents |
|------|----------|
| `terraform.tf` | Single `terraform` block: `required_version` and `required_providers` |
| `backend.tf` | Backend configuration |
| `providers.tf` | All provider blocks (default provider first) |
| `main.tf` | Resources and data sources |
| `variables.tf` | All `variable` blocks, alphabetical |
| `outputs.tf` | All `output` blocks, alphabetical |
| `locals.tf` | Local values referenced across files |

As the codebase grows, split `main.tf` by logical group (`network.tf`, `storage.tf`, `compute.tf`). It should always be obvious where to find a given resource.

## Variables & Outputs

- **Every variable needs a `type` and `description`.** Provide a sensible `default` for optional variables.
- **Variable parameter order:** type, description, default, sensitive, validation.
- **Mark secrets `sensitive = true`** (passwords, keys). Note: Terraform still stores these in plaintext in state — use a secrets manager for real protection.
- **Use `validation` blocks** only for genuinely restrictive requirements.
- **Every output needs a `description`.** Mark sensitive outputs accordingly. Design outputs around what consumers need.
- **Avoid overusing variables and locals** — expose a variable only when the value genuinely changes between deployments. Use locals sparingly to avoid obscuring logic.

## Modules

- **Group logically related resources** that are provisioned together (e.g. a `network` module: VPC, subnets, gateway, security groups).
- **Store local modules at `./modules/<module_name>`.**
- **Keep root modules lean**; push reusable logic into focused, versioned child modules with clear inputs and outputs.
- **Registry naming:** module repos must be named `terraform-<PROVIDER>-<NAME>` (e.g. `terraform-aws-ec2-instance`).
- **Standard module structure:** each module has `main.tf`, `variables.tf`, `outputs.tf`, plus a `README.md`.
- **Prefer one module per repository** so each can be versioned independently, or use a deliberate monorepo with workspace-per-directory scoping.

## State Management

- **Use remote state with locking** (e.g. S3 + DynamoDB lock table, or HCP Terraform / Terraform Enterprise). Local state is plaintext on disk and has no locking.
- **Separate state per environment**, and split large codebases across multiple states/workspaces to limit blast radius and keep state files small.
- **Never commit state.** Exclude `terraform.tfstate*`, `.terraform.tfstate.lock.info`, the `.terraform/` directory, saved plan files, and any sensitive `*.tfvars`.
- **Always commit** all `.tf` files, the `.terraform.lock.hcl` dependency lock file, a `.gitignore`, and a `README.md`.
- **Share data across states** via the `tfe_outputs` data source (HCP/TFE) or provider data sources — avoid sharing raw state files.

## Versioning

- **Pin Terraform, provider, and module versions** to prevent unintended changes.
  ```hcl
  terraform {
    required_providers {
      aws = {
        source  = "hashicorp/aws"
        version = "5.34.0"
      }
    }
    required_version = ">= 1.7"
  }
  ```
- **Pin registry modules** with the `version` parameter in the `module` block (local modules ignore `version`).

## Security

- **Never hardcode secrets** in `.tf` files or commit them. Use dynamic provider credentials or a secrets manager (e.g. HashiCorp Vault). Remember secrets still land in state in plaintext.
- **Least-privilege IAM** for the credentials Terraform runs with; scope provider roles to what each configuration needs.
- **Use provider-specific environment variables** for credentials in Community Edition; use dynamic credentials in HCP/TFE.
- **Scan IaC** for misconfigurations (e.g. tfsec, Checkov, Trivy) in CI before apply.
- **Enforce policy as code** (Sentinel or OPA) for guardrails: required tags, instance-size limits, blocked actions. Store policies in a separate repo from the Terraform code.

## Meta-Arguments

- **Use `count` and `for_each` sparingly** — they add power but also complexity. Comment non-obvious uses.
- **`count`** for near-identical resources or simple conditional creation (`count = var.enabled ? 1 : 0`).
- **`for_each`** (over a map or set) when instances need distinct values not derivable from an integer; gives stable keyed addresses rather than fragile index-based ones.

## Workflow & Testing

- **Review the plan before apply.** Plan → review → apply is the core safety loop; you always see changes before they happen.
- **Use short-lived branches and pull requests** (GitHub flow). Run speculative plans on PRs where available.
- **Treat `main` as the source of truth** for all environments; use a workspace or directory per environment.
- **Write Terraform tests** (`terraform test`) for modules and run them as a pre-merge check or CI step. Tests validate code behavior; preconditions/postconditions/validation validate deployed infrastructure — use both.
- **Production safety:** for destructive changes (resource deletion/replacement), confirm intent explicitly and never disable safeguards (deletion protection, state backups, versioning) without sign-off.
