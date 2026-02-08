/**
 * Kling 3.0 Video Templates
 * 
 * Best for: Multi-shot narratives, dialogue, character consistency
 * Strengths: Native audio, up to 15s, multi-shot (6 shots max)
 * 
 * Run with: bun run sdk-templates/kling.tsx [template]
 * 
 * KLING PROMPTING PHILOSOPHY:
 * - Think in SHOTS, not clips
 * - Lead with camera motion (dolly push, whip-pan, crash zoom)
 * - Name REAL light sources (not "dramatic lighting")
 * - Include TEXTURE (grain, reflections, condensation, sweat)
 * - Describe TEMPORAL FLOW (beginning → middle → end)
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fal } from "@fal-ai/client";

// Configure fal client
const apiKey = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
if (!apiKey) {
  console.error("Error: FAL_API_KEY or FAL_KEY required");
  process.exit(1);
}
fal.config({ credentials: apiKey });

// ============================================================================
// TEMPLATE 1: PRODUCT SHOWCASE (360 ROTATION / DOLLY)
// ============================================================================
/**
 * Best for: Product videos, e-commerce, tech reveals
 * 
 * PROMPT STRUCTURE:
 * [Camera: orbit/dolly movement] + [Product: detailed description with materials]
 * + [Motion: rotation + light interaction] + [Background: clean/studio]
 * + [Lighting: named sources] + [Texture: reflections, highlights]
 */
export const PRODUCT_SHOWCASE = {
  // Premium Tech Product (Headphones)
  techProduct: `Slow orbit shot circling a pair of premium matte-black wireless headphones 
resting on a polished obsidian pedestal. Camera rotates 180 degrees around the product 
as soft rim lighting traces the brushed aluminum accents. Subtle reflections dance across 
the leather earcups. Background: gradient from deep charcoal to warm amber. 
Light source: key light from upper left, soft fill from right, backlight creating halo effect. 
Shot on macro 85mm lens with shallow depth of field, hyper-detailed product photography, 8k.`,

  // Luxury Watch
  luxuryWatch: `Dolly push-in toward an elegant gold chronograph watch displayed on black velvet. 
Camera begins at medium shot, slowly approaching until dial fills frame. 
Second hand ticks precisely as light catches the sapphire crystal face, 
creating prismatic reflections. Rose gold numerals gleam under warm spotlight. 
Background fades to pure black. Light: single overhead spot with soft diffusion, 
edge light tracing the case profile. Shot on 100mm macro, photorealistic, 
cinematic jewelry commercial aesthetic.`,

  // Sneaker Release
  sneakerReveal: `Tracking shot following a fresh white leather sneaker rotating on a turntable 
at 45 degrees. Camera holds steady while product spins 360 degrees. 
Premium stitching visible on uppers, red accent threading catching light. 
Clean white cyclorama background with soft shadows. 
Lighting: three-point setup with softboxes, subtle orange gel on backlight. 
Smooth rotation, no wobble. Commercial product video, 4k, crisp detail.`,
};

// ============================================================================
// TEMPLATE 2: TALKING HEAD / SPOKESPERSON
// ============================================================================
/**
 * Best for: CEO messages, testimonials, influencer content
 * 
 * KLING 3.0 DIALOGUE RULES:
 * - P1: Structured Naming [Character A: Description]
 * - P2: Visual Anchoring (action before dialogue)
 * - P3: Audio Details [voice quality, emotion]
 * - P4: Temporal Control ("Immediately," "Pause," "Then")
 */
export const TALKING_HEAD = {
  // Corporate Spokesperson
  corporateSpeaker: `Medium shot, static tripod, locked-off frame.
[Character A: 40-year-old executive, navy blazer, silver tie clip, confident posture]
Stands before floor-to-ceiling windows showing blurred city skyline at golden hour.

Character looks directly at camera, slight nod of acknowledgment.
[Character A, authoritative but warm voice]: "Innovation isn't just about technology—it's about people."

Subtle smile forms. Hands gesture outward naturally.
[Character A, measured pace]: "And people are at the heart of everything we build."

Soft natural light from windows, fill light from camera-left reducing shadows.
Shot on 50mm lens, shallow depth of field blurring background. 
Professional corporate video aesthetic, photorealistic.`,

  // Influencer/Creator
  influencerStyle: `Close-up shot with subtle handheld drift, shoulder-cam sway.
[Character A: 25-year-old creator, colorful oversized hoodie, nose ring, animated expressions]
Seated in bedroom setup with LED strip lights and plants visible behind.

Eyes widen with excitement, leans slightly toward camera.
[Character A, enthusiastic high energy voice]: "Okay so I FINALLY tried it and—"

Pauses dramatically, hand comes up near face.
[Character A, conspiratorial whisper]: "...it actually works."

Laughs genuinely, shakes head in disbelief.
Ring light reflection visible in eyes, RGB ambient glow from background.
Shot on 35mm, warm color grade, authentic influencer aesthetic, 4k.`,

  // Testimonial
  testimonialReal: `Medium close-up, tripod with slight breathing room.
[Character A: 50-year-old woman, reading glasses pushed up on head, genuine warmth in expression]
Seated in bright kitchen with natural light from window.

Takes a breath, looks down briefly then back to camera.
[Character A, sincere emotional voice]: "I didn't believe it at first. I really didn't."

Slight head shake, eyes glisten.
[Character A, steady gaining strength]: "But three months later, I'm a different person."

Genuine smile breaks through, small laugh of relief.
Soft window light as key, white reflector fill.
Documentary interview style, authentic, photorealistic.`,
};

