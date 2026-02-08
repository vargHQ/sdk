/**
 * Hunyuan Video Templates
 *
 * Note: Hunyuan is available via Tencent/HuggingFace, not via fal.ai directly.
 * This template shows the prompt structures that work best with Hunyuan.
 * For SDK integration, use wan-2.5 with similar prompt styles.
 *
 * Best for: Realistic scenes, long videos (up to 16s), detailed prompts
 *
 * Key principles from research:
 * - 7 Essential Components: Subject, Scene, Motion, Camera, Atmosphere, Lighting, Shot
 * - 100-300 words optimal for prompts
 * - Free to use (open source via HuggingFace)
 * - Better than Wan for text-to-video if you want fast + prompt adherence
 *
 * For now, these prompts can be used with wan-2.5 which has similar capabilities.
 *
 * Run: bunx vargai render sdk-templates/hunyuan.tsx
 */
import { elevenlabs, fal, higgsfield } from "vargai/ai";
import {
  Captions,
  Clip,
  Image,
  Music,
  Render,
  Speech,
  Video,
} from "vargai/react";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Using wan-2.5 as the model since Hunyuan isn't directly on fal
  // These prompts are optimized for Hunyuan-style detailed descriptions
  model: "wan-2.5",
  width: 1080,
  height: 1920,
  voiceId: "5l5f8iK3YPeGga21rQIX",
};

// ============================================================================
// THE 7 HUNYUAN COMPONENTS (apply to any video model)
// ============================================================================
// 1. Subject - Main focus
// 2. Scene - Environment
// 3. Motion - What's happening
// 4. Camera Movement - How we see it
// 5. Atmosphere - Mood/feeling
// 6. Lighting - Light source and quality
// 7. Shot Composition - Framing

// ============================================================================
// TEMPLATE 1: Serene Mountain Hiker
// ============================================================================

const MOUNTAIN_HIKER_PROMPT = `
A lone hiker with a bright red backpack ascends a rocky trail in a tranquil
mountain range at sunrise. Layers of mist roll over the peaks in the distance.
The hiker pauses to admire the breathtaking view, turning slightly to survey
the landscape.

The camera begins with a wide-angle shot capturing the vast terrain, then
slowly zooms in to focus on the hiker's steady climb. The golden hour sunlight
casts long shadows across the rocky ground, creating warm orange and purple
hues in the sky.

The peaceful atmosphere is enhanced by the gentle movement of clouds and
the subtle sway of alpine grass in the morning breeze. Documentary
cinematography style, photorealistic 8k resolution.
`;

