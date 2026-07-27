# IaC Update — CDK (C#)

This reference defines the changes needed to an existing CDK ECS Fargate stack to add the ADOT sidecar container.

## Overview of Changes

1. Increase task CPU/memory to accommodate the sidecar
2. Build and add the ADOT sidecar container to the task definition
3. Set container dependency (app depends on ADOT starting first)
4. Add IAM permissions for X-Ray and CloudWatch to the task role
5. Add a CloudWatch log group for ADOT collector logs

## Task Definition Changes

### Increase Resources

Update the `FargateTaskDefinition` to accommodate the sidecar:

```csharp
// Before (typical dev sizing):
// Cpu = 256, MemoryLimitMiB = 512

// After (with ADOT sidecar):
var taskDef = new FargateTaskDefinition(this, "AppTaskDef", new FargateTaskDefinitionProps
{
    Cpu = 512,
    MemoryMiB = 1024,
    RuntimePlatform = new RuntimePlatform
    {
        CpuArchitecture = CpuArchitecture.X86_64,
        OperatingSystemFamily = OperatingSystemFamily.LINUX
    }
});
```

### Add ADOT Log Group

```csharp
var adotLogGroup = new LogGroup(this, "AdotLogGroup", new LogGroupProps
{
    LogGroupName = $"/ecs/{envName}-<app-name>/adot",
    Retention = RetentionDays.TWO_WEEKS,
    RemovalPolicy = RemovalPolicy.DESTROY
});
```

### Build ADOT Container Image

Use `DockerImageAsset` to build the ADOT collector image from the `src/Otel` directory:

```csharp
var adotImageAsset = new DockerImageAsset(this, "AdotEcrAsset", new DockerImageAssetProps
{
    Directory = Path.GetFullPath("<path-to-project>/src/Otel"),
    Platform = Platform_.LINUX_AMD64  // or LINUX_ARM64 based on task platform
});
```

### Add ADOT Sidecar Container

```csharp
var adotContainer = taskDef.AddContainer("AdotCollectorContainer", new ContainerDefinitionOptions
{
    Image = ContainerImage.FromDockerImageAsset(adotImageAsset),
    MemoryLimitMiB = 256,
    Cpu = 128,
    Essential = true,
    Command = new[] { "--config=/etc/ecs/otel-config.yaml" },
    Environment = new Dictionary<string, string>
    {
        ["AWS_REGION"] = this.Region
    },
    Logging = new AwsLogDriver(new AwsLogDriverProps
    {
        LogGroup = adotLogGroup,
        StreamPrefix = "adot"
    })
});
```

### Update Application Container

Add the OTLP endpoint environment variable and container dependency to the existing application container:

```csharp
var appContainer = taskDef.AddContainer("AppContainer", new ContainerDefinitionOptions
{
    Image = ContainerImage.FromDockerImageAsset(appImageAsset),
    MemoryLimitMiB = 1024,
    Essential = true,
    Environment = new Dictionary<string, string>
    {
        ["ASPNETCORE_URLS"] = $"http://+:{containerPort}",
        ["ASPNETCORE_ENVIRONMENT"] = "Production",
        ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://localhost:4317",
        ["SERVICE_NAME"] = "<app-name>"
    },
    Logging = new AwsLogDriver(new AwsLogDriverProps
    {
        LogGroup = appLogGroup,
        StreamPrefix = "api"
    }),
    PortMappings = new[] { new PortMapping { ContainerPort = containerPort } }
});

// App container depends on ADOT collector starting first
appContainer.AddContainerDependencies(new ContainerDependency
{
    Container = adotContainer,
    Condition = ContainerDependencyCondition.START
});
```

## IAM Changes

### Task Role Permissions

Add X-Ray and CloudWatch permissions to the task role. If the task role is created by CDK:

