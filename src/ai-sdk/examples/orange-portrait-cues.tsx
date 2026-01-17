import { fal } from "../fal-provider";
import { Clip, Image, Render, Video } from "../react";

type Cue = { readonly _tag: string; readonly tokens: readonly string[] };

const cue = <T extends string>(tag: T, tokens: readonly string[]): Cue & { _tag: T } => ({
  _tag: tag,
  tokens,
});

// =============================================================================
// IMAGE CUES
// =============================================================================

const subject = {
  text: (description: string) => cue("subject", [description]),
  fromRef: (refDescription: string) => cue("subject", [`exact likeness from reference: ${refDescription}`]),
} as const;

const expression = {
  confident: cue("expression", ["confident", "self-assured"]),
  playful: cue("expression", ["playful", "slight smirk"]),
  serious: cue("expression", ["serious", "intense gaze"]),
  neutral: cue("expression", ["neutral", "composed"]),
  vulnerable: cue("expression", ["vulnerable", "soft gaze"]),
  surprised: cue("expression", ["surprised", "wide eyes"]),
} as const;

const composition = {
  extremeCloseUp: cue("composition", ["extreme close-up", "face fills frame"]),
  closeUp: cue("composition", ["close-up", "head shot"]),
  headShoulders: cue("composition", ["head and shoulders", "cropped at chest"]),
  threeQuarter: cue("composition", ["three-quarter body"]),
  fullBody: cue("composition", ["full body", "head to toe"]),
  wide: cue("composition", ["wide shot", "environment visible"]),
} as const;

const lighting = {
  rimOrange: cue("lighting", ["dramatic orange rim light", "backlit glow", "warm edge highlights"]),
  studioSoft: cue("lighting", ["soft studio lighting", "even illumination"]),
  noir: cue("lighting", ["noir", "high contrast", "deep shadows"]),
  natural: cue("lighting", ["natural light", "soft diffused"]),
  dramatic: cue("lighting", ["dramatic", "strong shadows"]),
  golden: cue("lighting", ["golden hour", "warm sunlight"]),
} as const;

const lens = {
  mm85: cue("lens", ["85mm lens", "portrait focal length"]),
  mm50: cue("lens", ["50mm lens", "natural perspective"]),
  mm35: cue("lens", ["35mm lens", "slight wide angle"]),
  mm24: cue("lens", ["24mm lens", "wide angle"]),
  f14: cue("lens", ["f/1.4 aperture", "shallow depth of field"]),
  f28: cue("lens", ["f/2.8 aperture", "moderate bokeh"]),
} as const;

const style = {
  editorial: cue("style", ["high-end fashion editorial", "magazine quality"]),
  cinematic: cue("style", ["cinematic", "film-like", "movie still"]),
  documentary: cue("style", ["documentary style", "authentic", "candid"]),
  portrait: cue("style", ["professional portrait", "clean"]),
  artistic: cue("style", ["artistic", "creative lighting"]),
} as const;

const background = {
  black: cue("background", ["deep black background"]),
  white: cue("background", ["clean white background"]),
  gradient: cue("background", ["gradient background"]),
  geometric: cue("background", ["geometric shapes", "angular elements"]),
  blurred: cue("background", ["blurred environment", "bokeh"]),
} as const;

// =============================================================================
// VIDEO CUES
// =============================================================================

const motion = {
  stepsBack: cue("motion", ["steps backward", "reveals more of body"]),
  stepsForward: cue("motion", ["steps forward", "approaches camera"]),
  turnsHead: cue("motion", ["turns head", "looks to side"]),
  turnsSide: cue("motion", ["turns body to side", "shows profile"]),
  tiltsHead: cue("motion", ["tilts head slightly"]),
  looksUp: cue("motion", ["looks upward"]),
  looksDown: cue("motion", ["looks downward"]),
  blinks: cue("motion", ["blinks naturally"]),
  smiles: cue("motion", ["smile grows", "expression warms"]),
  still: cue("motion", ["remains still", "subtle breathing only"]),
} as const;

