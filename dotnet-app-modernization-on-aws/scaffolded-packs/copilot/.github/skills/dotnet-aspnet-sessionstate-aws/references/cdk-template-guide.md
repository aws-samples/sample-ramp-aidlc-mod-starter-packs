# CDK Template Guide (C#)

CDK project structure for provisioning ElastiCache Serverless for ASP.NET session state.

## Project Structure

```
<project-root>/infra/ElastiCacheSession.Cdk/
├── src/
│   ├── Program.cs
│   ├── ElastiCacheSessionStack.cs
│   └── ElastiCacheSession.csproj
└── cdk.json
```

## cdk.json

```json
{
  "app": "dotnet run --project src/ElastiCacheSession.csproj"
}
```

## .csproj

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

## Program.cs

```csharp
using Amazon.CDK;

var app = new App();
new ElastiCacheSessionStack(app, "ElastiCacheSessionStack", new StackProps
{
    Env = new Amazon.CDK.Environment
    {
        Region = "<region>"
    }
});
app.Synth();
```

## Stack Implementation — New VPC

```csharp
using Amazon.CDK;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.ElastiCache;
using Constructs;

public class ElastiCacheSessionStack : Stack
{
    public ElastiCacheSessionStack(Construct scope, string id, IStackProps props = null)
        : base(scope, id, props)
    {
        var envName = new CfnParameter(this, "EnvironmentName", new CfnParameterProps
        {
            Default = "dev"
        });

        var engine = new CfnParameter(this, "Engine", new CfnParameterProps
        {
            Default = "valkey",
            AllowedValues = new[] { "valkey", "redis" },
            Description = "Cache engine (Valkey recommended)"
        });

        // ============================================
        // NETWORKING
        // ============================================

        var vpc = new Vpc(this, "CacheVpc", new VpcProps
        {
            MaxAzs = 2,
            NatGateways = 0,  // ElastiCache doesn't need internet access
            SubnetConfiguration = new[]
            {
                new SubnetConfiguration
                {
                    Name = "Private",
                    SubnetType = SubnetType.PRIVATE_ISOLATED,
                    CidrMask = 24
                }
            }
        });

        // ============================================
        // SECURITY GROUP
        // ============================================

        var cacheSg = new SecurityGroup(this, "CacheSg", new SecurityGroupProps
        {
            Vpc = vpc,
            AllowAllOutbound = false,
            Description = "Allow inbound from application to ElastiCache"
        });

        // Allow inbound from VPC CIDR on port 6379
        // Replace with specific app security group after deployment
        cacheSg.AddIngressRule(
            Peer.Ipv4(vpc.VpcCidrBlock),
            Port.Tcp(6379),
            "Allow Redis/Valkey from VPC");

        // ============================================
        // ELASTICACHE SERVERLESS
        // ============================================

        var cache = new CfnServerlessCache(this, "SessionCache", new CfnServerlessCacheProps
        {
            ServerlessCacheName = $"{envName.ValueAsString}-session-cache",
            Engine = engine.ValueAsString,
            Description = $"{envName.ValueAsString} session state cache",
            MajorEngineVersion = "7",
            SecurityGroupIds = new[] { cacheSg.SecurityGroupId },
            SubnetIds = vpc.SelectSubnets(new SubnetSelection
            {
                SubnetType = SubnetType.PRIVATE_ISOLATED
            }).SubnetIds,
            CacheUsageLimits = new CfnServerlessCache.CacheUsageLimitsProperty
            {
                DataStorage = new CfnServerlessCache.DataStorageProperty
                {
                    Maximum = 1,
                    Unit = "GB"
                },
                EcpuPerSecond = new CfnServerlessCache.ECPUPerSecondProperty
                {
                    Maximum = 1000
                }
            },
            Tags = new[]
            {
                new CfnTag { Key = "Environment", Value = envName.ValueAsString }
            }
        });

        // ============================================
        // OUTPUTS
        // ============================================

        new CfnOutput(this, "ElastiCacheEndpoint", new CfnOutputProps
        {
            Value = cache.AttrEndpointAddress,
            Description = "ElastiCache Serverless endpoint"
        });

        new CfnOutput(this, "ElastiCachePort", new CfnOutputProps
        {
            Value = cache.AttrEndpointPort,
            Description = "ElastiCache port"
        });

        new CfnOutput(this, "ConnectionString", new CfnOutputProps
        {
            Value = $"{cache.AttrEndpointAddress}:{cache.AttrEndpointPort},ssl=true,abortConnect=false",
            Description = "Connection string for appsettings.json"
        });

        new CfnOutput(this, "SecurityGroupId", new CfnOutputProps
        {
            Value = cacheSg.SecurityGroupId,
            Description = "ElastiCache security group ID"
        });
    }
}
```

## Stack Implementation — Existing VPC

When the user provides an existing VPC, use `Vpc.FromLookup` or `Vpc.FromVpcAttributes`:

