# IaC Generation Guide

How to generate Infrastructure-as-Code for provisioning SSM parameters, Secrets Manager secrets, and the IAM policy the application needs.

## Output Location

```
<project-root>/infra/
```

- CloudFormation: `<project-root>/infra/parameters.yaml`
- CDK: `<project-root>/infra/ParameterStore.Cdk/` (standard CDK project structure)

---

## CloudFormation Template (YAML)

### Structure

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: SSM Parameters, Secrets, and IAM policy for <ServiceName>

Parameters:
  AppName:
    Type: String
    Default: <service-name>
  EnvironmentName:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]

Resources:
  # --- SSM Parameters ---
  # --- Secrets Manager Secrets ---
  # --- IAM Policy ---

Outputs:
  ParameterPathPrefix:
    Value: !Sub "/app/${AppName}"
  ConfigReadPolicyArn:
    Value: !Ref AppConfigReadPolicy
```

### SSM Parameter Resources

One `AWS::SSM::Parameter` per non-sensitive value:

```yaml
  S3BucketNameParameter:
    Type: AWS::SSM::Parameter
    Properties:
      Name: !Sub "/app/${AppName}/s3/bucketname"
      Type: String
      Value: "<<REPLACE-WITH-ACTUAL-VALUE>>"
      Description: S3 bucket name for file uploads
      Tags:
        Application: !Ref AppName
        Environment: !Ref EnvironmentName
```

For SecureString (if user chose this for credentials):

```yaml
  DbConnectionStringParameter:
    Type: AWS::SSM::Parameter
    Properties:
      Name: !Sub "/app/${AppName}/db/connectionstring"
      Type: String  # Note: CloudFormation doesn't support creating SecureString directly
      Value: "<<REPLACE-WITH-ACTUAL-VALUE>>"
      Description: Database connection string
```

> **Important**: CloudFormation `AWS::SSM::Parameter` does not support `Type: SecureString` for creation. If the user chose SecureString, add a comment noting they must create it via CLI with `--type SecureString`, or use a Custom Resource. Alternatively, use Secrets Manager (which CloudFormation supports natively).

### Secrets Manager Resources

One `AWS::SecretsManager::Secret` per credential:

```yaml
  DbConnectionStringSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub "/app/${AppName}/db/connectionstring"
      Description: Database connection string
      SecretString: "<<REPLACE-AFTER-DEPLOY>>"
      Tags:
        - Key: Application
          Value: !Ref AppName
        - Key: Environment
          Value: !Ref EnvironmentName
```

For generated passwords (e.g., new database setup):

```yaml
  DbPasswordSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub "/app/${AppName}/db/password"
      Description: Database password
      GenerateSecretString:
        PasswordLength: 32
        ExcludeCharacters: '"@/\'
