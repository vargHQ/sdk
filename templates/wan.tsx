/**
 * Wan 2.1/2.5 Video Templates
 *
 * Models: wan-2.5, wan-2.5-preview
 * Best for: Open-source flexibility, camera adherence, stylized content
 *
 * Key principles from research:
 * - Camera movements work exceptionally well
 * - Formula: Subject + Scene + Motion (basic) or + Camera + Atmosphere + Style (advanced)
 * - Supports many artistic styles: cyberpunk, anime, pixel art, etc.
 * - Good balance of speed and quality
 *
 * Run: bunx vargai render sdk-templates/wan.tsx
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
  model: "wan-2.5",
  width: 1080,
  height: 1920,
  voiceId: "5l5f8iK3YPeGga21rQIX",
};

// ============================================================================
// PROMPT FORMULAS
// ============================================================================

// Basic: Subject + Scene + Motion
// Advanced: Subject (Description) + Scene (Description) + Motion (Description)
//           + Camera Language + Atmosphere + Style

// ============================================================================
// TEMPLATE 1: Close-up Portrait
// ============================================================================

const PORTRAIT_PROMPT = `
Close-up shot, soft light falls on her skin, outlining delicate contours.
Young woman with flowing black hair, gentle expression, eyes slowly close
and open. Shallow depth of field, creamy bokeh background. Natural lighting,
peaceful serene atmosphere. Photorealistic 8k.
`;

const portraitVideo = Video({
  prompt: PORTRAIT_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 2: Tracking Shot (Wan specialty)
// ============================================================================

const TRACKING_SHOT_PROMPT = `
Medium shot, camera follows subject. Woman gracefully walking among wildflowers,
long white dress fluttering in the breeze. Camera tracks parallel to her movement.
Golden hour sunlight, field stretches to distant hills. Dreamy ethereal atmosphere.
Cinematic style, photorealistic.
`;

const trackingVideo = Video({
  prompt: TRACKING_SHOT_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 3: Dolly Push-in
// ============================================================================

const DOLLY_IN_PROMPT = `
Camera slowly pushes in, dolly movement. Old wooden desk with antique typewriter,
steam rising from coffee cup beside scattered papers. Morning light streams
through dusty window, dust particles dance in beams. Nostalgic writer's study
atmosphere. Warm vintage color grading, cinematic style.
`;

const dollyInVideo = Video({
  prompt: DOLLY_IN_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 4: Orbit Shot
// ============================================================================

const ORBIT_SHOT_PROMPT = `
Camera rotates around subject, orbit shot. Sculptor working on marble statue
in sun-drenched workshop. Camera circles slowly, revealing different angles
of the emerging figure. Marble dust floats in afternoon light. Focused artistic
atmosphere. Documentary cinematography style.
`;

const orbitVideo = Video({
  prompt: ORBIT_SHOT_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 5: Time-lapse Effect
// ============================================================================

const TIMELAPSE_PROMPT = `
Time-lapse effect, plants growing and blooming. Small seed in soil, sprout emerges
and unfurls leaves, stem extends upward, bud forms and opens into vibrant red flower.
Soft studio lighting, clean white background. Scientific documentation style,
mesmerizing transformation.
`;

const timelapseVideo = Video({
  prompt: TIMELAPSE_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 6: Slow Motion
// ============================================================================

const SLOWMO_PROMPT = `
Slow motion magnifies every step. Athlete running through rain-soaked city street,
water droplets suspended in air around their movement. Street lights create halos
in the mist. Determined expression, powerful stride. Dramatic sports documentary
style, high contrast lighting.
`;

const slowmoVideo = Video({
  prompt: SLOWMO_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 7: Cyberpunk Style
// ============================================================================

const CYBERPUNK_PROMPT = `
Cyberpunk night city scene. Camera slowly pans right revealing neon-lit skyline,
flying vehicles streak across frame leaving light trails. Rain falls through
holographic advertisements. Protagonist in tech-enhanced jacket walks through
crowded street market. Futuristic elements, neon lights everywhere. High contrast
cyberpunk style, purple and cyan color palette.
`;

const cyberpunkVideo = Video({
  prompt: CYBERPUNK_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 8: Anime Style
// ============================================================================

const ANIME_PROMPT = `
Chinese anime style. Young hero stands on cliff edge, wind dramatically blowing
hair and cloak. Camera slowly pulls back to reveal vast fantasy landscape below,
floating islands in distance. Sunset paints sky in orange and purple. Dramatic
determined pose, epic adventure atmosphere. Detailed anime illustration style.
`;

const animeVideo = Video({
  prompt: ANIME_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 9: Product Showcase
// ============================================================================

const PRODUCT_PROMPT = `
Camera slowly pushes in then orbits. Minimalist tech product on floating pedestal,
clean white studio environment. Subtle reflections on polished surface, ambient
particles drift gently. Camera completes half orbit revealing all angles. Premium
luxury atmosphere. Professional product photography style, hyper-detailed.
`;

const productVideo = Video({
  prompt: PRODUCT_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 10: Talking Head with Lipsync
// ============================================================================

const TALKING_HEAD_CHARACTER = `
Close-up selfie portrait of friendly young professional in their 20s,
natural makeup, casual smart attire, warm genuine smile, bright engaged eyes.
Soft natural window light, clean modern office background. iPhone photo quality,
photorealistic.
`;

const TALKING_HEAD_MOTION = `
Person speaks naturally to camera, subtle head movements, maintains eye contact,
occasional nod, genuine friendly expression. Natural breathing and blinking.
`;

const TALKING_HEAD_SCRIPT = "Let me show you something incredible!";

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
// TEMPLATE 11: Atmospheric Scene
// ============================================================================

const ATMOSPHERIC_PROMPT = `
Long shot establishing scene. Solitary lighthouse on rocky coast, waves crash
against cliffs below. Camera slowly tilts up revealing storm clouds gathering.
Seabirds circle in the wind. Lonely melancholic atmosphere, nature's raw power.
Cinematic documentary style, dramatic lighting.
`;

const atmosphericVideo = Video({
  prompt: ATMOSPHERIC_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// EXPORT: Choose your template
// ============================================================================

// Uncomment the template you want to render:

// Option 1: Tracking shot (Wan specialty)
// export default (
//   <Render width={CONFIG.width} height={CONFIG.height}>
//     <Clip duration={5}>{trackingVideo}</Clip>
//   </Render>
// );

// Option 2: Cyberpunk style
// export default (
//   <Render width={1920} height={1080}>
//     <Clip duration={5}>{cyberpunkVideo}</Clip>
//   </Render>
// );

// Option 3: Talking head with lipsync
export default (
  <Render width={CONFIG.width} height={CONFIG.height}>
    <Music
      prompt="upbeat modern pop, positive energy, professional"
      model={elevenlabs.musicModel()}
      volume={0.1}
    />
    <Clip duration={5}>{talkingHeadLipsynced}</Clip>
    <Captions src={talkingHeadVoice} style="tiktok" color="#ffffff" />
  </Render>
);

// Option 4: Time-lapse
// export default (
//   <Render width={1920} height={1080}>
//     <Clip duration={5}>{timelapseVideo}</Clip>
//   </Render>
// );

// ============================================================================
// WAN PROMPT CHEAT SHEET
// ============================================================================
/*

PROMPT FORMULAS:
Basic:    Subject + Scene + Motion
Advanced: Subject + Scene + Motion + Camera Language + Atmosphere + Style
Camera:   Camera Movement Description + Subject + Scene + Motion + Camera + Atmosphere + Style

SHOT TYPES:
- Close-up: "Close-up shot, soft light falls on her skin"
- Medium: "Medium shot, woman gracefully walking among flowers"
- Long Shot: "Long shot, bustling city street, people coming and going"
- Bird's Eye: "Bird's eye view, camera looks down on entire city"

CAMERA MOVEMENTS (Wan's strength!):
- Push In: "Camera slowly pushes in", "dolly in"
- Pull Out: "Camera slowly pulls out", "dolly out"
- Pan: "Camera gently moves sideways"
- Track: "Camera follows subject", "tracking shot"
- Orbit: "Camera rotates around", "orbit shot"
- Tilt: "Camera tilts up/down"
- Crash Zoom: "crash zoom"
- Camera Roll: "camera roll effect"

SPEED EFFECTS:
- Slow: "moves slowly", "gentle pace"
- Fast: "drives quickly", "rapid movement"
- Slow Motion: "slow motion magnifies every step"
- Time-lapse: "time-lapse effect", "plants growing and blooming"

ATMOSPHERE WORDS:
- Vibrant: "Forest with sunlight, joyful birds"
- Dreamy: "Serene forests at night with starry skies"
- Lonely: "Solitary forest with falling leaves"
- Tense: "Winds lashing at treetops, ominous"
- Majestic: "Towering trees, sense of grandeur"

STYLE KEYWORDS:
- Cyberpunk: "neon lights, futuristic elements"
- Post-apocalyptic: "desolate landscapes"
- Chinese Anime Style
- Line Art Animation
- Felt Style
- Pixel Game
- Classic Masterpiece (Van Gogh style, etc.)

PRO TIPS:
- Camera movements work exceptionally well with Wan
- Small denoise = stable but maybe boring
- Large denoise = lively but flickery
- Start at ~0.5 denoise if unsure

*/
