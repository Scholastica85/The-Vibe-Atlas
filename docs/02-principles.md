# Architectural Principles Assessment

## 1. Separation of Concerns

### Layer Architecture

The codebase divides into four distinct layers with clear boundaries:

| Layer | Location | Responsibility | Dependencies |
|---|---|---|---|
| **Data Fetching** | `src/api/unsplash.ts` | Raw HTTP, URL construction, key validation, JSON parsing | `types/index.ts` |
| **State Management** | `src/hooks/useMoodImages.ts` | Request lifecycle, loading/error toggles, cancellation, mood tracking | `api/unsplash.ts`, `types/index.ts` |
| **UI Rendering** | `src/components/*.tsx`, `src/App.tsx` | JSX, layout, event handling, conditional rendering | `hooks/useMoodImages.ts`, `types/index.ts` |
| **Styling** | `src/index.css` + Tailwind utility classes | Visual appearance, animations, theme tokens | None |

### Boundary Quality

**Data Fetching vs State Management**

The boundary is clean. The API layer (`unsplash.ts`) has zero state awareness — it accepts a `mood` string and an optional `AbortSignal`, returns a `Promise<string[]>`, and throws on failure. The hook layer (`useMoodImages.ts`) handles all lifecycle concerns. No component ever imports from `unsplash.ts` directly; it's always mediated by the hook.

One minor coupling: the API layer reads `import.meta.env` globals directly. If you wanted to swap providers (e.g., Pexels instead of Unsplash), you'd also need to change `.env` variable names in the API module. A provider-abstracted interface would make this swap zero-touch, but for a single-provider app this is acceptable.

**State Management vs UI Rendering**

The hook returns plain data (`images`, `isLoading`, `isError`, `errorMessage`, `activeMood`) and a single action (`fetchImages`). Components have no direct access to setters — they cannot call `setIsLoading(true)` or `setImages([...])`. This is a textbook unidirectional data flow: actions flow down, data flows up via the return value.

**Styling Isolation**

Tailwind utility classes are co-located with JSX (component-level styling). The custom CSS in `index.css` contains only:
- The `@theme` block (design tokens — colors, not component styles)
- The `shimmer` keyframe animation (used by two components)
- A global box-sizing reset

No component-specific CSS bleeds into the global stylesheet. Every visual detail is either a Tailwind utility or the global `skeleton-shimmer` class (which is generic by design).

**Verdict: 8/10.** The layers are well-separated. The only improvement would be abstracting the API provider behind an interface for true provider-agnosticism.

---

## 2. Loading State Management

### The Three States

The app manages exactly three mutually exclusive display states:

```
IDLE ──click──► LOADING ──success──► RESOLVED
                  │                     │
                  │                     │ (click again → LOADING)
                  │                     │
                  └──error──► ERROR ────┘
                               │
                               │ retry → LOADING
                               │
                               │ click different mood → LOADING
```

### Transition Analysis

**Idle → Loading**

Triggered by any mood button click. The sequence in `useMoodImages.ts:27–30` fires four state setters synchronously before the `await`:

```ts
setActiveMood(mood)    // highlights the new button
setIsLoading(true)     // skeleton grid appears
setIsError(false)      // error box disappears
setErrorMessage('')    // error text clears
```

React batches these into a single render, so the UI flips from idle→loading in one frame. No flicker.

**Loading → Resolved**

In the success path (`useMoodImages.ts:34–37`):

```ts
if (!controller.signal.aborted) {
  setImages(urls)
  setIsLoading(false)
}
```

Two setters fire. The skeleton grid is removed and the image grid appears in its place. Because the skeleton grid's HTML structure (5 divs with the exact same grid layout) matches the image grid's layout, there is zero layout shift — the only visual change is the shimmer placeholders being replaced by actual images.

**Loading → Error**

In the error path (`useMoodImages.ts:42–44`):

```ts
setErrorMessage(message)
setIsError(true)
setIsLoading(false)
```

The skeleton disappears, the error card appears with the message and a "Try again" button. The `images` array is **not cleared** — if there were previous images from a prior successful fetch, they stay in memory but are not displayed (because `showGrid` checks `!isError`).

**Error → Loading (Retry)**

The retry button calls `fetchImages(activeMood)`, which re-enters the Loading state. The error card is replaced by the skeleton grid.

