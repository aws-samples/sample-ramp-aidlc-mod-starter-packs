# Summary Guide Template

Template for the `PARAMETER-STORE-GUIDE.md` file generated in Phase 5.

## Output Location

```
<project-root>/PARAMETER-STORE-GUIDE.md
```

## Critical: IAM Policy Is Required

The summary guide **must always** include a complete IAM policy document (Section 4 below). This is non-negotiable — it's the most commonly forgotten piece when externalizing config, and the app will fail at runtime without it.

## Template Structure

The generated guide must include these sections:

---

### Section 1: Summary of Changes

List every file that was modified and what changed:

```markdown
## Summary of Changes

| File | Change |
|------|--------|
| `MyService.csproj` | Added `AWSSDK.SimpleSystemsManagement` and `AWSSDK.SecretsManager` NuGet packages |
| `Helpers/IAWSConfig.cs` | Created — interface for SSM/Secrets resolution |
| `Helpers/AWSConfig.cs` | Created — implementation with GetStringFromSSM and GetSecretValue |
| `Program.cs` | Registered `IAWSConfig` as singleton |
| `appsettings.json` | Replaced values with SSM parameter paths |
| `appsettings.Development.json` | Preserved local development values |
| `Services/MyService.cs` | Updated to resolve config via IAWSConfig |
```

### Section 2: Parameter Inventory

Table listing every parameter/secret that needs to be created in AWS:

```markdown
## Parameter Inventory

| Parameter Name | Type | Store | Description |
|---------------|------|-------|-------------|
| `/app/myservice/db/connectionstring` | SecureString | SSM Parameter Store | Database connection string |
| `/app/myservice/s3/bucketname` | String | SSM Parameter Store | S3 bucket for file uploads |
| `/app/myservice/eventbridge/busname` | String | SSM Parameter Store | EventBridge bus name |
| `/app/myservice/api/invokeurl` | String | SSM Parameter Store | API Gateway invoke URL |
```

Or if using Secrets Manager:

```markdown
| `/app/myservice/db/connectionstring` | Secret | Secrets Manager | Database connection string |
```

### Section 3: AWS CLI Commands

Ready-to-run commands. Use placeholder values that clearly indicate what to substitute:

```markdown
## Create Parameters

### SSM Parameter Store (String)

​```bash
aws ssm put-parameter \
  --name "/app/myservice/s3/bucketname" \
  --value "<YOUR-BUCKET-NAME>" \
  --type String \
  --description "S3 bucket for file uploads"

aws ssm put-parameter \
  --name "/app/myservice/eventbridge/busname" \
  --value "<YOUR-EVENTBUS-NAME>" \
  --type String \
  --description "EventBridge bus name"

aws ssm put-parameter \
  --name "/app/myservice/api/invokeurl" \
  --value "<YOUR-API-GATEWAY-URL>" \
  --type String \
  --description "API Gateway invoke URL"
​```

### SSM Parameter Store (SecureString) — for credentials if user chose this

​```bash
aws ssm put-parameter \
  --name "/app/myservice/db/connectionstring" \
  --value "<YOUR-CONNECTION-STRING>" \
  --type SecureString \
  --description "Database connection string"
​```

### Secrets Manager — for credentials (default)

​```bash
aws secretsmanager create-secret \
  --name "/app/myservice/db/connectionstring" \
  --secret-string "<YOUR-CONNECTION-STRING>" \
  --description "Database connection string"
​```
```

### Section 4: IAM Policy (REQUIRED)

This section is **always** included. Generate the policy document with actual resource ARNs based on the parameter inventory from Phase 0.

```markdown
## IAM Policy

The application's execution role (ECS task role, EC2 instance profile, etc.) **must** have the following policy attached. Without it, the app will throw `AccessDeniedException` at runtime.

### Policy Document

​```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadSSMParameters",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:<region>:<account-id>:parameter/app/<service-name>/*"
    },
    {
      "Sid": "ReadSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:<region>:<account-id>:secret:/app/<service-name>/*"
    },
    {
      "Sid": "DecryptWithKMS",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": [
            "ssm.<region>.amazonaws.com",
            "secretsmanager.<region>.amazonaws.com"
          ]
        }
      }
    }
  ]
}
​```

### How to Attach

**Option A: AWS CLI**
​```bash
aws iam put-role-policy \
  --role-name <your-task-role-name> \
  --policy-name <service-name>-config-read \
  --policy-document file://policy.json
​```

**Option B: Use the generated IaC** (if you chose CloudFormation or CDK in Phase 6)

The IaC template includes this policy as a managed policy resource. Attach its ARN to your task role.
```

**Tailoring rules:**
- Omit the `ReadSecrets` statement if not using Secrets Manager.
- Omit `DecryptWithKMS` if only using plain String parameters (no SecureString, no Secrets Manager).
- Replace `<region>`, `<account-id>`, and `<service-name>` with actual values from the developer's context.
- If specific parameter ARNs are known, list them individually instead of using a wildcard for tighter scoping.

### Section 5: Local Development

```markdown
## Local Development

The app works locally without AWS credentials:

- `appsettings.Development.json` contains actual values (not SSM paths)
- The `ASPNETCORE_ENVIRONMENT=Development` setting is automatic when using `dotnet run`
- No AWS CLI or credentials required for local development

If you need to test SSM resolution locally, configure AWS credentials:
​```bash
aws configure
​```
```

### Section 6: Next Steps

```markdown
## Next Steps

- [ ] Create the parameters/secrets listed above in your target AWS account
- [ ] Attach the IAM policy to your application's execution role
- [ ] Deploy and verify the application reads values correctly
- [ ] Consider adding parameter rotation for secrets (Secrets Manager supports auto-rotation)
- [ ] Set up monitoring: CloudWatch alarms on `ssm:GetParameter` throttling
- [ ] For CI/CD: add parameter creation to your deployment pipeline
```

---

## Phase 6: CLI Provisioning Flow

When the user accepts the offer to create parameters:

### Pre-flight Checks

```bash
# 1. Check AWS CLI is installed
aws --version

# 2. Check credentials are configured
aws sts get-caller-identity

# 3. Verify SSM access (lightweight check)
aws ssm describe-parameters --max-results 1
```

If any check fails, provide the user with:
- AWS CLI install link: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- `aws configure` instructions
- Required permissions: `ssm:PutParameter`, `secretsmanager:CreateSecret`

### Creation Flow

For each parameter:
1. Run the `put-parameter` or `create-secret` command
2. If the parameter already exists, ask: "Parameter `<name>` already exists. Overwrite with new value?"
   - If yes, add `--overwrite` flag
   - If no, skip
3. Report success/failure for each

### Verification

After creation, read back one parameter to confirm:
```bash
aws ssm get-parameter --name "/app/myservice/s3/bucketname" --query "Parameter.Value" --output text
```
