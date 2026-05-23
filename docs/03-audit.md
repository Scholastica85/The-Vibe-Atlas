# Code Audit: Security & Performance

## 1. API Key Exposure

### Finding: Unsplash Access Key Leaks in Two Places

**`src/api/unsplash.ts:3–4`**
```ts
const API_URL = import.meta.env.VITE_UNSPLASH_API_URL
const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY
```

**`VITE_UNSPLASH_ACCESS_KEY`** is an access key, not a secret OAuth token — it identifies the application, not a user. Unsplash's API model is designed for client-side use with access keys. The key is sent as a query parameter (`client_id=...`) in every request.

However, the key is visible in:
1. **The production JavaScript bundle.** Vite inlines `import.meta.env.VITE_*` variables at build time into the output JS. Anyone can open DevTools → Sources → `index-*.js` and read the key in plaintext.
2. **Network requests.** Every `fetch` to Unsplash includes `?client_id=KEY` in the URL, visible in DevTools → Network tab.
3. **The `.env` file** was committed to the repo. The `.gitignore` lists `.env` (line 8), so it should be ignored, but the file physically exists in the project directory as tracked content. A `git status` check is needed to confirm it's not being tracked.

**Severity: Medium.** The key is a public-facing "Access Key" by Unsplash's design, not a secret token. Unsplash expects these keys to be client-visible. The actual risk is rate-limit abuse: if someone copies the key and exceeds the 50 requests/hour limit (Free tier Unsplash keys), the application will stop working for all users of this deployed instance.

**Mitigation recommendation:**
- Move the key to a server-side proxy endpoint so the client never sees it.
- At minimum, verify the `.env` file is in `.gitignore` and not tracked in git history.

---

## 2. Async Race Conditions

### Finding: Handled Correctly via Per-Call AbortController Closures

**`src/hooks/useMoodImages.ts:21–46`**

The race-condition scenario:

```
T=0ms  User clicks "Calm"
       → fetchImages("calm") called
       → controller_calm = new AbortController()
       → abortRef stores controller_calm
       → fetch("https://api.unsplash.com/photos/random?query=calm...", { signal: controller_calm.signal })

T=200ms  User clicks "Loud"
         → fetchImages("loud") called
         → abortRef.current?.abort()        // aborts controller_calm
         → controller_loud = new AbortController()
         → abortRef stores controller_loud (overwrites)
         → fetch("https://api.unsplash.com/photos/random?query=loud...", { signal: controller_loud.signal })

T=400ms  "Calm" response arrives (but fetch was aborted)
         → fetchMoodImages throws AbortError
         → catch block runs
         → controller_calm.signal.aborted === true
         → returns silently — no state update
         ✓ CORRECT

T=600ms  "Loud" response arrives
         → data.map() returns URLs
         → controller_loud.signal.aborted === false
         → setImages(urls), setIsLoading(false)
         ✓ CORRECT
```

**Why this works — the closure invariant:**

Each call to `fetchImages` creates a new lexical scope with its own `controller` constant:

```ts
const fetchImages = useCallback(async (mood: string) => {
  abortRef.current?.abort()      // kills the PREVIOUS call's controller
  const controller = new AbortController()  // THIS call's controller
  abortRef.current = controller

  try {
    const urls = await fetchMoodImages(mood, controller.signal)
    if (!controller.signal.aborted) {    // ← closure captures THIS controller
      setImages(urls)
    }
  } catch (err) {
    if (controller.signal.aborted) return  // ← closure captures THIS controller
    // handle error
  }
}, [])
```

The ref (`abortRef.current`) is used only to abort the **previous** call. The current call always checks its **own** controller's `signal.aborted`. Even if the slow "Calm" response arrives after "Loud" has overwritten `abortRef.current`, the "Calm" closure still holds a reference to `controller_calm`, so its abort check is correct.

**Scenario not handled: unmount mid-fetch**

If the component unmounts while a fetch is in flight, `controller.signal.aborted` is never set to true (no one calls `.abort()`). The `await` resolves, and `setImages(urls)` or `setIsError(true)` fires on an unmounted component. In React 18+, this logs a warning. In React 19 (the version used here), the warning was removed, but it's still a wasted state update on an unmounted tree.

**Severity: Low.** The race condition between concurrent user clicks is fully mitigated. Unmount cleanup is a minor gap.

---

## 3. API Rate Limits

### Finding: No Rate-Limit Awareness, No Degradation Path

**Unsplash Free Tier limits:**
- 50 requests per hour
- After exceeding, API returns HTTP 403 or 429 with a rate-limit error

