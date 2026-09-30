---
name: terraform-aws
description: Comprehensive AWS infrastructure management with Terraform. Covers provider configuration, state management (S3 backend with native locking in Terraform 1.11+), common resource patterns (VPC, IAM, S3, RDS, EKS), module usage, and production best practices. Use when provisioning AWS infrastructure, managing Terraform state, creating VPCs, configuring IAM roles/policies, deploying databases, or troubleshooting Terraform/AWS issues.
metadata:
  author: adaptationio
  source: https://playbooks.com/skills/adaptationio/skrillz/terraform-aws
---

# Terraform AWS Infrastructure Management

## Overview

Complete guide for managing AWS infrastructure as code using Terraform. This skill provides production-ready patterns for VPC networking, IAM security, state management, and common AWS resources with Terraform 1.11+ features and AWS Provider 6.x.

**Terraform Version**: 1.11+ (with S3 native locking)
**AWS Provider**: 6.x

## When to Use This Skill

- Provisioning AWS infrastructure with Terraform
- Setting up VPC networking with public/private subnets
- Configuring IAM roles, policies, and permissions
- Managing Terraform state with S3 backend
- Deploying databases (RDS, Aurora)
- Creating EKS-ready VPC configurations
- Troubleshooting Terraform plan/apply failures
- Migrating from DynamoDB to S3 native locking
- Importing existing AWS resources into Terraform

## Quick Start

### Basic AWS Provider Configuration

```hcl
terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket = "my-terraform-state-bucket"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Project     = var.project_name
    }
  }
}
```

## Common Resource Patterns

### VPC with Public and Private Subnets

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.project_name}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true
  enable_dns_support   = true
  enable_flow_log      = true
}
```

### S3 Bucket with Encryption and Versioning

```hcl
resource "aws_s3_bucket" "app_data" {
  bucket = "${var.project_name}-app-data-${var.environment}"
}

resource "aws_s3_bucket_versioning" "app_data" {
  bucket = aws_s3_bucket.app_data.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "app_data" {
  bucket = aws_s3_bucket.app_data.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "app_data" {
  bucket                  = aws_s3_bucket.app_data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

### IAM Role for EC2 with SSM Access

```hcl
resource "aws_iam_role" "ec2_app_role" {
  name = "${var.project_name}-ec2-app-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_app_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
```

### RDS PostgreSQL Database

```hcl
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db-${var.environment}"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.environment == "production" ? "db.t3.medium" : "db.t3.micro"

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.environment == "production" ? 30 : 7
  deletion_protection     = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"
}
```

## State Management

### S3 Backend with Native Locking (Terraform 1.11+)

```hcl
terraform {
  backend "s3" {
    bucket       = "my-terraform-state-bucket"
    key          = "production/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
```

### Legacy: S3 + DynamoDB Locking (Terraform < 1.11)

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-bucket"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

## Module Usage Patterns

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  # ...
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"
  cluster_name    = "${var.project_name}-eks"
  cluster_version = "1.30"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
}
```

## Common Issues and Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| State lock timeout | Orphaned lock file | `terraform force-unlock <lock-id>` |
| Provider version conflict | Incompatible versions | Update `required_providers` block |
| Resource already exists | Created outside Terraform | Use `terraform import` |
| State drift detected | Manual changes in AWS | Review with `terraform plan`, then apply or import |

## Production Deployment Checklist

- [ ] S3 backend configured with encryption
- [ ] State locking enabled
- [ ] Provider versions pinned
- [ ] Sensitive variables marked as `sensitive = true`
- [ ] Secrets stored in AWS Secrets Manager
- [ ] Default tags configured on provider
- [ ] VPC using private subnets for sensitive resources
- [ ] Security groups follow least privilege
- [ ] CloudWatch logging enabled
- [ ] `.terraform/` and `*.tfstate` in `.gitignore`
