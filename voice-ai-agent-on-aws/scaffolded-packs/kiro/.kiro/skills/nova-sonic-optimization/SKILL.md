---
name: nova-sonic-optimization
description: "Optimize a Nova Sonic voice agent for low latency, cost, and reliability on AWS. Covers (1) measuring end-to-end and per-segment latency, (2) same-region deployment and network path tuning, (3) streaming inference and tool-call patterns that hide latency, (4) cost levers (provisioned vs on-demand, voice pricing), and (5) reliability across multiple regions. TRIGGER when: user wants to reduce voice latency; user mentions Groq-class responsiveness; user asks about same-region deployment, streaming, or cold start; user wants to control Nova Sonic cost. SKIP when: user is designing a new agent for the first time (use nova-sonic-best-practices); user is migrating from text (use text-agent-to-nova-sonic-voice)."
---

# Nova Sonic — Latency, Cost, and Reliability Optimization

The realistic latency target for an AWS-native voice agent is **300–700 ms perceived response time** for the inference segment, comparable to what teams typically see from Groq for STT+LLM. Hitting that requires deliberate choices across the stack.

## Step 1 — Measure before you optimize

Instrument these per turn and log them:

| Segment | What to measure |
|---------|-----------------|
| Mic → server | WebSocket / WebRTC RTT |
| Server → Bedrock first audio frame | Time from final user audio frame to first Sonic audio frame out |
| Tool call duration | Per tool, p50 and p95 |
| Server → client first audio frame | WebSocket send to browser playback |
| End-to-end | User stops talking → user hears first response audio |

A simple per-segment log per turn is enough to find the bottleneck. Don't optimize blind.

## Step 2 — Co-locate everything in the same Region

Cross-region hops add 50–200 ms each. For a sub-second target, every component should be in the same Region.

| Component | Recommendation |
|-----------|----------------|
| Bedrock (Nova Sonic) | Pick the Region with Sonic available and lowest user RTT (commonly `us-east-1`) |
| FastAPI / BidiAgent server | Same Region as Bedrock (ECS Fargate, EKS, or EC2) |
| RAG vector store | Same Region; OpenSearch Serverless or Aurora pgvector |
| CRM / tool backends | Same Region or behind a low-latency cache |
| Client → server entry | CloudFront or Global Accelerator for global users |

For multi-region (your `us-east-2` primary, `us-east-1` and `ap-southeast-1` secondary): pin each user to their nearest Region via Route 53 latency routing. Don't cross Regions mid-session.

## Step 3 — Stream everything, buffer nothing

The single biggest win is treating the pipeline as a stream, not a batch.

- **Mic → server:** Send PCM frames as they arrive (20–40 ms chunks). Don't wait for end-of-utterance.
- **Server → Bedrock:** Use the bidirectional streaming API (Strands BidiAgent does this). Frames flow as the user speaks; Sonic emits responses as soon as it has tokens.
- **Bedrock → server → client:** Forward each Sonic audio chunk to the browser the moment you receive it. Don't accumulate.
- **Browser playback:** Queue chunks into an `AudioBuffer` or MediaSource; start playing on the first chunk.

If you ever find yourself buffering "until done" anywhere in the chain, you've added latency equal to the response length.

## Step 4 — Hide tool latency

Tools are the most common cause of the dreaded mid-sentence pause.

### Pattern A — Pre-announce slow tools

```python
@tool
def lookup_order(order_id: str) -> str:
    """Look up an order. Slow tool — the agent should say 'One moment' before calling."""
    ...
```

Reinforce in the system prompt: *"Before calling lookup_order, say 'Let me pull that up.'"* Sonic generates that filler audio while the tool runs.

### Pattern B — Parallel tool calls

If you need two pieces of data, fire both tools in parallel. Strands handles concurrent tool execution.

### Pattern C — Cache aggressively

For tools with stable answers (business hours, pricing, FAQs), cache in-process or in ElastiCache. Most repeat questions in a single session don't need a backend hit.

### Pattern D — Prefetch on intent

If the user says "I'd like to cancel order 12345" you can fire `lookup_order` *before* the confirmation step, so by the time they say "yes" the data is already in hand.

## Step 5 — Trim the prompt and tool surface

- **System prompt < 500 words.** Long prompts increase time-to-first-token.
- **Tool count < ~10 per agent.** Each extra tool adds tokens to every turn. Split agents by domain if you need more.
- **Tool descriptions short and intent-focused.** "Use this when the customer asks about their balance" beats a 200-word spec.
- **No few-shot examples in the system prompt** unless absolutely necessary. They cost tokens on every turn.

## Step 6 — Connection and warmup

- **Pre-warm the Bedrock connection.** On server startup, open a Sonic stream with a no-op so the TLS handshake and CRT client are ready.
- **Reuse HTTP connections to tool backends.** Use a keep-alive `httpx.AsyncClient` instance, not per-call clients.
- **Persistent WebSocket from browser.** Don't tear down the WS between turns.

## Cost levers

Nova Sonic on Bedrock is priced per second of audio input + per second of audio output (and a token rate for the underlying LLM). Levers:

| Lever | Effect |
|-------|--------|
| Shorter responses (1–2 sentences) | Lower output-audio-seconds per turn |
| Aggressive endpointing / VAD | Lower input-audio-seconds (don't stream silence) |
| Cache on tool layer | Fewer tokens through Sonic for stable answers |
| Right-size compute (ECS Fargate task size) | Don't over-provision orchestrator |
| Same-Region traffic | Eliminate inter-Region data transfer charges |
| Provisioned Throughput (only at scale) | Predictable cost for steady high-volume traffic; not worth it < ~hundreds of concurrent sessions |

Set a CloudWatch alarm on Bedrock invocation count and audio-seconds per session so cost outliers (runaway loops, stuck sessions) get flagged.

## Reliability across regions

- **Active-active across two Regions** with Route 53 latency routing for the entry point.
- **Stateless orchestrator** — push session state into DynamoDB Global Tables or ElastiCache (Region-local) so a failover doesn't lose context.
- **Idempotent tool calls** — every tool should be safe to retry.
- **Circuit-break slow backends** so a downstream CRM outage doesn't pin the agent.
- **Fallback voice** — if Sonic is unavailable in the primary Region, fall back to STT (Transcribe) + Bedrock LLM + Polly in a secondary Region. Higher latency but the call survives.

## Quick checklist

Before going live:

- [ ] Per-segment latency logging in place
- [ ] Server, Bedrock, RAG store, tool backends all in same Region
- [ ] Streaming end-to-end (no buffering anywhere)
- [ ] Bedrock connection pre-warmed at server start
- [ ] System prompt < 500 words
- [ ] Tool count < 10, descriptions short
- [ ] Cache on stable tools
- [ ] CloudWatch alarms on invocation count and audio-seconds
- [ ] Active-active in 2+ Regions with Route 53 latency routing
- [ ] Fallback path defined for Bedrock outage

## References

- [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)
- [Amazon Nova samples](https://github.com/aws-samples/amazon-nova-samples)
- Companion skills: [nova-sonic-best-practices](../nova-sonic-best-practices/SKILL.md), [text-agent-to-nova-sonic-voice](../text-agent-to-nova-sonic-voice/SKILL.md)
