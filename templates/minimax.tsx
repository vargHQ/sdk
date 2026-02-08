/**
 * MiniMax/Hailuo Video Templates
 *
 * Model: minimax (fal-ai/minimax-video)
 * Best for: Cinematic shots, facial expressions, rack focus, dolly zoom
 *
 * Key principles from research:
 * - Requires detailed, well-structured prompts
 * - Put most important elements FIRST (attention prioritizes beginning)
 * - Define: lighting, camera movements, actor positions, mood
 * - Works great: rack focus, dolly zoom, tracking shots
 * - Use positive descriptions, not negative prompts
 *
 * Prompt formula:
 * [Camera Shot + Motion] + [Subject + Description] + [Action] +
 * [Scene + Description] + [Lighting] + [Style/Mood]
 *
 * Run: bunx vargai render sdk-templates/minimax.tsx
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
  model: "minimax",
  width: 1080,
  height: 1920, // 9:16 vertical
  voiceId: "5l5f8iK3YPeGga21rQIX",
};

// ============================================================================
// TEMPLATE 1: Urban Nightlife (Cinematic)
// ============================================================================

const URBAN_NIGHT_PROMPT = `
Medium tracking shot following a lone figure in a dark coat walking down
rain-slicked Tokyo alley at night, neon signs reflecting in puddles of
pink and blue light, steam rising from street vents, camera moves parallel
to subject from side angle, moody film noir atmosphere with high contrast,
photorealistic, shot on Arri Alexa, 8k resolution.
`;

const urbanVideo = Video({
  prompt: URBAN_NIGHT_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 2: Nature Documentary Style
// ============================================================================

const NATURE_DOC_PROMPT = `
Wide establishing shot of misty mountain valley at sunrise, camera slowly
pans right to reveal elk herd grazing in meadow below, golden morning light
filtering through fog, natural documentary cinematography, soft focus on
distant peaks, serene and peaceful atmosphere, 8k photorealistic, natural lighting.
`;

const natureVideo = Video({
  prompt: NATURE_DOC_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 3: Rack Focus Effect (MiniMax specialty)
// ============================================================================

const RACK_FOCUS_PROMPT = `
Close-up shot starting focused on a blooming red rose in foreground,
camera shifts focus to reveal a woman's face in the background watching
with a gentle smile, soft diffused window light illuminating both subjects,
romantic atmosphere, shallow depth of field, photorealistic, cinematic movie style.
`;

const rackFocusVideo = Video({
  prompt: RACK_FOCUS_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 4: Dolly Zoom / Vertigo Effect (MiniMax specialty)
// ============================================================================

const DOLLY_ZOOM_PROMPT = `
Medium shot dolly zoom effect on a person standing at the edge of a tall
building rooftop, camera dollies out while zooming in creating vertigo
disorientation, city skyline behind subject appears to stretch impossibly,
subject's expression shifts from calm to slight unease, golden hour light,
shot on Arri Alexa, cinematic 8k, hyper-detailed.
`;

const dollyZoomVideo = Video({
  prompt: DOLLY_ZOOM_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 5: Product Video (Premium Look)
// ============================================================================

const PRODUCT_PROMPT = `
Extreme close-up slow push-in on a luxury watch face, camera glides over
polished metal surface revealing intricate dial details and crystal clarity,
soft studio lighting with subtle highlights on chrome accents, rotating
slightly to catch light on beveled edges, minimal black velvet background,
photorealistic hyper-detailed, 8k resolution, professional product photography.
`;

const productVideo = Video({
  prompt: PRODUCT_PROMPT.trim(),
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 6: Character Portrait with Expression
// ============================================================================

// Use double parentheses (( )) for emphasis on unique features
const CHARACTER_PORTRAIT_PROMPT = `
Close-up portrait, slow subtle push-in on ((40-year-old woman with shoulder-length
auburn hair, small mole above left eyebrow, wearing worn brown leather jacket)),
expression transitions from contemplative to gentle knowing smile, soft natural
window light from left creating rim light on hair, shallow depth of field with
creamy bokeh background, photorealistic, hyper-detailed skin texture, shot on
85mm lens, cinematic movie style, 8k.
`;

const characterPortraitImage = Image({
  prompt: CHARACTER_PORTRAIT_PROMPT.trim(),
  model: higgsfield.imageModel("soul", {
    styleId: higgsfield.styles.REALISTIC,
  }),
  aspectRatio: "9:16",
});

const characterPortraitVideo = Video({
  prompt: {
    text: "Woman's expression shifts subtly, natural breathing, slight smile develops, eyes show warmth, hyper-realistic movement",
    images: [characterPortraitImage],
  },
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

// ============================================================================
// TEMPLATE 7: Talking Head with Lipsync
// ============================================================================

const UGC_CHARACTER_PROMPT = `
Close-up selfie-style portrait of a friendly 25-year-old content creator,
natural makeup, wearing casual white t-shirt, warm smile, bright eyes looking
at camera, soft ring light illumination, clean minimal background, authentic
iPhone photo quality, photorealistic, 8k.
`;

const UGC_MOTION_PROMPT = `
Person speaks animatedly to camera, natural head movements, genuine smile,
expressive eyes, subtle hand gestures visible at edge of frame, authentic
social media creator energy.
`;

const UGC_SCRIPT = "You won't believe what I just discovered about AI video!";

const ugcImage = Image({
  prompt: UGC_CHARACTER_PROMPT.trim(),
  model: higgsfield.imageModel("soul", {
    styleId: higgsfield.styles.REALISTIC,
  }),
  aspectRatio: "9:16",
});

const ugcAnimated = Video({
  prompt: {
    text: UGC_MOTION_PROMPT.trim(),
    images: [ugcImage],
  },
  model: fal.videoModel(CONFIG.model),
  duration: 5,
});

const ugcVoice = Speech({
  model: elevenlabs.speechModel("eleven_v3"),
  voice: CONFIG.voiceId,
  children: UGC_SCRIPT,
});

const ugcLipsynced = Video({
  prompt: {
    video: ugcAnimated,
    audio: ugcVoice,
  },
  model: fal.videoModel("sync-v2-pro"),
});

// ============================================================================
// TEMPLATE 8: Atmospheric Mood Scene
// ============================================================================

const ATMOSPHERIC_PROMPT = `
Wide shot slow crane movement descending through thick morning fog in an
ancient forest, camera reveals moss-covered stone ruins below, shafts of
pale sunlight pierce through canopy creating god rays, particles of dust
and pollen drift lazily in light beams, mystical ethereal atmosphere,
photorealistic, 8k cinematic, shot on Arri Alexa.
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

// Option 1: Urban nightlife
// export default (
//   <Render width={CONFIG.width} height={CONFIG.height}>
//     <Clip duration={5}>{urbanVideo}</Clip>
//   </Render>
// );

// Option 2: Rack focus (MiniMax specialty)
// export default (
//   <Render width={CONFIG.width} height={CONFIG.height}>
//     <Clip duration={5}>{rackFocusVideo}</Clip>
//   </Render>
// );

// Option 3: UGC Talking head with lipsync
export default (
  <Render width={CONFIG.width} height={CONFIG.height}>
    <Music
      prompt="upbeat positive pop, social media energy, friendly vibe"
      model={elevenlabs.musicModel()}
      volume={0.1}
    />
    <Clip duration={5}>{ugcLipsynced}</Clip>
    <Captions src={ugcVoice} style="tiktok" color="#ffffff" />
  </Render>
);

// Option 4: Atmospheric mood
// export default (
//   <Render width={1920} height={1080}>
//     <Clip duration={5}>{atmosphericVideo}</Clip>
//   </Render>
// );

// ============================================================================
// MINIMAX PROMPT CHEAT SHEET
// ============================================================================
/*

PROMPT FORMULA:
[Camera Shot + Motion] + [Subject + Description] + [Action] +
[Scene + Description] + [Lighting] + [Style/Mood]

PUT IMPORTANT THINGS FIRST - Attention mechanism prioritizes beginning!

CAMERA SHOTS:
- Close-up, medium shot, wide shot, extreme close-up
- Tracking shot, dolly zoom, pan left/right
- Dutch angle, rack focus, match cut, drone shot

CINEMATIC TECHNIQUES THAT WORK WELL:
✅ Rack Focus: "Camera shifts focus from subject A to subject B in background"
✅ Dolly Zoom (Vertigo): "Dolly out while zooming in"
✅ Tracking Shots: "Camera follows subject from behind/side"

PHOTOREALISM KEYWORDS (avoid cartoon look):
- photorealistic
- hyper-detailed
- shot on Arri Alexa
- 8k resolution
- cinematic movie style
- natural lighting

CHARACTER CONSISTENCY:
1. Be hyper-specific: "40-year-old woman with shoulder-length auburn hair"
2. Copy-paste EXACT description for every clip
3. Use (( )) for emphasis on unique features

WHAT TO AVOID:
❌ Vague prompts ("a person walking")
❌ Multiple conflicting actions
❌ No camera direction
❌ Generic descriptions ("lovely scenery")
❌ Negative instructions (use positive prompts instead)

LIGHTING KEYWORDS:
- soft window light, golden hour
- studio lighting, ring light
- neon signs, candlelight
- rim light, backlit, silhouette

*/
