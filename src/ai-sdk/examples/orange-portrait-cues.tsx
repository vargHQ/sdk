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

const shot = {
  extremeCloseUp: cue("shot", ["extreme close-up"]),
  closeUp: cue("shot", ["close-up shot"]),
  medium: cue("shot", ["medium shot"]),
  full: cue("shot", ["full body shot"]),
  wide: cue("shot", ["wide shot"]),
  
  eyeLevel: cue("shot", ["eye level angle"]),
  lowAngle: cue("shot", ["low angle", "looking up"]),
  highAngle: cue("shot", ["high angle", "looking down"]),
  dutchAngle: cue("shot", ["dutch angle", "tilted frame"]),
  birdsEye: cue("shot", ["bird's eye view", "overhead"]),
  wormEye: cue("shot", ["worm's eye view", "ground level"]),
  
  frontView: cue("shot", ["front view", "facing camera"]),
  threeQuarter: cue("shot", ["three-quarter view"]),
  profile: cue("shot", ["profile view", "side angle"]),
  overShoulder: cue("shot", ["over the shoulder"]),
} as const;

const subject = {
  text: (description: string) => cue("subject", [description]),
  fromRef: (refDescription: string) => cue("subject", [`exact likeness from reference: ${refDescription}`]),
} as const;

const pose = {
  standing: cue("pose", ["standing"]),
  sitting: cue("pose", ["sitting"]),
  leaning: cue("pose", ["leaning"]),
  walking: cue("pose", ["walking"]),
  
  confident: cue("pose", ["confident posture", "shoulders back"]),
  relaxed: cue("pose", ["relaxed posture", "natural stance"]),
  tense: cue("pose", ["tense posture", "stiff"]),
  dynamic: cue("pose", ["dynamic pose", "movement implied"]),
  
  directGaze: cue("pose", ["looking directly at camera", "eye contact"]),
  averted: cue("pose", ["gaze averted", "looking away"]),
  downcast: cue("pose", ["eyes downcast", "looking down"]),
  upward: cue("pose", ["looking upward"]),
  
  smiling: cue("pose", ["smiling"]),
  serious: cue("pose", ["serious expression"]),
  playful: cue("pose", ["playful expression"]),
  contemplative: cue("pose", ["contemplative expression"]),
  vulnerable: cue("pose", ["vulnerable expression"]),
} as const;

const lighting = {
  soft: cue("lighting", ["soft diffused lighting"]),
  hard: cue("lighting", ["hard lighting", "sharp shadows"]),
  rim: cue("lighting", ["rim lighting", "edge highlights"]),
  backlit: cue("lighting", ["backlit", "silhouette edges"]),
  butterfly: cue("lighting", ["butterfly lighting", "shadow under nose"]),
  rembrandt: cue("lighting", ["rembrandt lighting", "triangle on cheek"]),
  split: cue("lighting", ["split lighting", "half face lit"]),
  loop: cue("lighting", ["loop lighting", "small nose shadow"]),
  
  warmTemp: cue("lighting", ["warm color temperature", "golden tones"]),
  coolTemp: cue("lighting", ["cool color temperature", "blue tones"]),
  neutral: cue("lighting", ["neutral color temperature"]),
  
  orange: cue("lighting", ["orange light"]),
  blue: cue("lighting", ["blue light"]),
  purple: cue("lighting", ["purple light"]),
  red: cue("lighting", ["red light"]),
  green: cue("lighting", ["green light"]),
  
  highContrast: cue("lighting", ["high contrast", "deep shadows"]),
  lowContrast: cue("lighting", ["low contrast", "flat lighting"]),
  
  fromLeft: cue("lighting", ["light from left"]),
  fromRight: cue("lighting", ["light from right"]),
  fromAbove: cue("lighting", ["light from above"]),
  fromBelow: cue("lighting", ["light from below", "underlighting"]),
} as const;

const frame = {
  centered: cue("frame", ["centered framing"]),
  ruleOfThirds: cue("frame", ["rule of thirds"]),
  goldenRatio: cue("frame", ["golden ratio composition"]),
  symmetrical: cue("frame", ["symmetrical framing"]),
  asymmetrical: cue("frame", ["asymmetrical framing"]),
  
  tightCrop: cue("frame", ["tight crop"]),
  looseCrop: cue("frame", ["loose crop", "breathing room"]),
  headroom: cue("frame", ["minimal headroom"]),
  
  dutchTilt: cue("frame", ["slight dutch tilt"]),
  straightHorizon: cue("frame", ["level horizon"]),
} as const;

