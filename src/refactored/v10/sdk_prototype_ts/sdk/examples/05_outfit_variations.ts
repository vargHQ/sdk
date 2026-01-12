/**
 * Example 5: Outfit/Style Variations (7% of scripts)
 *
 * Generate one character, then create multiple outfit variations using NanoBanana.
 */

import { fal, higgsfield, generateImage, transformImage, animateImage, parallel, batch } from '../index'

const BASE_CHARACTER = {
  prompt: `A fit 28-year-old woman with athletic build, confident smile,
    ponytail, looking at camera, bright gym background, realistic`,
}

const OUTFIT_VARIATIONS = [
  { id: 1, name: 'Yoga Studio', prompt: 'wearing yoga clothes, peaceful yoga studio with plants' },
  { id: 2, name: 'Running Outdoors', prompt: 'wearing running outfit, sunrise park trail' },
  { id: 3, name: 'Home Workout', prompt: 'wearing sports bra and leggings, cozy living room' },
  { id: 4, name: 'Swimming Pool', prompt: 'wearing stylish swimsuit, poolside with palm trees' },
  { id: 5, name: 'Boxing Gym', prompt: 'wearing boxing gloves and sports top, boxing gym' },
]

async function main() {
  // 1. Generate base character
  const { image: baseImage } = await generateImage({
    model: higgsfield.image('soul'),
    prompt: BASE_CHARACTER.prompt,
    aspectRatio: '9:16',
  })

  // 2. Generate outfit variations (parallel)
  const variations = await parallel(
    OUTFIT_VARIATIONS,
    async (variation) => {
      const { image } = await transformImage({
        model: fal.image('nano-banana'),
        image: baseImage,
        prompt: variation.prompt,
      })
      return { id: variation.id, name: variation.name, image }
    },
    { maxConcurrent: 5, onProgress: (done, total) => console.log(`Variations: ${done}/${total}`) }
  )

  // 3. Animate each (batch of 3 due to rate limits)
  const animated = await batch(
    variations.results,
    async (variation) => {
      const { video } = await animateImage({
        model: fal.video('kling'),
        image: variation.image,
        prompt: 'Woman doing light exercises, energetic movement',
        duration: 5,
      })
      return { id: variation.id, name: variation.name, video }
    },
    { batchSize: 3, delayBetweenBatches: 5000, onProgress: (done, total) => console.log(`Animations: ${done}/${total}`) }
  )

  console.log(`Done: ${animated.results.length} variations`)
  animated.results.forEach((v) => console.log(`  ${v.name}: ${v.video.url}`))

  return animated.results
}

main().catch(console.error)