const mountainVideo = Video({
  prompt: MOUNTAIN_HIKER_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 2: Bustling City Street
// ============================================================================

const CITY_STREET_PROMPT = `
A street vendor prepares food at a small cart on a lively urban street filled
with pedestrians, bicycles, and colorful storefronts. Steam rises from the grill
as the vendor flips food with practiced precision.

Passersby walk briskly in the background, creating a dynamic flow of movement.
The camera employs a tracking shot, following the vendor's skilled hands as they
work, before panning upward to reveal the bustling street scene.

Warm afternoon light filters through gaps between buildings, creating pockets
of golden illumination. The energetic atmosphere captures the authentic rhythm
of city life. Street photography style, natural documentary lighting.
`;

const cityStreetVideo = Video({
  prompt: CITY_STREET_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 3: Ocean Sunset
// ============================================================================

const OCEAN_SUNSET_PROMPT = `
Dramatic ocean sunset scene. Waves crash rhythmically against dark volcanic rocks
in the foreground. The sun descends toward the horizon, painting the sky in
brilliant oranges, pinks, and deep purples.

Camera holds a static wide shot, allowing the natural drama to unfold. Seabirds
fly across the frame in silhouette. The water reflects the fiery colors above,
creating a mirror effect on the calm sections between waves.

Serene yet powerful atmosphere. The lighting transitions gradually as the sun
sinks lower, creating god rays through scattered clouds. Nature documentary
cinematography, 4k resolution.
`;

const oceanSunsetVideo = Video({
  prompt: OCEAN_SUNSET_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 4: Coffee Shop Morning
// ============================================================================

const COFFEE_SHOP_PROMPT = `
Interior of a cozy artisan coffee shop on a quiet morning. A barista crafts
latte art on a fresh cup, swirling the milk with careful precision. Steam rises
from the espresso machine in the background.

The camera captures a medium close-up of the cup, then slowly pulls back to
reveal the warm wooden counter and shelves lined with coffee beans. Morning
sunlight streams through large windows, creating soft shadows and highlighting
the dust particles in the air.

Calm, inviting atmosphere with warm color tones. The soft clatter of cups and
quiet indie music suggest a peaceful start to the day. Lifestyle photography
style, shallow depth of field.
`;

const coffeeShopVideo = Video({
  prompt: COFFEE_SHOP_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 5: Night Market
// ============================================================================

const NIGHT_MARKET_PROMPT = `
Vibrant Asian night market scene bursting with color and activity. Food stalls
stretch along both sides of a narrow alley, their warm light illuminating the
faces of browsing customers. Vendors call out their specialties while smoke
rises from sizzling woks.

The camera moves in a slow tracking shot down the center of the market,
capturing the array of fresh produce, hanging lanterns, and handwritten signs.
Neon lights mix with traditional paper lanterns to create a magical glow.

Electric, festive atmosphere filled with the bustle of evening shoppers. The
lighting creates dramatic contrasts between bright stalls and shadowy gaps.
Travel documentary style, rich saturated colors.
`;

const nightMarketVideo = Video({
  prompt: NIGHT_MARKET_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 6: Product Reveal
// ============================================================================

const PRODUCT_REVEAL_PROMPT = `
Sleek technology product reveal on a minimalist set. A modern smartphone
rests on a floating platform with a gradient backdrop transitioning from
deep black to subtle purple. The device catches carefully placed studio lights
that highlight its curved edges and glass surface.

The camera executes a slow orbit around the product, revealing its profile
from multiple angles. Subtle lens flares appear as the light catches the
screen. The platform rotates slightly, creating dynamic reflections.

Premium, sophisticated atmosphere conveying innovation and luxury. Soft key
light with accent lighting creating highlights on metallic elements. High-end
commercial photography style, 8k resolution.
`;

const productRevealVideo = Video({
  prompt: PRODUCT_REVEAL_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 7: Talking Head (Detailed Style)
// ============================================================================

const TALKING_HEAD_CHARACTER = `
Close-up portrait of a confident professional in their early 30s with warm
brown eyes and a friendly expression. They wear a crisp white button-down shirt
against a soft, blurred home office background. Natural window light illuminates
their face from the left, creating soft shadows. Hair is neatly styled, skin
shows natural texture. Authentic, approachable demeanor. iPhone photo quality,
photorealistic.
`;

const TALKING_HEAD_MOTION = `
The person speaks directly to camera with natural enthusiasm. Subtle head tilts
and nods punctuate their points. Eyes maintain warm contact with the lens.
Occasional small gestures visible at the edge of frame. Natural breathing and
blinking create authentic presence. Professional yet personable energy.
`;

const TALKING_HEAD_SCRIPT = "Here's what nobody tells you about building AI products.";

const talkingHeadImage = Image({
  prompt: TALKING_HEAD_CHARACTER.trim(),
  model: higgsfield.imageModel("soul", {
    styleId: higgsfield.styles.REALISTIC,
  }),
  aspectRatio: "9:16",
});

const talkingHeadAnimated = Video({
  prompt: {
    text: TALKING_HEAD_MOTION.trim(),
    images: [talkingHeadImage],
  },
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

const talkingHeadVoice = Speech({
  model: elevenlabs.speechModel("eleven_v3"),
  voice: CONFIG.voiceId,
  children: TALKING_HEAD_SCRIPT,
});

const talkingHeadLipsynced = Video({
  prompt: {
    video: talkingHeadAnimated,
    audio: talkingHeadVoice,
  },
  model: fal.videoModel("sync-v2-pro"),
});

// ============================================================================
// TEMPLATE 8: Forest Path
// ============================================================================

const FOREST_PATH_PROMPT = `
A winding path through an ancient forest. Massive redwood trees stretch upward,
their canopy filtering dappled sunlight onto the fern-covered ground below.
Shafts of golden light pierce through gaps in the foliage, illuminating floating
particles and pollen.

The camera moves forward along the path in a smooth steadicam shot, as if the
viewer is walking through this primordial space. Moss-covered rocks line the
trail, and small forest creatures might be glimpsed in the underbrush.

Peaceful, meditative atmosphere with a sense of ancient mystery. Soft natural
lighting creates contrast between bright patches and deep forest shadows.
Nature documentary cinematography, rich green color grading.
`;

const forestPathVideo = Video({
  prompt: FOREST_PATH_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// EXPORT: Choose your template
// ============================================================================

// Uncomment the template you want to render:

// Option 1: Mountain hiker
// export default (
//   <Render width={1920} height={1080}>
//     <Clip duration={5}>{mountainVideo}</Clip>
//   </Render>
// );

// Option 2: Night market
// export default (
//   <Render width={CONFIG.width} height={CONFIG.height}>
//     <Clip duration={5}>{nightMarketVideo}</Clip>
//   </Render>
// );

// Option 3: Talking head with lipsync
export default (
  <Render width={CONFIG.width} height={CONFIG.height}>
    <Music
      prompt="modern tech ambient, thoughtful, professional podcast vibe"
      model={elevenlabs.musicModel()}
      volume={0.1}
    />
    <Clip duration={5}>{talkingHeadLipsynced}</Clip>
    <Captions src={talkingHeadVoice} style="tiktok" color="#ffffff" />
  </Render>
);

// Option 4: Product reveal
// export default (
//   <Render width={1920} height={1080}>
//     <Clip duration={5}>{productRevealVideo}</Clip>
//   </Render>
// );

// ============================================================================
// HUNYUAN PROMPT CHEAT SHEET
// ============================================================================
/*

THE 7 ESSENTIAL COMPONENTS:
1. Subject - Main focus of the scene
2. Scene - Environment and setting
3. Motion - What's happening, how things move
4. Camera Movement - How we see it unfold
5. Atmosphere - Mood and feeling
6. Lighting - Light source and quality
7. Shot Composition - Framing and composition

PROMPT STRUCTURE (100-300 words optimal):
1. Lead with Subject: Clear, detailed description
2. Establish Scene: Setting details immediately after
3. Describe Action: Focus on what can happen in 5 seconds
4. Specify Camera Work: Clear movement instructions
5. Set Mood and Lighting: Atmospheric details last

CAMERA MOVEMENT TYPES (Official):
- zoom in, zoom out
- pan up, pan down, pan left, pan right
- tilt up, tilt down, tilt left, tilt right
- around left, around right
- static shot, handheld shot

FROM OFFICIAL DOCUMENTATION:
- Short Description: Main content of scene
- Dense Description: Scene content + transitions + camera movements
- Background: Environment description
- Style: Documentary, cinematic, realistic, sci-fi
- Shot Type: Aerial, close-up, medium, long shot
- Lighting: Lighting conditions
- Atmosphere: Cozy, tense, mysterious, peaceful

TIPS:
- Keep under 77 tokens for ComfyUI (avoid warnings)
- 100-300 words optimal for full prompts
- Hunyuan better than Wan for T2V if you want fast + prompt adherence
- LoRA works great with HunyuanVideo
- Free and open source via HuggingFace

EXAMPLE STRUCTURE:
"[Subject description]. [What they're doing]. [Scene setting].

The camera [movement description], [revealing/capturing/following] [what].
[Additional movement or transition].

[Atmosphere description]. [Lighting description]. [Style keywords]."

*/
