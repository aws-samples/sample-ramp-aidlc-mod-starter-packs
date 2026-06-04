---
name: aws-skills
description: Guides AWS development with infrastructure automation and cloud architecture patterns. Use when designing or refactoring cloud-native applications on AWS, automating environment provisioning with Terraform/CDK/CloudFormation, setting up secure CI/CD pipelines, evaluating service choices for cost/scalability/fault tolerance, or preparing production runbooks and observability.
metadata:
  author: sickn33
  source: https://playbooks.com/skills/sickn33/antigravity-awesome-skills/aws-skills
---

# AWS Cloud Architecture & Infrastructure Skills

## Overview

Practical patterns and tooling for AWS development focused on infrastructure automation and cloud architecture. Covers provisioning, CI/CD, security, and cost-aware design using common IaC and AWS services. Aimed at developers and architects who need repeatable, production-ready approaches for AWS workloads.

## How This Skill Works

Inspects your architecture goals and recommends infrastructure-as-code patterns, service choices, and deployment workflows. Suggests templates, module boundaries, and automation steps for Terraform, CloudFormation, CDK, and CI pipelines. Highlights security controls, networking topologies, and cost optimization measures tailored to the chosen services.

## When to Use

- Designing or refactoring cloud-native applications on AWS
- Automating environment provisioning with Terraform, CDK, or CloudFormation
- Setting up secure CI/CD pipelines for infrastructure and application code
- Evaluating service choices for cost, scalability, and fault tolerance
- Preparing production runbooks, observability, and incident response

## Best Practices

- Model infrastructure as modular IaC components with clear ownership
- Enforce least-privilege IAM policies and use short-lived credentials
- Automate tests and policy checks in CI for IaC changes
- Design multi-AZ and graceful-failover patterns for critical workloads
- Monitor cost and performance with tagging, budgets, and observability

## Example Use Cases

1. **VPC with Transit Gateway** - Create segmented subnets for multi-tier apps
2. **Blue/Green Deployments** - Implement canary deployments for ECS, EKS, or Lambda workloads
3. **Infrastructure Pipelines** - Build automated pipelines that run plan/apply with approvals
4. **Account Hardening** - Harden with SCPs, IAM roles, and centralized logging/monitoring
5. **Migration** - Migrate monolithic services to serverless or container platforms with staged rollout

## IaC Tool Selection Guide

| Tool | Best For | Strengths |
|------|----------|-----------|
| **Terraform** | Cross-cloud consistency | Large module ecosystem, HCL declarative syntax |
| **CDK** | Complex logic, familiar languages | TypeScript/Python/Java constructs, L2/L3 abstractions |
| **CloudFormation** | Native AWS support | No external tooling, deep AWS integration |

## Environment Consistency

To keep environments consistent across dev, staging, and prod:
- Use the same IaC modules with parameterized inputs
- Enforce policy-as-code checks in CI
- Apply automated promotion gates so the same templates and tests run across environments

## Architecture Patterns

### Multi-AZ High Availability
- Deploy across at least 2 AZs
- Use ALB/NLB for traffic distribution
- Configure auto-scaling groups with health checks
- Implement database read replicas across AZs

### Cost Optimization
- Right-size instances using AWS Compute Optimizer
- Use Savings Plans or Reserved Instances for steady-state workloads
- Implement auto-scaling for variable workloads
- Tag all resources for cost allocation and tracking
- Set up AWS Budgets with alerts

### Security Baseline
- Enable AWS CloudTrail in all regions
- Configure AWS Config rules for compliance
- Use AWS GuardDuty for threat detection
- Implement VPC Flow Logs
- Enable AWS Security Hub for centralized findings