**What happens when the limit is hit:**

1. `fetch()` returns a `Response` with `status: 403` (or 429).
2. `response.ok` is `false` → throws `new Error("Failed to fetch images: Forbidden")`.
3. Catch block in `useMoodImages.ts` sets `isError = true`.
4. `ErrorState` renders with message: `"Failed to fetch images: Forbidden"`.
5. User clicks "Try again" → immediate re-fetch → hits same limit → same error → infinite error loop with no backoff.

**The degradation path:**

```
Rate limit exceeded
        ↓
Error displayed: "Failed to fetch images: Forbidden"
        ↓
"Try again" button appears
        ↓
click → immediate retry → immediate failure → same error
        ↓
(repeat indefinitely — no cooldown, no count tracking)
```

The app does not:
- Detect rate-limit headers like `X-Ratelimit-Remaining` (Unsplash returns these)
- Track remaining requests locally
- Show a user-friendly message like "Image service is busy. Try again in 15 minutes."
- Implement exponential backoff on retry
- Cache previous results to serve stale content as a fallback

**Severity: High.** Once the 50-request limit is hit, the application becomes permanently non-functional until the next calendar hour, with no user feedback beyond a developer-oriented error message and a non-functional retry button.

---

## 4. Accessibility (a11y)

### Finding: Dynamic alt Text Exists but Is Always Generic

**`src/components/ImageCard.tsx:26–28`**

```tsx
<img
  src={src}
  alt={alt}
  loading="lazy"
  onLoad={() => setLoaded(true)}
/>
```

The `alt` prop is passed from `ImageGrid.tsx`:

```tsx
<ImageCard src={first} alt={`${mood} mood visual 1`} />
```

This produces alt text like:
- `"calm mood visual 1"`
- `"loud mood visual 2"`

**The problem:** The `alt` text is derived solely from the mood the user selected, not from the actual photo content. The Unsplash API returns `alt_description` for each photo (e.g., "a calm lake at sunset with mountains in the background"), but the code discards it — the `map()` on line 32 of `unsplash.ts` only extracts `img.urls.regular`, throwing away all metadata including `alt_description`.

**Impact:**
| User group | Experience |
|---|---|
| Sighted user | Sees the photo, understands the mood |
| Screen reader user | Hears "calm mood visual 1" — tells them the mood category but NOT what the photo actually depicts |
| User with images disabled | Alt text is only the mood category, not descriptive |

**Additional a11y issues:**

**1. `alt_description` is typed as `string | null`** in `types/index.ts:8`, so even if it were used, it could be `null` for some photos. A fallback would be needed.

**2. The mood buttons have no `aria-pressed` or `aria-current` state:**

```tsx
<button
  key={mood}
  onClick={() => onSelect(mood)}
  disabled={disabled && !isActive}
  className={isActive ? 'bg-brand-neon-500 ...' : '...'}
>
  {moodLabels[mood]}
</button>
```

The active state is conveyed ONLY by visual styling (background color change). A screen reader user has no way to know which mood is currently active. The button should have `aria-pressed={isActive}` or `aria-current="true"` when selected.

**3. The skeleton shimmer animation lacks `prefers-reduced-motion`:**

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

The animation runs unconditionally. Users who set `prefers-reduced-motion: reduced` in their OS settings will still see the shimmer animation, which can cause vestibular discomfort.

**4. Image grid lacks a landmark region:**

```tsx
<section className="max-w-6xl mx-auto px-4 pb-16">
```

This `section` has no `aria-label` or `aria-labelledby`. Screen reader users navigating by landmark will hear "section" with no context about what it contains.

**Severity: Medium.** The app is not fully screen-reader friendly. The alt text gap is the most impactful — it's fixable by passing `alt_description` through the data pipeline, which requires no architectural changes, only a data shape change.

---

## 5. Component Re-renders

### Finding: Well-Optimized Core Path, Suboptimal Edges

#### The Already-Optimized Path

**`App.tsx:22–27` — `handleMoodSelect` is memoized:**

```tsx
const handleMoodSelect = useCallback(
  (mood: Mood) => fetchImages(mood),
  [fetchImages],
)
```

`fetchImages` is stable (empty dependency array in the hook), so `handleMoodSelect` is stable. This means `MoodDock` receives the same `onSelect` function reference across re-renders. If `MoodDock` were wrapped in `React.memo`, it would skip re-renders entirely unless `moods`, `activeMood`, or `disabled` change.

**`MoodDock.tsx:18–44` — Button identity is stable:**

