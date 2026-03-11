/**
 * Split layout example: math teacher with vertical split.
 *
 * Demonstrates that Split fills each region by default (resize="cover")
 * — no black bars even when child aspect ratios differ from the split region.
 */
import { elevenlabs } from "../../ai-sdk/providers/elevenlabs";
import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Music, Render, render, Split, Title, Video } from "..";

async function main() {
  console.log("creating math teacher split screen...\n");

  const mathImage = Image({
    prompt:
      "whiteboard with math problem: 2x + 5 = 13, solve for x, clean handwriting, chalk white on dark board, 8k",
    model: fal.imageModel("nano-banana-pro"),
    aspectRatio: "9:16",
  });

  const instructorImage = Image({
    prompt:
      "male math teacher in his 30s, friendly expression, standing in front of whiteboard, wearing blue button-up shirt, classroom setting, confident pose, professional, 8k photorealistic",
    model: fal.imageModel("nano-banana-pro"),
    aspectRatio: "9:16",
  });

  const mathVideo = Video({
    prompt: {
      text: "animated solution: equation appears, numbers highlight, arrow points to step 1: subtract 5 from both sides showing 2x = 8, step 2: divide by 2 showing x = 4, final answer glows",
      images: [mathImage],
    },
    model: fal.videoModel("kling-v2.5"),
    duration: 5,
  });

  const instructorVideo = Video({
    prompt: {
      text: "teacher gestures while speaking, points to side with hand, nods, explains with confident expression, hand movements match explanation",
      images: [instructorImage],
    },
    model: fal.videoModel("kling-v2.5"),
    duration: 5,
  });

  const video = (
    <Render width={2160} height={1920}>
      <Clip duration={5}>
        <Split direction="vertical">{[mathVideo, instructorVideo]}</Split>
        <Music
          prompt="light upbeat educational background music, cheerful classroom vibe"
          model={elevenlabs.musicModel()}
          volume={0.2}
          duration={5}
        />
        <Title position="top" color="#ffffff">
          Solving Linear Equations
        </Title>
      </Clip>
    </Render>
  );

  console.log("video tree:", JSON.stringify(video, null, 2));

  const buffer = await render(video, {
    output: "output/split-math-teacher.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.video.byteLength} bytes`);
  console.log("output: output/split-math-teacher.mp4");
}

main().catch(console.error);