```csharp
// Add X-Ray permissions
taskDef.TaskRole.AddToPrincipalPolicy(new PolicyStatement(new PolicyStatementProps
{
    Actions = new[]
    {
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords",
        "xray:GetSamplingRules",
        "xray:GetSamplingTargets"
    },
    Resources = new[] { "*" }
}));

// Add CloudWatch Logs permissions (for EMF metrics exporter)
taskDef.TaskRole.AddToPrincipalPolicy(new PolicyStatement(new PolicyStatementProps
{
    Actions = new[]
    {
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
    },
    Resources = new[] { $"arn:aws:logs:{this.Region}:{this.Account}:log-group:/aws/ecs/*" }
}));

// Add CloudWatch Metrics permissions
taskDef.TaskRole.AddToPrincipalPolicy(new PolicyStatement(new PolicyStatementProps
{
    Actions = new[] { "cloudwatch:PutMetricData" },
    Resources = new[] { "*" }
}));
```

If the task role is an existing IAM role (looked up via `Role.FromRoleName`), the permissions must be added to that role directly — either through a separate CDK construct or manually in the AWS console/CLI.

## Using Existing IAM Role

When the CDK stack references an existing role (as in the reference implementation):

```csharp
// If using an existing role, you cannot add inline policies via CDK.
// Instead, create a managed policy and attach it:
var otelPolicy = new ManagedPolicy(this, "OtelPolicy", new ManagedPolicyProps
{
    ManagedPolicyName = $"{envName}-otel-policy",
    Statements = new[]
    {
        new PolicyStatement(new PolicyStatementProps
        {
            Actions = new[]
            {
                "xray:PutTraceSegments",
                "xray:PutTelemetryRecords",
                "xray:GetSamplingRules",
                "xray:GetSamplingTargets",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "cloudwatch:PutMetricData"
            },
            Resources = new[] { "*" }
        })
    }
});

// Note: Attaching to an imported role requires the role to exist
// The developer may need to manually attach this policy
```

## Complete Example (relevant section)

Here's how the ADOT sidecar fits into a typical CDK stack:

```csharp
// ============================================
// ADOT SIDECAR
// ============================================

// Build ADOT collector image
var adotImageAsset = new DockerImageAsset(this, "AdotEcrAsset", new DockerImageAssetProps
{
    Directory = Path.GetFullPath("../src/Otel"),
    Platform = Platform_.LINUX_AMD64
});

// ADOT log group
var adotLogGroup = new LogGroup(this, "AdotLogGroup", new LogGroupProps
{
    LogGroupName = $"/ecs/{envName}-<app-name>/adot",
    Retention = RetentionDays.TWO_WEEKS,
    RemovalPolicy = RemovalPolicy.DESTROY
});

// Add ADOT collector container
var adotContainer = taskDef.AddContainer("AdotCollectorContainer", new ContainerDefinitionOptions
{
    Image = ContainerImage.FromDockerImageAsset(adotImageAsset),
    MemoryLimitMiB = 256,
    Cpu = 128,
    Essential = true,
    Command = new[] { "--config=/etc/ecs/otel-config.yaml" },
    Environment = new Dictionary<string, string>
    {
        ["AWS_REGION"] = this.Region
    },
    Logging = new AwsLogDriver(new AwsLogDriverProps
    {
        LogGroup = adotLogGroup,
        StreamPrefix = "adot"
    })
});

// Application container depends on ADOT collector
appContainer.AddContainerDependencies(new ContainerDependency
{
    Container = adotContainer,
    Condition = ContainerDependencyCondition.START
});
```

## Deployment Steps

After updating the CDK stack:

1. Deploy the updated stack (CDK builds and pushes both images automatically):
   ```bash
   cd infra/<CdkProject>
   cdk deploy
   ```

2. If using separate image builds (not `DockerImageAsset`), build and push both images first, then force a new deployment:
   ```bash
   aws ecs update-service \
     --cluster <env>-cluster \
     --service <env>-<app-name>-service \
     --force-new-deployment \
     --region <region>
   ```

## Verification

After deployment:
- **X-Ray**: AWS Console → X-Ray → Traces → filter by service name
- **CloudWatch Metrics**: CloudWatch → Metrics → namespace `ECS/AWSOTel/<app-name>`
- **ADOT Logs**: CloudWatch → Log Groups → `/ecs/<env>-<app-name>/adot`
- **ECS Task**: Confirm both containers are running in the ECS console → Task tab
