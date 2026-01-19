import { fal } from "../index";
import { Clip, Image, Render, Video } from "../react";

// ============================================================================
// CHARACTER REFERENCE
// ============================================================================

const characterRef = "https://s3.varg.ai/uploads/images/screenshot-2026-01-18-at-34213-pm_3644f152.png";

// ============================================================================
// STEP 1: BASE GYM ENVIRONMENT (one consistent gym)
// ============================================================================

const baseGym = Image({
  prompt: "Modern gym interior, clean minimalist design, large windows with natural daylight, mirror wall, dumbbell rack, workout benches, rubber flooring, empty scene without people, wide establishing shot, vertical 9:16 composition",
  model: fal.imageModel("nano-banana-pro"),
  aspectRatio: "9:16",
});

// ============================================================================
// STEP 2: DIFFERENT ANGLES OF THE SAME GYM
// ============================================================================

const gymAngle_bench = Image({
  prompt: {
    text: "Same gym interior, camera angle focused on bench press area near mirror wall. Same lighting, same equipment layout, same windows. Empty scene, no people.",
    images: [baseGym],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

const gymAngle_mirror = Image({
  prompt: {
    text: "Same gym interior, camera angle facing the mirror wall directly. Same natural lighting from windows, same equipment visible. Empty scene, no people.",
    images: [baseGym],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

const gymAngle_weights = Image({
  prompt: {
    text: "Same gym interior, camera angle near dumbbell rack and free weights area. Same lighting, same design aesthetic. Empty scene, no people.",
    images: [baseGym],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

const gymAngle_wide = Image({
  prompt: {
    text: "Same gym interior, wider shot showing more of the space. Same windows, same mirror, same equipment. Empty scene, no people.",
    images: [baseGym],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// ============================================================================
// STEP 3: PLACE CHARACTER IN SCENES
// ============================================================================

// Scene 1: Frustrated scrolling on bench
const scene1_frustrated = Image({
  prompt: {
    text: "Place this man sitting on gym bench, hunched over looking at his phone with frustrated annoyed expression. Same athletic wear as reference. He's scrolling rapidly, looks confused and irritated. Keep the gym environment exactly as shown.",
    images: [characterRef, gymAngle_bench],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// Scene 2: Sighing at generic apps (closer shot near mirror)
const scene2_sighing = Image({
  prompt: {
    text: "Place this man standing near gym mirror, looking at phone with disappointed expression. He sighs, slight eye roll. Same clothes as reference. Phone visible in his hands. Keep the gym environment exactly as shown.",
    images: [characterRef, gymAngle_mirror],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// Scene 3: Discovery moment - expression changes
const scene3_discovery = Image({
  prompt: {
    text: "Place this man in gym, now with curious interested expression looking at phone. Eyebrows raised, slight smile forming, pleasant surprise. Same athletic wear. He sits up straighter, engaged. Keep the gym environment exactly as shown.",
    images: [characterRef, gymAngle_bench],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// Scene 4: Personalized plan - satisfied
const scene4_personalized = Image({
  prompt: {
    text: "Place this man sitting on gym bench, smiling genuinely at phone screen. Confident relaxed posture, nodding approvingly. Same clothes as reference. Phone clearly visible. Keep the gym environment exactly as shown.",
    images: [characterRef, gymAngle_bench],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// Scene 5: Watching demo - over shoulder
const scene5_demo = Image({
  prompt: {
    text: "Over-the-shoulder view of this man watching phone screen in gym. He's standing, phone held up, head slightly tilted studying exercise form. Back and shoulder visible. Same athletic wear. Keep the gym environment exactly as shown.",
    images: [characterRef, gymAngle_weights],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// Scene 6: Working out - dumbbell exercise
const scene6_workout = Image({
  prompt: {
    text: "Place this man doing dumbbell press on gym bench. Focused determined expression, mid-rep with good form. Phone placed on bench beside him. Same athletic wear as reference. Keep the gym environment exactly as shown.",
    images: [characterRef, gymAngle_weights],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// Scene 7: CTA - selfie style to camera
const scene7_cta = Image({
  prompt: {
    text: "Place this man in selfie-style front-facing shot, speaking directly to camera with confident friendly smile. One hand gesturing casually. Same clothes as reference. Gym background slightly blurred behind him. Authentic vlogger energy.",
    images: [characterRef, gymAngle_wide],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// ============================================================================
// RENDER - VIDEO CLIPS
// ============================================================================

export default (
  <Render width={1080} height={1920}>
    <Clip duration={4}>
      <Video
        prompt={{
          images: [scene1_frustrated],
          text: "Man sits on gym bench looking frustrated at phone, scrolling rapidly with annoyed expression. He sighs and shifts uncomfortably. Static camera.",
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Clip duration={3}>
      <Video
        prompt={{
          images: [scene2_sighing],
          text: "Man near gym mirror sighing, slight eye roll, disappointed expression looking at phone. He swipes between apps. Static camera.",
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Clip duration={3}>
      <Video
        prompt={{
          images: [scene3_discovery],
          text: "Man's expression changes from bored to curious, then pleasantly surprised. Eyebrows raise, slight smile forms. Static camera.",
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Clip duration={3}>
      <Video
        prompt={{
          images: [scene4_personalized],
          text: "Man smiles genuinely, nods approvingly at phone screen. Relaxed confident body language. Static camera.",
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Clip duration={3}>
      <Video
        prompt={{
          images: [scene5_demo],
          text: "Over-shoulder shot, man watches exercise demo on phone, tilts head studying form, then mimics movement slightly. Static camera.",
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Clip duration={5}>
      <Video
        prompt={{
          images: [scene6_workout],
          text: "Man performs dumbbell press with good form, focused expression. Completes rep and glances at phone timer on bench. Static camera.",
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Clip duration={4}>
      <Video
        prompt={{
          images: [scene7_cta],
          text: "Man speaks to camera selfie style, confident smile, casual hand gesture pointing down. Friendly authentic energy. Static camera.",
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
  </Render>
);