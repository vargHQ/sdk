import { describe, expect, test } from "bun:test";
import { Image, Video } from "../index";
import type { VargElement } from "../types";
import { Composite } from "./composite";
import { Grid } from "./grid";
import { Slot } from "./slot";
import { Split } from "./split";

// Grid/Split return arrays at runtime (JSX fragments serialize to arrays)
function asArray(result: unknown): VargElement[] {
  return result as VargElement[];
}

describe("Slot", () => {
  test("parses fit-cover class", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "fit-cover", children: child });

    expect(result.props.resize).toBe("cover");
  });

  test("parses fit-contain class", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "fit-contain", children: child });

    expect(result.props.resize).toBe("contain");
  });

  test("parses fit-contain-blur class", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "fit-contain-blur", children: child });

    expect(result.props.resize).toBe("contain-blur");
  });

  test("parses fit-fill class as stretch", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "fit-fill", children: child });

    expect(result.props.resize).toBe("stretch");
  });

  test("parses pos-top class", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "pos-top", children: child });

    expect(result.props.cropPosition).toBe("top");
  });

  test("parses pos-bottom class", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "pos-bottom", children: child });

    expect(result.props.cropPosition).toBe("bottom");
  });

  test("parses pos-left class", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "pos-left", children: child });

    expect(result.props.cropPosition).toBe("left");
  });

  test("parses pos-right class", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "pos-right", children: child });

    expect(result.props.cropPosition).toBe("right");
  });

  test("parses compound position classes", () => {
    const positions = [
      "pos-top-left",
      "pos-top-right",
      "pos-bottom-left",
      "pos-bottom-right",
    ] as const;

    for (const pos of positions) {
      const child = Video({ src: "test.mp4" });
      const result = Slot({ class: pos, children: child });
      expect(result.props.cropPosition).toBe(pos.replace("pos-", ""));
    }
  });

  test("parses combined fit and position classes", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ class: "fit-cover pos-top", children: child });

    expect(result.props.resize).toBe("cover");
    expect(result.props.cropPosition).toBe("top");
  });

  test("explicit props override class", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({
      class: "fit-cover pos-top",
      fit: "contain",
      position: "bottom",
      children: child,
    });

    expect(result.props.resize).toBe("contain");
    expect(result.props.cropPosition).toBe("bottom");
  });

  test("defaults to cover and center when no class or props", () => {
    const child = Video({ src: "test.mp4" });
    const result = Slot({ children: child });

    expect(result.props.resize).toBe("cover");
    expect(result.props.cropPosition).toBe("center");
  });

  test("preserves child props", () => {
    const child = Video({ src: "test.mp4", volume: 0.5 });
    const result = Slot({ class: "fit-cover pos-top", children: child });

    expect(result.props.src).toBe("test.mp4");
    expect(result.props.volume).toBe(0.5);
    expect(result.type).toBe("video");
  });
});

describe("Split", () => {
  test("horizontal split positions children side by side", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
    ] as VargElement[];

    const result = asArray(Split({ direction: "horizontal", children }));

    expect(result.length).toBe(2);
    expect(result[0]?.props.left).toBe("0%");
    expect(result[0]?.props.width).toBe("50%");
    expect(result[1]?.props.left).toBe("50%");
    expect(result[1]?.props.width).toBe("50%");
  });

  test("vertical split stacks children", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
    ] as VargElement[];

    const result = asArray(Split({ direction: "vertical", children }));

    expect(result.length).toBe(2);
    expect(result[0]?.props.top).toBe("0%");
    expect(result[0]?.props.height).toBe("50%");
    expect(result[1]?.props.top).toBe("50%");
    expect(result[1]?.props.height).toBe("50%");
  });

  test("returns null for empty children", () => {
    const result = Split({ children: [] });
    expect(result).toBeNull();
  });

  test("defaults to horizontal", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
    ] as VargElement[];

    const result = asArray(Split({ children }));

    expect(result[0]?.props.left).toBe("0%");
    expect(result[1]?.props.left).toBe("50%");
  });
});

