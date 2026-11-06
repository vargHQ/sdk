# CODEMAP — vargai SDK

Orientation map for agents and newcomers: read this first, then open only the files you need.
This file covers code structure only. Usage lives in [README.md](README.md), [docs/react.md](docs/react.md) (JSX API), [docs/sdk.md](docs/sdk.md) (AI-SDK API), [docs/prompting.md](docs/prompting.md); Bun rules, the JSX-pragma trap and the cache policy live in [CLAUDE.md](CLAUDE.md); provider how-to lives in [src/ai-sdk/providers/CONTRIBUTING.md](src/ai-sdk/providers/CONTRIBUTING.md); hooks and commit format live in [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md).
Every path and symbol below was checked against the code. When the code and this file disagree, the code wins, so fix this file.

## 1. What it is

`vargai` (package.json `name`, `bin` → `src/cli/index.ts`) is a Bun-only TypeScript SDK for AI media generation and video composition. Four layers:

| Layer | Entry | Role |
|---|---|---|
| CLI | `src/cli/index.ts` | citty commands: `render`/`preview`/`frame`/`storyboard`/`studio` (JSX files) and `run`/`list`/`find`/`which` (registry definitions), plus auth/billing |
| Definitions + core | `src/definitions/`, `src/core/` | Zod-typed model/action/skill definitions in a `registry`, run by `executor`, backed by the legacy provider classes in `src/providers/` |
| JSX composition | `src/react/` (export `vargai/react`) | `<Render>/<Clip>/<Video>/…` build a plain element tree. `render()` resolves it, compiles a plan, generates, then composes with ffmpeg |
| AI-SDK providers | `src/ai-sdk/` (export `vargai/ai`) | Vercel AI-SDK v3 model objects (`varg`, `fal`, `elevenlabs`, …), extra `VideoModelV3`/`MusicModelV3` types, `withCache`/`fileCache`, `editly` (ffmpeg compositor), storage |

The JSX layer only calls AI-SDK models, while `varg run` uses `src/providers/`. They are two mostly separate provider stacks. The bridges are `src/providers/fal.ts`, which imports `IMAGE_MODELS` from the AI-SDK fal, and the image action, which uses `executeJobUrl` from `varg.ts`. `vargai` (root, `src/index.ts`) re-exports upstream `@ai-sdk/fal`'s `fal`. `vargai/ai` exports the SDK's own `fal` (`src/ai-sdk/providers/fal.ts`). These are different objects.

## 2. Directory map

```
src/cli/commands/         one file per subcommand (render.tsx holds render+preview, loadComponent, detectDefaultModels)
src/cli/credentials.ts    ~/.varg/credentials (API key from `vargai login`)
src/core/registry/        Registry, name resolver/fuzzy search, filesystem loader
src/core/executor/        Executor (model/action/skill dispatch), JobRunner, PipelineRunner
src/core/schema/          ActionDefinition/ModelDefinition/SkillDefinition types, shared Zod schemas, validator
src/definitions/actions/  CLI actions (video, image, voice, music, transcribe, sync, captions, edit, upload, grok-edit, qwen-angles, magnific-*)
src/definitions/models/   model metadata + pricing formulas (allModels); pricing.test.ts
src/definitions/skills/   multi-step skills (talking-character, text-to-tiktok)
src/providers/            BaseProvider subclasses used by actions (fal, elevenlabs, replicate, groq, higgsfield, heygen, piapi, magnific, ffmpeg, storage…)
src/react/                elements.ts (factories), types.ts (all props), resolve.ts (standalone await), render.ts (pipeline)
src/react/ir/             compile → discover/validate/topo-sort → execute/run-step (plan IR)
src/react/renderers/      per-element renderers + compose (render.ts, clip.ts, flatten.ts, captions/ASS/fonts/emoji, cache-key utils)
src/react/layouts/        Grid/Split/Slot: plain JSX components that set position props on children
src/react/primitives/     audio extract, silence/speech-activity detection, Whisper transcription
src/react/runtime/        jsx-runtime (wraps async components as "__lazy" elements)
src/ai-sdk/providers/     AI-SDK providers + model-rules.ts (duration snapping) + editly/ (ffmpeg compositor, local/Rendi backends)
src/ai-sdk/middleware/    placeholder generation + wrapVideoModel/wrapMusicModel (preview mode)
src/ai-sdk/storage/       r2Storage, falStorage, retry/limiter
src/speech/               ElevenLabs alignment → word timings → segments
src/studio/               `bun run studio` web UI (Bun.serve, step-by-step stage rendering)
src/tests/                unit.test.ts (no API), all.test.ts (needs keys)
```

