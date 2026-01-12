/**
 * Example 5: Outfit/Style Variations (7% of scripts)
 *
 * Take one character and generate multiple variations:
 * - Different outfits (NanoBanana)
 * - Different environments (Seedream)
 * - Different activities
 *
 * Then animate each variation.
 *
 * Based on: animate_variations_multiStyle.py, ava_beauty_transformations.py,
 *           generate_variations.py, face_transformation_pipeline.py
 */

import {
  fal,
  higgsfield,
  nanoBanana,
  generateImage,
  transformImage,
  animateImage,
  batch,
  parallel,
} from '../index'

// Base character
const BASE_CHARACTER = {
  name: 'Fitness Influencer',
  prompt: `A fit 28-year-old woman with athletic build, confident smile,
    natural makeup, hair in ponytail, looking at phone camera,
    bright modern gym background, realistic UGC style`,
}

// Outfit variations to generate
const OUTFIT_VARIATIONS = [
  {
    id: 1,
    name: 'Yoga Studio',
    transformPrompt: 'wearing yoga clothes, peaceful yoga studio with plants background',
    animationPrompt: 'Woman doing gentle stretches, calm breathing, serene expression',
  },
  {
    id: 2,
    name: 'Running Outdoors',
    transformPrompt: 'wearing running outfit, sunrise park trail background',
    animationPrompt: 'Woman jogging in place, energetic, morning sunlight',
  },
  {
    id: 3,
    name: 'Home Workout',
    transformPrompt: 'wearing sports bra and leggings, cozy home living room background',
    animationPrompt: 'Woman doing light exercises, casual home workout vibe',
  },
  {
    id: 4,
    name: 'Swimming Pool',
    transformPrompt: 'wearing stylish swimsuit, poolside background with palm trees',
    animationPrompt: 'Woman relaxing by pool, confident pose, tropical setting',
  },
  {
    id: 5,
    name: 'Boxing Gym',
    transformPrompt: 'wearing boxing gloves and sports top, boxing gym with bags',
    animationPrompt: 'Woman throwing punches, powerful movements, determined expression',
  },
]

async function generateOutfitVariations() {
  console.log('=' .repeat(60))
  console.log('OUTFIT VARIATION GENERATION')
  console.log(`Base: ${BASE_CHARACTER.name}`)
  console.log(`Variations: ${OUTFIT_VARIATIONS.length}`)
  console.log('=' .repeat(60))

  const imageModel = higgsfield.image('soul', { style: 'realistic' })
  const transformModel = nanoBanana.transform()
  const videoModel = fal.video('kling')

  // =========================================================================
  // Step 1: Generate base character
  // =========================================================================
  console.log('\n📸 Step 1: Generating base character...')
  const { image: baseImage } = await generateImage({
    model: imageModel,
    prompt: BASE_CHARACTER.prompt,
    aspectRatio: '9:16',
  })
  console.log(`✓ Base image: ${baseImage.url}`)

  // =========================================================================
  // Step 2: Generate outfit variations (parallel)
  // =========================================================================
  console.log('\n👗 Step 2: Generating outfit variations...')

  const variations = await parallel(
    OUTFIT_VARIATIONS,
    async (variation) => {
      const { image } = await transformImage({
        model: transformModel,
        image: baseImage,
        prompt: variation.transformPrompt,
      })
      return {
        id: variation.id,
        name: variation.name,
        image,
        animationPrompt: variation.animationPrompt,
      }
    },
    {
      maxConcurrent: 5,
      onProgress: (done, total) => console.log(`  Variations: ${done}/${total}`),
    }
  )
  console.log(`✓ Generated ${variations.results.length} variations`)

  // =========================================================================
  // Step 3: Animate each variation (batch of 3)
  // =========================================================================
  console.log('\n🎬 Step 3: Animating variations...')

  const animated = await batch(
    variations.results,
    async (variation) => {
      const { video } = await animateImage({
        model: videoModel,
        image: variation.image,
        prompt: variation.animationPrompt,
        duration: 5,
        providerOptions: { cfgScale: 0.5 },
      })
      return {
        id: variation.id,
        name: variation.name,
        imageUrl: variation.image.url,
        videoUrl: video.url,
      }
    },
    {
      batchSize: 3, // Kling rate limit
      delayBetweenBatches: 5000,
      onProgress: (done, total) => console.log(`  Animations: ${done}/${total}`),
    }
  )
  console.log(`✓ Animated ${animated.successful} variations`)

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n' + '='.repeat(60))
  console.log('VARIATIONS COMPLETE')
  console.log('='.repeat(60))

  console.log('\nGenerated variations:')
  animated.results.forEach((v) => {
    console.log(`\n${v.id}. ${v.name}`)
    console.log(`   Image: ${v.imageUrl}`)
    console.log(`   Video: ${v.videoUrl}`)
  })

  // Return structured results (for campaign use)
  return {
    baseCharacter: BASE_CHARACTER.name,
    baseImage: baseImage.url,
    variations: animated.results,
  }
}

generateOutfitVariations().catch(console.error)
