# Multi-Tenant Patterns for Agentic AI

This document provides implementation patterns for building multi-tenant agentic AI systems on AWS.

## Tenant Context Introduction

Every agentic system must propagate tenant context through all layers:

### Request Headers

```python
TENANT_ID_HEADER = "x-tenant-id"

def extract_tenant_id(event: dict) -> str:
    """Extract tenant ID from API Gateway event."""
    # From custom authorizer
    tenant_id = event.get("requestContext", {}).get("authorizer", {}).get("tenant_id")

    # Fallback to header
    if not tenant_id:
        headers = event.get("headers", {})
        tenant_id = headers.get(TENANT_ID_HEADER) or headers.get(TENANT_ID_HEADER.lower())

    if not tenant_id:
        raise ValueError("Missing tenant_id in request")

    return tenant_id
```

### Resource Tagging

```python
def tag_bedrock_request(tenant_id: str, request_id: str) -> dict:
    """Generate tags for Bedrock API calls."""
    return {
        "TenantId": tenant_id,
        "RequestId": request_id,
        "Application": "agentic-ai",
        "Timestamp": datetime.utcnow().isoformat()
    }
```

### Logging Context

```python
import structlog

def get_tenant_logger(tenant_id: str, request_id: str):
    """Create logger with tenant context."""
    return structlog.get_logger().bind(
        tenant_id=tenant_id,
        request_id=request_id
    )

# Usage
logger = get_tenant_logger(tenant_id, request_id)
logger.info("agent_invoked", action="start", input_length=len(input))
```

## Isolation Patterns

### Compute Isolation

**Pooled (Shared Lambda/ECS):**
```python
# Single Lambda serves all tenants
# Isolation through request context
def lambda_handler(event, context):
    tenant_id = extract_tenant_id(event)

    # All operations scoped to tenant
    with tenant_context(tenant_id):
        result = process_request(event)

    return result
```

**Siloed (Per-Tenant Lambda):**
```hcl
# Deploy separate Lambda per tenant
resource "aws_lambda_function" "agent" {
  for_each = toset(var.tenant_ids)

  function_name = "agent-${each.value}"

  environment {
    variables = {
      TENANT_ID = each.value
    }
  }

  tags = {
    TenantId = each.value
  }
}
```

### Data Isolation

**DynamoDB with Tenant Partition:**
```python
# Table design: tenant_id as partition key prefix
def get_agent_state(tenant_id: str, session_id: str) -> dict:
    response = dynamodb.get_item(
        TableName="agent-state",
        Key={
            "pk": {"S": f"TENANT#{tenant_id}"},
            "sk": {"S": f"SESSION#{session_id}"}
        }
    )
    return response.get("Item", {})
```

**S3 with Tenant Prefix:**
```python
def get_tenant_bucket_path(tenant_id: str, path: str) -> str:
    """All tenant data under tenant prefix."""
    return f"tenants/{tenant_id}/{path}"

def store_agent_output(tenant_id: str, output_id: str, data: bytes):
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=get_tenant_bucket_path(tenant_id, f"outputs/{output_id}"),
        Body=data,
        Metadata={"tenant_id": tenant_id}
    )
```

### IAM Isolation

**Condition-Based Access:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockTenantAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestTag/TenantId": "${aws:PrincipalTag/TenantId}"
        }
      }
    }
  ]
}
```

**Resource-Based Policy for DynamoDB:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TenantDataAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/agent-state",
      "Condition": {
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": ["TENANT#${aws:PrincipalTag/TenantId}*"]
        }
      }
    }
  ]
}
```

## Rate Limiting

### Per-Tenant Quotas

