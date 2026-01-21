import { describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { fal } from "../fal-provider";
import {
  Animate,
  Captions,
  Clip,
  Image,
  Packshot,
  Render,
  render,
  Slider,
  Split,
  Swipe,
  Title,
  Video,
} from "./index";

describe("varg-react elements", () => {
  test("Render creates correct element structure", () => {
    const element = Render({
      width: 1280,
      height: 720,
      fps: 30,
      children: [],
    });

    expect(element.type).toBe("render");
    expect(element.props.width).toBe(1280);
    expect(element.props.height).toBe(720);
    expect(element.props.fps).toBe(30);
  });

  test("Video creates correct element structure", () => {
    const element = Video({
      prompt: "ocean waves",
      model: fal.videoModel("wan-2.5"),
    });

    expect(element.type).toBe("video");
    expect(element.props.prompt).toBe("ocean waves");
  });

  test("Clip creates correct element structure", () => {
    const element = Clip({
      duration: 5,
      transition: { name: "fade", duration: 0.5 },
      children: [],
    });

    expect(element.type).toBe("clip");
    expect(element.props.duration).toBe(5);
    expect(element.props.transition).toEqual({ name: "fade", duration: 0.5 });
  });

  test("Image creates correct element structure", () => {
    const element = Image({
      prompt: "fat tiger on couch",
      model: fal.imageModel("flux-schnell"),
      aspectRatio: "16:9",
      zoom: "in",
    });

    expect(element.type).toBe("image");
    expect(element.props.prompt).toBe("fat tiger on couch");
    expect(element.props.aspectRatio).toBe("16:9");
    expect(element.props.zoom).toBe("in");
  });

  test("Title creates correct element with text children", () => {
    const element = Title({
      position: "bottom",
      color: "#ffffff",
      children: "I'M IN DANGER",
    });

    expect(element.type).toBe("title");
    expect(element.props.position).toBe("bottom");
    expect(element.props.color).toBe("#ffffff");
    expect(element.children).toContain("I'M IN DANGER");
  });

  test("Animate creates correct element with nested image", () => {
    const image = Image({ prompt: "luigi in wheelchair" });
    const element = Animate({
      image,
      model: fal.videoModel("wan-2.5"),
      motion: "wheels spinning fast",
      duration: 5,
    });

    expect(element.type).toBe("animate");
    expect(element.props.image).toBe(image);
    expect(element.props.motion).toBe("wheels spinning fast");
    expect(element.props.duration).toBe(5);
  });

  test("nested composition builds correct tree", () => {
    const root = Render({
      width: 1080,
      height: 1920,
      children: [
        Clip({
          duration: 5,
          children: [
            Image({
              prompt: "ralph wiggum",
              model: fal.imageModel("flux-schnell"),
            }),
            Title({ children: "HELLO" }),
          ],
        }),
        Clip({
          duration: 3,
          transition: { name: "fade", duration: 0.3 },
          children: [
            Image({
              prompt: "fat tiger",
              model: fal.imageModel("flux-schnell"),
            }),
          ],
        }),
      ],
    });

    expect(root.type).toBe("render");
    expect(root.children.length).toBe(2);

    const clip1 = root.children[0] as ReturnType<typeof Clip>;
    expect(clip1.type).toBe("clip");
    expect(clip1.children.length).toBe(2);

    const clip2 = root.children[1] as ReturnType<typeof Clip>;
    expect(clip2.type).toBe("clip");
    expect(clip2.props.transition).toEqual({ name: "fade", duration: 0.3 });
  });
});

describe("varg-react render", () => {
  test("render throws on non-render root", async () => {
    const clip = Clip({ duration: 5, children: [] });

    expect(render(clip)).rejects.toThrow("Root element must be <Render>");
  });

  test("render requires model prop for image with prompt", async () => {
    const root = Render({
      width: 720,
      height: 720,
      children: [
        Clip({
          duration: 3,
          children: [Image({ prompt: "test image without model" })],
        }),
      ],
    });

    expect(render(root)).rejects.toThrow("model");
  });
});

describe("layout renderers", () => {
  const testImage1 = "media/cyberpunk-street.png";
  const testImage2 = "media/fal-coffee-shop.png";
  const outPath = "output/layout-test.mp4";

  test("Split renders side-by-side images", async () => {
    const root = Render({
      width: 1280,
      height: 720,
      children: [
        Clip({
          duration: 2,
          children: [
            Split({
              direction: "horizontal",
              children: [
                Image({ src: testImage1 }),
                Image({ src: testImage2 }),
              ],
            }),
          ],
        }),
      ],
    });

    const result = await render(root, { output: outPath, quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    expect(existsSync(outPath)).toBe(true);
    unlinkSync(outPath);
  });

  test(
    "Slider renders with slide transitions",
    async () => {
      const root = Render({
        width: 1280,
        height: 720,
        children: [
          Clip({
            duration: 4,
            children: [
              Slider({
                direction: "horizontal",
                children: [
                  Image({ src: testImage1 }),
                  Image({ src: testImage2 }),
                ],
              }),
            ],
          }),
        ],
      });

      const result = await render(root, { output: outPath, quiet: true });
      expect(result).toBeInstanceOf(Uint8Array);
      expect(existsSync(outPath)).toBe(true);
      unlinkSync(outPath);
    },
    { timeout: 30000 },
  );

  test(
    "Swipe renders with swipe animation",
    async () => {
      const root = Render({
        width: 1280,
        height: 720,
        children: [
          Clip({
            duration: 4,
            children: [
              Swipe({
                direction: "left",
                interval: 2,
                children: [
                  Image({ src: testImage1 }),
                  Image({ src: testImage2 }),
                ],
              }),
            ],
          }),
        ],
      });

      const result = await render(root, { output: outPath, quiet: true });
      expect(result).toBeInstanceOf(Uint8Array);
      expect(existsSync(outPath)).toBe(true);
      unlinkSync(outPath);
    },
    { timeout: 30000 },
  );

  test("Packshot renders end card with logo and cta", async () => {
    const root = Render({
      width: 1280,
      height: 720,
      children: [
        Clip({
          duration: 3,
          children: [
            Packshot({
              background: "#1a1a2e",
              logo: testImage1,
              logoPosition: "center",
              logoSize: "40%",
              cta: "Subscribe Now!",
              ctaPosition: "bottom",
              ctaColor: "#FFD700",
              duration: 3,
            }),
          ],
        }),
      ],
    });

    const result = await render(root, { output: outPath, quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(existsSync(outPath)).toBe(true);
    unlinkSync(outPath);
  });

  test(
    "Captions burns subtitles from SRT file",
    async () => {
      const root = Render({
        width: 1280,
        height: 720,
        children: [
          Clip({
            duration: 3,
            children: [Image({ src: testImage1 })],
          }),
          Captions({
            srt: "media/dora-test.srt",
            style: "tiktok",
          }),
        ],
      });

      const result = await render(root, { output: outPath, quiet: true });
      expect(result).toBeInstanceOf(Uint8Array);
      expect(existsSync(outPath)).toBe(true);
      unlinkSync(outPath);
    },
    { timeout: 30000 },
  );
});
