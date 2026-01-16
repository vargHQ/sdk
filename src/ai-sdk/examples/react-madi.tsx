import { fal } from "../fal-provider";
import { Animate, Clip, Image, Music, Render, render } from "../react";

const MADI_REF =
  "https://s3.varg.ai/fellowers/madi/character_shots/madi_shot_03_closeup.png";

// TikTok timeline structure:
// 0-2s: HOOK - frontal close-up, grab attention
// 2-4s: 45° medium shot + expression change
// 4-6s: low angle or extreme close-up
// 6-8s: high angle + new emotion
const SCENES = [
  {
    // 0-2s: HOOK - frontal extreme close-up, surprised/curious expression
    prompt:
      "extreme close-up face shot, surprised expression with wide eyes, looking directly at camera, holding peach near lips",
    motion:
      "eyes widen in surprise, eyebrows raise slightly, subtle head tilt forward. Static shot, no camera movement.",
  },
  {
    // 2-4s: 45° medium shot, playful grimace while eating
    prompt:
      "45-degree angle medium shot showing face and hands, biting into peach with exaggerated enjoyment, juice on lips, playful expression",
    motion:
      "turns head 45 degrees, bites into peach, juice drips down chin, hands move expressively. Slow push-in camera movement.",
  },
  {
    // 4-6s: low angle (up shot), confident/powerful vibe
    prompt:
      "low angle shot from below, looking down at camera with confident smirk, holding peach triumphantly, dramatic perspective",
    motion:
      "looks down at camera with growing smile, raises peach slightly, confident head tilt. Static camera, slight lens distortion.",
  },
  {
    // 6-8s: high angle (down shot), playful vulnerability + CTA energy
    prompt:
      "high angle shot from above, looking up at camera with playful smile, arms spread wide, peach in one hand, endearing expression",
    motion:
      "looks up at camera, expression shifts from neutral to excited smile, subtle wink, slight forward lean. Gentle camera tilt down.",
  },
];

async function main() {
  console.log("creating madi peach video (animated)...\n");

  const video = (
    <Render width={1080} height={1920}>
      <Music src="./output/duet-mixed.mp4" duration={4 * 1} />

      {SCENES.map((scene, i) => (
        <Clip key={i} duration={1}>
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

  console.log("rendering", SCENES.length, "animated clips in parallel...");

  const buffer = await render(video, {
    output: "output/react-madi.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-madi.mp4");
}

main().catch(console.error);
