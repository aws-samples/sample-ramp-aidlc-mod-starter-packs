---
title: Android & Jetpack Compose Design Best Practices
inclusion: manual
---

# Android & Jetpack Compose Design Best Practices

Guidance for building modern, maintainable, accessible Android apps. Reference this when designing UI, structuring app modules, or reviewing Compose code.

## Architecture

- **Follow a layered architecture**: UI layer (Compose + ViewModel) → Domain layer (use cases, optional) → Data layer (repositories, data sources). Keep dependencies pointing inward.
- **Use unidirectional data flow (UDF)**: state flows down from ViewModel to UI; events flow up from UI to ViewModel. UI never mutates state directly.
- **One source of truth per piece of state.** Repositories own data; ViewModels expose UI state derived from it.
- **Prefer `StateFlow`/`MutableStateFlow`** for observable UI state over `LiveData` in new Compose code. Expose immutable `StateFlow`, keep `MutableStateFlow` private.
- **Modularize by feature** (`:capture`, `:upload`, `:review`) plus a shared `:core`. This keeps build times down and ownership clear — exactly the structure used in this pack's reference design.

## Jetpack Compose

- **Hoist state.** Composables should be stateless where possible: take state as parameters and emit events via lambdas. Keep `remember`/`mutableStateOf` at the lowest sensible level.
- **Keep composables small and focused.** A composable that does layout should not also fetch data.
- **Use `@Preview`** generously for fast iteration, including previews for different states (loading, error, empty, populated).
- **Avoid heavy work in composition.** No blocking I/O or expensive computation in the composable body; use `LaunchedEffect`, `remember`, or move it to the ViewModel.
- **Use keys in `LazyColumn`/`LazyRow`** (`items(list, key = { it.id })`) to preserve scroll position and animation correctness.
- **Respect recomposition.** Pass stable types; mark data classes used in UI as stable. Avoid passing lambdas that allocate on every recomposition where it matters.
- **Theme centrally** via `MaterialTheme` (Material 3). Define color, typography, and shape in one place; never hardcode colors or dimensions in screens.

## State & Lifecycle

- **Collect flows lifecycle-aware**: `collectAsStateWithLifecycle()` over plain `collectAsState()` to avoid work while the UI is in the background.
- **Survive configuration changes** with `ViewModel` + `SavedStateHandle` for user input that must persist.
- **Scope coroutines correctly**: `viewModelScope` in ViewModels, structured concurrency everywhere. Never launch unscoped global coroutines.

## Navigation

- **Use a single `NavHost`** with typed routes. Centralize destinations (e.g. in a single `Destinations` object).
- **Gate protected routes** behind auth state at the navigation layer, not inside each screen.
- **Handle deep links** explicitly (e.g., push notification → review screen).

## Camera & Media (CameraX)

- **Use CameraX**, not Camera2 directly, for lifecycle-aware capture.
- **Bind to lifecycle** so the camera releases automatically.
- **Do image processing off the main thread** (e.g., `Dispatchers.Default` for OpenCV work). Never run CV on the UI thread.
- **Request permissions just-in-time** with a clear rationale, and handle denial gracefully with an explanation screen.

## Accessibility (do not skip in a demo)

- **Provide `contentDescription`** for all meaningful images, icons, and image buttons; use `null` only for purely decorative elements.
- **Meet touch target sizes**: minimum 48x48 dp for interactive elements.
- **Support dynamic font scaling**: use `sp` for text, test at large font sizes.
- **Ensure color contrast** meets WCAG AA (4.5:1 for normal text). Never use color as the only signal — flagged fields should also have an icon or label.
- **Test with TalkBack** before presenting. Full WCAG validation requires manual testing with assistive technologies and expert review.

## Performance

- Avoid unnecessary recomposition (stable params, `derivedStateOf` for computed state).
- Load images with Coil; size them appropriately, don't decode full-resolution bitmaps into small views.
- Keep the main thread free; profile with the Android Studio profiler if frames drop.

## Testing

- Unit-test ViewModels and domain logic on the JVM (no Android dependencies).
- Use Compose UI tests (`createComposeRule`) for screen behavior.
- Pair example-based tests with property-based tests for invariants (see the PBT skill).
