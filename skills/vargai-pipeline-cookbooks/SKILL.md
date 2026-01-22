---
name: vargai-pipeline-cookbooks
description: This skill should be used when the user asks to "create a talking character pipeline", "make a text-to-tiktok video", "build a round selfie video for Telegram", "do trendwatching with Apify", or "create a Remotion video pipeline".
version: 0.1.0
allowed-tools: Read, Bash
---

# pipeline cookbooks

Provide complete, multi-step workflows for common varg pipelines. Select the closest cookbook and follow its steps end-to-end.

## select a cookbook

- **Talking character (full workflow)**: `references/talking-character-pipeline.md`
- **Talking character (short form)**: `references/talking-character.md`
- **Text-to-TikTok**: `references/text-to-tiktok.md`
- **Round video character (Telegram selfie)**: `references/round-video-character.md`
- **Trendwatching (Apify + TikTok)**: `references/trendwatching.md`
- **Remotion editing pipeline**: `references/remotion-video.md`

## scripts

Use helper scripts from `scripts/` when the cookbook calls for them. Avoid editing scripts unless requested.

## notes

- Assume Bun and the varg SDK are available.
- Many steps require API keys (`FAL_API_KEY`, `ELEVENLABS_API_KEY`, `REPLICATE_API_TOKEN`, `GROQ_API_KEY`).
- Prefer the full talking-character pipeline when quality matters; use the short form for quick tests.
