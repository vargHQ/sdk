/**
 * Example 2: Batch Campaign (25% of scripts)
 *
 * 15 characters with batched processing:
 * - Images: batch of 8
 * - Animation: batch of 3 (rate limited)
 * - Voiceover: batch of 5
 * - Lipsync: batch of 3
 */

import {
  fal,
  higgsfield,
  elevenlabs,
  generateImage,
  animateImage,
  generateSpeech,
  generateLipsync,
  batch,
} from '../index'

interface Character {
  id: number
  name: string
  prompt: string
  voice: string
  script: string
}

const CHARACTERS: Character[] = [
  { id: 1, name: 'Christian Mom', prompt: 'A 42-year-old woman, cross necklace, kitchen, realistic', voice: 'matilda', script: 'First week on this diet, my cravings just stopped.' },
  { id: 2, name: 'Young Woman', prompt: 'A 21-year-old woman, blonde hair, church interior, realistic', voice: 'freya', script: 'Biblical eating made me feel spiritually grounded.' },
  { id: 3, name: 'Blue-collar Dad', prompt: 'A 38-year-old man, work clothes, garage, realistic', voice: 'callum', script: 'Lost 12 pounds just by eating early and cutting junk.' },
  { id: 4, name: 'Southern Grandma', prompt: 'A 55-year-old woman, gray hair, floral apron, kitchen, realistic', voice: 'dorothy', script: 'Only this diet made my body feel clean again.' },
  { id: 5, name: 'Midwest Nurse', prompt: 'A 33-year-old woman, scrubs, hospital, realistic', voice: 'rachel', script: 'This diet gave me energy during 12-hour shifts.' },
]

async function main() {
  // Phase 1: Images (batch of 8)
  const images = await batch(
    CHARACTERS,
    async (char) => {
      const { image } = await generateImage({
        model: higgsfield.image('soul'),
        prompt: char.prompt,
        aspectRatio: '9:16',
      })
      return { id: char.id, image }
    },
    { batchSize: 8, onProgress: (done, total) => console.log(`Images: ${done}/${total}`) }
  )

  // Phase 2: Animation (batch of 3)
  const videos = await batch(
    images.results,
    async ({ id, image }) => {
      const { video } = await animateImage({
        model: fal.video('kling'),
        image,
        prompt: 'Person speaking naturally to camera',
        duration: 10,
      })
      return { id, video }
    },
    { batchSize: 3, delayBetweenBatches: 5000, onProgress: (done, total) => console.log(`Videos: ${done}/${total}`) }
  )

  // Phase 3: Voiceover (batch of 5)
  const voices = await batch(
    CHARACTERS,
    async (char) => {
      const { audio } = await generateSpeech({
        model: elevenlabs.speech('multilingual_v2', { voice: char.voice as any }),
        text: char.script,
      })
      return { id: char.id, audio }
    },
    { batchSize: 5, onProgress: (done, total) => console.log(`Voices: ${done}/${total}`) }
  )

  // Phase 4: Lipsync (batch of 3)
  const inputs = videos.results.map((v) => ({
    ...v,
    audio: voices.results.find((a) => a.id === v.id)?.audio,
  }))

  const finals = await batch(
    inputs.filter((i) => i.audio),
    async ({ id, video, audio }) => {
      const { video: final } = await generateLipsync({
        model: fal.lipsync(),
        video,
        audio: audio!,
      })
      return { id, video: final }
    },
    { batchSize: 3, delayBetweenBatches: 5000, onProgress: (done, total) => console.log(`Lipsync: ${done}/${total}`) }
  )

  console.log(`Done: ${finals.results.length}/${CHARACTERS.length} videos`)
  return finals.results
}

main().catch(console.error)
