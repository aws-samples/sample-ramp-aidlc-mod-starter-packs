---
name: property-based-testing-guide
description: How to think about and write correctness properties and property-based tests. Use when defining properties in design docs or implementing property tests.
---

# Property-Based Testing (PBT) Guide

How to think about and write correctness properties and property-based tests. Reference when defining properties in a design doc or implementing property tests.

## What PBT Is

Instead of asserting behavior on a few hand-picked examples, you state a **property** — a rule that must hold for *all* valid inputs — and the framework generates hundreds of random inputs to try to falsify it. When it finds a failing case, it **shrinks** it to a minimal counterexample.

PBT complements example-based testing; it does not replace it. Use examples for specific known cases and integration points; use properties for universal invariants.

## The Three Artifacts of Spec-Driven PBT

1. A **specification** including human-readable correctness properties.
2. A working **implementation** that conforms to the spec.
3. A **test suite** providing evidence the implementation obeys the properties.

The reference design is a strong model: 22 numbered properties, each mapped to the requirements it validates, each with a generator strategy.

## Writing Good Properties

A property is a formal statement of what the system should always do. Common patterns:

- **Invariants**: something always true. *"A session with N pages, after adding a page, has N+1 pages and retains all originals."*
- **Round-trip / inverse**: `decode(encode(x)) == x`. *"Export then re-import yields the same record."*
- **Idempotency**: applying twice equals applying once. *"Re-processing the same page yields the same result."*
- **Commutativity / order-independence**: *"Per-page layout inference is independent — reordering pages doesn't change any page's result."*
- **Oracle / model-based**: compare against a simpler reference implementation.
- **Metamorphic**: a known change in input produces a known change in output. *"Doubling a quantity doubles that line total."*
- **Conservation**: *"Order total equals the sum of line totals."*

### How to derive properties from requirements

For each requirement, ask: "What must be true for *every* valid input, not just my examples?" Phrase it as *"For any X, the system SHALL Y."* Then map it back to the requirement IDs it validates (traceability).

## Writing the Tests

**Suggested libraries:** [Kotest Property Testing](https://kotest.io/docs/proptest/property-based-testing.html) (Kotlin). Backend TypeScript Lambdas use [fast-check](https://fast-check.dev/).

Guidelines:

- **Run enough iterations.** Minimum 100 per property is a good default. More for cheap properties.
- **Write generators that cover the valid input space**, including boundaries: empty collections, single elements, large collections, zero/negative/max numbers, nulls where allowed.
- **Test the boundary explicitly.** For threshold logic (confidence below/at/above threshold), make sure generated values straddle the threshold.
- **Keep properties deterministic.** Same input → same result. Seed the RNG so failures reproduce.
- **Assert the property, not the implementation.** Don't reimplement the code inside the test.
- **Let shrinking work for you.** When a test fails, the minimal counterexample usually points straight at the bug.

### Kotest sketch

```kotlin
class SessionPropertyTest : StringSpec({
    "adding a page yields N+1 pages and retains originals" {
        checkAll(sessionArb(minPages = 0, maxPages = 50), pageArb()) { session, newPage ->
            val result = session.addPage(newPage)
            result.pages.size shouldBe session.pages.size + 1
            result.pages.dropLast(1) shouldBe session.pages
        }
    }
})
```

## Bug-Condition PBT (for bugfix specs)

When fixing a bug, first write an **exploration property test** that encodes the bug condition C(X) — the property that *should* hold but currently doesn't.

- The test is **expected to FAIL on unfixed code** — that failure confirms the bug exists and gives you a minimal counterexample.
- After the fix, the same test should **pass** (fix check), and previously passing properties should **still pass** (preservation check).
- If an exploration test passes unexpectedly on unfixed code, the property or the root-cause hypothesis is wrong — re-investigate before coding a fix.

## Common Pitfalls

- Generators too narrow → properties pass vacuously. Verify your generators actually produce diverse, boundary-hitting data.
- Properties that just restate the implementation → no real signal.
- Flaky properties from hidden nondeterminism (time, randomness, ordering) → inject and control those inputs.
- Floating-point equality → use tolerances; use `BigDecimal` for money.
