import { describe, expect, test } from "bun:test";
import { fal } from "../fal-provider";
import { Animate, Clip, Image, render, Title, Video } from "./index";

describe("varg-react elements", () => {
  test("Video creates correct element structure", () => {
    const element = Video({
      width: 1280,
      height: 720,
      fps: 30,
      children: [],
    });

    expect(element.type).toBe("video");
    expect(element.props.width).toBe(1280);
    expect(element.props.height).toBe(720);
    expect(element.props.fps).toBe(30);
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
    const video = Video({
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

    expect(video.type).toBe("video");
    expect(video.children.length).toBe(2);

    const clip1 = video.children[0] as ReturnType<typeof Clip>;
    expect(clip1.type).toBe("clip");
    expect(clip1.children.length).toBe(2);

    const clip2 = video.children[1] as ReturnType<typeof Clip>;
    expect(clip2.type).toBe("clip");
    expect(clip2.props.transition).toEqual({ name: "fade", duration: 0.3 });
  });
});

describe("varg-react render", () => {
  test("render throws on non-video root", async () => {
    const clip = Clip({ duration: 5, children: [] });

    expect(render(clip)).rejects.toThrow("Root element must be <Video>");
  });

  test("render requires model prop for image with prompt", async () => {
    const video = Video({
      width: 720,
      height: 720,
      children: [
        Clip({
          duration: 3,
          children: [Image({ prompt: "test image without model" })],
        }),
      ],
    });

    expect(render(video)).rejects.toThrow("model");
  });
});
