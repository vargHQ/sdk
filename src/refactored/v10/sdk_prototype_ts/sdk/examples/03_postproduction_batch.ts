/**
 * Example 3: Post-Production Batch (10% of scripts)
 *
 * Take existing videos and apply:
 * - Captions
 * - Aspect ratio conversion (9:16 → 4:5, 1:1)
 */

import { addCaptions, addVoiceover, convertAspectRatio, batch, type AspectRatio } from '../index'

const INPUT_VIDEOS = [
  { id: 1, url: 'https://s3.varg.ai/videos/char_01.mp4', script: 'I lost 20 pounds in just 30 days.' },
  { id: 2, url: 'https://s3.varg.ai/videos/char_02.mp4', script: 'My energy levels are through the roof.' },
  { id: 3, url: 'https://s3.varg.ai/videos/char_03.mp4', script: 'The best part? I never felt hungry.' },
]

const OUTPUT_RATIOS: AspectRatio[] = ['9:16', '4:5', '1:1']

async function main() {
  // Step 1: Add captions
  const captioned = await batch(
    INPUT_VIDEOS,
    async (item) => {
      const { video } = await addCaptions({
        video: item.url,
        text: item.script,
        style: { position: 'bottom', fontSize: 55, useBounce: true },
      })
      return { id: item.id, video }
    },
    { batchSize: 5, onProgress: (done, total) => console.log(`Captions: ${done}/${total}`) }
  )

  // Step 2: Convert to multiple aspect ratios
  const results: Array<{ id: number; ratio: AspectRatio; url: string }> = []

  for (const { id, video } of captioned.results) {
    results.push({ id, ratio: '9:16', url: video.url })

    for (const ratio of OUTPUT_RATIOS.filter((r) => r !== '9:16')) {
      const { video: converted } = await convertAspectRatio({
        video,
        targetRatio: ratio,
        addBlurredBackground: true,
      })
      results.push({ id, ratio, url: converted.url })
    }
  }

  console.log(`Done: ${results.length} videos (${INPUT_VIDEOS.length} × ${OUTPUT_RATIOS.length} formats)`)
  return results
}

main().catch(console.error)
