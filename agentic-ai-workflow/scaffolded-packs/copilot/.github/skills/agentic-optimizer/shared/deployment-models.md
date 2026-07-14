# AWS Deployment Models for Agentic AI

This document provides guidance on selecting the appropriate AWS deployment model for your agentic AI system.

## Deployment Options Overview

| Model | Best For | Max Duration | Scaling | Cost Model |
|-------|----------|--------------|---------|------------|
| Lambda | Task-based, sporadic | 15 min | Auto | Pay per invocation |
| ECS Fargate | Interaction-based, consistent load | Unlimited | Auto/Manual | Pay for running time |
| Step Functions | Multi-step workflows, orchestration | 1 year | Auto | Pay per transition |

## AWS Lambda

### When to Use

- **Task-based agents** with execution time < 15 minutes
- **Sporadic or unpredictable** traffic patterns
- **Stateless** operations (or with external state store)
- **Cost-sensitive** workloads with variable demand
- **Simple single-agent** architectures

### Configuration Guidelines

```hcl
resource "aws_lambda_function" "agent" {
  function_name = "agentic-ai-agent"
  runtime       = "python3.11"

  # Memory allocation affects CPU
  # Higher memory = more CPU = faster LLM processing
  memory_size = 1024  # 1GB recommended minimum

  # Timeout for agent execution
  # Consider LLM latency + processing time
  timeout = 900  # 15 minutes max

  # Reserved concurrency for tenant isolation
  reserved_concurrent_executions = 100

  # Enable X-Ray for tracing
  tracing_config {
    mode = "Active"
  }

  # Environment for configuration
  environment {
    variables = {
      MODEL_ID   = "anthropic.claude-3-sonnet"
      AWS_REGION = var.region
    }
  }
}
```

### Scaling Characteristics

- **Cold start**: 1-3 seconds (mitigate with provisioned concurrency)
- **Concurrent executions**: 1000 default (can increase)
- **Burst capacity**: 3000 in us-east-1

### Cost Optimization

- Use ARM64 architecture for 20% cost reduction
- Right-size memory allocation
- Implement caching for repeated queries
- Use provisioned concurrency only for latency-critical paths

## Amazon ECS Fargate

### When to Use

- **Interaction-based agents** with ongoing conversations
- **Long-running tasks** exceeding 15 minutes
- **Consistent, predictable** traffic patterns
- **Multi-agent systems** requiring inter-agent communication
- **Complex state management** requirements

### Configuration Guidelines

```hcl
resource "aws_ecs_task_definition" "agent" {
  family                   = "agentic-ai-agent"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  # CPU and memory allocation
  cpu    = 1024  # 1 vCPU
  memory = 2048  # 2 GB

  container_definitions = jsonencode([{
    name  = "agent"
    image = "${aws_ecr_repository.agent.repository_url}:latest"

    # Health check for ALB
    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    # Logging to CloudWatch
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/agentic-ai-agent"
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "agent"
      }
    }

    # Port mapping for ALB
    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]
  }])
}

# Auto-scaling based on CPU
resource "aws_appautoscaling_policy" "agent_scaling" {
  name               = "agent-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.agent.resource_id
  scalable_dimension = aws_appautoscaling_target.agent.scalable_dimension
  service_namespace  = aws_appautoscaling_target.agent.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
```

### Scaling Characteristics

- **Startup time**: 30-60 seconds for new tasks
- **Scaling granularity**: Per-task (1 task = 1 container)
- **Max tasks**: Limited by VPC IP addresses and quotas

### Cost Optimization

- Use Spot instances for non-critical workloads (70% savings)
- Implement connection pooling
- Scale down during off-peak hours
- Use ARM64 Graviton processors (20% cost reduction)

## AWS Step Functions

### When to Use

- **Multi-agent orchestration** with defined workflows
- **Long-running processes** (up to 1 year)
- **Complex error handling** and retry logic
- **Audit trail requirements** (built-in execution history)
- **Human-in-the-loop** workflows
- **Parallel processing** with fan-out/fan-in patterns

### Configuration Guidelines

