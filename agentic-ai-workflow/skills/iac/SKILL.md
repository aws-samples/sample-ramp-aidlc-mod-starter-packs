---
name: iac
description: Infrastructure as Code best practices with Terraform, Ansible, Pulumi, and CloudFormation. Use when bootstrapping cloud environments, managing remote state backends, recovering from state issues, automating CI/CD pipelines for infrastructure, modularizing infrastructure for reuse, enforcing drift detection, or performing risk assessments before applying changes.
metadata:
  authors: pluginagentmarketplace, omer-metin, williamzujkowski
  sources:
    - https://playbooks.com/skills/pluginagentmarketplace/custom-plugin-devops/iac
    - https://playbooks.com/skills/omer-metin/skills-for-antigravity/infrastructure-as-code
    - https://playbooks.com/skills/williamzujkowski/standards/infrastructure-as-code
---

# Infrastructure as Code (IaC) Best Practices

## Overview

Pragmatic guidance and battle-tested patterns for provisioning and managing cloud infrastructure with Terraform, Pulumi, Ansible, and CloudFormation. Focuses on preserving state, preventing drift, reducing blast radius, and protecting production environments. Grounded in real operational failures and prescriptive patterns.

## When to Use

- Bootstrapping cloud environments and standardized resources
- Configuring servers, roles, and deployments using Ansible playbooks
- Managing and recovering Terraform state in remote backends
- Automating CI/CD pipelines for infrastructure changes
- Modularizing infrastructure for reuse across teams
- Performing risk assessments before terraform apply/stack updates
- Investigating production outages tied to state drift or misapplied changes
- Enforcing drift detection and remediation

## Core Principles

### 1. Treat State as Sacred
- Enforce remote backends with backups and locking
- Never store state locally in team environments
- Enable versioning on state storage (S3 versioning, etc.)
- Restrict access to state files via IAM policies

### 2. Always Plan Before Apply
- Run and review an explicit plan before applying changes
- Use `--check`/`diff` modes to preview changes and detect drift
- Require human review of plans for production workspaces

### 3. Limit Blast Radius
- Split infrastructure into small, purpose-driven modules
- Use separate workspaces/projects for prod vs non-prod
- Enable resource targeting sparingly
- Implement policy checks that block destructive changes

### 4. Secure Secrets
- Never store plaintext secrets in state
- Integrate secret managers (AWS Secrets Manager, HashiCorp Vault)
- Use encrypted variables and ansible-vault for Ansible
- Rotate exposed secrets immediately

### 5. Validate Early and Often
- Run `terraform fmt` and `validate` in CI
- Implement drift detection on a schedule
- Use linters (TFLint, Checkov) for best practice enforcement

## Terraform Workflow

### Init / Plan / Apply / Destroy Cycle

```bash
# Initialize backend and download providers
terraform init

# Preview changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Destroy resources
terraform destroy
```

### Remote State Setup

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

### State Recovery

```bash
# Force unlock after failed operation
terraform force-unlock <lock-id>

# Import existing resource
terraform import aws_vpc.main vpc-12345678

# Remove resource from state (without destroying)
terraform state rm aws_instance.old

# Restore from S3 versioning
aws s3api list-object-versions --bucket my-terraform-state --prefix prod/terraform.tfstate
aws s3api get-object --bucket my-terraform-state --key prod/terraform.tfstate --version-id <version> restored.tfstate
```

## Ansible Patterns

### Playbook Best Practices

```yaml
# Use roles for reusable configuration
- hosts: webservers
  roles:
    - common
    - nginx
    - app-deploy

# Use inventory targeting by environment
ansible-playbook -i inventory/production site.yml

# Check mode (dry run)
ansible-playbook site.yml --check --diff
```

### Secrets with Ansible Vault

```bash
# Encrypt a file
ansible-vault encrypt secrets.yml

# Edit encrypted file
ansible-vault edit secrets.yml

# Run playbook with vault
ansible-playbook site.yml --ask-vault-pass
```

## Modularization Strategy

### When to Build a Module vs Copy Code

| Scenario | Approach |
|----------|----------|
| Used across 2+ projects/environments | Create a module |
| One-off configuration | Inline resources |
| Complex logic with many variables | Module with clear interface |
| Simple 1-2 resources | Inline unless shared |

### Module Boundaries

```
modules/
├── networking/     # VPC, subnets, route tables
├── compute/        # EC2, ASG, ALB
├── data/           # RDS, ElastiCache, DynamoDB
├── security/       # IAM, security groups, KMS
└── monitoring/     # CloudWatch, SNS, alarms
```

## CI/CD Integration

### Pipeline Stages

1. **Lint** - `terraform fmt -check`, `tflint`
2. **Validate** - `terraform validate`
3. **Security Scan** - `checkov`, `trivy`
4. **Plan** - `terraform plan -out=tfplan`
5. **Review** - Human approval for production
6. **Apply** - `terraform apply tfplan`
7. **Drift Check** - Scheduled comparison of live vs state

### Drift Detection

```bash
# Compare live state to planned configuration
terraform plan -detailed-exitcode
# Exit code 0 = no drift
# Exit code 2 = drift detected

# Schedule in CI (daily)
# cron: '0 6 * * *'
```

## Anti-Patterns to Avoid

| Anti-Pattern | Risk | Fix |
|-------------|------|-----|
| Local state files | Data loss, no collaboration | Use remote backend with locking |
| Monolithic modules | Large blast radius, slow plans | Split into focused modules |
| Secrets in state | Security breach | Use secret managers + write-only args |
| No plan review | Accidental destruction | Require human approval for prod |
| Manual console changes | State drift | Enforce IaC-only changes policy |
| No resource tagging | Cost tracking impossible | Enforce tags via policy |

## FAQ

**How do I handle a state lock caused by a failed operation?**
Wait for the operation to complete or use `terraform force-unlock` with the lock ID after confirming no active processes are modifying the state.

**When should I import resources instead of recreating them?**
Import when resources already exist in the cloud and you want to adopt them into IaC without downtime or when deletion would be disruptive.

**How do I protect production from accidental deletes?**
Use separate workspaces for prod, require mandatory plan reviews and approvals, enable resource targeting sparingly, and implement policy checks that block destructive changes to critical resources.

**How do I avoid state conflicts with multiple people?**
Use a remote backend that supports locking (S3 + DynamoDB or Terraform Cloud) and require plan review before apply.
