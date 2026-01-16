import { fal } from "../fal-provider";
import { Clip, Image, Render, Video } from "../react";

// character: young woman, short dark brown bob with wispy bangs, oval face, fair skin,
// large dark brown eyes, full lips, silver hoop earrings
// style: deep black bg, dramatic orange rim lighting, noir/premium aesthetic

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          text: "Woman with short dark bob slowly steps backward, camera reveals her full body. Dramatic orange rim light glows behind her, casting warm edge highlights on her hair and shoulders. Deep black void background. She maintains confident eye contact, slight knowing smile. Cinematic slow reveal. Camera locked off, no movement.",
          images: [
            Image({
              prompt: {
                text: "Photorealistic close-up portrait. Young woman with short dark brown bob, wispy bangs across forehead, large dark brown eyes, full lips, silver hoop earrings. Fair skin with warm undertones. Wearing bright red cropped knit sweater, crew neck. Confident direct gaze, slight intensity in expression. Deep black background with two diagonal slashes of glowing orange light behind her — warm rim lighting catching edges of her hair and shoulders. Shot on 85mm f/1.4, shallow DOF. High-end fashion editorial. Dramatic noir lighting with punchy orange accents. Subtle film grain.",
                images: [
                  "https://s3.varg.ai/uploads/images/1_0475e227.png",
                  "https://s3.varg.ai/uploads/images/xyearp51qvve-zi3nrcve-zbno2hfgt5gergjrof_995f553d.png",
                ],
              },
              model: fal.imageModel("nano-banana-pro/edit"),
            }),
          ],
        }}
        model={fal.videoModel("kling-v2.5")}
        duration={5}
      />
    </Clip>
  </Render>
);