const camera = {
  static: cue("camera", ["camera static", "locked off", "no movement"]),
  slowPush: cue("camera", ["slow push in", "camera moves forward"]),
  slowPull: cue("camera", ["slow pull back", "camera moves backward"]),
  pan: cue("camera", ["slow pan", "horizontal movement"]),
  tilt: cue("camera", ["slow tilt", "vertical movement"]),
  handheld: cue("camera", ["subtle handheld", "slight movement"]),
  orbit: cue("camera", ["slow orbit", "circles subject"]),
} as const;

const mood = {
  authentic: cue("mood", ["authentic", "genuine"]),
  playful: cue("mood", ["playful", "lighthearted"]),
  intense: cue("mood", ["intense", "dramatic"]),
  calm: cue("mood", ["calm", "serene"]),
  energetic: cue("mood", ["energetic", "dynamic"]),
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type SubjectCue = ReturnType<typeof subject.text> | ReturnType<typeof subject.fromRef>;
type ExpressionCue = (typeof expression)[keyof typeof expression];
type CompositionCue = (typeof composition)[keyof typeof composition];
type LightingCue = (typeof lighting)[keyof typeof lighting];
type LensCue = (typeof lens)[keyof typeof lens];
type StyleCue = (typeof style)[keyof typeof style];
type BackgroundCue = (typeof background)[keyof typeof background];
type MotionCue = (typeof motion)[keyof typeof motion];
type CameraCue = (typeof camera)[keyof typeof camera];
type MoodCue = (typeof mood)[keyof typeof mood];

type CueInput<T extends Cue> = T | [T, ...(T | string)[]];

type ImageShotConfig = {
  subject: CueInput<SubjectCue>;
  expression: CueInput<ExpressionCue>;
  composition: CueInput<CompositionCue>;
  lighting: CueInput<LightingCue>;
  lens: CueInput<LensCue>;
  style: CueInput<StyleCue>;
  background?: CueInput<BackgroundCue>;
};

type VideoShotConfig = {
  motion: CueInput<MotionCue>;
  camera: CueInput<CameraCue>;
  lighting?: CueInput<LightingCue>;
  mood?: CueInput<MoodCue>;
};

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function normalizeCue(input: Cue | (Cue | string)[]): string[] {
  if (Array.isArray(input)) {
    return input.flatMap((item) => (typeof item === "string" ? [item] : [...item.tokens]));
  }
  return [...input.tokens];
}

function imageShot(config: ImageShotConfig): string {
  const tokens = [
    ...normalizeCue(config.subject),
    ...normalizeCue(config.expression),
    ...normalizeCue(config.composition),
    ...normalizeCue(config.lighting),
    ...normalizeCue(config.lens),
    ...normalizeCue(config.style),
    ...normalizeCue(config.background ?? background.black),
  ];
  return tokens.join(". ") + ".";
}

function videoShot(config: VideoShotConfig): string {
  const tokens = [
    ...normalizeCue(config.motion),
    ...normalizeCue(config.camera),
    ...(config.lighting ? normalizeCue(config.lighting) : []),
    ...(config.mood ? normalizeCue(config.mood) : []),
  ];
  return tokens.join(". ") + ".";
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

const portraitPrompt = imageShot({
  subject: subject.fromRef("young woman, short dark brown bob, wispy bangs, large dark brown eyes, silver hoop earrings, red cropped sweater"),
  expression: expression.confident,
  composition: composition.headShoulders,
  lighting: [lighting.rimOrange, "with subtle purple accents"],
  lens: [lens.mm85, lens.f14],
  style: style.editorial,
  background: [background.geometric, "diagonal orange slashes"],
});

const videoPrompt = videoShot({
  motion: [motion.stepsBack, "revealing full body gradually"],
  camera: camera.static,
  mood: [mood.authentic, "slightly playful"],
});

console.log("Image prompt:", portraitPrompt);
console.log("Video prompt:", videoPrompt);

const character = Image({
  prompt: {
    text: portraitPrompt,
    images: [
      "https://s3.varg.ai/uploads/images/1_0475e227.png",
      "https://s3.varg.ai/uploads/images/xyearp51qvve-zi3nrcve-zbno2hfgt5gergjrof_995f553d.png",
    ],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          images: [character],
          text: videoPrompt,
        }}
        model={fal.videoModel("kling-v2.5")}
        duration={5}
      />
    </Clip>
  </Render>
);
