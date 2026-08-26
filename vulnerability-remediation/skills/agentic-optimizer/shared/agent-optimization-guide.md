# Agent Optimization Guide

Based on Amazon's experience building thousands of production agents and lessons from refactoring real-world AI agent architectures.

## From Prompt Spaghetti to Structured Systems

### What is Prompt Spaghetti?

"Prompt spaghetti" refers to poorly structured agent implementations characterized by:

1. **Monolithic prompts** trying to handle all scenarios
2. **Implicit business logic** buried in natural language
3. **Inconsistent outputs** with no defined format
4. **Missing error paths** and fallback strategies
5. **Tangled responsibilities** across agents
6. **No systematic evaluation** before deployment

### The Transformation Journey

```
Stage 1: Prototype ("Works in Demo")
- Single prompt handling everything
- Manual testing
- No observability
- Happy path only

Stage 2: Structured ("Works Reliably")
- Decomposed responsibilities
- Automated evaluation
- Full observability
- Error handling

Stage 3: Production ("Works at Scale")
- Multi-agent architecture
- Continuous monitoring
- Performance optimization
- Security hardening
```

## Nine Enterprise Best Practices

### 1. Start Small and Define Success Clearly

**Why it matters**: Teams that try to build agents handling every scenario end up with complexity that prevents iteration.

**Implementation**:
```python
# Define clear boundaries
AGENT_SCOPE = {
    "should_do": [
        "Answer order status questions",
        "Provide tracking information",
        "Explain delivery timelines"
    ],
    "should_not_do": [
        "Process refunds",
        "Modify orders",
        "Access payment information"
    ],
    "escalate_to_human": [
        "Complaints about damaged items",
        "Requests exceeding $1000",
        "Legal or compliance questions"
    ]
}
```

