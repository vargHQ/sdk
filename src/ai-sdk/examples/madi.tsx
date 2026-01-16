import { fal } from "../fal-provider";
import { Animate, Clip, Image, Music, Render } from "../react";

const MADI_REF =
  "https://s3.varg.ai/fellowers/madi/character_shots/madi_shot_03_closeup.png";

const SCENES = [
  {
    prompt:
      "extreme close-up face shot, surprised expression with wide eyes, looking directly at camera, holding peach near lips",
    motion:
      "eyes widen in surprise, eyebrows raise slightly, subtle head tilt forward. Static shot, no camera movement.",
  },
  {
    prompt:
      "45-degree angle medium shot showing face and hands, biting into peach with exaggerated enjoyment, juice on lips, playful expression",
    motion:
      "turns head 45 degrees, bites into peach, juice drips down chin, hands move expressively. Slow push-in camera movement.",
  },
  {
    prompt:
      "low angle shot from below, looking down at camera with confident smirk, holding peach triumphantly, dramatic perspective",
    motion:
      "looks down at camera with growing smile, raises peach slightly, confident head tilt. Static camera, slight lens distortion.",
  },
  {
    prompt:
      "high angle shot from above, looking up at camera with playful smile, arms spread wide, peach in one hand, endearing expression",
    motion:
      "looks up at camera, expression shifts from neutral to excited smile, subtle wink, slight forward lean. Gentle camera tilt down.",
  },
];

export default (
  <Render width={1080} height={1920}>
    <Music src="./output/duet-mixed.mp4" duration={8} />

    {SCENES.map((scene, i) => (
      <Clip key={i} duration={2}>
        <Animate
          image={Image({
            prompt: { text: scene.prompt, images: [MADI_REF] },
            model: fal.imageModel("nano-banana-pro/edit"),
            aspectRatio: "9:16",
            resize: "cover",
          })}
          motion={scene.motion}
          model={fal.videoModel("wan-2.5")}
          duration={5}
        />
      </Clip>
    ))}
  </Render>
);