// ============================================================================
// TEMPLATE 3: CINEMATIC SCENE
// ============================================================================
/**
 * Best for: Short films, ads, mood pieces
 * 
 * KEY ELEMENTS:
 * - Motion verbs: dolly push, whip-pan, crash zoom, snap focus
 * - Named lights: neon signs, candlelight, golden hour, fluorescents
 * - Texture: grain, lens flares, condensation, smoke
 * - Temporal flow: describe the progression
 */
export const CINEMATIC_SCENE = {
  // Neo-Noir Urban Night
  neoNoir: `Slow dolly push through rain-soaked Tokyo alley at midnight.
Camera drifts forward past steaming vents and puddles reflecting neon signs.
A lone figure in a dark trench coat walks away from camera, 
their silhouette fragmenting in the wet pavement reflections.
Pink and blue neon kanji characters bleed into the mist.
Condensation beads on a nearby window. Cigarette smoke curls upward.
Light sources: flickering neon, distant streetlamp, warm glow from ramen shop.
Shot on 35mm film, anamorphic lens flares, cinematic grain, 
high contrast, noir atmosphere. Handheld micro-drift.`,

  // Golden Hour Romance
  goldenHour: `Tracking shot following two silhouettes walking along beach at sunset.
Camera moves parallel from behind as waves lap at their ankles.
Long shadows stretch across wet sand. Her white dress catches the warm light.
He reaches for her hand—fingers intertwine.
She turns, laughing, face lit by pure golden hour glow.
Light source: setting sun directly behind them, rim lighting their outlines.
Lens flares dance across frame. Soft focus on distant sailboat.
Shot on 85mm, shallow depth, warm color grade, romantic cinema aesthetic.`,

  // Thriller Tension
  thrillerTension: `Static locked-off wide of dimly lit parking garage.
A figure emerges from elevator, harsh fluorescent flicker overhead.
Footsteps echo. Camera holds. Shadows stretch between concrete pillars.
Suddenly—headlights flash on across the garage. Engine revs.
Figure freezes, turns toward camera, face half-lit by approaching beams.
Light sources: dying fluorescent tubes, car headlights, exit sign glow.
Shot on wide-angle steadicam, cold blue-green color grade,
film grain, thriller tension, Fincher aesthetic.`,
};

// ============================================================================
// TEMPLATE 4: MULTI-SHOT SEQUENCE
// ============================================================================
/**
 * Kling 3.0 supports native multi-shot (up to 6 shots)
 * Use "Multi shot Prompt N:" labels for each
 * Specify duration per shot
 */
export const MULTI_SHOT = {
  // Morning Routine Montage
  morningRoutine: `Multi shot Prompt 1: Extreme close-up of alarm clock display changing from 6:59 to 7:00. 
Harsh morning light through blinds. Sharp focus snap. (Duration: 2 seconds)

Multi shot Prompt 2: Medium shot of hand reaching to silence alarm, 
camera follows arm pulling back under warm covers. Soft window light. (Duration: 3 seconds)

Multi shot Prompt 3: Wide shot of figure sitting up in bed, stretching arms overhead.
Dust particles visible in beam of sunlight. Slow motion. (Duration: 3 seconds)

Multi shot Prompt 4: Close-up of coffee being poured into ceramic mug.
Steam rises, swirls in morning light. Rich brown liquid. (Duration: 2 seconds)

Multi shot Prompt 5: Medium shot through kitchen window, 
figure sipping coffee looking out at city waking up. Contemplative mood. (Duration: 5 seconds)

Consistent lighting: warm morning sun, natural documentary style, 35mm film aesthetic.`,

  // Action Sequence
  actionChase: `Multi shot Prompt 1: Wide establishing shot of busy street market.
Crowds, colorful stalls, chaotic energy. Suddenly, figure bursts through crowd running. 
(Duration: 3 seconds)

Multi shot Prompt 2: Handheld tracking shot following runner from behind.
Camera bounces with urgency. Stalls blur past. People dive out of way. (Duration: 3 seconds)

Multi shot Prompt 3: Low angle, runner leaps over fruit cart.
Slow motion as oranges scatter, suspended in air. 
Light catches droplets of sweat. (Duration: 2 seconds)

Multi shot Prompt 4: Crash zoom to pursuer's face emerging from crowd.
Determination in eyes. Heavy breathing visible. (Duration: 2 seconds)

Multi shot Prompt 5: Wide from above—bird's eye—two figures racing through maze of alleys.
Shadows slice geometric patterns. Urban thriller energy. (Duration: 3 seconds)

Consistent color grade: high contrast, desaturated except reds, handheld urgency.`,

  // Product Story
  productStory: `Multi shot Prompt 1: Black screen. Sound of packaging opening.
Light reveals elegant box, hands lifting lid. Anticipation. (Duration: 3 seconds)

Multi shot Prompt 2: Close-up of product emerging from tissue paper.
Camera dollies back as product is lifted into frame. 
Studio lighting, clean white background. (Duration: 3 seconds)

Multi shot Prompt 3: Orbit shot, product floating center frame, 
rotating slowly, light catching every surface detail. Premium materials visible. (Duration: 4 seconds)

Multi shot Prompt 4: Snap to product in use—real environment, natural lighting.
Seamless integration into lifestyle. User interaction. (Duration: 3 seconds)

Multi shot Prompt 5: Final beauty shot, product hero position,
camera slowly pushing in as screen fades to brand colors. (Duration: 2 seconds)

Consistent: commercial polish, 4k, photorealistic, premium brand aesthetic.`,
};