const lens = {
  mm85: cue("lens", ["85mm lens", "portrait focal length"]),
  mm50: cue("lens", ["50mm lens", "natural perspective"]),
  mm35: cue("lens", ["35mm lens", "slight wide angle"]),
  mm24: cue("lens", ["24mm lens", "wide angle"]),
  mm135: cue("lens", ["135mm lens", "telephoto compression"]),
  
  f14: cue("lens", ["f/1.4 aperture", "shallow depth of field"]),
  f18: cue("lens", ["f/1.8 aperture", "shallow depth of field"]),
  f28: cue("lens", ["f/2.8 aperture", "moderate bokeh"]),
  f4: cue("lens", ["f/4 aperture"]),
  f8: cue("lens", ["f/8 aperture", "deep focus"]),
  
  shallowDof: cue("lens", ["shallow depth of field", "bokeh background"]),
  deepDof: cue("lens", ["deep depth of field", "everything sharp"]),
} as const;

const expression = {
  confident: cue("expression", ["confident expression", "self-assured"]),
  playful: cue("expression", ["playful expression", "slight smirk"]),
  serious: cue("expression", ["serious expression", "intense gaze"]),
  neutral: cue("expression", ["neutral expression", "composed"]),
  vulnerable: cue("expression", ["vulnerable expression", "soft gaze"]),
  surprised: cue("expression", ["surprised expression", "wide eyes"]),
  joyful: cue("expression", ["joyful expression", "genuine smile"]),
  contemplative: cue("expression", ["contemplative expression", "thoughtful"]),
  fierce: cue("expression", ["fierce expression", "intense"]),
  serene: cue("expression", ["serene expression", "peaceful"]),
} as const;

const skin = {
  smooth: cue("skin", ["smooth skin", "soft texture"]),
  textured: cue("skin", ["visible skin texture", "pores visible"]),
  dewy: cue("skin", ["dewy skin", "slight sheen"]),
  matte: cue("skin", ["matte skin", "no shine"]),
  freckled: cue("skin", ["freckled skin"]),
  weathered: cue("skin", ["weathered skin", "character lines"]),
} as const;

const wardrobe = {
  casual: cue("wardrobe", ["casual clothing"]),
  formal: cue("wardrobe", ["formal attire"]),
  streetwear: cue("wardrobe", ["streetwear"]),
  elegant: cue("wardrobe", ["elegant clothing"]),
  minimal: cue("wardrobe", ["minimal clothing"]),
  
  fitted: cue("wardrobe", ["fitted clothing"]),
  loose: cue("wardrobe", ["loose clothing"]),
  oversized: cue("wardrobe", ["oversized fit"]),
  
  cotton: cue("wardrobe", ["cotton fabric"]),
  silk: cue("wardrobe", ["silk fabric", "shiny material"]),
  leather: cue("wardrobe", ["leather material"]),
  denim: cue("wardrobe", ["denim fabric"]),
  knit: cue("wardrobe", ["knit fabric", "textured weave"]),
  velvet: cue("wardrobe", ["velvet fabric", "soft sheen"]),
} as const;

const accessories = {
  earrings: cue("accessories", ["earrings"]),
  hoops: cue("accessories", ["hoop earrings"]),
  studs: cue("accessories", ["stud earrings"]),
  necklace: cue("accessories", ["necklace"]),
  rings: cue("accessories", ["rings"]),
  bracelet: cue("accessories", ["bracelet"]),
  watch: cue("accessories", ["watch"]),
  glasses: cue("accessories", ["glasses"]),
  sunglasses: cue("accessories", ["sunglasses"]),
  hat: cue("accessories", ["hat"]),
  
  gold: cue("accessories", ["gold jewelry", "warm metal"]),
  silver: cue("accessories", ["silver jewelry", "cool metal"]),
  catching: cue("accessories", ["catching light", "reflective"]),
} as const;

