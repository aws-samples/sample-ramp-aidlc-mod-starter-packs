# CDK Patterns for Event-Driven Infrastructure

Stack decomposition and cross-stack wiring for an event-driven FSI platform.

## Recommended Stack Decomposition

```
stacks/
├── network-stack.ts          — VPC, subnets, security groups
├── streaming-stack.ts        — MSK cluster, topics, schema registry
├── alerts-stack.ts           — Subscription matching Lambda/Flink, DynamoDB tables
├── notification-stack.ts     — Notification ECS service, push/email/SMS
├── integration-stack.ts      — Order Service, external-integration gateway (ECS), DynamoDB
├── api-stack.ts              — API Gateway, authorizers, routes
├── observability-stack.ts    — Dashboards, alarms, log groups
└── pipeline-stack.ts         — CI/CD (CodePipeline or GitHub Actions)
```

## Cross-Stack References — Pass Construct References Directly

**Best practice: pass construct references between stacks** (via stack props / constructor parameters) and let the CDK figure out the wiring. When a construct in stack A is used by stack B, the CDK **automatically synthesizes the CloudFormation export in A and the `Fn::ImportValue` in B** — you never write them by hand.

```ts
// app.ts
const streaming = new StreamingStack(app, 'Streaming');
const alerts = new AlertsStack(app, 'Alerts', {
  cluster: streaming.mskCluster,        // pass the construct reference
  ordersTopicArn: streaming.ordersTopicArn,
});
// AlertsStack uses props.cluster directly; CDK creates the export + import.
```

### Avoid manual `CfnOutput` + `Fn.importValue`

Wiring stacks by hand with `CfnOutput` in the producer and `Fn.importValue` in the consumer creates a **strong reference** and is an anti-pattern for stacks in the same CDK app. A strong reference is prone to the **dependency deadlock ("deadly embrace")**: CloudFormation will not let the producing stack remove or change an export while any consumer still imports it, which blocks updates and deletes until you manually break the reference on both sides.

The CDK's automatic cross-stack references (from passing construct refs) manage the export lifecycle and let you migrate reference strength (strong → weak via `Fn::GetStackOutput`) to break such deadlocks safely.

**When manual `Fn.importValue` is appropriate:** only for **truly cross-app or pre-existing resources** — e.g. importing a resource created by a different CDK app, a different tool, or the console — where you cannot pass a live construct reference.

## Sources

- [Resources and the AWS CDK — Referencing resources in a different stack; dependency deadlock (deadly embrace); reference strength](https://docs.aws.amazon.com/cdk/v2/guide/resources.html)