**Concurrent Request Handling**

If the user clicks "Loud" while "Calm" is still loading:

1. The "Calm" request is aborted (stops wasting bandwidth)
2. The "Calm" catch block fires → checks `controller.signal.aborted` → silently returns
3. The new "Loud" fetch starts fresh

During the brief window between abort and the new fetch starting, `isLoading` remains `true` (it's never set to `false` in between), so the skeleton grid stays visible without a flash.

**Edge Case: Rapid Clicks on the Same Mood**

Clicking "Calm" twice rapidly:
1. First call: `setIsLoading(true)`, fetch starts
2. Second call: `abortRef.current?.abort()` aborts the first fetch's controller
3. But wait — the second call creates a NEW controller and stores it in `abortRef.current`. The first fetch's `catch` checks `controller.signal.aborted` against its OWN controller, which WAS aborted → returns silently.
4. Second fetch proceeds normally.

This is correct. The key insight is that each invocation of `fetchImages` creates a new closure with its own `controller` variable, and the abort check always references the closure's own controller, not `abortRef.current`.

### Missing: Loading-to-Idle Transition

There is no way to return to the idle (welcome screen) state without refreshing the page. Once a mood is selected, `activeMood` is never set back to `null`. The welcome screen (`showEmpty`) requires `!activeMood`, so it disappears forever after the first click. This is a deliberate UX choice (not a bug), but it means there's no "clear" or "deselect" action.

**Verdict: 9/10.** The transitions are seamless, race-condition-free, and layout-stable. The only missing piece is an explicit idle reset.

---

## 3. Error Boundaries / Error Handling

### Layers of Defense

The app has three error-handling mechanisms, each at a different layer:

#### Layer 1: API Key Validation (Guard Clauses)

File: `src/api/unsplash.ts:10–14`

```ts
if (!ACCESS_KEY || ACCESS_KEY === 'your_actual_unsplash_client_id_here') {
  throw new Error('Unsplash API key is not configured...')
}
```

This runs before any network request. It catches the most common deployment mistake (forgetting to set the `.env` file) with a clear, specific error message. This is the only validation layer — there are no runtime type guards on the API response shape.

#### Layer 2: HTTP Error Checking

File: `src/api/unsplash.ts:27–29`

```ts
if (!response.ok) {
  throw new Error(`Failed to fetch images: ${response.statusText}`)
}
```

The `fetch` API does NOT throw on 4xx/5xx status codes — it only throws on network-level failures (DNS failure, connection refused, timeout). This check converts non-OK HTTP responses into thrown errors. The error message includes `response.statusText` (e.g., "Forbidden", "Not Found", "Internal Server Error").

#### Layer 3: Catch Block in the Hook

File: `src/hooks/useMoodImages.ts:38–45`

```ts
catch (err) {
  if (controller.signal.aborted) return
  const message = err instanceof Error ? err.message : 'Something went wrong'
  setErrorMessage(message)
  setIsError(true)
  setIsLoading(false)
}
```

Catches three types of failures:
| Failure Type | Where it's thrown | err type | message |
|---|---|---|---|
| Missing API key | `unsplash.ts:11` | `Error` | "Unsplash API key is not configured..." |
| HTTP 4xx/5xx | `unsplash.ts:28` | `Error` | "Failed to fetch images: Not Found" |
| Network error | `fetch()` itself | `TypeError` | "Failed to fetch" (browser-generated) |
| AbortError | `fetch()` when aborted | `DOMException` | (silently ignored on line 39) |
| JSON parse failure | `response.json()` | `SyntaxError` | JSON parse error message |
| Anything else | Anywhere | unknown | "Something went wrong" |

The `err instanceof Error` check is a defensive guard — in JavaScript, `catch` blocks can receive anything (strings, numbers, `null`, objects). If it's not a proper `Error` instance, we fall back to a generic message rather than risking a "Cannot read property 'message' of undefined" crash.

### What's Missing: A React Error Boundary

There is **no Error Boundary component** wrapping the app. An Error Boundary is a React feature (class component with `componentDidCatch`) that catches errors during rendering, in lifecycle methods, and in constructors. If any component throws during render (not during an async fetch — that's already caught), the entire UI would unmount and show a blank screen.

Errors that would bypass the current handling:
- A crash in `ImageCard` during render (e.g., `src` is somehow undefined)
- A crash in `ImageGrid` if `.slice(0, 5)` fails on a non-array (though TypeScript prevents this)
- A crash in Tailwind class generation
- An error in an event handler that isn't inside a try/catch

### Error Message UX

The `ErrorState` component displays the error message verbatim to the user. For an API key error, the user sees:

> "Unsplash API key is not configured. Set VITE_UNSPLASH_ACCESS_KEY in your .env file."

This is developer-facing language shown in the end-user UI. A production app would map this to a user-friendly message like "The image service is not configured. Please contact support."

### Retry Safety

The retry button re-calls `fetchImages(activeMood)`, which re-enters the loading state and attempts the exact same request. If the error is transient (network blip), this works. If the error is permanent (bad API key, deleted photos), it will fail again. No retry count limit or exponential backoff is implemented, so a user with a permanent error could spam the retry button indefinitely with no feedback.

**Verdict: 6/10.** The async error handling is thorough, but the lack of a React Error Boundary and user-friendly error message mapping are notable gaps.

---

## 4. Immutability of Fetched Data

### The Data Flow

```
Unsplash API
    ↓ response.json()
data: UnsplashImage[]           ← fresh array from JSON.parse
    ↓ .map((img) => img.urls.regular)
urls: string[]                  ← brand new array (map returns new)
    ↓ setImages(urls)
images state in hook            ← React's useState stores the new reference
```

### Analysis

**The API layer returns a new array every time:**

```ts
return data.map((img) => img.urls.regular)
```

`Array.prototype.map` always returns a new array. The original `data` array from the JSON response is never mutated — `.map` reads from it and produces a new array. The URLs inside are primitive strings (immutable by definition in JavaScript).

**The hook stores via setState:**

```ts
const [images, setImages] = useState<string[]>([])
// ...
setImages(urls)   // urls is a new array reference every time
```

`useState`'s setter replaces the entire value — there is no push, splice, or in-place mutation. Each successful fetch creates a completely new array and swaps it in. This is the textbook correct pattern for immutability in React.

**No accumulation or merging:**

The app does not do `setImages(prev => [...prev, ...urls])` or any form of pagination/append. The array is fully replaced on every fetch. This means:
- There is no risk of stale data from previous moods accumulating
- There is no risk of duplicate entries across requests
- There is no mutation of the previous array

**Component reads are read-only:**

Components destructure the array (`const [first, second, ...] = images.slice(0, 5)`) but never modify it. `Array.prototype.slice` returns a new shallow copy, but even if they didn't slice, they only read — nothing in the component layer calls `images.push(...)` or `images[0] = ...`.

**The catch: no error-path clearing**

When an error occurs, `images` is NOT cleared:

```ts
catch (err) {
  // ...
  setErrorMessage(message)
  setIsError(true)
  setIsLoading(false)
  // Note: no setImages([])
}
```

This means if the user successfully loads "Calm" images, then clicks "Loud" and the request fails, the old "Calm" images remain in state. They aren't displayed (because `showGrid` requires `!isError`), but they persist in memory. On the next successful fetch, `setImages(urls)` replaces them anyway. This is not an immutability violation, but it's a minor memory note.

**No direct mutations anywhere**

A search for `.push(`, `.splice(`, `.pop(`, `[` assignment, or `delete` across all source files returns zero hits. The codebase is fully compliant with React immutability conventions.

**Verdict: 10/10.** Every state update produces a new reference. No direct mutations exist. The data flow is fully immutable.

---

## Summary Table

| Principle | Score | Key Strengths | Key Gaps |
|---|---|---|---|
| **Separation of Concerns** | 8/10 | Clean 4-layer architecture, unidirectional data flow, no setter leakage | Provider is hard-coded; swapping APIs requires rework |
| **Loading State Management** | 9/10 | Zero-layout-shift skeleton, race-condition-safe abort logic, batched renders | No way to return to idle/welcome state without refresh |
| **Error Boundaries/Handling** | 6/10 | Catches all async failure modes, AbortError handled gracefully | No React Error Boundary, user-facing error messages are developer-oriented, no retry limiting |
| **Immutability of Fetched Data** | 10/10 | Fresh array per request, no mutations anywhere, `.map()` guarantees new reference | — |
