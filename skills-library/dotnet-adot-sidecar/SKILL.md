---
name: dotnet-adot-sidecar
description: Adds OpenTelemetry instrumentation to a containerized .NET application and configures AWS Distro for OpenTelemetry (ADOT) as an ECS sidecar container. Updates existing IaC to include the ADOT collector in the task definition with proper IAM permissions. NOT for non-containerized apps or apps without existing ECS infrastructure.
version: 1
allowed-tools: [Read, Write, Shell]
---

# Add ADOT Sidecar to .NET ECS Workload

## When to Use This Skill

**Use this skill when:**
- A .NET application is already containerized with a Dockerfile
- ECS Fargate IaC (CloudFormation or CDK) already exists for the application
- The developer wants distributed tracing (AWS X-Ray) and metrics (CloudWatch EMF) via OpenTelemetry
- The developer wants ADOT deployed as a sidecar container alongside the application

**Do NOT use this skill for:**
- Applications that are not yet containerized — suggest [`dotnet-aws-ecs`](https://github.com/adisimon217/sample-appmod-skills/tree/main/dotnet-aws-ecs) first
- Applications without existing ECS IaC — suggest [`dotnet-aws-ecs`](https://github.com/adisimon217/sample-appmod-skills/tree/main/dotnet-aws-ecs) first
- Non-.NET applications
- Lambda-based deployments (use the ADOT Lambda layer instead)
- Applications that already have ADOT configured

## Objective

Update an existing containerized .NET application and its ECS IaC to add observability via AWS Distro for OpenTelemetry. The output:

1. Adds OpenTelemetry SDK packages and instrumentation code to the .NET application
2. Creates a custom ADOT collector image (Dockerfile + config) and pushes it to Amazon ECR
3. Updates the ECS task definition to reference the custom ECR image as a sidecar container
4. Adds required IAM permissions for X-Ray and CloudWatch

**Important**: The public `amazon/aws-otel-collector` image cannot be used directly in the task definition. A custom image must be built (to bake in `otel-config.yaml`) and pushed to a private ECR repository. The ECS task definition then references this private ECR URI.

This is an **update skill** — it modifies existing infrastructure, not creates new infrastructure from scratch.

## Recommended MCP Server

This skill works best when the **AWS Knowledge MCP** server is configured for looking up current ADOT collector configuration options, X-Ray permissions, and ECS sidecar patterns.

## Phases

### Phase 0 — Validate Prerequisites

Before making changes, verify:

1. **Dockerfile exists** — locate the application's Dockerfile alongside the `.csproj`
2. **ECS IaC exists** — confirm CloudFormation or CDK infrastructure is present (typically in `infra/`)
3. **No existing ADOT setup** — check that the task definition doesn't already include an ADOT container

If prerequisites are not met, stop and recommend:
- No Dockerfile or IaC → "Use the [`dotnet-aws-ecs`](https://github.com/adisimon217/sample-appmod-skills/tree/main/dotnet-aws-ecs) skill first to containerize and generate ECS infrastructure."

### Ask the Developer

- **IaC format**: "Is your existing IaC **CloudFormation** (YAML) or **CDK** (C#)?" (default: CloudFormation)
- **Service name**: "What name should identify this service in traces and metrics?" (default: infer from project name)
- **Health check path**: "What is your application's health check endpoint?" (default: infer from `Program.cs`)
- **Telemetry pipelines**: "Which telemetry do you want enabled?"
  - Traces → AWS X-Ray (default: yes)
  - Metrics → CloudWatch EMF (default: yes)

### Phase 1 — Instrument the Application

Add OpenTelemetry SDK and instrumentation to the .NET application.

Read [references/application-instrumentation.md](references/application-instrumentation.md) for detailed guidance.

This phase:
- Adds NuGet packages for OpenTelemetry
- Creates an `Instrumentation` helper class (ActivitySource + TracerProvider + MeterProvider)
- Registers the instrumentation in `Program.cs` via DI
- Configures the OTLP exporter endpoint (defaults to `http://localhost:4317` for sidecar communication)

### Phase 2 — Create ADOT Sidecar and Push to ECR

Create a custom ADOT collector image and push it to Amazon ECR. **You cannot use the public `amazon/aws-otel-collector` image directly in the ECS task definition** — ECS Fargate tasks in private subnets may not have access to pull from public registries, and the collector requires a custom `otel-config.yaml` baked into the image. The approach is:

1. Create `src/Otel/otel-config.yaml` — the collector pipeline configuration
2. Create `src/Otel/Dockerfile` — pulls the public ADOT base image and copies in the custom config
3. **Build the custom image locally**
4. **Push the built image to a private ECR repository**
5. Reference the ECR image URI in the ECS task definition

This ensures the ADOT sidecar has the correct configuration embedded and is available from a private registry accessible to the ECS task.

Read [references/adot-sidecar-config.md](references/adot-sidecar-config.md) for detailed guidance on the Dockerfile, otel-config.yaml, and the ECR build/push workflow.

#### Output Location

```
<project-root>/src/Otel/
├── otel-config.yaml
└── Dockerfile
```

### Phase 3 — Update IaC

Update the existing ECS infrastructure to include the ADOT sidecar container and IAM permissions.

Read [references/iac-update-cloudformation.md](references/iac-update-cloudformation.md) for CloudFormation changes, or [references/iac-update-cdk.md](references/iac-update-cdk.md) for CDK changes.

This phase:
- Adds the ADOT sidecar container definition to the ECS task definition
- Sets container dependency (app container depends on ADOT container starting first)
- Increases task CPU/memory to accommodate the sidecar
- Adds IAM permissions for X-Ray (`xray:PutTraceSegments`, `xray:PutTelemetryRecords`) and CloudWatch Logs
- Adds a CloudWatch log group for ADOT collector logs (or metrics namespace)

## Constraints

- Do NOT create new ECS clusters, VPCs, or load balancers — only update the existing task definition
- Do NOT reference the public `amazon/aws-otel-collector` image directly in the task definition — always build a custom image and push to ECR
- The custom ADOT image must be built from `src/Otel/Dockerfile` (which pulls the public base image and copies in the custom config), then pushed to a private ECR repository
- ADOT container should be marked as `essential: true`
- Application container must depend on ADOT container (start dependency)
- ADOT sidecar communicates over `localhost:4317` (OTLP gRPC) — no network config needed between containers in the same task
- Keep the ADOT container resource allocation small (128 CPU / 256 MiB) relative to the app container
- Increase task-level CPU/memory to accommodate the sidecar (e.g., from 256/512 to 512/1024)
- Filter health check spans from traces to reduce noise
- Do NOT modify the application's existing Dockerfile

## Output Structure

```
<project-root>/
├── src/
│   ├── <AppProject>/
│   │   ├── Helpers/
│   │   │   ├── IInstrumentation.cs      # Interface for DI
│   │   │   └── Instrumentation.cs       # OTel setup (TracerProvider, MeterProvider)
│   │   ├── Program.cs                   # Updated — registers Instrumentation
│   │   └── <App>.csproj                 # Updated — OTel NuGet packages added
│   └── Otel/
│       ├── otel-config.yaml             # ADOT collector pipeline config
│       └── Dockerfile                   # ADOT collector container
├── infra/
│   └── ...                              # Updated — sidecar added to task definition
```

## Reporting

After generation, summarize:
- What was added to the application (packages, instrumentation class)
- ADOT collector pipeline configuration (receivers → processors → exporters)
- ECR repository created/used for the custom ADOT image
- IaC changes made (sidecar container referencing ECR URI, IAM permissions, resource sizing)
- How to verify traces appear in X-Ray and metrics in CloudWatch
- Manual steps required:
  1. Build the custom ADOT image: `docker build -t <app-name>-adot -f src/Otel/Dockerfile src/Otel/`
  2. Tag and push to ECR: `docker tag <app-name>-adot:latest <ecr-uri>:latest && docker push <ecr-uri>:latest`
  3. Rebuild and push the application image (with OTel instrumentation added)
  4. Deploy updated IaC / force new ECS deployment
