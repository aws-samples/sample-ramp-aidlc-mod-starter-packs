# CloudFormation Template Guide

Structure for the CloudFormation template that provisions an ElastiCache Serverless cache for ASP.NET session state.

## Template Skeleton

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'ElastiCache Serverless for ASP.NET session state'

Parameters:
  EnvironmentName:
    Type: String
    Default: dev
    Description: Environment name prefix for resources

  Engine:
    Type: String
    Default: valkey
    AllowedValues:
      - valkey
      - redis
    Description: Cache engine (Valkey recommended — Redis-compatible, no license concerns)

  AppSecurityGroupId:
    Type: AWS::EC2::SecurityGroup::Id
    Description: Security group of the application (ECS tasks, EC2 instances) that will connect to ElastiCache
    Default: ''

Resources:
  # ============================================
  # NETWORKING (new VPC mode only)
  # ============================================
  # ...

  # ============================================
  # SECURITY GROUPS
  # ============================================
  # ...

  # ============================================
  # ELASTICACHE
  # ============================================
  # ...

Outputs:
  # ...
```

## New VPC Mode

When creating a new VPC for ElastiCache, only private subnets are needed (no public subnets, no NAT, no IGW — ElastiCache is accessed from within the VPC only).

### VPC and Subnets

```yaml
VPC:
  Type: AWS::EC2::VPC
  Properties:
    CidrBlock: 10.0.0.0/16
    EnableDnsHostnames: true
    EnableDnsSupport: true
    Tags:
      - Key: Name
        Value: !Sub ${EnvironmentName}-elasticache-vpc

PrivateSubnet1:
  Type: AWS::EC2::Subnet
  Properties:
    VpcId: !Ref VPC
    AvailabilityZone: !Select [0, !GetAZs '']
    CidrBlock: 10.0.1.0/24
    Tags:
      - Key: Name
        Value: !Sub ${EnvironmentName}-elasticache-private-1

PrivateSubnet2:
  Type: AWS::EC2::Subnet
  Properties:
    VpcId: !Ref VPC
    AvailabilityZone: !Select [1, !GetAZs '']
    CidrBlock: 10.0.2.0/24
    Tags:
      - Key: Name
        Value: !Sub ${EnvironmentName}-elasticache-private-2
```

**Note:** If ElastiCache and the application are in different VPCs, VPC peering or a Transit Gateway is required. In most cases, deploy ElastiCache in the same VPC as the application. The "new VPC" mode is primarily for isolated testing or when no VPC exists yet.

## Existing VPC Mode

### Additional Parameters

```yaml
Parameters:
  # ... keep existing parameters ...

  VpcId:
    Type: AWS::EC2::VPC::Id
    Description: ID of the existing VPC

  PrivateSubnet1Id:
    Type: AWS::EC2::Subnet::Id
    Description: First private subnet for ElastiCache

  PrivateSubnet2Id:
    Type: AWS::EC2::Subnet::Id
    Description: Second private subnet for ElastiCache (different AZ)
```

### What to Remove

Omit the VPC and subnet resources. Replace references:

| New VPC | Existing VPC |
|---------|-------------|
| `!Ref VPC` | `!Ref VpcId` |
| `!Ref PrivateSubnet1` | `!Ref PrivateSubnet1Id` |
| `!Ref PrivateSubnet2` | `!Ref PrivateSubnet2Id` |

## Security Group

```yaml
ElastiCacheSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Allow inbound from application to ElastiCache
    VpcId: !Ref VPC  # or !Ref VpcId for existing VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 6379
        ToPort: 6379
        SourceSecurityGroupId: !Ref AppSecurityGroupId
    Tags:
      - Key: Name
        Value: !Sub ${EnvironmentName}-elasticache-sg
```

If the `AppSecurityGroupId` parameter is empty (e.g., cluster created before the app is deployed), use a CIDR-based rule as fallback and add a comment to update it later:

```yaml
# Fallback: Allow from VPC CIDR. Replace with app security group after deployment.
SecurityGroupIngress:
  - IpProtocol: tcp
    FromPort: 6379
    ToPort: 6379
    CidrIp: 10.0.0.0/16
