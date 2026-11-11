---
name: nova-sonic-best-practices
description: "Best practices for building a Nova Sonic speech-to-speech voice agent on AWS. Covers (1) when to choose Nova Sonic over a STT→LLM→TTS pipeline, (2) voice-first system prompt design, (3) tool calling for voice, (4) conversation UX patterns (barge-in, confirmation, disfluencies), and (5) common pitfalls. TRIGGER when: user is designing a new Nova Sonic voice agent; user asks how to write a voice prompt; user asks about speech-to-speech vs STT→LLM→TTS; user asks about tool calling, barge-in, or voice UX with Nova Sonic. SKIP when: user is migrating an existing text agent (use text-agent-to-nova-sonic-voice instead); user is debugging latency or cost (use nova-sonic-optimization instead)."
---

# Nova Sonic Voice Agent — Best Practices

Amazon Nova Sonic is a unified speech-to-speech foundation model on Amazon Bedrock. It takes audio in and emits audio plus text out in a single bidirectional stream — no separate STT and TTS hops. Use this skill when designing a new voice agent or hardening an existing one.

## When to use Nova Sonic vs. STT → LLM → TTS

| Choose Nova Sonic when                          | Choose STT → LLM → TTS when                                       |
| -------------------------------------------------| -------------------------------------------------------------------|
| You want one AWS-native model on Bedrock        | You need a specific non-Sonic LLM (e.g. Claude, custom fine-tune) |
| Latency must be conversational (< 1s perceived) | Latency budget is generous (> 2s is fine)                         |
| You want natural prosody, expressive voice      | You only need flat TTS playback                                   |
| You can fit logic into Sonic + tool calls       | You have heavy multi-step rea that needs a frontier text model    |

A common hybrid: Nova Sonic for the live conversation, with tools that call Claude/Bedrock Knowledge Bases for deep reasoning or RAG.

## Architecture at a glance

```
Browser ── WebRTC/WebSocket ──▶ FastAPI / Strands BidiAgent ──▶ Nova Sonic (Bedrock)
                                          │
                                          ├── @tool: knowledge_search (Bedrock KB)
                                          ├── @tool: crm_lookup (HTTP)
                                          └── @tool: get_time, etc.
```

Use Strands `BidiAgent` + `BidiNovaSonicModel` (see [text-agent-to-nova-sonic-voice](../text-agent-to-nova-sonic-voice/SKILL.md)) — it handles the bidirectional event stream, audio framing, tool dispatch, and barge-in for you.

## Voice-first system prompt design

A prompt that works for text will sound robotic in voice. Rewrite for the ear, not the eye.

### Core rules

1. **Speak in 1–2 sentences per turn.** Long monologues kill the conversational feel.
2. **Never mention formatting.** No "here's a bulleted list", no JSON, no markdown.
3. **Spell out numbers, currency, dates.** "fifteen thousand two hundred dollars" not "$15,200".
4. **Add disfluencies and acknowledgments.** "Sure thing.", "Let me check that for you.", "One moment."
5. **Always greet, always close.** "Hello, this is [Service]. How can I help?" → "Thanks for calling. Have a great day."
6. **Confirm before acting.** Repeat key details back before any tool call that mutates state.
7. **Handle the unhearable.** "I'm sorry, could you say that again?" beats silence.

### Template

```
You are [Persona] for [Company]. You speak with customers over the phone.

Style:
- Speak naturally. Keep each response to one or two sentences.
- Never mention formatting, JSON, or punctuation.
- Spell out numbers and currency in words.
- Use brief acknowledgments: "Sure thing.", "One moment.", "Got it."
- If you don't understand: "I'm sorry, could you say that again?"

Greeting:
- Start with: "Hi, this is [Persona] from [Company]. How can I help today?"

Confirmation:
- Before any change, repeat the details back: "I'll [action] for [details]. Is that correct?"
- Wait for a yes before calling the tool.

Closing:
- After helping: "Is there anything else I can help with?"
- End: "Thanks for calling [Company]. Have a great day."
```

Keep the full prompt under ~500 words. Push detail into tool descriptions, not the system prompt.

