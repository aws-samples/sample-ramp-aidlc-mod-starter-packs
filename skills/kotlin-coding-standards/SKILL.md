---
name: kotlin-coding-standards
description: Conventions for clean, idiomatic, safe Kotlin. Use when writing or reviewing Kotlin code.
---

# Kotlin Coding Standards

Conventions for clean, idiomatic, safe Kotlin. Reference when writing or reviewing Kotlin code.

## Style & Naming

- Follow the [official Kotlin coding conventions](https://kotlinlang.org/docs/coding-conventions.html).
- `PascalCase` for types, `camelCase` for functions/properties, `UPPER_SNAKE_CASE` for compile-time constants.
- Prefer descriptive names over comments. Names should make intent obvious.
- Keep functions short and single-purpose. If a function needs a section comment, consider extracting it.

## Null Safety

- Embrace non-null types. Avoid `!!` — it defeats the purpose of Kotlin's null safety.
- Use `?.`, `?:`, `let`, and `requireNotNull`/`checkNotNull` (with messages) instead of force unwraps.
- Model "absence" explicitly with nullable types or sealed results, not sentinel values.

## Immutability & Data

- Prefer `val` over `var`. Prefer immutable collections (`List`, `Map`) over mutable ones in public APIs.
- Use `data class` for value-holding types; use `copy()` for derived state.
- Use `sealed class`/`sealed interface` for closed type hierarchies (e.g., UI state, results). They make `when` exhaustive and self-documenting.
- Use `enum class` for fixed sets of constants (the reference design uses these well: `SessionStatus`, `FlagReason`, etc.).

## Functions & Expressions

- Favor expression bodies for simple functions: `fun total() = qty * price`.
- Use default and named arguments instead of overloads.
- Use extension functions to add focused behavior without inheritance — but keep them discoverable.
- Use scope functions (`let`, `run`, `apply`, `also`, `with`) intentionally; don't nest them into unreadable chains.

## Error Handling

- Use exceptions for truly exceptional cases; use sealed result types (`Result<T>` or a custom `sealed interface`) for expected failure paths (e.g., upload failed, match not found).
- Always include a message in `require`/`check`/`error`.
- Never swallow exceptions silently. Log with context (session id, page number) as the reference error-handling design specifies.

## Coroutines & Concurrency

- Respect structured concurrency: launch in a defined scope (`viewModelScope`, `coroutineScope`).
- Inject dispatchers (don't hardcode `Dispatchers.IO`) so code is testable.
- Make suspend functions main-safe: a suspend function should be safe to call from the main thread and switch dispatchers internally as needed.
- Use `Flow` for streams; keep operators pure and side-effect-free except in terminal operators.

## Money & Numbers

- Use `BigDecimal` for monetary values (the reference design does this for line totals and order totals). Never use `Float`/`Double` for money.
- Be explicit about rounding mode and scale when comparing computed vs printed totals.

## Dependency Injection

- Use Hilt for DI on Android. Constructor-inject dependencies; avoid service locators and global singletons.
- Inject interfaces, not concrete classes, so components are swappable and testable.

## Documentation

- Use KDoc for public APIs and non-obvious behavior. Document the "why," not the "what."
- Keep interface contracts (like those in the reference design) documented so JSON/boundary contracts stay clear across languages.