```python
from functools import wraps
import redis

redis_client = redis.Redis(host=REDIS_HOST)

def rate_limit(max_requests: int, window_seconds: int):
    """Decorator for per-tenant rate limiting."""
    def decorator(func):
        @wraps(func)
        def wrapper(tenant_id: str, *args, **kwargs):
            key = f"rate_limit:{tenant_id}"
            current = redis_client.incr(key)

            if current == 1:
                redis_client.expire(key, window_seconds)

            if current > max_requests:
                raise RateLimitExceeded(
                    f"Tenant {tenant_id} exceeded {max_requests} requests per {window_seconds}s"
                )

            return func(tenant_id, *args, **kwargs)
        return wrapper
    return decorator

@rate_limit(max_requests=100, window_seconds=60)
def invoke_agent(tenant_id: str, input: str) -> str:
    # Agent invocation logic
    pass
```

### Token Budget Management

```python
class TenantTokenBudget:
    def __init__(self, tenant_id: str, daily_limit: int):
        self.tenant_id = tenant_id
        self.daily_limit = daily_limit
        self.key = f"token_budget:{tenant_id}:{date.today().isoformat()}"

    def check_and_consume(self, tokens: int) -> bool:
        """Check if tenant has budget and consume tokens."""
        current = int(redis_client.get(self.key) or 0)

        if current + tokens > self.daily_limit:
            return False

        redis_client.incrby(self.key, tokens)
        redis_client.expire(self.key, 86400)  # 24 hours
        return True

    def get_remaining(self) -> int:
        """Get remaining token budget."""
        used = int(redis_client.get(self.key) or 0)
        return max(0, self.daily_limit - used)
```

## Cost Allocation

### Usage Tracking

```python
def track_usage(tenant_id: str, request_id: str, usage: dict):
    """Track usage for billing and analytics."""
    cloudwatch.put_metric_data(
        Namespace="AgenticAI/Usage",
        MetricData=[
            {
                "MetricName": "TokensUsed",
                "Value": usage["total_tokens"],
                "Unit": "Count",
                "Dimensions": [
                    {"Name": "TenantId", "Value": tenant_id},
                    {"Name": "Model", "Value": usage["model"]}
                ]
            },
            {
                "MetricName": "RequestLatency",
                "Value": usage["latency_ms"],
                "Unit": "Milliseconds",
                "Dimensions": [
                    {"Name": "TenantId", "Value": tenant_id}
                ]
            }
        ]
    )
```

### Cost Tags on Resources

```hcl
locals {
  common_tags = {
    Application = "agentic-ai"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_lambda_function" "agent" {
  # ... configuration ...

  tags = merge(local.common_tags, {
    TenantId   = var.tenant_id
    CostCenter = var.cost_center
  })
}
```

## Routing Strategies

### API Gateway with Tenant Routing

```yaml
# SAM template for tenant-aware routing
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  AgentApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Auth:
        DefaultAuthorizer: TenantAuthorizer
        Authorizers:
          TenantAuthorizer:
            FunctionArn: !GetAtt AuthorizerFunction.Arn

  AuthorizerFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: authorizer.handler
      Runtime: python3.11
      # Extracts and validates tenant_id, adds to context
```

### Multi-Tenant Router

```python
class TenantRouter:
    """Route requests to appropriate agent based on tenant config."""

    def __init__(self):
        self.tenant_configs = {}  # Load from DynamoDB/SSM

    def get_agent_endpoint(self, tenant_id: str) -> str:
        """Get agent endpoint for tenant (siloed vs pooled)."""
        config = self.tenant_configs.get(tenant_id, {})

        if config.get("isolation") == "siloed":
            return f"https://agent-{tenant_id}.internal"
        else:
            return "https://agent-pooled.internal"

    def route_request(self, tenant_id: str, request: dict) -> dict:
        """Route request to appropriate agent."""
        endpoint = self.get_agent_endpoint(tenant_id)

        # Add tenant context to request
        request["tenant_id"] = tenant_id

        return self.invoke_agent(endpoint, request)
```

## Security Best Practices

1. **Always validate tenant_id** - Never trust client-provided values without verification
2. **Use IAM conditions** - Enforce tenant boundaries at the IAM level
3. **Encrypt tenant data** - Use per-tenant KMS keys where possible
4. **Audit all access** - Log tenant context with every operation
5. **Implement quotas** - Prevent noisy neighbor issues
6. **Regular access reviews** - Verify tenant isolation effectiveness