Each mood button uses `key={mood}`, which is a stable string. React correctly preserves DOM nodes and only updates the `className` and `disabled` attributes when they change.

**`ImageCard.tsx:9–10` — Local state is minimal:**

```tsx
const [loaded, setLoaded] = useState(false)
```

Only one local state variable per card, which is ideal.

#### Performance Hotspots

**1. `ImageGrid` creates three derived values on every render:**

```tsx
function ImageGrid({ images, mood }: ImageGridProps) {
  if (images.length === 0) return null
  const [first, second, third, fourth, fifth] = images.slice(0, 5)
  // ...
}
```

`images.slice(0, 5)` creates a new array on every render of `ImageGrid` or its parents. For a 5-element array this is negligible (~5ns), but it's a pattern that signals the component is not optimized. With `React.memo` wrapping `ImageGrid`, re-renders would only happen when the `images` reference or `mood` string actually changes.

**2. No `React.memo` on any component:**

| Component | Props that change on every fetch | Should it be memo'd? |
|---|---|---|
| `Header` | None (no props) | Yes — trivially prevents re-render on every state change |
| `MoodDock` | `activeMood`, `disabled` | Possibly — re-renders when a mood button is clicked or loading toggles. With memo, it only re-renders when one of these three props changes |
| `ImageGrid` | `images` (new reference), `mood` | Yes — only re-renders when images actually change |
| `ErrorState` | `message`, `onRetry` (stable) | Yes — only re-renders on error toggle |
| `SkeletonGrid` | None (no props) | Yes — never needs to re-render once mounted |
| `ImageCard` | `src`, `alt` (stable per image) | Possibly — re-renders on `loaded` state change anyway |

**3. The `onRetry` inline arrow function in `App.tsx:49`:**

```tsx
onRetry={() => activeMood && fetchImages(activeMood)}
```

This creates a new function reference on every render of `App`. If `ErrorState` were wrapped in `React.memo`, the memo would always fail because the `onRetry` prop is a new reference every time. This should use `useCallback`:

```tsx
const handleRetry = useCallback(
  () => activeMood && fetchImages(activeMood),
  [activeMood, fetchImages],
)
```

**4. State update ordering and batching:**

The synchronous state updates in `fetchImages`:

```tsx
setActiveMood(mood)
setIsLoading(true)
setIsError(false)
setErrorMessage('')
```

These fire synchronously before `await`. React 18+ (and 19) automatically batches them into one render. However, this means the UI shows the skeleton grid for the new mood before knowing if the request will succeed. For fast requests (<300ms), users may see a brief skeleton flash. This is not a correctness issue, but it's a perceptual one.

**5. `App.tsx` re-renders on every state change:**

Every time `setIsLoading`, `setImages`, `setIsError`, `setErrorMessage`, or `setActiveMood` is called, `App` re-renders. All children re-render too (unless memo'd or their props didn't change). The render tree:

```
App (re-renders on every state change)
 ├── Header (always re-renders — should be memo'd)
 ├── MoodDock (always re-renders — props change when mood/loading changes, OK)
 ├── SkeletonGrid (always re-renders — no props, should be memo'd)
 ├── ErrorState (always re-renders — should be memo'd)
 └── ImageGrid (always re-renders — should be memo'd)
      └── ImageCard × 5 (always re-renders — ok due to loaded state)
```

**Severity: Low-Medium.** The app is small enough (5 images, 5 buttons) that the absolute rendering cost is negligible. The patterns are worth fixing as the app scales. The most impactful single fix would be wrapping `Header` and `SkeletonGrid` in `React.memo`.

---

## Summary

| # | Finding | Severity | Category |
|---|---|---|---|
| 1 | Access key visible in production JS bundle | Medium | Security |
| 2 | `.env` may be tracked in git (verify `git status`) | Medium | Security |
| 3 | Race conditions are correctly handled via closure-scoped AbortController | ✅ None | Async |
| 4 | No unmount cleanup for in-flight requests | Low | Async |
| 5 | Rate-limit exhaustion causes permanent failure with no degradation | High | Resilience |
| 6 | No exponential backoff on retry | Medium | Resilience |
| 7 | Alt text is mood-only, discards photo content | Medium | Accessibility |
| 8 | Mood buttons lack `aria-pressed` / `aria-current` | Medium | Accessibility |
| 9 | Shimmer animation ignores `prefers-reduced-motion` | Low | Accessibility |
| 10 | Image grid `<section>` lacks an accessible label | Low | Accessibility |
| 11 | No `React.memo` on static/pure components | Low | Performance |
| 12 | `onRetry` inline arrow breaks memo comparators | Low | Performance |