const environment = {
  studio: cue("environment", ["studio setting"]),
  outdoor: cue("environment", ["outdoor setting"]),
  urban: cue("environment", ["urban environment", "city"]),
  nature: cue("environment", ["natural environment"]),
  interior: cue("environment", ["interior setting"]),
  
  blackBg: cue("environment", ["black background", "void"]),
  whiteBg: cue("environment", ["white background", "clean"]),
  gradientBg: cue("environment", ["gradient background"]),
  
  concrete: cue("environment", ["concrete surfaces"]),
  brick: cue("environment", ["brick walls"]),
  wood: cue("environment", ["wooden surfaces"]),
  metal: cue("environment", ["metal surfaces"]),
  
  foggy: cue("environment", ["foggy atmosphere", "haze"]),
  dusty: cue("environment", ["dusty atmosphere", "particles"]),
  rainy: cue("environment", ["rain", "wet surfaces"]),
  smoky: cue("environment", ["smoke", "atmospheric"]),
} as const;

const texture = {
  filmGrain: cue("texture", ["subtle film grain"]),
  noiseGrain: cue("texture", ["digital noise"]),
  clean: cue("texture", ["clean image", "no grain"]),
  
  sharpFocus: cue("texture", ["sharp focus", "crisp details"]),
  softFocus: cue("texture", ["soft focus", "dreamy"]),
  
  fabricDetail: cue("texture", ["visible fabric texture"]),
  skinDetail: cue("texture", ["visible skin detail"]),
  metalDetail: cue("texture", ["metal reflections", "specular highlights"]),
  hairDetail: cue("texture", ["individual hair strands visible"]),
} as const;

const era = {
  modern: cue("era", ["modern", "contemporary"]),
  vintage: cue("era", ["vintage aesthetic"]),
  retro70s: cue("era", ["1970s aesthetic", "retro"]),
  retro80s: cue("era", ["1980s aesthetic"]),
  retro90s: cue("era", ["1990s aesthetic"]),
  y2k: cue("era", ["Y2K aesthetic", "early 2000s"]),
  
  digitalCamera: cue("era", ["digital camera"]),
  filmCamera: cue("era", ["shot on film"]),
  polaroid: cue("era", ["polaroid style"]),
  mediumFormat: cue("era", ["medium format film"]),
  dslr: cue("era", ["DSLR quality"]),
  cinematic: cue("era", ["cinematic camera", "anamorphic"]),
} as const;

const style = {
  editorial: cue("style", ["high-end fashion editorial", "magazine quality"]),
  cinematic: cue("style", ["cinematic", "movie still"]),
  documentary: cue("style", ["documentary style", "candid"]),
  portrait: cue("style", ["professional portrait"]),
  artistic: cue("style", ["artistic", "creative"]),
  commercial: cue("style", ["commercial photography"]),
  streetPhoto: cue("style", ["street photography"]),
  fineart: cue("style", ["fine art photography"]),
  noir: cue("style", ["noir aesthetic"]),
  glamour: cue("style", ["glamour photography"]),
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
  walks: cue("motion", ["walks", "in motion"]),
  runs: cue("motion", ["runs", "fast movement"]),
  gestures: cue("motion", ["hand gestures", "expressive hands"]),
} as const;

const camera = {
  static: cue("camera", ["camera static", "locked off", "no movement"]),
  slowPush: cue("camera", ["slow push in", "dolly forward"]),
  slowPull: cue("camera", ["slow pull back", "dolly backward"]),
  pan: cue("camera", ["slow pan", "horizontal movement"]),
  tilt: cue("camera", ["slow tilt", "vertical movement"]),
  handheld: cue("camera", ["subtle handheld", "organic movement"]),
  orbit: cue("camera", ["slow orbit", "circles subject"]),
  crane: cue("camera", ["crane movement", "vertical sweep"]),
  tracking: cue("camera", ["tracking shot", "follows subject"]),
  whip: cue("camera", ["whip pan", "fast movement"]),
} as const;