describe("Grid", () => {
  test("2x1 grid positions children horizontally", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
    ] as VargElement[];

    const result = asArray(Grid({ columns: 2, rows: 1, children }));

    expect(result[0]?.props.left).toBe("0%");
    expect(result[0]?.props.top).toBe("0%");
    expect(result[0]?.props.width).toBe("50%");
    expect(result[0]?.props.height).toBe("100%");

    expect(result[1]?.props.left).toBe("50%");
    expect(result[1]?.props.top).toBe("0%");
    expect(result[1]?.props.width).toBe("50%");
    expect(result[1]?.props.height).toBe("100%");
  });

  test("1x2 grid positions children vertically", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
    ] as VargElement[];

    const result = asArray(Grid({ columns: 1, rows: 2, children }));

    expect(result[0]?.props.left).toBe("0%");
    expect(result[0]?.props.top).toBe("0%");
    expect(result[0]?.props.width).toBe("100%");
    expect(result[0]?.props.height).toBe("50%");

    expect(result[1]?.props.left).toBe("0%");
    expect(result[1]?.props.top).toBe("50%");
    expect(result[1]?.props.width).toBe("100%");
    expect(result[1]?.props.height).toBe("50%");
  });

  test("2x2 grid positions children in grid pattern", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
      Video({ src: "c.mp4" }),
      Video({ src: "d.mp4" }),
    ] as VargElement[];

    const result = asArray(Grid({ columns: 2, rows: 2, children }));

    expect(result[0]?.props.left).toBe("0%");
    expect(result[0]?.props.top).toBe("0%");

    expect(result[1]?.props.left).toBe("50%");
    expect(result[1]?.props.top).toBe("0%");

    expect(result[2]?.props.left).toBe("0%");
    expect(result[2]?.props.top).toBe("50%");

    expect(result[3]?.props.left).toBe("50%");
    expect(result[3]?.props.top).toBe("50%");
  });

  test("defaults resize to cover", () => {
    const children = [Video({ src: "a.mp4" })] as VargElement[];
    const result = asArray(Grid({ columns: 1, children }));

    expect(result[0]?.props.resize).toBe("cover");
  });

  test("child resize overrides grid default", () => {
    const child = Video({ src: "a.mp4" });
    (child.props as Record<string, unknown>).resize = "cover";

    const result = asArray(Grid({ columns: 1, children: [child] }));

    expect(result[0]?.props.resize).toBe("cover");
  });

  test("infers columns from children length when not specified", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
      Video({ src: "c.mp4" }),
    ] as VargElement[];

    const result = asArray(Grid({ children }));

    expect((result[0]?.props.width as string).startsWith("33.33")).toBe(true);
    expect((result[1]?.props.width as string).startsWith("33.33")).toBe(true);
    expect((result[2]?.props.width as string).startsWith("33.33")).toBe(true);
  });
});

describe("Split + Slot integration", () => {
  test("vertical split with Slot applies fit and position", () => {
    const video1 = Video({ src: "a.mp4" });
    const video2 = Video({ src: "b.mp4" });

    const slot1 = Slot({ class: "fit-cover pos-top", children: video1 });
    const slot2 = Slot({ class: "fit-cover pos-bottom", children: video2 });

    const result = asArray(
      Split({ direction: "vertical", children: [slot1, slot2] }),
    );

    expect(result[0]?.props.top).toBe("0%");
    expect(result[0]?.props.height).toBe("50%");
    expect(result[0]?.props.resize).toBe("cover");
    expect(result[0]?.props.cropPosition).toBe("top");

    expect(result[1]?.props.top).toBe("50%");
    expect(result[1]?.props.height).toBe("50%");
    expect(result[1]?.props.resize).toBe("cover");
    expect(result[1]?.props.cropPosition).toBe("bottom");
  });

  test("horizontal split with mixed Slot positions", () => {
    const video1 = Video({ src: "a.mp4" });
    const video2 = Video({ src: "b.mp4" });

    const slot1 = Slot({ class: "fit-cover pos-left", children: video1 });
    const slot2 = Slot({ class: "fit-contain pos-right", children: video2 });

    const result = asArray(
      Split({ direction: "horizontal", children: [slot1, slot2] }),
    );

    expect(result[0]?.props.resize).toBe("cover");
    expect(result[0]?.props.cropPosition).toBe("left");

    expect(result[1]?.props.resize).toBe("contain");
    expect(result[1]?.props.cropPosition).toBe("right");
  });
});

describe("Grid + Slot integration", () => {
  test("2x2 grid with different Slot configurations", () => {
    const videos = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
      Video({ src: "c.mp4" }),
      Video({ src: "d.mp4" }),
    ];

    const slots = [
      Slot({
        class: "fit-cover pos-top-left",
        children: videos[0] as VargElement,
      }),
      Slot({
        class: "fit-cover pos-top-right",
        children: videos[1] as VargElement,
      }),
      Slot({
        class: "fit-contain pos-bottom-left",
        children: videos[2] as VargElement,
      }),
      Slot({
        class: "fit-fill pos-bottom-right",
        children: videos[3] as VargElement,
      }),
    ];

    const result = asArray(Grid({ columns: 2, rows: 2, children: slots }));

    expect(result[0]?.props.cropPosition).toBe("top-left");
    expect(result[1]?.props.cropPosition).toBe("top-right");
    expect(result[2]?.props.cropPosition).toBe("bottom-left");
    expect(result[2]?.props.resize).toBe("contain");
    expect(result[3]?.props.cropPosition).toBe("bottom-right");
    expect(result[3]?.props.resize).toBe("stretch");
  });
});

