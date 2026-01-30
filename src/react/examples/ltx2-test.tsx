import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Render, Video } from "..";

export default (
  <Render width={1248} height={704}>
    <Clip>
      <Video
        prompt={{
          text: "Camera slowly dollies in toward her face, city lights flicker",
          images: [
            "https://storage.googleapis.com/falserverless/example_inputs/ltxv-2-i2v-input.jpg",
          ],
        }}
        model={fal.videoModel("ltx-2-19b-distilled")}
        keepAudio={true}
        providerOptions={{
          fal: {
            generate_audio: true,
            camera_lora: "dolly_in",
          },
        }}
      />
    </Clip>
  </Render>
);
