/**
 * Seedance 2 Cartoon — varg/react composable test.
 *
 * Generates a cartoon image via varg gateway, then uses it as a reference
 * frame for an 8-second Seedance 2 video — all in one declarative tree.
 *
 * Run: VARG_API_KEY=varg_xxx bun run src/react/examples/seedance-cartoon.tsx
 */
import { createVarg } from "../../ai-sdk/index";
import { Clip, Image, Render, render, Video } from "..";

const varg = createVarg({
  apiKey: process.env.VARG_API_KEY!,
  baseUrl: process.env.VARG_BASE_URL || "https://api.varg.ai/v1",
});

const scene = (
  <Render width={1280} height={720}>
    <Clip duration={8}>
      <Video
        prompt={{
          text: "The cartoon fox waves at the camera, snow gently falling, it turns its head and smiles, warm cozy Pixar animation",
          images: [
            Image({
              model: varg.imageModel("nano-banana-pro"),
              prompt:
                "A cheerful cartoon fox wearing a tiny red scarf, standing in a snowy forest clearing, Pixar style, vibrant colors, soft lighting",
              aspectRatio: "16:9",
            }),
          ],
        }}
        model={varg.videoModel("seedance-2-preview")}
        duration={8}
        aspectRatio="16:9"
      />
    </Clip>
  </Render>
);

export default scene;

if (import.meta.main) {
  console.log("Generating cartoon image + 8s Seedance 2 video...\n");
  const { video } = await render(scene, {
    output: "output/seedance-cartoon-8s.mp4",
    cache: ".cache/ai",
  });
  console.log(
    `\nDone! ${(video.byteLength / 1024 / 1024).toFixed(2)} MB -> output/seedance-cartoon-8s.mp4`,
  );
}
