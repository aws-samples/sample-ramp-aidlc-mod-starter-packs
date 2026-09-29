# References

Detailed guides for each phase of the `dotnet-aws-parameterstore` skill.

## Phase Guides

- **inventory-and-classification.md** — How to audit configuration, classify values (Secrets Manager vs. SSM String vs. keep), naming convention, and the developer confirmation prompt
- **configuration-wiring.md** — NuGet packages, IAWSConfig interface and implementation, Program.cs registration, caching, region resolution, and error handling
- **secrets-cleanup.md** — Migrating appsettings.json to SSM paths, preserving local dev, updating consuming code, and development environment guard patterns
- **summary-guide-template.md** — Template for the generated PARAMETER-STORE-GUIDE.md including parameter inventory, IAM policy (required), AWS CLI commands, and optional CLI provisioning flow
- **iac-generation.md** — CloudFormation and CDK templates for provisioning parameters, secrets, and the IAM read policy in `<project-root>/infra/`
