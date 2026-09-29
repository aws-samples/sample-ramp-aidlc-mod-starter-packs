# Voice AI Agent on AWS with Nova Sonic — AI-DLC Starter Pack

A **tool-agnostic** starter pack for building **real-time voice AI agents** on AWS with **Amazon Nova Sonic** (speech-to-speech on Amazon Bedrock) — including migrating an existing text/chatbot agent to voice — driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use gains deep Nova Sonic voice AI expertise and follows structured, decision-gated workflows — no manual setup needed.

## Use case

Adding a **real-time voice channel** on top of an existing text/chat platform (e.g. an AI chatbot, CRM, and AI-assisted workflow stack). A user speaks; the system reasons and responds in natural voice with sub-second perceived latency, sharing context and back-office integrations with the existing chat experience.

The pack supports two entry points:

- **Migrate an existing text agent to voice** — take a text/chatbot agent's system prompt and tools (LangChain, OpenAI function-calling, Bedrock Converse, or custom) and run them as a live speech-to-speech agent via **Strands `BidiAgent` + Amazon Nova Sonic**.
- **Design a new Nova Sonic voice agent** — speech-to-speech architecture, voice-first prompt design, tool calling for voice, and conversation UX (barge-in, confirmation, turn-taking).

It is deliberately **stack-flexible** on the surrounding pieces:

- **Voice model** — Amazon Nova Sonic speech-to-speech, or a classic **STT → LLM → TTS** pipeline (Amazon Transcribe / Bedrock / Polly, or third-party providers) when a non-Sonic LLM is required. The design phase decides.
- **Orchestrator** — FastAPI + Strands BidiAgent over WebSocket/WebRTC.
- **Knowledge / RAG** — Amazon Bedrock Knowledge Bases, OpenSearch Serverless, or Aurora pgvector.
- **Deployment** — single or multi-region (latency-routed), on containers (ECS/Fargate, EKS) or EC2.

It works for **greenfield** builds and **brownfield** extensions alike — when an existing codebase (e.g. the current chat/CRM stack) is present, the workflow runs a reverse-engineering pass (Phase 0) first.

## Getting started

Pick **one** of the two ways to add this pack to your project.

### Option A — copy a pre-built folder (no tooling)

Pre-generated, tool-correct configs live under [`scaffolded-packs/`](scaffolded-packs/). Copy the folder for your tool into your project root:

| Your tool | Copy from | Into your project |
|---|---|---|
| **Kiro** | `scaffolded-packs/kiro/` | `.kiro/` |
| **Claude Code** | `scaffolded-packs/claude-code/` | `CLAUDE.md`, `.claude/`, `.mcp.json` |
| **GitHub Copilot** | `scaffolded-packs/copilot/` | `.github/`, `.vscode/mcp.json` |
| **Cursor** | `scaffolded-packs/cursor/` | `.cursor/` |

### Option B — generate it (installer)

Run the `ramp-pack` installer from the repo root; it reads the neutral source and writes the correct layout into your target project:

```bash
node installer/bin/ramp-pack.js init voice-ai-agent-on-aws --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. Open the project in your tool and start a conversation. Try:
   - *"Convert this text agent to a Nova Sonic voice agent."*
   - *"Let's start the AI-DLC workflow. I want to add a real-time voice channel to an existing chat platform."*
   - *"Design a Nova Sonic voice agent and help me hit sub-second perceived latency."*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.
2. **(For brownfield / Phase 0)** Make any existing codebase (the current chat/CRM/agent stack) available to the agent: clone it into a gitignored folder, symlink your local checkout, or point the agent at an absolute path when it asks.
3. Confirm **Nova Sonic model availability in your target region** via the AWS Knowledge MCP during design.

The workflow creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions.

## What's in this pack

```
voice-ai-agent-on-aws/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Decision-gated Requirements → Design → Tasks (primary)
│   ├── skill-activation.md       # When to activate skills + MCP (companion, always)
│   └── reverse-engineering.md    # Phase 0 playbook (companion, brownfield-only)
├── skills/                   # Nova Sonic voice AI expertise
│   ├── text-agent-to-nova-sonic-voice/   # SKILL.md + references/ + examples/ (langchain, openai, custom)
│   ├── nova-sonic-best-practices/        # SKILL.md
│   └── nova-sonic-optimization/          # SKILL.md
└── scaffolded-packs/         # Pre-generated per-tool configs (Option A above)
    ├── kiro/         # .kiro/{steering,settings,skills}
    ├── claude-code/  # CLAUDE.md, .claude/{rules,commands,skills}, .mcp.json
    ├── copilot/      # .github/{copilot-instructions.md,instructions,prompts,skills}, .vscode/mcp.json
    └── cursor/       # .cursor/{rules,skills}, .cursor/mcp.json
