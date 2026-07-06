# Voice AI on Nova Sonic — AI-DLC Starter Pack

A pre-configured Kiro workspace for building **real-time voice AI agents** on AWS with **Amazon Nova Sonic** (speech-to-speech on Amazon Bedrock) — including migrating an existing text/chatbot agent to voice — driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

Open this folder in Kiro. The agent picks up the steering files automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

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

## What's in this pack

```
voice-ai-on-nova-sonic/
├── .kiro/
│   ├── steering/                       # Always-on agent rules
│   │   ├── decision-driven-specs.md        # Phase 0 → Requirements → Design → Tasks
│   │   ├── reverse-engineering.md          # Phase 0 analysis playbook (brownfield)
│   │   └── skill-mcp-activation.md         # When to activate skills + MCP
│   ├── settings/mcp.json               # AWS Knowledge MCP + AWS Docs MCP
│   └── skills/                         # Curated Nova Sonic voice-AI skills
│       ├── text-agent-to-nova-sonic-voice/   # SKILL.md + references/ + examples/ (langchain, openai, custom)
│       ├── nova-sonic-best-practices/        # SKILL.md
│       └── nova-sonic-optimization/          # SKILL.md
└── (aidlc-docs/ and .kiro/specs/ are created by the agent during the workflow)
```

### Steering

| File | What it does |
|---|---|
| `decision-driven-specs.md` | The workflow. Optional **Phase 0: Reverse Engineering** for brownfield codebases, then `Requirements → Design → Tasks`, each gated by a `_decisions-*.md` file. The agent never produces a spec document until you've filled in your decisions. |
| `reverse-engineering.md` | Phase 0 playbook — which artifacts to produce when analyzing an existing codebase (business overview, architecture, API docs, code quality, bounded contexts, modernization readiness). |
| `skill-mcp-activation.md` | Tells the agent which skills and MCP tools to activate, and when. |

### MCP servers (`.kiro/settings/mcp.json`)

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, and **regional availability of Nova Sonic / Bedrock models**, current API behavior. |
| **AWS Docs** (`aws-documentation-mcp-server`) | Fallback documentation search/read when the AWS Knowledge MCP returns nothing useful. |

> Both MCP servers launch via `uvx` and need no credentials. For any AWS operations or deploys the agent runs locally, make sure you have valid AWS credentials configured.

### Skills

Skills are curated, domain-specific knowledge bundles the agent activates on demand. See [Credits & attribution](#credits--attribution) for sources and licensing.

| Skill | Activates when… |
|---|---|
| `text-agent-to-nova-sonic-voice` | Migrating an existing text/chatbot agent to real-time voice — frontend WebSocket audio client + FastAPI/Strands `BidiAgent` orchestrator. Ships before/after migration examples for **LangChain**, **OpenAI**, and **custom (Bedrock Converse)** agents, plus client/server/deployment references. |
| `nova-sonic-best-practices` | Designing a new Nova Sonic voice agent — when to choose speech-to-speech vs STT→LLM→TTS, voice-first prompt design, tool calling for voice, conversation UX (barge-in, confirmation, turn-taking), voice selection |
| `nova-sonic-optimization` | Reducing voice latency and cost — per-segment latency measurement, same-region co-location, streaming end-to-end, hiding tool latency, prompt trimming, and multi-region reliability |

## Getting started

1. Open this folder in Kiro.
2. No MCP configuration is required — the AWS Knowledge and AWS Docs MCP servers are launched via `uvx` and need no credentials. For any AWS operations or deploys the agent runs locally, ensure you have valid AWS credentials. Confirm **Nova Sonic model availability in your target region** via the AWS Knowledge MCP during design.
3. **(For brownfield / Phase 0)** Make any existing codebase (the current chat/CRM/agent stack) available to the agent: clone it into a gitignored folder, symlink your local checkout, or point the agent at an absolute path when it asks.
4. Start a conversation. Try:
   - *"Convert this text agent to a Nova Sonic voice agent."*
   - *"Let's start the AI-DLC workflow. I want to add a real-time voice channel to an existing chat platform."*
   - *"Design a Nova Sonic voice agent and help me hit sub-second perceived latency."*

The workflow creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions. The `.kiro/specs/` and `aidlc-docs/` directories are created by the agent on the first run.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- [Git](https://git-scm.com/downloads) (for branches and any existing-codebase clone)
- AWS credentials configured for any local AWS operations or deploys (not needed for the MCP servers), with access to **Amazon Bedrock / Nova Sonic** in your chosen region
- [`uvx`](https://docs.astral.sh/uv/) available on your PATH (used to launch the AWS Knowledge and AWS Docs MCP servers)
- For running the generated voice agent locally: Python 3, plus the `portaudio` system library (`brew install portaudio` on macOS; `apt-get install -y portaudio19-dev` on Debian/Ubuntu)

## Credits & attribution

- The `text-agent-to-nova-sonic-voice`, `nova-sonic-best-practices`, and `nova-sonic-optimization` skills are quick-reference guides authored for this pack. They build on patterns from the [**Amazon Nova samples**](https://github.com/aws-samples/amazon-nova-samples) and the [**Strands Agents SDK**](https://github.com/strands-agents/sdk-python) (`BidiAgent` / `BidiNovaSonicModel`). Refer to those upstream projects for the latest APIs and their `LICENSE`/`NOTICE` files.
- AI-DLC steering is adapted from [**awslabs/aidlc-workflows**](https://github.com/awslabs/aidlc-workflows) (MIT-0).