// ============================================================================
// RUNNER
// ============================================================================

type TemplateCategory = 
  | typeof PRODUCT_SHOWCASE 
  | typeof TALKING_HEAD 
  | typeof CINEMATIC_SCENE 
  | typeof MULTI_SHOT;

const TEMPLATES: Record<string, TemplateCategory> = {
  product: PRODUCT_SHOWCASE,
  talking: TALKING_HEAD,
  cinematic: CINEMATIC_SCENE,
  multishot: MULTI_SHOT,
};

async function generateVideo(prompt: string, name: string) {
  console.log(`\n🎬 Generating: ${name}`);
  console.log(`📝 Prompt preview: ${prompt.slice(0, 100)}...`);
  
  const result = await fal.subscribe("fal-ai/kling-video/v1.5/pro/text-to-video", {
    input: {
      prompt: prompt,
      duration: "10", // Kling supports up to 15s
      aspect_ratio: "16:9",
    },
  });

  const data = result.data as { video?: { url?: string } };
  if (data?.video?.url) {
    console.log(`✅ Video URL: ${data.video.url}`);
    return data.video.url;
  }
  
  console.log("⚠️ No video URL in response");
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const category = args[0] || "list";
  const template = args[1];

  await mkdir(join(import.meta.dir, "../output"), { recursive: true });

  if (category === "list" || !TEMPLATES[category]) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    KLING 3.0 VIDEO TEMPLATES                     ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  CATEGORIES:                                                     ║
║    product   - Product showcase (360, dolly, beauty shots)       ║
║    talking   - Talking head / spokesperson with dialogue         ║
║    cinematic - Cinematic scenes (noir, romance, thriller)        ║
║    multishot - Multi-shot sequences (montage, action, story)     ║
║                                                                  ║
║  USAGE:                                                          ║
║    bun run sdk-templates/kling.tsx <category> [template]         ║
║                                                                  ║
║  EXAMPLES:                                                       ║
║    bun run sdk-templates/kling.tsx product techProduct           ║
║    bun run sdk-templates/kling.tsx cinematic neoNoir             ║
║    bun run sdk-templates/kling.tsx multishot actionChase         ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

AVAILABLE TEMPLATES:

📦 PRODUCT:
   • techProduct  - Premium headphones orbit shot
   • luxuryWatch  - Gold watch dolly push-in
   • sneakerReveal - Sneaker turntable rotation

🎤 TALKING HEAD:
   • corporateSpeaker - CEO/executive message with dialogue
   • influencerStyle  - Energetic creator testimonial
   • testimonialReal  - Authentic customer testimonial

🎬 CINEMATIC:
   • neoNoir     - Rain-soaked Tokyo alley, noir aesthetic
   • goldenHour  - Beach sunset romance tracking shot
   • thrillerTension - Parking garage suspense

🎞️ MULTI-SHOT:
   • morningRoutine - 5-shot morning montage
   • actionChase    - 5-shot chase sequence
   • productStory   - 5-shot product narrative
`);
    return;
  }

  const templates = TEMPLATES[category];
  
  if (template && template in templates) {
    await generateVideo(templates[template as keyof typeof templates], template);
  } else {
    console.log(`\nTemplates in "${category}":`);
    for (const [name, prompt] of Object.entries(templates)) {
      console.log(`\n--- ${name} ---`);
      console.log(prompt);
    }
    console.log(`\n\nTo generate, run: bun run sdk-templates/kling.tsx ${category} <template_name>`);
  }
}

main().catch(console.error);