const mood = {
  authentic: cue("mood", ["authentic", "genuine"]),
  playful: cue("mood", ["playful", "lighthearted"]),
  intense: cue("mood", ["intense", "dramatic"]),
  calm: cue("mood", ["calm", "serene"]),
  energetic: cue("mood", ["energetic", "dynamic"]),
  mysterious: cue("mood", ["mysterious", "enigmatic"]),
  romantic: cue("mood", ["romantic", "soft"]),
  melancholic: cue("mood", ["melancholic", "wistful"]),
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type ShotCue = (typeof shot)[keyof typeof shot];
type SubjectCue = ReturnType<typeof subject.text> | ReturnType<typeof subject.fromRef>;
type PoseCue = (typeof pose)[keyof typeof pose];
type ExpressionCue = (typeof expression)[keyof typeof expression];
type LightingCue = (typeof lighting)[keyof typeof lighting];
type FrameCue = (typeof frame)[keyof typeof frame];
type LensCue = (typeof lens)[keyof typeof lens];
type SkinCue = (typeof skin)[keyof typeof skin];
type WardrobeCue = (typeof wardrobe)[keyof typeof wardrobe];
type AccessoriesCue = (typeof accessories)[keyof typeof accessories];
type EnvironmentCue = (typeof environment)[keyof typeof environment];
type TextureCue = (typeof texture)[keyof typeof texture];
type EraCue = (typeof era)[keyof typeof era];
type StyleCue = (typeof style)[keyof typeof style];
type MotionCue = (typeof motion)[keyof typeof motion];
type CameraCue = (typeof camera)[keyof typeof camera];
type MoodCue = (typeof mood)[keyof typeof mood];

type CueInput<T extends Cue> = T | [T, ...(T | string)[]];

type ImageShotConfig = {
  shot: CueInput<ShotCue>;
  subject: CueInput<SubjectCue>;
  pose: CueInput<PoseCue>;
  expression: CueInput<ExpressionCue>;
  lighting: CueInput<LightingCue>;
  frame: CueInput<FrameCue>;
  lens: CueInput<LensCue>;
  
  skin?: CueInput<SkinCue>;
  wardrobe?: CueInput<WardrobeCue>;
  accessories?: CueInput<AccessoriesCue>;
  environment?: CueInput<EnvironmentCue>;
  texture?: CueInput<TextureCue>;
  era?: CueInput<EraCue>;
  style?: CueInput<StyleCue>;
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
  const sections: string[][] = [
    normalizeCue(config.shot),
    normalizeCue(config.subject),
    config.skin ? normalizeCue(config.skin) : [],
    config.wardrobe ? normalizeCue(config.wardrobe) : [],
    config.accessories ? normalizeCue(config.accessories) : [],
    normalizeCue(config.pose),
    normalizeCue(config.expression),
    config.environment ? normalizeCue(config.environment) : [],
    normalizeCue(config.lighting),
    normalizeCue(config.frame),
    normalizeCue(config.lens),
    config.texture ? normalizeCue(config.texture) : [],
    config.era ? normalizeCue(config.era) : [],
    config.style ? normalizeCue(config.style) : [],
  ];
  return sections
    .filter((s) => s.length > 0)
    .map((s) => s.join(", "))
    .join(". ") + ".";
}

function videoShot(config: VideoShotConfig): string {
  const sections: string[][] = [
    normalizeCue(config.motion),
    normalizeCue(config.camera),
    config.lighting ? normalizeCue(config.lighting) : [],
    config.mood ? normalizeCue(config.mood) : [],
  ];
  return sections
    .filter((s) => s.length > 0)
    .map((s) => s.join(", "))
    .join(". ") + ".";
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

const portraitPrompt = imageShot({
  shot: [shot.closeUp, shot.threeQuarter, shot.eyeLevel],
  subject: subject.fromRef("young woman, short dark brown bob, wispy bangs, large dark brown eyes, full lips"),
  pose: [pose.confident, pose.directGaze, "relaxed shoulders"],
  lighting: [lighting.rim, lighting.orange, lighting.highContrast, "warm edge highlights"],
  frame: [frame.centered],
  lens: [lens.mm85, lens.f14],
  expression: expression.confident,
  
  skin: [skin.smooth, skin.dewy],
  wardrobe: [wardrobe.knit, wardrobe.fitted, "bright red cropped sweater"],
  accessories: [accessories.hoops, accessories.silver, accessories.catching],
  environment: [environment.blackBg, "diagonal orange geometric shapes"],
  texture: [texture.filmGrain, texture.hairDetail],
  era: era.modern,
  style: style.editorial,
});

const videoPrompt = videoShot({
  motion: [motion.stepsBack, "revealing full body gradually", "then turns slightly to show profile"],
  camera: camera.static,
  lighting: [lighting.rim, lighting.orange],
  mood: [mood.authentic, mood.playful],
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