```

> `instructions/`, `skills/`, and `pack.yaml` are the **neutral source** you edit. `scaffolded-packs/` is **generated** from them by the installer — regenerate it after editing the source; don't hand-edit the scaffolded output.

### How each instruction maps per tool

The neutral instructions declare a **role** (`primary` / `companion`) and a **load** rule (`always` / `auto`); the installer renders each into the target tool's native mechanism:

| Neutral role | Kiro | Claude Code | Copilot | Cursor |
|---|---|---|---|---|
| `aidlc-workflow` (primary) | `.kiro/steering/*` `inclusion: always` | `CLAUDE.md` | `.github/copilot-instructions.md` | `.cursor/rules/*.mdc` `alwaysApply: true` |
| `skill-activation` (always) | `inclusion: always` | `.claude/rules/*` | `.github/instructions/*` `applyTo: '**'` | `.mdc` `alwaysApply: false` |
| `reverse-engineering` (auto) | `inclusion: auto` | `.claude/rules/*` | `.github/instructions/*` (conditional) | `.mdc` `alwaysApply: false` |
| `/aidlc` command | — | `.claude/commands/aidlc.md` | `.github/prompts/aidlc.prompt.md` | — |

### Skills — Nova Sonic Voice AI

Three domain-specific skills activate when your conversation mentions Nova Sonic, voice agents, speech-to-speech, or text-to-voice migration. Each bundles `SKILL.md` plus reference/example materials and follows the [Agent Skills open standard](https://agentskills.io/), so it copies verbatim into every supported tool.

| Skill | Activates when… |
|---|---|
| `text-agent-to-nova-sonic-voice` | Migrating an existing text/chatbot agent to real-time voice — frontend WebSocket audio client + FastAPI/Strands `BidiAgent` orchestrator. Ships before/after migration examples for **LangChain**, **OpenAI**, and **custom (Bedrock Converse)** agents, plus client/server/deployment references. |
| `nova-sonic-best-practices` | Designing a new Nova Sonic voice agent — when to choose speech-to-speech vs STT→LLM→TTS, voice-first prompt design, tool calling for voice, conversation UX (barge-in, confirmation, turn-taking), voice selection |
| `nova-sonic-optimization` | Reducing voice latency and cost — per-segment latency measurement, same-region co-location, streaming end-to-end, hiding tool latency, prompt trimming, and multi-region reliability |

### MCP servers

Declared once in `pack.yaml`; the installer writes them to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, and **regional availability of Nova Sonic / Bedrock models**, current API behavior. Used proactively when validating best practices or when you question a recommendation. |
| **AWS Docs** (`aws-documentation-mcp-server`) | Fallback documentation search/read when the AWS Knowledge MCP returns nothing useful. |

> Both MCP servers launch via `uvx` and need no credentials. For any AWS operations or deploys the agent runs locally, ensure you have valid AWS credentials configured.

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- [`uvx`](https://docs.astral.sh/uv/) available on your PATH (used to launch the AWS Knowledge and AWS Docs MCP servers).
- AWS credentials configured for any local AWS operations or deploys (not needed for the MCP servers), with access to **Amazon Bedrock / Nova Sonic** in your chosen region.
- For running the generated voice agent locally: Python 3, plus the `portaudio` system library (`brew install portaudio` on macOS; `apt-get install -y portaudio19-dev` on Debian/Ubuntu).

## Credits & attribution

- The `text-agent-to-nova-sonic-voice`, `nova-sonic-best-practices`, and `nova-sonic-optimization` skills are quick-reference guides authored for this pack. They build on patterns from the [**Amazon Nova samples**](https://github.com/aws-samples/amazon-nova-samples) and the [**Strands Agents SDK**](https://github.com/strands-agents/sdk-python) (`BidiAgent` / `BidiNovaSonicModel`). Refer to those upstream projects for the latest APIs and their `LICENSE`/`NOTICE` files.
- AI-DLC steering is adapted from [**awslabs/aidlc-workflows**](https://github.com/awslabs/aidlc-workflows) (MIT-0).