```csharp
using Amazon.CDK;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.ElastiCache;
using Constructs;

public class ElastiCacheSessionStack : Stack
{
    public ElastiCacheSessionStack(Construct scope, string id, IStackProps props = null)
        : base(scope, id, props)
    {
        var envName = new CfnParameter(this, "EnvironmentName", new CfnParameterProps
        {
            Default = "dev"
        });

        var engine = new CfnParameter(this, "Engine", new CfnParameterProps
        {
            Default = "valkey",
            AllowedValues = new[] { "valkey", "redis" },
            Description = "Cache engine (Valkey recommended)"
        });

        // ============================================
        // NETWORKING — Existing VPC
        // ============================================

        // Option A: Lookup by VPC ID (resolves at synth time)
        var vpc = Vpc.FromLookup(this, "ExistingVpc", new VpcLookupOptions
        {
            VpcId = "<vpc-id>"  // Replace with actual VPC ID
        });

        // Option B: Explicit attributes (when subnet tagging is non-standard)
        // var vpc = Vpc.FromVpcAttributes(this, "ExistingVpc", new VpcAttributes
        // {
        //     VpcId = "<vpc-id>",
        //     AvailabilityZones = new[] { "<az-1>", "<az-2>" },
        //     PrivateSubnetIds = new[] { "<subnet-1>", "<subnet-2>" }
        // });

        // ============================================
        // SECURITY GROUP
        // ============================================

        var cacheSg = new SecurityGroup(this, "CacheSg", new SecurityGroupProps
        {
            Vpc = vpc,
            AllowAllOutbound = false,
            Description = "Allow inbound from application to ElastiCache"
        });

        // If app security group ID is known, use it directly:
        // var appSg = SecurityGroup.FromSecurityGroupId(this, "AppSg", "<app-sg-id>");
        // cacheSg.AddIngressRule(appSg, Port.Tcp(6379), "From application");

        // Otherwise, allow from VPC CIDR and refine later
        cacheSg.AddIngressRule(
            Peer.Ipv4(vpc.VpcCidrBlock),
            Port.Tcp(6379),
            "Allow Redis/Valkey from VPC");

        // ============================================
        // ELASTICACHE SERVERLESS
        // ============================================

        var privateSubnets = vpc.SelectSubnets(new SubnetSelection
        {
            SubnetType = SubnetType.PRIVATE_WITH_EGRESS
        });

        var cache = new CfnServerlessCache(this, "SessionCache", new CfnServerlessCacheProps
        {
            ServerlessCacheName = $"{envName.ValueAsString}-session-cache",
            Engine = engine.ValueAsString,
            Description = $"{envName.ValueAsString} session state cache",
            MajorEngineVersion = "7",
            SecurityGroupIds = new[] { cacheSg.SecurityGroupId },
            SubnetIds = privateSubnets.SubnetIds,
            CacheUsageLimits = new CfnServerlessCache.CacheUsageLimitsProperty
            {
                DataStorage = new CfnServerlessCache.DataStorageProperty
                {
                    Maximum = 1,
                    Unit = "GB"
                },
                EcpuPerSecond = new CfnServerlessCache.ECPUPerSecondProperty
                {
                    Maximum = 1000
                }
            },
            Tags = new[]
            {
                new CfnTag { Key = "Environment", Value = envName.ValueAsString }
            }
        });

        // ============================================
        // OUTPUTS
        // ============================================

        new CfnOutput(this, "ElastiCacheEndpoint", new CfnOutputProps
        {
            Value = cache.AttrEndpointAddress,
            Description = "ElastiCache Serverless endpoint"
        });

        new CfnOutput(this, "ElastiCachePort", new CfnOutputProps
        {
            Value = cache.AttrEndpointPort,
            Description = "ElastiCache port"
        });

        new CfnOutput(this, "ConnectionString", new CfnOutputProps
        {
            Value = $"{cache.AttrEndpointAddress}:{cache.AttrEndpointPort},ssl=true,abortConnect=false",
            Description = "Connection string for appsettings.json"
        });

        new CfnOutput(this, "SecurityGroupId", new CfnOutputProps
        {
            Value = cacheSg.SecurityGroupId,
            Description = "ElastiCache security group ID"
        });
    }
}
```

## Key Differences from CloudFormation

- CDK's `Vpc` construct handles subnet creation automatically (new VPC mode)
- `Vpc.FromLookup` resolves at synth time — actual VPC ID must be hardcoded
- ElastiCache Serverless uses `CfnServerlessCache` (L1 construct) since there's no L2 construct yet
- Security group rules are method calls on the SG object

## Notes

- Replace `<region>` with the target region
- Replace `<vpc-id>`, `<az-*>`, `<subnet-*>` with actual values from the user
- Default to Serverless. Only use replication groups if the user explicitly requests cluster mode.
- `CfnServerlessCache` is an L1 (CloudFormation-level) construct. Property names match CloudFormation exactly.
- Add comments noting production capacity considerations.
