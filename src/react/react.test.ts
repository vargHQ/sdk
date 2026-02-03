import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { _resetResizeModeWarning } from "../ai-sdk/providers/editly/layers";
import { fal } from "../ai-sdk/providers/fal";
import {
  Captions,
  Clip,
  Image,
  Overlay,
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

  test("Video creates correct element with nested image", () => {
    const image = Image({ prompt: "luigi in wheelchair" });
    const element = Video({
      prompt: { text: "wheels spinning fast", images: [image] },
      model: fal.videoModel("wan-2.5"),
    });

    expect(element.type).toBe("video");
    expect((element.props.prompt as { images: unknown[] }).images[0]).toBe(
      image,
    );
    expect((element.props.prompt as { text: string }).text).toBe(
      "wheels spinning fast",
    );
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

  test("parallel failures preserve successful results and report all errors", async () => {
    let callCount = 0;
    const mockModel = {
      specificationVersion: "v3" as const,
      provider: "mock",
      modelId: "mock-model",
      maxImagesPerCall: 1,
      doGenerate: mock(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Request Timeout");
        }
        return {
          images: [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: "mock",
            headers: undefined,
          },
        };
      }),
    };

    const root = Render({
      width: 720,
      height: 720,
      children: [
        Clip({
          duration: 1,
          children: [Image({ prompt: "first", model: mockModel })],
        }),
        Clip({
          duration: 1,
          children: [Image({ prompt: "second", model: mockModel })],
        }),
        Clip({
          duration: 1,
          children: [Image({ prompt: "third", model: mockModel })],
        }),
      ],
    });

    const error = await render(root, { quiet: true }).catch((e) => e);
    expect(error.message).toContain("1 of 3 clips failed");
    expect(error.message).toContain("Request Timeout");
    expect(callCount).toBe(3);
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

describe("warnings", () => {
  const testImage = "media/cyberpunk-street.png";
  const outPath = "output/warning-test.mp4";
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    _resetResizeModeWarning();
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    if (existsSync(outPath)) unlinkSync(outPath);
  });

  test(
    "issue #45: warns when Overlay is placed inside Clip",
    async () => {
      const root = Render({
        width: 1280,
        height: 720,
        children: [
          Clip({
            duration: 2,
            children: [
              Image({ src: testImage }),
              Overlay({
                left: "10%",
                top: "10%",
                width: "20%",
                height: "20%",
                children: [Image({ src: testImage })],
              }),
            ],
          }),
        ],
      });

      await render(root, { output: outPath, quiet: true });

      const warnings = warnSpy.mock.calls.map(
        (call: unknown[]) => call[0] as string,
      );
      expect(
        warnings.some(
          (w: string) =>
            w.includes("Overlay") && w.includes("inside") && w.includes("Clip"),
        ),
      ).toBe(true);
    },
    { timeout: 10000 },
  );

  test(
    "issue #24: warns when image with zoompan has no resizeMode",
    async () => {
      const root = Render({
        width: 1280,
        height: 720,
        children: [
          Clip({
            duration: 2,
            children: [Image({ src: testImage, zoom: "in" })],
          }),
        ],
      });

      await render(root, { output: outPath, quiet: true });

      const warnings = warnSpy.mock.calls.map(
        (call: unknown[]) => call[0] as string,
      );
      expect(
        warnings.some(
          (w: string) => w.includes("resizeMode") && w.includes("Deprecation"),
        ),
      ).toBe(true);
    },
    { timeout: 10000 },
  );
});
