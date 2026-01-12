# VARG SDK Examples

5 typical examples covering 100% of common use cases.

| # | Example | % of Scripts | Description |
|---|---------|--------------|-------------|
| 1 | `01_simple_ugc.ts` | 40% | Basic UGC: Image → Animation → Voice → Lipsync |
| 2 | `02_batch_15_characters.ts` | 25% | Campaign with 15 characters, batched processing |
| 3 | `03_postproduction_batch.ts` | 10% | Post-production: captions, aspect ratios |
| 4 | `04_hook_body_packshot.ts` | 18% | Ad creative: Hook → Body → Packshot |
| 5 | `05_outfit_variations.ts` | 7% | Generate character outfit variations |

## Run

```bash
npx ts-node examples/01_simple_ugc.ts
```

## Batch Sizes

| Operation | Batch Size | Reason |
|-----------|------------|--------|
| Image Generation | 8 | Fast API |
| Animation (Kling) | 3 | Rate limited |
| Voiceover (ElevenLabs) | 5 | API limits |
| Lipsync | 3 | Slow processing |
