# Mocking Collaborators with Moq

Unit tests should exercise one unit in isolation. When the unit under test depends on collaborators (a repository, a clock, an HTTP client, a message publisher), replace those collaborators with test doubles so the test is fast, deterministic, and focused. Moq is the common library for this in .NET.

Design for testability first: depend on **interfaces** (or abstract types) injected via the constructor. You can only mock what you can substitute.

## Install

```bash
dotnet add Orders.Api.Tests package Moq
```

## Setup / Returns / Verify

```csharp
[Fact]
public void PlaceOrder_ChargesCustomer_AndPersists()
{
    // Arrange
    var payments = new Mock<IPaymentGateway>();
    payments.Setup(p => p.Charge(It.IsAny<decimal>()))
            .Returns(new Receipt(Success: true));
    var repo = new Mock<IOrderRepository>();
    var service = new OrderService(payments.Object, repo.Object);

    // Act
    service.PlaceOrder(new Order(amount: 42m));

    // Assert
    payments.Verify(p => p.Charge(42m), Times.Once);
    repo.Verify(r => r.Save(It.IsAny<Order>()), Times.Once);
}
```

- **`Setup(...).Returns(...)`** — define what a method returns when called. Use `ReturnsAsync` for `Task<T>`.
- **`Setup(...).Throws<T>()`** — simulate failure paths.
- **`Verify(...)`** — assert an interaction happened (or didn't) with `Times.Once`, `Times.Never`, `Times.Exactly(n)`.
- **Argument matchers** — `It.IsAny<T>()`, `It.Is<T>(x => x > 0)` to match on specific arguments.
- **Properties / setup chains** — `mock.SetupGet(x => x.Now).Returns(fixedTime)`; `mock.SetupSequence(...)` for successive calls.

## Stubs vs mocks vs fakes

These are all "test doubles" but serve different purposes — choose deliberately:

| Double | Purpose | In Moq / practice |
|---|---|---|
| **Stub** | Supplies canned answers so the SUT can run. You assert on the SUT's *output/state*, not on the stub. | `Setup(...).Returns(...)`, no `Verify`. |
| **Mock** | Verifies an *interaction* (a call was/ wasn't made) — behavior verification. | `Setup` + `Verify`. Use when the side effect *is* the requirement. |
| **Fake** | A lightweight working implementation (in-memory repo, `TimeProvider` fake). | Hand-written class, not Moq. Great for repositories/collections. |

Rule of thumb: assert on **state** where you can (stubs/fakes); use **interaction verification** (mocks) only when the observable behavior *is* the call itself (e.g. "an email must be sent", "the customer must be charged exactly once").

## Avoid over-mocking

Over-mocking couples tests to implementation and produces brittle, low-value tests. Watch for these smells:

- **Mocking types you own and could just construct.** If a value object or simple class is cheap to build, use the real thing.
- **Mocking every dependency reflexively.** Only substitute what makes the test slow, non-deterministic, or crosses a process/network boundary.
- **Asserting on internal call sequences** rather than outcomes — this re-encodes the implementation in the test and breaks on every refactor.
- **Deep mock chains** (`a.B.C.D` all mocked) — usually a design signal (Law of Demeter); prefer a fake or a redesign.
- **Mocking the .NET framework / third-party concrete classes.** Wrap them behind your own interface, then mock the interface.

Prefer real objects and fakes for the "hands" your code coordinates; reserve mocks for true external boundaries and mandated side effects.

## Sources
- Moq (devlooped/moq) — https://github.com/devlooped/moq
- Unit testing best practices — mocking, fakes and stubs (.NET) — https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices
