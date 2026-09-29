# ADOT Sidecar Configuration Guide

This reference defines the ADOT (AWS Distro for OpenTelemetry) collector sidecar setup — the Dockerfile, `otel-config.yaml` pipeline configuration, and the ECR build/push workflow.

## Why a Custom ADOT Image Is Required

You **cannot** use the public `amazon/aws-otel-collector` image directly in the ECS task definition. There are two reasons:

1. **Custom configuration**: The ADOT collector needs a custom `otel-config.yaml` that defines your specific pipelines (receivers, processors, exporters). This config must be baked into the image at `/etc/ecs/otel-config.yaml`.
2. **Private subnet accessibility**: ECS Fargate tasks running in private subnets without NAT gateways cannot pull images from public registries. Even with NAT, relying on a public registry introduces availability risks and slower cold starts.

The workflow is:
1. Create a `Dockerfile` that uses the public ADOT image as a base and copies in your custom config
2. Build the custom image locally (or in CI/CD)
3. Push the built image to a private Amazon ECR repository
4. Reference the ECR image URI in the ECS task definition

## Directory Structure

```
<project-root>/src/Otel/
├── otel-config.yaml
└── Dockerfile
```

Place the Otel sidecar files in a dedicated directory alongside the application source (not inside `infra/`).

## Dockerfile

```dockerfile
FROM amazon/aws-otel-collector:latest

COPY otel-config.yaml /etc/ecs/otel-config.yaml
```

This is deliberately minimal — it pulls the public ADOT collector image as a base and bakes in the custom pipeline config. **The resulting image must be pushed to a private ECR repository** — do not reference the public base image directly in the ECS task definition.

### Why This Dockerfile Exists

The ADOT collector expects its config file at a known path. By building a custom image with the config embedded:
- The task definition only needs to specify `--config=/etc/ecs/otel-config.yaml` as the container command
- No volume mounts or S3 config fetching is needed
- The image is self-contained and immutable per deployment

### Notes

- `amazon/aws-otel-collector:latest` is a multi-arch image (supports both x86_64 and ARM64)
- The entrypoint is already configured in the base image
- The config file path `/etc/ecs/otel-config.yaml` is passed via the container `command` in the task definition: `--config=/etc/ecs/otel-config.yaml`
- After building, tag and push to ECR (see "ECR Build and Push Workflow" below)

## otel-config.yaml

### Full Template

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  filter/healthcheck:
    spans:
      exclude:
        match_type: strict
        attributes:
          - key: http.route
            value: "<health-check-path>"

exporters:
  awsxray:
  awsemf:
    namespace: ECS/AWSOTel/<app-name>
    log_group_name: '/aws/ecs/<app-name>/metrics'

service:
  pipelines:
    traces:
      receivers:
        - otlp
      processors:
        - filter/healthcheck
      exporters:
        - awsxray
    metrics:
      receivers:
        - otlp
      exporters:
        - awsemf
```

### Section Breakdown

#### Receivers

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
```

- Listens on port 4317 for OTLP gRPC traffic from the application container
- Bound to `0.0.0.0` (within the ECS task network namespace, only reachable from other containers in the same task)

#### Processors

```yaml
processors:
  filter/healthcheck:
    spans:
      exclude:
        match_type: strict
        attributes:
          - key: http.route
            value: "<health-check-path>"
```

- Filters out health check endpoint spans to reduce trace noise
- Replace `<health-check-path>` with the actual health check path (e.g., `/hc`, `/health`, `/healthz`)
- `match_type: strict` ensures only exact matches are filtered

**Optional additional processors:**

```yaml
processors:
  batch:
    timeout: 5s
    send_batch_size: 256
```

Add `batch` processor for production workloads to reduce API calls to X-Ray and CloudWatch.

#### Exporters

##### AWS X-Ray (traces)

```yaml
exporters:
  awsxray:
```

- Sends trace data to AWS X-Ray
- Region is auto-detected from the ECS task metadata or `AWS_REGION` environment variable
- Requires IAM permissions: `xray:PutTraceSegments`, `xray:PutTelemetryRecords`, `xray:GetSamplingRules`, `xray:GetSamplingTargets`