describe("Composite", () => {
  test("positions layers with arbitrary left/top/width/height", () => {
    const imgA = Image({ src: "https://example.com/a.png" });
    const imgB = Image({ src: "https://example.com/b.png" });
    const imgC = Image({ src: "https://example.com/c.png" });

    const result = asArray(
      Composite({
        layers: [
          { src: imgA, left: "0%", top: "0%", width: "50%", height: "100%" },
          { src: imgB, left: "50%", top: "0%", width: "50%", height: "100%" },
          { src: imgC, left: "25%", top: "10%", width: "50%", height: "80%" },
        ],
      }),
    );

    expect(result.length).toBe(3);

    // Layer 0: left half
    expect(result[0]?.props.left).toBe("0%");
    expect(result[0]?.props.top).toBe("0%");
    expect(result[0]?.props.width).toBe("50%");
    expect(result[0]?.props.height).toBe("100%");

    // Layer 1: right half
    expect(result[1]?.props.left).toBe("50%");
    expect(result[1]?.props.top).toBe("0%");
    expect(result[1]?.props.width).toBe("50%");
    expect(result[1]?.props.height).toBe("100%");

    // Layer 2: centered overlay
    expect(result[2]?.props.left).toBe("25%");
    expect(result[2]?.props.top).toBe("10%");
    expect(result[2]?.props.width).toBe("50%");
    expect(result[2]?.props.height).toBe("80%");
  });

  test("preserves original element type as image", () => {
    const img = Image({ src: "https://example.com/a.png" });

    const result = asArray(
      Composite({
        layers: [
          { src: img, left: "0%", top: "0%", width: "100%", height: "100%" },
        ],
      }),
    );

    expect(result[0]?.type).toBe("image");
  });

  test("preserves child props (src, prompt, model)", () => {
    const img = Image({ src: "https://example.com/photo.png" });

    const result = asArray(
      Composite({
        layers: [
          { src: img, left: "10%", top: "20%", width: "80%", height: "60%" },
        ],
      }),
    );

    expect(result[0]?.props.src).toBe("https://example.com/photo.png");
  });

  test("defaults position to 0% and size to 100% when omitted", () => {
    const img = Image({ src: "https://example.com/a.png" });

    const result = asArray(
      Composite({
        layers: [{ src: img }],
      }),
    );

    expect(result[0]?.props.left).toBe("0%");
    expect(result[0]?.props.top).toBe("0%");
    expect(result[0]?.props.width).toBe("100%");
    expect(result[0]?.props.height).toBe("100%");
  });

  test("defaults resize to cover", () => {
    const img = Image({ src: "https://example.com/a.png" });

    const result = asArray(
      Composite({
        layers: [{ src: img }],
      }),
    );

    expect(result[0]?.props.resize).toBe("cover");
  });

  test("per-layer resize overrides default", () => {
    const img = Image({ src: "https://example.com/a.png" });

    const result = asArray(
      Composite({
        layers: [{ src: img, resize: "contain" }],
        resize: "cover",
      }),
    );

    expect(result[0]?.props.resize).toBe("contain");
  });

  test("supports pixel values for position", () => {
    const img = Image({ src: "https://example.com/a.png" });

    const result = asArray(
      Composite({
        layers: [
          { src: img, left: "100px", top: "50px", width: "800px", height: "600px" },
        ],
      }),
    );

    expect(result[0]?.props.left).toBe("100px");
    expect(result[0]?.props.top).toBe("50px");
    expect(result[0]?.props.width).toBe("800px");
    expect(result[0]?.props.height).toBe("600px");
  });

  test("supports numeric values for position", () => {
    const img = Image({ src: "https://example.com/a.png" });

    const result = asArray(
      Composite({
        layers: [{ src: img, left: 100, top: 50, width: 800, height: 600 }],
      }),
    );

    expect(result[0]?.props.left).toBe(100);
    expect(result[0]?.props.top).toBe(50);
    expect(result[0]?.props.width).toBe(800);
    expect(result[0]?.props.height).toBe(600);
  });

  test("returns null for empty layers", () => {
    const result = Composite({ layers: [] });
    expect(result).toBeNull();
  });

  test("layer order matches array order (later layers on top)", () => {
    const imgA = Image({ src: "https://example.com/bottom.png" });
    const imgB = Image({ src: "https://example.com/middle.png" });
    const imgC = Image({ src: "https://example.com/top.png" });

    const result = asArray(
      Composite({
        layers: [
          { src: imgA, left: "0%", top: "0%", width: "100%", height: "100%" },
          { src: imgB, left: "10%", top: "10%", width: "80%", height: "80%" },
          { src: imgC, left: "20%", top: "20%", width: "60%", height: "60%" },
        ],
      }),
    );

    // Order preserved — bottom layer first, top layer last
    expect(result[0]?.props.src).toBe("https://example.com/bottom.png");
    expect(result[1]?.props.src).toBe("https://example.com/middle.png");
    expect(result[2]?.props.src).toBe("https://example.com/top.png");
  });
});
