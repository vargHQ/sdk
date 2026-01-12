// examples/basic.ts

import { generateImage, generateVideo, animateImage } from '@varg/sdk';
import { fal } from '@varg/fal';

async function main() {
  // ============================================
  // IMAGE GENERATION
  // ============================================

  // Generate image with Flux
  const { image } = await generateImage({
    model: fal.image('fal-ai/flux/schnell'),
    prompt: 'A cyberpunk samurai in neon-lit Tokyo',
    aspectRatio: '16:9',
    providerOptions: {
      fal: {
        num_inference_steps: 4,
      },
    },
  });

  console.log('Generated image:', image.mediaType);

  // Generate with Flux Pro
  const { images } = await generateImage({
    model: fal.image('fal-ai/flux-pro/v1.1'),
    prompt: 'A serene mountain landscape at sunset',
    n: 2,
    aspectRatio: '16:9',
    providerOptions: {
      fal: {
        guidance_scale: 3.5,
        num_inference_steps: 28,
      },
    },
  });

  console.log('Generated images:', images.length);

  // ============================================
  // VIDEO GENERATION
  // ============================================

  // Text to video with Kling
  const { video } = await generateVideo({
    model: fal.video('fal-ai/kling-video/v2/master/text-to-video'),
    prompt: 'A cat playing piano in a jazz club',
    duration: 5,
    aspectRatio: '16:9',
    providerOptions: {
      fal: {
        cfg_scale: 0.5,
      },
    },
  });

  console.log('Generated video:', video.mediaType);

  // Image to video - animate the generated image
  const { video: animatedVideo } = await animateImage({
    model: fal.video('fal-ai/kling-video/v2/master/image-to-video'),
    image, // Pass the generated image directly!
    prompt: 'The samurai slowly draws their sword',
    duration: 5,
    providerOptions: {
      fal: {
        cfg_scale: 0.5,
      },
    },
  });

  console.log('Animated video:', animatedVideo.mediaType);

  // Video with Runway
  const { video: runwayVideo } = await generateVideo({
    model: fal.video('fal-ai/runway-gen3/turbo/image-to-video'),
    prompt: 'Ocean waves crashing on rocks',
    providerOptions: {
      fal: {
        seconds: 5,
      },
    },
  });

  console.log('Runway video:', runwayVideo.mediaType);

  // ============================================
  // CHAINING - Image → Video
  // ============================================

  // Step 1: Generate character
  const { image: character } = await generateImage({
    model: fal.image('fal-ai/flux-pro/v1.1'),
    prompt: 'Portrait of a mysterious wizard with glowing eyes, fantasy art',
    aspectRatio: '9:16',
  });

  // Step 2: Animate character
  const { video: characterVideo } = await animateImage({
    model: fal.video('fal-ai/kling-video/v2/master/image-to-video'),
    image: character, // Direct chaining!
    prompt: 'The wizard raises their hand and casts a spell',
    duration: 5,
  });

  // Step 3: Save result
  // video.base64 contains the video data
  // video.uint8Array for binary operations
  console.log('Character video generated!');
}

main().catch(console.error);