## 3. Key flows

### 3.1 `vargai render file.tsx`, end to end
1. `src/cli/index.ts` imports `./quiet` first, registers `allDefinitions` and `providers` into `registry`, intercepts `--help`, then dispatches to `renderCmd` (`src/cli/commands/render.tsx`).
2. `loadComponent()`: if the file imports `vargai/*` or `@vargai/gateway`, it rewrites those imports to absolute paths in a temp file under `<pkg>/.cache/varg-render/`. A file with no imports gets `AUTO_IMPORTS` prepended, and a file with relative imports is imported as-is. If the default export is a function, it is called and awaited. The root must be `type === "render"`.
3. Output defaults to `output/<basename>.mp4`. Cache defaults to `--cache .cache/ai`. The cache is off with `--no-cache` and always off for `preview`. `detectDefaultModels()` picks the defaults (see 3.3).
4. `render()` (`src/react/render.ts`) runs in this order:
   1. `prepare()`: `resolveLazy()` (`src/react/renderers/resolve-lazy.ts`) runs inside `withResolveContext()` (`src/react/resolve-context.ts`: backend, cache, storage, defaults, p-limit).
   2. `compile()` (`src/react/ir/compile.ts`) builds the plan. If the plan has error diagnostics, `prepare()` throws `CompileError` before any plan step generates.
   3. `createRenderContext()` (`src/react/renderers/context-builder.ts`) sets up the cached generators, preview placeholders and the `onGeneration` pricing hook.
   4. `executePlan()` (`src/react/ir/execute.ts`, `concurrency` default 3, `throwOnError: false`) runs the steps in topo order. `runStep()` (`src/react/ir/run-step.ts`) calls the renderer and writes `element.meta`.
   5. `renderRoot()` composes the result.
5. `renderRoot()` (`src/react/renderers/render.ts`) does the composition:
   1. Collects top-level speech/audio/music/overlay elements and runs `flattenClips()` (`flatten.ts`: nested clips → leaf clips, hoisted captions, deferred audio).
   2. Runs `renderClip()` per clip (p-map) and aggregates failures as "N of M clips failed".
   3. Computes timeline offsets (minus transition overlap) and places deferred audio.
   4. Builds captions: `renderCaptions()` → ASS → `shiftAssTimestamps`/`mergeAssFiles`.
   5. Adds music, trimmed to the total duration.
   6. Runs `editly()` (`src/ai-sdk/providers/editly/index.ts`, a pure-ffmpeg filter graph on an `FFmpegBackend`), then `burnCaptions()`.
   7. Returns `RenderResult { video, files }`.

### 3.2 How an element is resolved and rendered
1. A factory in `src/react/elements.ts` calls `createElement()` → `{ type, props, children }`. `Image`/`Video`/`Speech`/`TalkingHead`/`Music`/`Slice`/`FFmpeg`/`Probe` are wrapped by `makeThenable()` (awaitable, memoized). `Video`/`Speech` also get `attachAudioGetter()` (`.audio` → `AudioNode`, `src/react/audio-element.ts`). `Video` runs `expandNativeAudio()` on `audio: "native"`.
2. **Inside render**, IR step kinds map through `OP_BY_TYPE` (`src/react/ir/constants.ts`) to `renderImage`/`renderVideo`/`renderSpeech`/`renderMusic`/`renderTalkingHead`/`renderAudio` in `src/react/renderers/`. Each one:
   1. returns early for `ResolvedElement` or `src`-only elements;
   2. falls back to `props.model ?? ctx.defaults.*`;
   3. calls `withDedup()` (`dedup.ts`, `ctx.pendingFiles` keyed by the cache key);
   4. calls `ctx.generateX({ …, cacheKey: computeCacheKey(element) })`.
   Video duration defaults to 5s (`renderers/video.ts`).