##### AWS CloudWatch EMF (metrics)

```yaml
exporters:
  awsemf:
    namespace: ECS/AWSOTel/<app-name>
    log_group_name: '/aws/ecs/<app-name>/metrics'
```

- Sends metrics as CloudWatch Embedded Metric Format (EMF) logs
- `namespace` — CloudWatch metrics namespace (visible in CloudWatch Metrics console)
- `log_group_name` — CloudWatch Logs group where EMF logs are written
- Requires IAM permissions: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`, `logs:DescribeLogGroups`

#### Service Pipelines

```yaml
service:
  pipelines:
    traces:
      receivers:
        - otlp
      processors:
        - filter/healthcheck
      exporters:
        - awsxray
    metrics:
      receivers:
        - otlp
      exporters:
        - awsemf
```

- **Traces pipeline**: receives OTLP → filters health checks → exports to X-Ray
- **Metrics pipeline**: receives OTLP → exports to CloudWatch EMF

### Optional: Debug Exporter

For development/debugging, add a `debug` exporter to see telemetry in the collector's stdout:

```yaml
exporters:
  debug:
    verbosity: detailed
  awsxray:
  awsemf:
    namespace: ECS/AWSOTel/<app-name>
    log_group_name: '/aws/ecs/<app-name>/metrics'

service:
  pipelines:
    traces:
      receivers:
        - otlp
      processors:
        - filter/healthcheck
      exporters:
        - debug
        - awsxray
    metrics:
      receivers:
        - otlp
      exporters:
        - debug
        - awsemf
```

Remove `debug` for production deployments to avoid excessive logging.

## Customization Points

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `<health-check-path>` | App health check route to filter from traces | `/hc`, `/health` |
| `<app-name>` | Application/service name for metrics namespace | `origination`, `my-api` |

## Port Reference

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 4317 | gRPC | Inbound (from app container) | OTLP receiver |

No external ports are exposed — communication is entirely within the ECS task network namespace.

## ECR Build and Push Workflow

After creating the Dockerfile and otel-config.yaml, you must build the custom ADOT image and push it to ECR before deploying the ECS task.

### Step 1 — Create or Identify ECR Repository

If an ECR repository for the ADOT image does not already exist, create one:

```bash
aws ecr create-repository \
  --repository-name <env>-<app-name>-adot \
  --image-scanning-configuration scanOnPush=true \
  --region <region>
```

Or define it in IaC (see the CloudFormation/CDK references for examples).

### Step 2 — Authenticate Docker to ECR

```bash
aws ecr get-login-password --region <region> | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
```

### Step 3 — Build the Custom ADOT Image

```bash
docker build -t <app-name>-adot -f src/Otel/Dockerfile src/Otel/
```

This pulls the public `amazon/aws-otel-collector:latest` base image and copies your custom `otel-config.yaml` into it.

### Step 4 — Tag and Push to ECR

```bash
docker tag <app-name>-adot:latest <account-id>.dkr.ecr.<region>.amazonaws.com/<env>-<app-name>-adot:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/<env>-<app-name>-adot:latest
```

### Step 5 — Reference the ECR URI in the Task Definition

The ECS task definition must use the private ECR URI for the ADOT container image — **not** the public `amazon/aws-otel-collector` image:

```
# Correct:
Image: <account-id>.dkr.ecr.<region>.amazonaws.com/<env>-<app-name>-adot:latest

# WRONG — do not use:
Image: amazon/aws-otel-collector:latest
```

### CDK Alternative (DockerImageAsset)

When using CDK, `DockerImageAsset` handles the build and push automatically:

```csharp
var adotImageAsset = new DockerImageAsset(this, "AdotEcrAsset", new DockerImageAssetProps
{
    Directory = Path.GetFullPath("../src/Otel"),
    Platform = Platform_.LINUX_AMD64
});

// Use in container definition:
Image = ContainerImage.FromDockerImageAsset(adotImageAsset)
```

CDK will:
1. Build the Dockerfile in `src/Otel/`
2. Push the resulting image to a CDK-managed ECR repository
3. Generate the correct image URI in the synthesized CloudFormation template

This eliminates the manual build/tag/push steps for CDK-based deployments.
