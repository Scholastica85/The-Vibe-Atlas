# Lie Detector: Architectural Statements

> Five technical assertions about the refactored Vibe Atlas codebase.
> Exactly one is false. Can you spot it?

---

1. The `try` block in `fetchImages` checks `controller.didAbort` before consulting `controller.signal.aborted`, ensuring that an intentional cancellation flagged by the custom property short-circuits the success path without ever evaluating the native `AbortSignal` — this ordering prevents a false-negative scenario where `signal.aborted` is `true` (from a late-received abort) but `didAbort` is `false`, which would incorrectly allow stale response data to reach `setImages`.

2. The `useEffect` cleanup function accesses `abortRef.current` to fire the abort sequence on unmount, but if the component unmounts before any mood selection (so `abortRef.current` is `null`), the cleanup is a no-op — however, since no fetch is in-flight at that point, no dangling promise can resolve on the detached fiber tree, making the null-guard a safety measure for lifecycle correctness rather than a functional requirement.

3. Each invocation of `fetchImages` creates a brand-new `AbortController` with `new AbortController()` and binds it to a local `controller` variable captured in the async closure; because this variable is function-scoped and recreated on every call, concurrent invocations have fully isolated `AbortController` instances whose `didAbort` flags cannot be cross-contaminated — the `abortRef.current` reference only provides abort-sequence initiation access, not mutation access to another call's closure-captured controller.

4. The `MoodDock` component's `disabled` prop evaluates `disabled && !isActive` per button, which means the currently-active mood button is never disabled during loading — a user can re-click the active mood to restart its fetch, creating a new `AbortController` that replaces the previous one in `abortRef.current` while the old controller's pending request is aborted with `didAbort` set to `true`.

5. The `fetchMoodImages` service in `unsplash.ts` throws a custom `Error` for non-ok HTTP statuses before reaching `response.json()`, and this thrown error propagates through the async promise chain back to the hook's `catch` block — because the error originates from a synchronous-type throw inside the async function rather than from a rejected `fetch` due to signal abort, the `AbortSignal` is never the cause of the rejection and `didAbort` is correctly `false`, allowing the error to surface in the UI.

## The Identified Lie

Statement 4 is the lie.

Statement 4 claims that because the active mood button is never disabled during loading, a user can re-click it to restart the fetch and trigger a new abort-sequence; however, our codebase features a strict Anti-Spam Guard clause (if (loading && activeMood === mood) return;) at the very top of the hook that completely intercepts and blocks a user from re-clicking the active mood while it is loading, meaning a re-click does absolutely nothing, no new AbortController is ever created, and the previous request is never aborted.

## AI Reveal

**Statement 3 is the lie.**

It claims that "concurrent invocations have fully isolated `AbortController` instances whose `didAbort` flags cannot be cross-contaminated" and that "`abortRef.current` only provides abort-sequence initiation access, not mutation access to another call's closure-captured controller."

This is architecturally false. Here is the proof traced through two rapid mood clicks against the actual code at `src/hooks/useVibeImages.ts:34-43`:

```
Click "calm":  fetchImages("calm")
               → prev = abortRef.current  // null, skip
               → controller_calm = new AbortController()
               → controller_calm.didAbort = false
               → abortRef.current = controller_calm
               → fetchMoodImages("calm", controller_calm.signal) pending

Click "loud":  fetchImages("loud")
               → prev = abortRef.current        // ← same object as controller_calm
               → prev.didAbort = true            // ← DIRECTLY MUTATES controller_calm.didAbort
               → prev.abort()                    // ← ABORTS controller_calm's signal
               → controller_loud = new AbortController()
               → controller_loud.didAbort = false
               → abortRef.current = controller_loud
               → fetchMoodImages("loud", controller_loud.signal) pending
```

At the mutation step, `prev` holds the **same object identity** as `controller_calm`. The assignment `prev.didAbort = true` writes directly into the `AbortController` instance captured by the "calm" invocation's async closure. This is not incidental — it is the entire point of the `didAbort` pattern. The new call deliberately cross-contaminates the old controller so the old request's catch block at line 58 reads `controller.didAbort === true` and correctly identifies it as an intentional cancellation.

The claim that `abortRef.current` "only provides abort-sequence initiation access, not mutation access" is contradicted by lines 35-38 of `src/hooks/useVibeImages.ts`, where the shared mutable ref is used specifically to obtain a writable reference to the previous controller for the purpose of mutating its `didAbort` flag. Cross-contamination is the intended feature, not a bug.

**Why the other four statements are true:**

- **Statement 1** — `src/hooks/useVibeImages.ts:52` checks `controller.didAbort` before `src/hooks/useVibeImages.ts:53` checks `controller.signal.aborted`. Verified by reading lines 50-56.
- **Statement 2** — `src/hooks/useVibeImages.ts:23` initializes `abortRef` as `null`. The cleanup at lines 25-32 guards on `abortRef.current`. No fetch was ever dispatched → no pending promise. Verified by reading lines 23-31.
- **Statement 4** — `src/components/MoodDock.tsx:30` evaluates `disabled={disabled && !isActive}`. When `isActive` is `true`, `!isActive` is `false`, so `disabled` is always `false`. Verified by reading line 30.
- **Statement 5** — `src/api/unsplash.ts:27-28` throws before `src/api/unsplash.ts:31` calls `response.json()`. The error propagates to `src/hooks/useVibeImages.ts:58` where `controller.didAbort` is `false`, so it surfaces. Verified by reading lines 27-31 of `unsplash.ts` and lines 57-63 of `useVibeImages.ts`.