3. **Standalone `await Image(...)`** goes through `resolveImageElement`/`resolveVideoElement`/… (`src/react/resolve.ts`):
   1. `memoizedElementResolve()` (WeakMap by element identity, so one element means one generation, and a rejection stays memoized);
   2. `withCache(...)` on `getActiveCache()` (the ResolveContext cache, or a `.cache/ai` fallback);
   3. a `ResolvedElement` (`src/react/resolved-element.ts`) is returned and its meta is written back, so renderers skip it later.
4. `renderClip()` (`src/react/renderers/clip.ts`) maps children to editly layers: image/image-overlay, video, audio, title, subtitle, and slider/swipe/packshot → video. If a clip has no base layer, it prepends a black `fill-color`. A nested `<Clip>` inside a leaf is ignored with a warning.
5. `Slice`/`FFmpeg`/`Probe` need a `gateway` prop (`FFmpegGateway`, `src/react/types.ts`).

### 3.3 Provider call: varg API vs direct providers
1. Models are AI-SDK v3 objects. `generateImage`/`experimental_generateSpeech` come from `ai`. `generateVideo` (`src/ai-sdk/generate-video.ts`) and `generateMusic` (`src/ai-sdk/generate-music.ts`) are the SDK's own. A string model id only works if `globalThis.AI_SDK_DEFAULT_PROVIDER` is set.
2. **varg** (`src/ai-sdk/providers/varg.ts`):
   1. `resolveVargConfig()` takes the key from settings, then `VARG_API_KEY`, then `~/.varg/credentials`. The base URL is `https://api.varg.ai/v2`, overridable only via `createVarg({ baseUrl })`.
   2. `doGenerate` uploads byte inputs via `POST /files` and builds `{ model, prompt, duration, aspect_ratio, files, provider_options, audio }`.
   3. `submitJob()` sends `POST /{video|image|speech|music}` with an `Idempotency-Key` from `computeIdempotencyKey()`. On 429 it backs off up to 6 retries.
   4. `pollJob()` polls `GET /jobs/:id` every 2s, up to 900 times.
   5. `downloadOutput()` fetches `outputs[0].url`.
   Model ids pass through verbatim. Mapping, validation and billing happen server-side (`api/` in the vargHQ meta-repo).
3. **Direct fal** (`src/ai-sdk/providers/fal.ts`):
   1. Friendly ids map to endpoints via `VIDEO_MODELS`, `IMAGE_MODELS`, `LIPSYNC_MODELS`, `MOTION_CONTROL_MODELS`, ….
   2. Durations are fixed by `normalizeProviderInput()` (`model-rules.ts`).
   3. `executeWithQueueRecovery()` stores the fal request id in `.cache/fal-pending` (24h), so a timed-out run resumes the same paid job. The timeout is `FAL_TIMEOUT_MS` (default 30 min).
   Other direct providers sit next to it: elevenlabs, google, heygen, higgsfield, krea, magnific, openai, piapi, replicate, together.
4. **CLI defaults** (`detectDefaultModels()`): a varg key gives `nano-banana-pro`/`kling-v3`/`eleven_v3`/`music_v1`. `FAL_API_KEY`/`FAL_KEY` **overrides** image/video with fal `flux-schnell`/`wan-2.5`. `ELEVENLABS_API_KEY` overrides speech/music.
5. **`varg run <name>`** takes a different path: `executor.run()` (`src/core/executor/executor.ts`) resolves the name via `registry` and validates the Zod input. Then a model goes to `jobRunner` with a `src/providers/*` class; an action goes to `execute()` when present, otherwise to the highest-`priority` matching `routes`; a skill goes to `pipelineRunner`.

### 3.4 Cache keys and where the cache lives
1. `withCache(fn, { storage, ttl, limit })` (`src/ai-sdk/cache.ts`) builds the key as `depsToKey(fn.name, cacheKey)`, e.g. `generateImage:image:prompt:beach:model:varg:nano-banana-pro`.
   - Only calls that pass a `cacheKey` are cached.
   - `skipCacheWrite` is used by preview.
   - `DEFAULT_TTL` is `"7d"`.
   - Without `storage`, the cache is an in-memory Map.
   - `limit` only gates cache misses.
