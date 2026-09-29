# IaC Update — CloudFormation

This reference defines the changes needed to an existing CloudFormation ECS Fargate template to add the ADOT sidecar container.

## Overview of Changes

1. Increase task CPU/memory to accommodate the sidecar
2. Add ADOT sidecar container definition to the task definition
3. Add container dependency (app depends on ADOT starting first)
4. Add IAM permissions for X-Ray and CloudWatch to the task role
5. Add a CloudWatch log group for ADOT collector logs

## Task Definition Changes

### Increase Resources

The sidecar needs approximately 128 CPU units and 256 MiB memory. Increase the task-level resources:

```yaml
# Before (typical dev sizing):
# Cpu: '256'
# Memory: '512'

# After (with ADOT sidecar):
TaskDefinition:
  Type: AWS::ECS::TaskDefinition
  Properties:
    Cpu: '512'
    Memory: '1024'
    # ... rest unchanged
```

### Add ADOT Sidecar Container

Add a second container definition to the `ContainerDefinitions` array:

```yaml
ContainerDefinitions:
  # --- Existing application container ---
  - Name: <app-name>
    Image: !Ref ContainerImage
    Essential: true
    DependsOn:
      - ContainerName: adot-collector
        Condition: START
    PortMappings:
      - ContainerPort: !Ref ContainerPort
        Protocol: tcp
    Environment:
      - Name: ASPNETCORE_ENVIRONMENT
        Value: Production
      - Name: ASPNETCORE_URLS
        Value: !Sub http://+:${ContainerPort}
      - Name: OTEL_EXPORTER_OTLP_ENDPOINT
        Value: http://localhost:4317
      - Name: SERVICE_NAME
        Value: <app-name>
    LogConfiguration:
      LogDriver: awslogs
      Options:
        awslogs-group: !Ref AppLogGroup
        awslogs-region: !Ref AWS::Region
        awslogs-stream-prefix: api

  # --- ADOT Sidecar Container ---
  - Name: adot-collector
    Image: !Ref AdotImage
    Essential: true
    Cpu: 128
    Memory: 256
    Command:
      - '--config=/etc/ecs/otel-config.yaml'
    Environment:
      - Name: AWS_REGION
        Value: !Ref AWS::Region
    LogConfiguration:
      LogDriver: awslogs
      Options:
        awslogs-group: !Ref AdotLogGroup
        awslogs-region: !Ref AWS::Region
        awslogs-stream-prefix: adot
```

### New Parameters

Add a parameter for the ADOT collector image:

```yaml
Parameters:
  # ... existing parameters ...

  AdotImage:
    Type: String
    Description: ADOT collector container image URI
    Default: ''
```

### Container Dependency

The application container must wait for the ADOT collector to start before sending telemetry:

```yaml
# On the application container:
DependsOn:
  - ContainerName: adot-collector
    Condition: START
```

This ensures the OTLP receiver is ready before the app attempts to export telemetry.

## IAM Changes

### Task Role Permissions

Add X-Ray and CloudWatch permissions to the ECS Task Role:

```yaml
ECSTaskRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: ecs-tasks.amazonaws.com
          Action: sts:AssumeRole
    Policies:
      - PolicyName: OTelCollectorPolicy
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            # X-Ray permissions
            - Effect: Allow
              Action:
                - xray:PutTraceSegments
                - xray:PutTelemetryRecords
                - xray:GetSamplingRules
                - xray:GetSamplingTargets
              Resource: '*'
            # CloudWatch Logs permissions (for EMF metrics)
            - Effect: Allow
              Action:
                - logs:CreateLogGroup
                - logs:CreateLogStream
                - logs:PutLogEvents
                - logs:DescribeLogGroups
                - logs:DescribeLogStreams
              Resource: !Sub arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/ecs/${EnvironmentName}-*
            # CloudWatch Metrics permissions
            - Effect: Allow
              Action:
                - cloudwatch:PutMetricData
              Resource: '*'
```

If the task role already has a `Policies` section, merge the statements into it rather than creating a separate role.

## CloudWatch Log Groups

Add a log group for the ADOT collector (separate from the app log group):

```yaml
AdotLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub /ecs/${EnvironmentName}-<app-name>/adot
    RetentionInDays: 14
```

The EMF metrics exporter also creates its own log group (configured in `otel-config.yaml`), but the task role permissions must allow creating it.

## ECR Repository for ADOT

If using a custom ADOT image (with custom config baked in), add an ECR repository or reuse an existing one:

```yaml
AdotECRRepository:
  Type: AWS::ECR::Repository
  Properties:
    RepositoryName: !Sub ${EnvironmentName}-<app-name>-adot
    ImageScanningConfiguration:
      ScanOnPush: true
    LifecyclePolicy:
      LifecyclePolicyText: |
        {
          "rules": [{
            "rulePriority": 1,
            "description": "Keep last 5 images",
            "selection": {
              "tagStatus": "any",
              "countType": "imageCountMoreThan",
              "countNumber": 5
            },
            "action": { "type": "expire" }
          }]
        }
```

## Outputs

Add the ADOT ECR URI to outputs:

```yaml
Outputs:
  # ... existing outputs ...

  AdotECRRepositoryUri:
    Value: !GetAtt AdotECRRepository.RepositoryUri
    Description: ECR repository URI for the ADOT collector image
```

## Deployment Steps

After updating the template:

1. Build and push the ADOT collector image:
   ```bash
   docker build -t <app-name>-adot -f src/Otel/Dockerfile src/Otel/
   docker tag <app-name>-adot:latest <adot-ecr-uri>:latest
   docker push <adot-ecr-uri>:latest
   ```

2. Rebuild and push the application image (now with OTel instrumentation):
   ```bash
   docker build -t <app-name> -f src/<AppProject>/Dockerfile src/<AppProject>/
   docker tag <app-name>:latest <app-ecr-uri>:latest
   docker push <app-ecr-uri>:latest
   ```

3. Update the stack with the new image URIs:
   ```bash
   aws cloudformation update-stack \
     --stack-name <env>-<app-name> \
     --template-body file://infra/ecs-fargate.yaml \
     --parameters \
       ParameterKey=ContainerImage,ParameterValue=<app-ecr-uri>:latest \
       ParameterKey=AdotImage,ParameterValue=<adot-ecr-uri>:latest \
     --capabilities CAPABILITY_IAM \
     --region <region>
   ```

4. Force a new deployment if images were re-pushed with the same tag:
   ```bash
   aws ecs update-service \
     --cluster <env>-cluster \
     --service <env>-<app-name>-service \
     --force-new-deployment \
     --region <region>
   ```

## Verification

After deployment, verify telemetry is flowing:

- **X-Ray traces**: Open the AWS X-Ray console → Traces → filter by service name
- **CloudWatch metrics**: Open CloudWatch → Metrics → look for the `ECS/AWSOTel/<app-name>` namespace
- **ADOT collector logs**: Check the `/ecs/<env>-<app-name>/adot` log group for collector startup and export confirmation