```

## ElastiCache Serverless

```yaml
ElastiCacheServerless:
  Type: AWS::ElastiCache::ServerlessCache
  Properties:
    ServerlessCacheName: !Sub ${EnvironmentName}-session-cache
    Engine: !Ref Engine
    Description: !Sub "${EnvironmentName} session state cache (${Engine})"
    MajorEngineVersion: "7"
    SecurityGroupIds:
      - !Ref ElastiCacheSecurityGroup
    SubnetIds:
      - !Ref PrivateSubnet1   # or !Ref PrivateSubnet1Id
      - !Ref PrivateSubnet2   # or !Ref PrivateSubnet2Id
    CacheUsageLimits:
      DataStorage:
        Maximum: 1
        Unit: GB
      ECPUPerSecond:
        Maximum: 1000
    Tags:
      - Key: Name
        Value: !Sub ${EnvironmentName}-session-cache
      - Key: Environment
        Value: !Ref EnvironmentName
```

### Engine Version

- Valkey: `MajorEngineVersion: "7"` (Valkey 7.x, compatible with Redis 7 protocol)
- Redis: `MajorEngineVersion: "7"` (Redis OSS 7.x)

### Serverless Capacity Defaults

For a dev/staging session cache:
- **DataStorage**: 1 GB maximum (sessions are typically small)
- **ECPUPerSecond**: 1000 (ElastiCache Capacity Units — sufficient for dev)

Add comments noting production sizing:

```yaml
# Dev: 1 GB / 1000 ECPU. For production consider:
#   DataStorage: 5-10 GB (depending on session payload size × concurrent users)
#   ECPUPerSecond: 5000-15000 (depending on request rate)
# ElastiCache Serverless auto-scales within these limits.
```

## Outputs

```yaml
Outputs:
  ElastiCacheEndpoint:
    Description: ElastiCache Serverless endpoint (use in connection string)
    Value: !GetAtt ElastiCacheServerless.Endpoint.Address

  ElastiCachePort:
    Description: ElastiCache port
    Value: !GetAtt ElastiCacheServerless.Endpoint.Port

  ConnectionString:
    Description: Ready-to-use connection string for appsettings.json
    Value: !Sub "${ElastiCacheServerless.Endpoint.Address}:${ElastiCacheServerless.Endpoint.Port},ssl=true,abortConnect=false"

  SecurityGroupId:
    Description: ElastiCache security group ID (add app SG ingress rule if needed)
    Value: !Ref ElastiCacheSecurityGroup

  Engine:
    Description: Cache engine
    Value: !Ref Engine
```

## Cluster Mode Alternative (Non-Serverless)

If the user prefers a traditional cluster instead of Serverless, use a replication group:

```yaml
ElastiCacheSubnetGroup:
  Type: AWS::ElastiCache::SubnetGroup
  Properties:
    Description: !Sub "${EnvironmentName} ElastiCache subnet group"
    SubnetIds:
      - !Ref PrivateSubnet1
      - !Ref PrivateSubnet2

ElastiCacheReplicationGroup:
  Type: AWS::ElastiCache::ReplicationGroup
  Properties:
    ReplicationGroupDescription: !Sub "${EnvironmentName} session cache"
    Engine: !Ref Engine
    EngineVersion: "7.1"
    CacheNodeType: cache.t4g.micro
    NumCacheClusters: 2
    AutomaticFailoverEnabled: true
    MultiAZEnabled: true
    CacheSubnetGroupName: !Ref ElastiCacheSubnetGroup
    SecurityGroupIds:
      - !Ref ElastiCacheSecurityGroup
    TransitEncryptionEnabled: true
    AtRestEncryptionEnabled: true
    Port: 6379
    Tags:
      - Key: Name
        Value: !Sub ${EnvironmentName}-session-cache
```

**Note:** Only use the cluster mode alternative if the user explicitly requests it. Default to Serverless for simplicity and auto-scaling.

## Cost Notes

### ElastiCache Serverless (default)
- Pay per GB stored + ECPU consumed
- Minimum cost is very low for dev workloads (< $5/month for light usage)
- Auto-scales — no capacity planning required

### Cluster Mode (cache.t4g.micro × 2 nodes)
- ~$18/month per node = ~$36/month for 2-node replication group
- Fixed capacity — no auto-scaling without additional configuration

Include these estimates in the deployment guide.