2. `computeCacheKey()` (`src/react/renderers/utils.ts`) builds the parts:
   - element type and props, minus `COMMON_IGNORED_PROPS` and `IGNORED_PROPS_BY_TYPE` (layout props for image and video; also trim, `volume`, `keepAudio` and `audio` for video; `volume` and `id` for speech);
   - the model as `provider`/`modelId`/`settings`, plus string children;
   - nested elements, recursively;
   - local file paths as `path:mtimeMs:size`, `Uint8Array` as `uint8:<len>`, and `ResolvedElement` as `resolved(type,text,duration)`, never its URL.
3. `fileCache({ dir })` (`src/ai-sdk/file-cache.ts`) writes one JSON file per key. Characters outside `[a-zA-Z0-9_-]` become `_`. Keys over 200 chars become the first 100 chars plus a `Bun.hash`. Bytes are stored as base64. Expired entries are blanked on read.
4. Locations, relative to cwd:
   - `vargai render --cache` (default `.cache/ai`);
   - standalone awaits outside `render()` → `.cache/ai`;
   - transcription → `transcribeAudio:<model>:…` in the active cache (`src/react/primitives/transcribe.ts`);
   - fal resume state → `.cache/fal-pending`;
   - studio → `.cache/ai` (`src/studio/server.ts`).

## 4. Where do I change X

| Change | Files |
|---|---|
| Model reachable via varg API | Usually server-side only (`api/` repo). Then call `varg.videoModel("<id>")`. Add CLI metadata below if needed |
| Model on direct fal | endpoint maps in `src/ai-sdk/providers/fal.ts`; special inputs in `FalVideoModel.doGenerate`/`FalImageModel`; see providers CONTRIBUTING.md |
| New direct AI-SDK provider | new file in `src/ai-sdk/providers/`, export from `src/ai-sdk/index.ts`; add the key to `KNOWN_UNDERLYING_PROVIDERS` in `varg.ts` if the API forwards it |
| Model metadata/pricing for `list`/`which`/`run` | `src/definitions/models/<name>.ts` + `allModels` in `src/definitions/models/index.ts`; check `pricing.test.ts` |
| CLI action | `src/definitions/actions/<name>.ts` (`ActionDefinition` from `src/core/schema/types.ts`) + `allActions` in `src/definitions/actions/index.ts`; backing class in `src/providers/` |
| Skill (multi-step) | `src/definitions/skills/` + `allSkills`; executed by `src/core/executor/pipeline.ts` |
| CLI command | `src/cli/commands/<cmd>.tsx`, export in `src/cli/commands/index.ts`, add to `subCommands` (+ `subcommandHelp`) in `src/cli/index.ts`; UI kit in `src/cli/ui/` |
| New JSX element | `VargElementType` + props + `ElementPropsMap` in `src/react/types.ts`; factory in `src/react/elements.ts`; export in `src/react/index.ts`; `OP_BY_TYPE`/`CONTAINER_TYPES` in `src/react/ir/constants.ts`; `runStep` case; renderer in `src/react/renderers/`; layer case in `clip.ts`; `resolve*Element` in `resolve.ts` if awaitable; `AUTO_IMPORTS` in `render.tsx` |
| New prop on an element | props in `src/react/types.ts`, consumer renderer; decide on cache-key impact (`IGNORED_PROPS_BY_TYPE`); validation in `src/react/ir/validate.ts` |
| Caching behavior | `src/ai-sdk/cache.ts`, `src/ai-sdk/file-cache.ts`, `computeCacheKey` in `src/react/renderers/utils.ts`, wiring in `context-builder.ts` and `resolve.ts`; tests `src/react/renderers/cache.test.ts`, `src/ai-sdk/cache.test.ts` |
| Per-model duration snapping/clamping | `ModelDurationRules` in `src/ai-sdk/providers/model-rules.ts` (direct fal only) |
| Clip timing / transitions / trims | offsets in `src/react/renderers/render.ts`; real clip length in `processClips` in `src/ai-sdk/providers/editly/index.ts`; nesting in `flatten.ts` |
| Captions look, fonts, emoji | `captions.ts`, `ass.ts`, `fonts.ts` (`PRIMARY_FONTS`), `emoji.ts`, `merge-ass.ts`, `burn-captions.ts` in `src/react/renderers/` |
| Pre-spend validation / diagnostics | `src/react/ir/validate.ts`, `src/react/ir/discover.ts` |
| varg API request/poll shape | `submitJob`/`pollJob`/`VargVideoModel` in `src/ai-sdk/providers/varg.ts`; test `varg-idempotency.test.ts` |
| Preview placeholders | `src/ai-sdk/middleware/placeholder.ts`, preview branches in `context-builder.ts` |
| ffmpeg backend (local vs cloud) | `src/ai-sdk/providers/editly/backends/local.ts`, `src/ai-sdk/providers/editly/rendi/index.ts` |
| Default models for `vargai render` | `detectDefaultModels` in `src/cli/commands/render.tsx` |