## Tool calling for voice

Tools work the same as in text agents but the **return shape matters**. Nova Sonic will read the tool result aloud to the user (or use it to formulate a spoken response). So:

- **Return clean natural-language strings**, not JSON. "Your balance is one hundred fifty-two dollars." beats `{"balance": 152.00}`.
- **Keep results short.** A 200-token tool response will be summarized anyway and adds latency.
- **Name and describe tools for voice intent.** A tool called `lookup_account_by_phone` is clearer to the model than `get_acct`.
- **Mark slow tools.** If a tool takes > 500ms, have the agent say "One moment" before the call.

```python
from strands import tool

@tool
def get_balance(account_id: str) -> str:
    """Get the current balance for a customer account.

    Use this when the customer asks about their balance, how much they owe, or how much is in their account.

    Args:
        account_id: The customer's account number.
    """
    balance = db.get_balance(account_id)
    return f"The current balance is {amount_to_words(balance)}."
```

## Conversation UX patterns

### Barge-in

Nova Sonic supports interruption natively when used via Strands BidiAgent. The user can speak over the agent and the agent will stop talking. You don't need to wire this manually — just don't suppress incoming audio while the agent is speaking.

### Turn-taking and silence

- Use VAD (Silero on the client, or rely on Sonic's built-in endpointing on the server) to detect end-of-utterance.
- If the user goes silent mid-conversation, prompt gently: "Are you still there?"
- Don't fill every gap. A short pause feels natural.

### Confirmation patterns

For any state-mutating action:

```
User: "Cancel my appointment for tomorrow."
Agent: "Just to confirm, you'd like to cancel your appointment on [date] at [time]. Is that right?"
User: "Yes."
Agent: → calls cancel_appointment tool
Agent: "Done. Your appointment has been canceled."
```

### Multi-turn information gathering

Don't ask for everything at once. Voice is sequential.

❌ "Can I get your account number, date of birth, and the last four of your card?"
✅ "Sure. Can I start with your account number?" → wait → "Thanks. And your date of birth?"

## Voice selection

Nova Sonic ships with several voices. Pick based on persona and locale:

| Voice     | Locale | Tone                     |
| -----------| --------| --------------------------|
| `matthew` | en-US  | Warm, professional, male |
| `tiffany` | en-US  | Friendly, female         |
| `amy`     | en-GB  | Calm, female             |

Match the voice to the brand. Don't switch voices mid-session.

## Knowledge / RAG integration

For knowledge lookups, expose a tool that hits a Bedrock Knowledge Base or your existing pgvector store:

```python
@tool
def knowledge_search(question: str) -> str:
    """Search the company knowledge base for the answer to a question.

    Use this when the customer asks about policies, products, hours, or anything you don't already know.

    Args:
        question: The customer's question, paraphrased if needed.
    """
    docs = kb.retrieve(question, top_k=3)
    return summarize_for_speech(docs)  # short, natural-language answer
```

Keep the summary short and spoken-style. If you return three paragraphs, Sonic will try to read all of it.

## Common pitfalls

| Pitfall                                     | Fix                                                                |
| ---------------------------------------------| --------------------------------------------------------------------|
| Agent reads JSON or markdown aloud          | Strip formatting from tool returns; reinforce in system prompt     |
| Sample rate mismatch produces garbled audio | Nova Sonic requires 16 kHz PCM for both input and output           |
| Long prompt → slow first token              | Keep system prompt < 500 words; push detail into tool descriptions |
| Tool result too long → agent monologues     | Return 1–2 sentences from each tool                                |
| No greeting → user thinks call dropped      | Always send an opening line on session start                       |
| Silence after tool call                     | Have the agent say "One moment" before slow tools                  |
| Numbers read as digits                      | Pre-format numbers/currency to words in tool returns               |

## References

- [Amazon Nova samples](https://github.com/aws-samples/amazon-nova-samples)
- [Strands Agents BidiAgent](https://github.com/strands-agents/sdk-python)
- Companion skills: [text-agent-to-nova-sonic-voice](../text-agent-to-nova-sonic-vsoning                               |