```

### IAM Policy Resource

A managed policy granting the application read access:

```yaml
  AppConfigReadPolicy:
    Type: AWS::IAM::ManagedPolicy
    Properties:
      ManagedPolicyName: !Sub "${AppName}-${EnvironmentName}-config-read"
      Description: !Sub "Allows ${AppName} to read its configuration from Parameter Store and Secrets Manager"
      PolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Sid: ReadParameters
            Effect: Allow
            Action:
              - ssm:GetParameter
              - ssm:GetParameters
              - ssm:GetParametersByPath
            Resource:
              - !Sub "arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/app/${AppName}/*"
          - Sid: ReadSecrets
            Effect: Allow
            Action:
              - secretsmanager:GetSecretValue
            Resource:
              - !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:/app/${AppName}/*"
          - Sid: DecryptWithKMS
            Effect: Allow
            Action:
              - kms:Decrypt
            Resource: "*"
            Condition:
              StringEquals:
                kms:ViaService:
                  - !Sub "ssm.${AWS::Region}.amazonaws.com"
                  - !Sub "secretsmanager.${AWS::Region}.amazonaws.com"
```

Omit the `ReadSecrets` statement if not using Secrets Manager. Omit `DecryptWithKMS` if only using plain String parameters.

### Outputs

```yaml
Outputs:
  ParameterPathPrefix:
    Description: Base path for all application parameters
    Value: !Sub "/app/${AppName}"
    Export:
      Name: !Sub "${AppName}-${EnvironmentName}-param-prefix"

  ConfigReadPolicyArn:
    Description: ARN of the IAM policy — attach to the application's task role
    Value: !Ref AppConfigReadPolicy
    Export:
      Name: !Sub "${AppName}-${EnvironmentName}-config-policy-arn"
```

---

## CDK Template (C#)

### Project Structure

```
<project-root>/infra/ParameterStore.Cdk/
├── src/
│   ├── Program.cs
│   ├── ParameterStoreCdkStack.cs
│   └── ParameterStoreCdk.csproj
└── cdk.json
```

### cdk.json

```json
{
  "app": "dotnet run --project src/ParameterStoreCdk.csproj"
}
```

### .csproj

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Amazon.CDK.Lib" Version="2.*" />
    <PackageReference Include="Constructs" Version="10.*" />
  </ItemGroup>
</Project>
```

### Program.cs

```csharp
using Amazon.CDK;

var app = new App();
new ParameterStoreCdkStack(app, "ParameterStoreCdkStack", new StackProps
{
    Env = new Amazon.CDK.Environment
    {
        Region = "<region>"
    }
});
app.Synth();
```

### Stack Implementation

```csharp
using Amazon.CDK;
using Amazon.CDK.AWS.SSM;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.IAM;
using Constructs;

public class ParameterStoreCdkStack : Stack
{
    public ParameterStoreCdkStack(Construct scope, string id, IStackProps props = null)
        : base(scope, id, props)
    {
        var appName = new CfnParameter(this, "AppName", new CfnParameterProps
        {
            Default = "<service-name>"
        });

        var envName = new CfnParameter(this, "EnvironmentName", new CfnParameterProps
        {
            Default = "dev",
            AllowedValues = new[] { "dev", "staging", "prod" }
        });

        // --- SSM Parameters ---
        new StringParameter(this, "S3BucketName", new StringParameterProps
        {
            ParameterName = $"/app/{appName.ValueAsString}/s3/bucketname",
            StringValue = "<<REPLACE>>",
            Description = "S3 bucket name",
            Tier = ParameterTier.STANDARD
        });

        // --- Secrets Manager ---
        new Secret(this, "DbConnectionString", new SecretProps
        {
            SecretName = $"/app/{appName.ValueAsString}/db/connectionstring",
            Description = "Database connection string",
            SecretStringValue = SecretValue.UnsafePlainText("<<REPLACE-AFTER-DEPLOY>>")
        });

        // --- IAM Policy ---
        new ManagedPolicy(this, "AppConfigReadPolicy", new ManagedPolicyProps
        {
            ManagedPolicyName = $"{appName.ValueAsString}-{envName.ValueAsString}-config-read",
            Statements = new[]
            {
                new PolicyStatement(new PolicyStatementProps
                {
                    Sid = "ReadParameters",
                    Actions = new[] { "ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath" },
                    Resources = new[] { $"arn:aws:ssm:{Of(this).Region}:{Of(this).Account}:parameter/app/{appName.ValueAsString}/*" }
                }),
                new PolicyStatement(new PolicyStatementProps
                {
                    Sid = "ReadSecrets",
                    Actions = new[] { "secretsmanager:GetSecretValue" },
                    Resources = new[] { $"arn:aws:secretsmanager:{Of(this).Region}:{Of(this).Account}:secret:/app/{appName.ValueAsString}/*" }
                }),
                new PolicyStatement(new PolicyStatementProps
                {
                    Sid = "DecryptWithKMS",
                    Actions = new[] { "kms:Decrypt" },
                    Resources = new[] { "*" },
                    Conditions = new Dictionary<string, object>
                    {
                        ["StringEquals"] = new Dictionary<string, string[]>
                        {
                            ["kms:ViaService"] = new[]
                            {
                                $"ssm.{Of(this).Region}.amazonaws.com",
                                $"secretsmanager.{Of(this).Region}.amazonaws.com"
                            }
                        }
                    }
                })
            }
        });
    }
}
```

---

## Guidelines

- Generate one resource per parameter/secret identified in Phase 0.
- Use `<<REPLACE-WITH-ACTUAL-VALUE>>` or `<<REPLACE-AFTER-DEPLOY>>` as placeholder values — never put real secrets in IaC templates.
- Always include the IAM policy in the template — it's the most commonly forgotten piece.
- Scope IAM permissions to the app's specific prefix (`/app/<service-name>/*`).
- Include `Description` and tags on every resource.
- Add comments in the template explaining each section.
- If the app already has an existing task role (e.g., from a separate ECS stack), note in the template comments that the policy should be attached to that role.

## Asking the User

Prompt:

> "Would you like me to generate Infrastructure-as-Code to provision these parameters, secrets, and the IAM read policy? Options:
> 1. **CloudFormation** (YAML template)
> 2. **CDK** (C# project)
> 3. **Enhance my existing IaC** (add permissions to current stack)
> 4. **No thanks** — I'll use the CLI commands from the guide"

If user says no, skip IaC generation entirely. The summary guide already has the CLI commands and IAM policy JSON.

---

## Enhancing Existing IaC

When the project already has a CloudFormation template or CDK stack (e.g., an ECS Fargate deployment), prefer **enhancing the existing template** over creating a standalone `parameters.yaml`. This is the most common real-world scenario.

### What to add to an existing ECS CloudFormation template:

1. **IAM policies on the Task Role** — Add inline policies for SSM and Secrets Manager to the existing `ECSTaskRole` resource:

```yaml
  ECSTaskRole:
    Type: AWS::IAM::Role
    Properties:
      # ... existing properties ...
      Policies:
        # ... existing policies ...
        - PolicyName: SSMParameterStoreRead
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Sid: ReadSSMParameters
                Effect: Allow
                Action:
                  - ssm:GetParameter
                  - ssm:GetParameters
                  - ssm:GetParametersByPath
                Resource: !Sub arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/app/<service-name>/*
        - PolicyName: SecretsManagerRead
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Sid: ReadSecrets
                Effect: Allow
                Action:
                  - secretsmanager:GetSecretValue
                Resource: !Sub arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:/app/<service-name>/*
              - Sid: DecryptWithKMS
                Effect: Allow
                Action:
                  - kms:Decrypt
                Resource: '*'
                Condition:
                  StringEquals:
                    kms:ViaService:
                      - !Sub ssm.${AWS::Region}.amazonaws.com
                      - !Sub secretsmanager.${AWS::Region}.amazonaws.com
```

2. **AWS_REGION environment variable** on the container definition — Required for the helper class to resolve the region:

```yaml
          Environment:
            # ... existing env vars ...
            - Name: AWS_REGION
              Value: !Ref AWS::Region
```

> **Note:** ECS Fargate does NOT automatically set `AWS_REGION` in the container environment (unlike Lambda or EC2 with instance metadata). You **must** explicitly pass it.

3. **Deploy the stack update first, then push the new image** — The IAM permissions must be in place before the new application code tries to call Secrets Manager, otherwise tasks will crash with `AccessDeniedException`.

### Deployment order for existing stacks:

1. Update the CloudFormation stack (adds IAM permissions + `AWS_REGION` env var)
2. Wait for stack update to complete
3. Build and push the new Docker image (with the AWSConfig helper)
4. Force a new ECS deployment (`aws ecs update-service --force-new-deployment`)
5. Wait for service stability
6. Verify health check passes