## 5. Gotchas and invariants

- **Cache = paid generations.** Follow the Cache Policy in [CLAUDE.md](CLAUDE.md). Never delete `.cache/ai` or `.cache/fal-pending`, which holds resumable paid fal jobs.
- **Changing `computeCacheKey`/`serializeValue`/`IGNORED_PROPS_BY_TYPE` or a `withCache` prefix silently invalidates every user's cache**, so everything gets paid for again. `src/react/renderers/cache.test.ts` pins which props must not affect keys.
- Cache entries written via `withCache` expire after 7 days (`DEFAULT_TTL`), even on disk.
- Touching a local input file (its mtime changes) regenerates everything that depends on it.
- **`vargai preview` only stubs image and video** (ffmpeg placeholders, no `doGenerate`). Speech, music and caption transcription still call real providers, and preview runs with no cache, so they are paid every run. Anything the TSX `await`s generates for real in every mode.
- No `--dry-run` CLI flag exists, despite mentions in comments. Use `compile()` (section 6).
- One element means one generation: the WeakMap in `resolve.ts`, `ctx.pendingFiles`, and the varg `Idempotency-Key` all exist because of runaway duplicate-job incidents. A failed element stays failed (memoized rejection) rather than retrying paid work. Keep it that way.
- `<Clip>` without a numeric `duration` counts as 3s for timeline offsets (`VARG_DURATION_DEFAULT` diagnostic). Meanwhile, editly takes the real clip length from the first video layer and clamps explicit durations to the source length.
- varg `providerOptions.varg` must be namespaced by underlying provider (`{ varg: { fal: {...} } }`). The API drops flat keys and returns 422 on unknown `provider_options` keys. `audio` is lifted to the top level (`audio: "native"` sugar; mapping is in the API). Keep `KNOWN_UNDERLYING_PROVIDERS` in sync with the API.
- `model-rules.ts` says it mirrors the legacy gateway schemas package (gateway is frozen). It is applied only by the direct fal provider; varg API duration rules live server-side.
- Actions with `execute` ignore `routes`, which then serve as metadata only. `varg run` has no result cache.
- `render()` returns `RenderResult { video, files }`, and streaming is `renderStream.stream()`. The "render options" section of docs/react.md still shows a buffer return and `render.stream`.
- Bun only. Never write the JSX pragma text in `.tsx` comments (see [CLAUDE.md](CLAUDE.md)). Temp files must use `uniqueTempPath()` (millisecond collisions corrupted captions once).

## 6. How to verify (no paid calls)

```bash
bun install
bun run check                      # biome + tsc (CI job 1)
bun run test:ci                    # hermetic suites, no keys (CI job 2): ~440 tests, a few seconds
bun test src/react/renderers/cache.test.ts   # single file
bun run src/tests/unit.test.ts     # registry/schema unit checks, no API
```

- Do not run `src/tests/all.test.ts`, the provider tests, the rendi/storage suites, or `react.test.ts` casually. They need keys or heavy ffmpeg, and may spend money (see the comment in `.github/workflows/ci.yml`). `pricing.test.ts` has known pre-existing failures.
- **Inspect a plan and its cache keys for free.** `compile()` never generates: `compile(Render({...})).toJSON()` (from `src/react/index.ts`) lists the steps, `dependsOn`, `cacheKey`, and diagnostics. Model objects such as `varg.videoModel("kling-v3")` can be constructed without a key.
- `vargai list` and `vargai which <name>` only read the registry. `vargai storyboard f.tsx` reads cached images only. `vargai preview f.tsx` needs local ffmpeg/ffprobe. It is free only for compositions without Speech/Music/Captions-by-transcription and without top-level `await`s.
- Pre-push runs `bun run type-check`. Commit messages must pass commitlint (`commitlint.config.js`, conventional types).