**Deliverables before building**:
1. Clear scope definition (what agent should/shouldn't do)
2. Tone and personality guidelines
3. Tool definitions with parameter specs
4. Ground truth dataset (50+ queries covering edge cases)

### 2. Instrument Everything from Day One

**Why it matters**: You can't improve what you can't measure. Debug issues are 10x harder without observability.

**Three observability layers**:

```python
# Layer 1: Trace-level debugging (development)
from aws_xray_sdk.core import xray_recorder

@xray_recorder.capture("agent_invocation")
def process_request(request):
    with xray_recorder.in_subsegment("intent_detection"):
        intent = detect_intent(request)

    with xray_recorder.in_subsegment("tool_execution"):
        result = execute_tool(intent)

    return result

# Layer 2: Metrics dashboard (production)
def emit_metrics(tenant_id, duration_ms, tokens_used, success):
    cloudwatch.put_metric_data(
        Namespace="AgenticAI/Performance",
        MetricData=[
            {
                "MetricName": "RequestLatency",
                "Value": duration_ms,
                "Unit": "Milliseconds",
                "Dimensions": [{"Name": "TenantId", "Value": tenant_id}]
            },
            {
                "MetricName": "TokensUsed",
                "Value": tokens_used,
                "Unit": "Count"
            },
            {
                "MetricName": "SuccessRate",
                "Value": 1 if success else 0,
                "Unit": "Count"
            }
        ]
    )

# Layer 3: Alerting
ALERT_THRESHOLDS = {
    "error_rate_percent": 5,
    "latency_p99_ms": 10000,
    "token_budget_daily": 1000000
}
```

### 3. Build a Deliberate Tooling Strategy

**Why it matters**: Vague tool descriptions cause incorrect tool selection. Overly broad tools cause errors.

**Good tool definition**:
```python
@tool
def get_order_status(
    order_id: str,
    tenant_id: str
) -> OrderStatusResponse:
    """
    Retrieve current status of a customer order.

    Use this tool ONLY when the user asks about:
    - Order status or state
    - Delivery progress
    - Shipping updates

    Do NOT use for:
    - Product information (use get_product_details)
    - Returns or refunds (use initiate_return)
    - Payment issues (escalate to human)

    Args:
        order_id: The order identifier (format: ORD-XXXXXXXX)
        tenant_id: Customer tenant for isolation

    Returns:
        OrderStatusResponse with status, timestamp, tracking_url

    Errors:
        OrderNotFoundError: Order ID doesn't exist
        UnauthorizedError: Tenant doesn't own this order
    """
    pass
```

**Bad tool definition**:
```python
@tool
def handle_order(order_info):
    """Help with orders."""  # Too vague!
    pass
```

### 4. Automate Evaluation from the Start

**Why it matters**: Manual testing doesn't scale. Agents degrade in production without continuous evaluation.

**Three-layer evaluation framework**:

```python
# Layer 1: Foundation Model Evaluation
def evaluate_model_performance(model_id, test_queries):
    """Benchmark model on standard metrics."""
    results = {
        "latency_p50": measure_latency(test_queries, percentile=50),
        "latency_p99": measure_latency(test_queries, percentile=99),
        "quality_score": measure_quality(test_queries),
        "cost_per_query": calculate_costs(test_queries)
    }
    return results

# Layer 2: Component Evaluation
def evaluate_components(agent, test_cases):
    """Evaluate individual agent components."""
    return {
        "intent_detection_accuracy": evaluate_intent_detection(agent, test_cases),
        "tool_selection_accuracy": evaluate_tool_selection(agent, test_cases),
        "reasoning_coherence": evaluate_reasoning(agent, test_cases),
        "error_recovery_rate": evaluate_error_handling(agent, test_cases)
    }

# Layer 3: End-to-End Evaluation
def evaluate_end_to_end(agent, ground_truth):
    """Evaluate overall agent performance."""
    return {
        "task_completion_rate": measure_completion(agent, ground_truth),
        "user_satisfaction_proxy": measure_response_quality(agent, ground_truth),
        "safety_score": measure_guardrails(agent, ground_truth),
        "cost_efficiency": measure_costs(agent, ground_truth)
    }
```

**LLM-as-Judge for quality**:
```python
JUDGE_PROMPT = """
Evaluate this agent response on a scale of 1-5:

User Query: {query}
Agent Response: {response}
Expected Behavior: {expected}

Criteria:
1. Accuracy: Does the response correctly address the query?
2. Completeness: Does it provide all necessary information?
3. Clarity: Is it easy to understand?
4. Tone: Is it appropriate for the context?
5. Safety: Does it avoid harmful or misleading content?

Provide scores for each criterion and an overall score with justification.
"""
```

### 5. Decompose Complexity with Multi-Agent Systems

**Why it matters**: Single agents handling everything become unmaintainable. Specialized agents are easier to test and improve.

**When to decompose**:
- Agent prompt exceeds 1000 tokens
- More than 5 distinct responsibilities
- Different tasks require different models
- Parts of workflow need different latency/cost tradeoffs

**Decomposition patterns**:

```python
# Pattern: Supervisor with Specialists
class CustomerServiceSystem:
    def __init__(self):
        self.supervisor = SupervisorAgent()
        self.specialists = {
            "orders": OrderSpecialist(),
            "returns": ReturnsSpecialist(),
            "products": ProductSpecialist(),
            "billing": BillingSpecialist()
        }

    def handle_request(self, request):
        # Supervisor classifies and routes
        classification = self.supervisor.classify(request)

        if classification.needs_escalation:
            return self.escalate_to_human(request)

        # Route to appropriate specialist
        specialist = self.specialists[classification.category]
        return specialist.handle(request)
```

### 6. Scale Securely with Personalization

**Why it matters**: Agents with user context are more helpful but require careful security design.

**Implementation pattern**:
```python
class SecureAgentContext:
    def __init__(self, user_id: str, session_id: str):
        self.user_id = user_id
        self.session_id = session_id
        self.permissions = self._load_permissions()

    def _load_permissions(self) -> set:
        """Load user's allowed actions."""
        return auth_service.get_permissions(self.user_id)

    def can_access_tool(self, tool_name: str) -> bool:
        """Check if user can access tool."""
        required_permission = TOOL_PERMISSIONS.get(tool_name)
        return required_permission in self.permissions

    def get_personalized_context(self) -> dict:
        """Get user-specific context for agent."""
        return {
            "user_preferences": self._get_preferences(),
            "recent_interactions": self._get_history(),
            "account_tier": self._get_tier()
        }
```

### 7. Combine Agents with Deterministic Code

**Why it matters**: LLMs are probabilistic. Business rules should be deterministic.

**What should be code, not prompts**:
- Validation logic
- Calculations
- Date/time processing
- Format conversions
- Business rules
- Access control

**Example**:
```python
# BAD: Business logic in prompt
prompt = """
If the order total is over $100, apply 10% discount.
If the user is a premium member, apply additional 5%.
Calculate the final price.
"""

# GOOD: Business logic in code
def calculate_final_price(order_total: float, is_premium: bool) -> float:
    """Deterministic pricing logic."""
    discount = 0.0

    if order_total > 100:
        discount += 0.10

    if is_premium:
        discount += 0.05

    return order_total * (1 - discount)

# Agent just calls the function
@tool
def get_order_total(order_id: str) -> dict:
    order = fetch_order(order_id)
    user = fetch_user(order.user_id)

    final_price = calculate_final_price(
        order.subtotal,
        user.is_premium
    )

    return {
        "subtotal": order.subtotal,
        "discount_applied": order.subtotal - final_price,
        "final_price": final_price
    }
```

### 8. Establish Continuous Testing Practices

**Why it matters**: Agents degrade over time. Model updates, data drift, and edge cases cause regressions.

**Testing pyramid**:
```
                    /\
                   /  \
                  / E2E \        <- Full agent tests
                 /------\
                / Compo- \       <- Component tests
               /  nent    \
              /------------\
             /    Unit      \    <- Tool and function tests
            /________________\
```

**Continuous testing implementation**:
```python
# tests/test_agent_regression.py
import pytest
from agent import CustomerServiceAgent

class TestAgentRegression:
    @pytest.fixture
    def agent(self):
        return CustomerServiceAgent()

    @pytest.mark.parametrize("query,expected_intent", [
        ("Where is my order?", "order_status"),
        ("I want to return this", "return_request"),
        ("What products do you have?", "product_inquiry"),
    ])
    def test_intent_detection(self, agent, query, expected_intent):
        result = agent.detect_intent(query)
        assert result.intent == expected_intent

    @pytest.mark.parametrize("query,expected_tool", [
        ("Order status for ORD-123", "get_order_status"),
        ("Track my package", "get_tracking_info"),
    ])
    def test_tool_selection(self, agent, query, expected_tool):
        result = agent.plan(query)
        assert result.selected_tool == expected_tool

    def test_error_handling(self, agent):
        """Agent should handle invalid orders gracefully."""
        result = agent.process("Status of order INVALID-999")
        assert "not found" in result.lower()
        assert "error" not in result.lower()  # Should be user-friendly
```

### 9. Build Organizational Capability

**Why it matters**: Individual agent success doesn't scale. Organizations need shared practices.

**Capability building**:
1. **Shared libraries**: Common tools, utilities, patterns
2. **Template agents**: Starting points for new projects
3. **Evaluation frameworks**: Consistent testing approaches
4. **Runbooks**: How to debug, deploy, monitor
5. **Training materials**: Onboarding for new team members

## Performance Optimization Techniques

### Latency Optimization

| Technique | Impact | Effort | Implementation |
|-----------|--------|--------|----------------|
| Response streaming | High | Low | Enable streaming in SDK |
| Parallel tool calls | High | Medium | Use asyncio/concurrent |
| Prompt caching | Medium | Low | Enable in Bedrock |
| Model selection | High | Medium | Use smaller models for simple tasks |
| Early termination | Medium | Medium | Stop when answer is clear |

### Cost Optimization

| Technique | Savings | Trade-off |
|-----------|---------|-----------|
| Token reduction | 20-40% | May reduce context |
| Model tiering | 30-60% | Latency for simple queries |
| Response caching | 10-30% | Stale data risk |
| Batching | 15-25% | Increased latency |

### Reliability Patterns

```python
class ResilientAgent:
    def __init__(self):
        self.retry_config = {
            "max_attempts": 3,
            "base_delay": 1.0,
            "max_delay": 10.0,
            "exponential_base": 2
        }

    async def invoke_with_retry(self, request):
        """Invoke with exponential backoff retry."""
        for attempt in range(self.retry_config["max_attempts"]):
            try:
                return await self._invoke(request)
            except TransientError as e:
                if attempt == self.retry_config["max_attempts"] - 1:
                    raise
                delay = min(
                    self.retry_config["base_delay"] *
                    (self.retry_config["exponential_base"] ** attempt),
                    self.retry_config["max_delay"]
                )
                await asyncio.sleep(delay)

    async def invoke_with_fallback(self, request):
        """Invoke with fallback strategy."""
        try:
            return await self.primary_agent.invoke(request)
        except AgentError:
            return await self.fallback_agent.invoke(request)
        except Exception:
            return self.static_fallback_response(request)
```

## Checklist: Production Readiness

### Before Going Live

- [ ] Scope clearly defined and documented
- [ ] Ground truth dataset with 50+ test cases
- [ ] Evaluation pipeline automated
- [ ] Observability enabled (traces, metrics, logs)
- [ ] Error handling covers all failure modes
- [ ] Security review completed
- [ ] Performance benchmarks established
- [ ] Runbook documented
- [ ] On-call rotation assigned
- [ ] Rollback procedure tested

### Ongoing Operations

- [ ] Weekly evaluation reports reviewed
- [ ] Production sampling analyzed
- [ ] Cost tracking within budget
- [ ] Performance SLAs met
- [ ] User feedback incorporated
- [ ] Model updates tested before deployment
- [ ] Security patches applied promptly
