#!/bin/bash
# Setup script for Kiro AI-DLC + Skills + MCP
# Installs steering files, skills, and MCP configuration into a target project

set -e

TARGET_DIR="${1:-.}"

echo "=== Kiro Development Environment Setup ==="
echo "Target: $TARGET_DIR"
echo ""

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- 1. Skills ---
echo "[1/3] Installing Kiro skills..."
mkdir -p "$TARGET_DIR/.kiro/skills"
cp -R "$SCRIPT_DIR/.kiro/skills/"* "$TARGET_DIR/.kiro/skills/"
echo "  ✓ Installed 5 skills: agentic-optimizer, terraform-skill, terraform-aws, aws-skills, iac"

# --- 2. MCP ---
echo "[2/3] Configuring MCP server..."
mkdir -p "$TARGET_DIR/.kiro/settings"
if [ -f "$TARGET_DIR/.kiro/settings/mcp.json" ]; then
  echo "  ⚠ mcp.json already exists — skipping (merge manually if needed)"
else
  cp "$SCRIPT_DIR/.kiro/settings/mcp.json" "$TARGET_DIR/.kiro/settings/mcp.json"
  echo "  ✓ AWS Knowledge MCP server configured"
fi

# --- 3. Steering ---
echo "[3/3] Installing steering files..."
mkdir -p "$TARGET_DIR/.kiro/steering"
cp "$SCRIPT_DIR/.kiro/steering/aidlc-decisions-approval.md" "$TARGET_DIR/.kiro/steering/"
echo "  ✓ Installed AI-DLC decision-driven steering"

# --- Optional: AI-DLC Core Workflow ---
if [ -d "$TARGET_DIR/.kiro/steering/aws-aidlc-rules" ]; then
  echo "  ⚠ AI-DLC core workflow already exists — skipping"
else
  echo ""
  echo "  [Optional] To also install the full AI-DLC core workflow:"
  echo ""
  echo "    curl -L -o /tmp/aidlc.zip https://github.com/awslabs/aidlc-workflows/releases/latest/download/aidlc-rules.zip"
  echo "    unzip -o /tmp/aidlc.zip -d /tmp/aidlc-rules"
  echo "    cp -R /tmp/aidlc-rules/aidlc-rules/aws-aidlc-rules $TARGET_DIR/.kiro/steering/"
  echo "    cp -R /tmp/aidlc-rules/aidlc-rules/aws-aidlc-rule-details $TARGET_DIR/.kiro/"
  echo ""
  echo "  More info: https://github.com/awslabs/aidlc-workflows"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Your project structure:"
echo "  $TARGET_DIR/"
echo "  └── .kiro/"
echo "      ├── settings/"
echo "      │   └── mcp.json                        # AWS Knowledge MCP server"
echo "      ├── steering/"
echo "      │   ├── aidlc-decisions-approval.md      # Decision-driven spec workflow"
echo "      │   └── aws-aidlc-rules/                 # AI-DLC core workflow (optional)"
echo "      └── skills/"
echo "          ├── agentic-optimizer/               # Agentic AI pattern optimizer"
echo "          ├── terraform-skill/                 # Terraform best practices"
echo "          ├── terraform-aws/                   # Terraform AWS patterns"
echo "          ├── aws-skills/                      # AWS architecture guidance"
echo "          └── iac/                             # IaC best practices"
echo ""
echo "Open the project in Kiro to start using the skills and steering."
