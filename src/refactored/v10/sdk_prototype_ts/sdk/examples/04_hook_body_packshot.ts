/**
 * Example 4: Ad Creative Assembly (18% of scripts)
 *
 * Structure: Hook (5s) → Body (15s) → B-roll (6s) → Packshot (5s)
 */

import {
  fal,
  higgsfield,
  elevenlabs,
  generateImage,
  animateImage,
  generateSpeech,
  generateLipsync,
  addCaptions,
  addTitle,
  createPackshot,
  concatVideos,
} from '../index'

const CREATIVE = {
  characterPrompt: 'A 42-year-old woman, cross necklace, warm home interior, speaking to camera',
  hookAction: 'touching her cross necklace with emotional relief',
  script: `First week on the Apostle Diet, my cravings just stopped.
    I felt lighter, calmer, and dropped 6 pounds without trying.`,
  packshotTitle: 'Start Your Apostle Journey',
  packshotButton: 'GET THE MEAL PLAN',
}

async function main() {
  // 1. Generate character
  const { image: characterImage } = await generateImage({
    model: higgsfield.image('soul'),
    prompt: CREATIVE.characterPrompt,
    aspectRatio: '9:16',
  })

  // 2. Generate HOOK (5s animated action)
  const { video: hookVideo } = await animateImage({
    model: fal.video('kling'),
    image: characterImage,
    prompt: `Person ${CREATIVE.hookAction}, looking at camera`,
    duration: 5,
  })

  // 3. Generate BODY (talking head with lipsync)
  const { video: talkingVideo } = await animateImage({
    model: fal.video('kling'),
    image: characterImage,
    prompt: 'Person speaking naturally to camera, friendly expression',
    duration: 10,
  })

  const { audio: voiceover } = await generateSpeech({
    model: elevenlabs.speech('multilingual_v2', { voice: 'matilda' }),
    text: CREATIVE.script,
  })

  const { video: lipsyncedVideo } = await generateLipsync({
    model: fal.lipsync(),
    video: talkingVideo,
    audio: voiceover,
  })

  const { video: bodyVideo } = await addCaptions({
    video: lipsyncedVideo,
    text: CREATIVE.script,
    style: { position: 'bottom', fontSize: 60, useBounce: true },
  })

  // 4. Generate PACKSHOT
  const { video: packshotVideo } = await createPackshot({
    config: {
      backgroundImage: characterImage,
      title: CREATIVE.packshotTitle,
      buttonText: CREATIVE.packshotButton,
      buttonColor: '#FF4444',
    },
    duration: 5,
  })

  // 5. ASSEMBLE
  const { video: final } = await concatVideos({
    videos: [hookVideo, bodyVideo, packshotVideo],
    transition: 'crossfade',
    transitionDuration: 0.3,
  })

  console.log(`Done: ${final.url}`)
  return final
}

main().catch(console.error)