```json
{
  "Comment": "Multi-Agent Agentic AI Workflow",
  "StartAt": "AnalyzeTask",
  "States": {
    "AnalyzeTask": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:${region}:${account}:function:analyze-task",
      "ResultPath": "$.analysis",
      "Retry": [{
        "ErrorEquals": ["States.TaskFailed"],
        "IntervalSeconds": 2,
        "MaxAttempts": 3,
        "BackoffRate": 2.0
      }],
      "Catch": [{
        "ErrorEquals": ["States.ALL"],
        "ResultPath": "$.error",
        "Next": "HandleError"
      }],
      "Next": "RouteToAgents"
    },
    "RouteToAgents": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.analysis.pattern",
          "StringEquals": "multi-agent",
          "Next": "ParallelAgentExecution"
        }
      ],
      "Default": "SingleAgentExecution"
    },
    "ParallelAgentExecution": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "ResearchAgent",
          "States": {
            "ResearchAgent": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:${region}:${account}:function:research-agent",
              "End": true
            }
          }
        },
        {
          "StartAt": "AnalysisAgent",
          "States": {
            "AnalysisAgent": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:${region}:${account}:function:analysis-agent",
              "End": true
            }
          }
        }
      ],
      "ResultPath": "$.agentResults",
      "Next": "SynthesizeResults"
    },
    "SingleAgentExecution": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:${region}:${account}:function:single-agent",
      "ResultPath": "$.result",
      "Next": "FormatOutput"
    },
    "SynthesizeResults": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:${region}:${account}:function:synthesize",
      "ResultPath": "$.result",
      "Next": "FormatOutput"
    },
    "FormatOutput": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:${region}:${account}:function:format-output",
      "End": true
    },
    "HandleError": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:${region}:${account}:function:handle-error",
      "End": true
    }
  }
}
```

### Scaling Characteristics

- **Concurrent executions**: 1 million (Standard) / 100k (Express)
- **State transitions**: Unlimited in Standard, 25K/sec in Express
- **Express vs Standard**: Express for high-volume, short duration

### Cost Optimization

- Use Express Workflows for high-volume, < 5 min executions
- Batch similar operations
- Use .sync pattern for Lambda (wait for completion)
- Implement early termination logic

## Decision Matrix

```
                        ┌────────────────────────────────────────────────┐
                        │              DEPLOYMENT SELECTION              │
                        └────────────────────────────────────────────────┘

Is execution time > 15 minutes?
│
├── YES ──► Is it a multi-step workflow with orchestration needs?
│           │
│           ├── YES ──► Step Functions + Lambda
│           │
│           └── NO ───► ECS Fargate
│
└── NO ───► Is traffic consistent and predictable?
            │
            ├── YES ──► ECS Fargate (cost-effective at scale)
            │
            └── NO ───► Is it multi-agent with complex orchestration?
                        │
                        ├── YES ──► Step Functions
                        │
                        └── NO ───► Lambda (most cost-effective)
```

## Hybrid Architectures

### Lambda + Step Functions

Best for: Multi-agent workflows with individual tasks < 15 min

```
Step Functions orchestrates the workflow
    ↓
Lambda functions execute individual agent tasks
    ↓
DynamoDB stores intermediate state
```

### API Gateway + Lambda + ECS

Best for: Mixed workloads with quick queries and long tasks

```
API Gateway routes requests
    ↓
Lambda handles quick tasks (< 30 sec)
    ↓
ECS handles long-running conversations
```

### EventBridge + Multiple Compute

Best for: Event-driven multi-agent systems

```
EventBridge routes events to appropriate compute
    ↓
Lambda for triggers and quick processing
    ↓
ECS for sustained agent conversations
    ↓
Step Functions for complex workflows
```

## Security Considerations by Deployment

### Lambda
- Use execution role with least privilege
- Enable VPC placement for private resources
- Use Secrets Manager for credentials
- Enable X-Ray for tracing

### ECS Fargate
- Use task role for AWS permissions
- Enable awsvpc networking mode
- Use private subnets with NAT
- Implement security groups

### Step Functions
- Use execution role with minimal permissions
- Enable CloudWatch logging
- Implement input/output filtering
- Use VPC endpoints for private access
