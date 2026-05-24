# sdk structure

## lib/ - two fal implementations

### lib/ai-sdk/fal.ts
uses `@ai-sdk/fal` with vercel ai sdk

**when to use:**
- standard image generation
- need consistent api across providers
- want automatic image format handling
- prefer typed aspect ratios

**commands:**
```bash
bun run lib/ai-sdk/fal.ts generate_image <prompt> [model] [aspectRatio]
```

### lib/fal.ts
uses `@fal-ai/client` directly

**when to use:**
- video generation (image-to-video, text-to-video)
- advanced fal features
- need queue/streaming updates
- custom api parameters

**commands:**
```bash
bun run lib/fal.ts generate_image <prompt> [model] [imageSize]
bun run lib/fal.ts image_to_video <prompt> <imageUrl> [duration]
bun run lib/fal.ts text_to_video <prompt> [duration]
```

### lib/higgsfield.ts
uses `@higgsfield/client` for soul character generation

**commands:**
```bash
bun run lib/higgsfield.ts generate_soul <prompt> [customReferenceId]
bun run lib/higgsfield.ts create_character <name> <imageUrl1> [imageUrl2...]
bun run lib/higgsfield.ts list_styles
```

## service/ - high-level wrappers

### service/image.ts
combines fal + higgsfield for image generation

```bash
bun run service/image.ts fal <prompt> [model] [upload]
bun run service/image.ts soul <prompt> [customReferenceId] [upload]
```

### service/video.ts
video generation with optional s3 upload

```bash
bun run service/video.ts from_image <prompt> <imageUrl> [duration] [upload]
bun run service/video.ts from_text <prompt> [duration] [upload]
```

## utilities/

### utilities/s3.ts
cloudflare r2 / s3 storage operations

```bash
bun run utilities/s3.ts upload <filePath> <objectKey>
bun run utilities/s3.ts upload_from_url <url> <objectKey>
bun run utilities/s3.ts presigned_url <objectKey> [expiresIn]
```

## pipeline/cookbooks/
markdown guides for complex workflows

- `talking-character.md`: create talking character videos

## studio/ - visual node canvas for templates

`bun run src/cli/index.ts studio [file.tsx]` launches the studio at
http://localhost:8282. The studio is both a code editor and a node canvas;
each VargElement (Image, Video, Speech, Music, TalkingHead, Clip, Render,
...) appears as a single node, with data-flow ports for the nested element
slots (e.g. `Image → Video.prompt.images`, `Speech → TalkingHead.audio`).

### Layers

- **`react/element-schemas.ts`** — Zod schema per `VargElementType`, plus
  port descriptors and palette metadata. Single source of truth for the
  param panel, codegen, parser, and connection rules.
- **`studio/graph.ts`** — `WorkflowGraph` JSON document type and validators.
  A graph is a DAG of nodes (1:1 with VargElements) plus typed edges
  encoding data-flow into specific prop slots.
- **`studio/parser.ts`** — `parseElement(VargElement) → WorkflowGraph`.
  Walks a resolved element tree, extracts nested elements at known port
  paths into edges, normalises `model` references to `{ provider, id }`.
- **`studio/codegen.ts`** — `generateCode(WorkflowGraph) → TSX`. Inverse of
  the parser. Inlines producer elements at their consumer's prop path.
  Auto-emits imports for `vargai/ai` providers and `vargai/react` factories.

### On-disk format

A template `my-template` may be persisted as either form (or both):

- `src/templates/my-template.tsx` — canonical executable
- `src/templates/my-template.varg.json` — graph (positions, ids, meta)

The TSX is always authoritative for `render()`; the JSON is the friendlier
form for the canvas. Both files round-trip losslessly via `parser` ↔
`codegen`.

### Studio HTTP API (additions)

UI routes:

- `GET  /graph`                     — minimal visual canvas (palette,
                                       drawflow, JSON / TSX inspectors).

Graph endpoints:

- `GET  /api/graph/schemas`         — Zod-derived JSON Schemas for every
                                       element type, plus palette categories.
- `POST /api/graph/new    { width?, height?, fps?, name? }` — blank graph.
- `POST /api/graph/parse  { code }` — TSX → graph (imports + walks).
- `POST /api/graph/codegen { graph }`— graph → TSX (validates first).
- `POST /api/graph/load   { path? }`— read a `.varg.json` from disk.
- `POST /api/graph/save   { graph, path?, writeTsx? }` — write `.varg.json`
                                       and optionally regenerate `.tsx`.

(Existing `/api/render`, `/api/step/*`, `/api/templates` and friends are
unchanged.)

### Trying it out

CLI smoke test (no server):

```bash
cd sdk
bun run scripts/graph-demo.tsx
# or, point at any example .tsx:
bun run scripts/graph-demo.tsx src/react/examples/character-video.tsx
```

Visual canvas:

```bash
cd sdk
bun run src/cli/index.ts studio src/react/examples/quickstart-test.tsx
# then open http://localhost:8282/graph
```

### Tests

- `studio/graph.test.tsx` — round-trip validation: builds JSX, parses to a
  graph, codegens TSX, and asserts topology is preserved.

## dependencies

- `@ai-sdk/fal` - vercel ai sdk fal provider
- `@fal-ai/client` - official fal client
- `@higgsfield/client` - higgsfield api client
- `@aws-sdk/client-s3` - s3 storage
- `ai` - vercel ai sdk core

## key decisions

1. **two fal implementations** - ai-sdk for simplicity, client for power
2. **all scripts are cli + library** - can be run directly or imported
3. **consistent logging** - `[module] message` format
4. **auto image opening** - ai-sdk version opens images automatically
