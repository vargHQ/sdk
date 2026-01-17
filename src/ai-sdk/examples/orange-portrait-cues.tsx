import { fal } from "../fal-provider";
import { Clip, Image, Render, Video } from "../react";

// ============================================================================
// CUE SYSTEM - type-safe prompt composition
// ============================================================================

type Cue = { readonly _tag: string; readonly tokens: readonly string[] };

const cue = <T extends string>(tag: T, tokens: readonly string[]): Cue & { _tag: T } => ({
  _tag: tag,
  tokens,
});

const expression = {
  confident: cue("expression", ["confident", "self-assured"]),
  playful: cue("expression", ["playful", "slight smirk"]),
  serious: cue("expression", ["serious", "intense gaze"]),
  neutral: cue("expression", ["neutral", "composed"]),
  vulnerable: cue("expression", ["vulnerable", "soft gaze"]),
} as const;

const action = {
  stepsBack: cue("action", ["steps backward", "reveals more of body"]),
  looksAtCamera: cue("action", ["looks directly at camera", "holds gaze"]),
  turnsSide: cue("action", ["turns slightly to side", "shows profile"]),
  tiltsHead: cue("action", ["tilts head slightly"]),
  poses: cue("action", ["poses naturally", "shifts weight"]),
  still: cue("action", ["remains still", "minimal movement"]),
} as const;

const composition = {
  closeUp: cue("composition", ["extreme close-up", "face fills frame"]),
  headShoulders: cue("composition", ["head and shoulders", "cropped at chest"]),
  threeQuarter: cue("composition", ["three-quarter body visible"]),
  fullBody: cue("composition", ["full body in frame", "head to toe"]),
  wideShot: cue("composition", ["wide shot", "environment visible"]),
} as const;

const lighting = {
  rimOrange: cue("lighting", ["dramatic orange rim", "backlit glow", "warm edge highlights"]),
  studioSoft: cue("lighting", ["soft studio", "even illumination"]),
  noir: cue("lighting", ["noir", "high contrast", "deep shadows"]),
  natural: cue("lighting", ["natural", "soft and diffused"]),
  dramatic: cue("lighting", ["dramatic", "strong shadows"]),
} as const;

const camera = {
  static: cue("camera", ["static", "locked off"]),
  slowPush: cue("camera", ["slowly pushes in"]),
  slowPull: cue("camera", ["slowly pulls back"]),
  handheld: cue("camera", ["subtle handheld movement"]),
} as const;

const mood = {
  authentic: cue("mood", ["authentic"]),
  cinematic: cue("mood", ["cinematic", "film-like"]),
  editorial: cue("mood", ["high-end editorial"]),
  intimate: cue("mood", ["intimate", "personal"]),
} as const;

const background = {
  black: cue("background", ["deep black"]),
  gradient: cue("background", ["gradient"]),
  geometric: cue("background", ["geometric shapes", "angular elements"]),
  blurred: cue("background", ["blurred", "shallow depth of field"]),
} as const;

// ============================================================================
// PROMPT BUILDER - enforces required cues via types
// ============================================================================

type ExpressionCue = (typeof expression)[keyof typeof expression];
type ActionCue = (typeof action)[keyof typeof action];
type CompositionCue = (typeof composition)[keyof typeof composition];
type LightingCue = (typeof lighting)[keyof typeof lighting];
type CameraCue = (typeof camera)[keyof typeof camera];
type MoodCue = (typeof mood)[keyof typeof mood];
type BackgroundCue = (typeof background)[keyof typeof background];

type VideoShotConfig = {
  // required - forces creative decisions
  expression: ExpressionCue;
  action: ActionCue;
  composition: CompositionCue;
  lighting: LightingCue;
  // optional - sensible defaults
  camera?: CameraCue;
  mood?: MoodCue;
  background?: BackgroundCue;
};

function shot(config: VideoShotConfig): string {
  const cues: Cue[] = [
    config.expression,
    config.action,
    config.composition,
    config.lighting,
    config.camera ?? camera.static,
    config.mood ?? mood.cinematic,
    config.background ?? background.black,
  ];

  return cues.flatMap((c) => c.tokens).join(". ") + ".";
}

// ============================================================================
// CHARACTER - created separately as image asset
// ============================================================================

const character = Image({
  prompt: {
    text: `Photorealistic three-quarter editorial portrait. 
Young woman with short dark brown bob, wispy bangs across forehead, large dark brown eyes, full lips, silver hoop earrings. 
Fair skin with warm undertones. Wearing bright red cropped knit sweater, crew neck.
Confident direct gaze.
Deep black background with diagonal slashes of glowing orange light — warm rim lighting on hair and shoulders.
Shot on 85mm f/1.4, shallow DOF. High-end fashion editorial. Subtle film grain.`,
    images: [
      "https://s3.varg.ai/uploads/images/1_0475e227.png",
      "https://s3.varg.ai/uploads/images/xyearp51qvve-zi3nrcve-zbno2hfgt5gergjrof_995f553d.png",
    ],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

// ============================================================================
// VIDEO - uses cue system for type-safe prompt
// ============================================================================

const videoPrompt = shot({
  // required decisions - won't compile without these
  expression: expression.confident,
  action: action.stepsBack,
  composition: composition.fullBody,
  lighting: lighting.rimOrange,
  // optional overrides
  camera: camera.static,
  mood: mood.authentic,
  background: background.geometric,
});

console.log("Generated prompt:", videoPrompt);

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          text: videoPrompt,
          images: [character],
        }}
        model={fal.videoModel("kling-v2.5")}
        duration={5}
      />
    </Clip>
  </Render>
);
