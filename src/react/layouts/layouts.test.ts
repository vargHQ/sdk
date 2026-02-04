import { describe, expect, test } from "bun:test";
import { Video } from "../index";
import type { VargElement } from "../types";
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
    expect(result[0]!.props.left).toBe("0%");
    expect(result[0]!.props.width).toBe("50%");
    expect(result[1]!.props.left).toBe("50%");
    expect(result[1]!.props.width).toBe("50%");
  });

  test("vertical split stacks children", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
    ] as VargElement[];

    const result = asArray(Split({ direction: "vertical", children }));

    expect(result.length).toBe(2);
    expect(result[0]!.props.top).toBe("0%");
    expect(result[0]!.props.height).toBe("50%");
    expect(result[1]!.props.top).toBe("50%");
    expect(result[1]!.props.height).toBe("50%");
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

    expect(result[0]!.props.left).toBe("0%");
    expect(result[1]!.props.left).toBe("50%");
  });
});

describe("Grid", () => {
  test("2x1 grid positions children horizontally", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
    ] as VargElement[];

    const result = asArray(Grid({ columns: 2, rows: 1, children }));

    expect(result[0]!.props.left).toBe("0%");
    expect(result[0]!.props.top).toBe("0%");
    expect(result[0]!.props.width).toBe("50%");
    expect(result[0]!.props.height).toBe("100%");

    expect(result[1]!.props.left).toBe("50%");
    expect(result[1]!.props.top).toBe("0%");
    expect(result[1]!.props.width).toBe("50%");
    expect(result[1]!.props.height).toBe("100%");
  });

  test("1x2 grid positions children vertically", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
    ] as VargElement[];

    const result = asArray(Grid({ columns: 1, rows: 2, children }));

    expect(result[0]!.props.left).toBe("0%");
    expect(result[0]!.props.top).toBe("0%");
    expect(result[0]!.props.width).toBe("100%");
    expect(result[0]!.props.height).toBe("50%");

    expect(result[1]!.props.left).toBe("0%");
    expect(result[1]!.props.top).toBe("50%");
    expect(result[1]!.props.width).toBe("100%");
    expect(result[1]!.props.height).toBe("50%");
  });

  test("2x2 grid positions children in grid pattern", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
      Video({ src: "c.mp4" }),
      Video({ src: "d.mp4" }),
    ] as VargElement[];

    const result = asArray(Grid({ columns: 2, rows: 2, children }));

    expect(result[0]!.props.left).toBe("0%");
    expect(result[0]!.props.top).toBe("0%");

    expect(result[1]!.props.left).toBe("50%");
    expect(result[1]!.props.top).toBe("0%");

    expect(result[2]!.props.left).toBe("0%");
    expect(result[2]!.props.top).toBe("50%");

    expect(result[3]!.props.left).toBe("50%");
    expect(result[3]!.props.top).toBe("50%");
  });

  test("defaults resize to contain", () => {
    const children = [Video({ src: "a.mp4" })] as VargElement[];
    const result = asArray(Grid({ columns: 1, children }));

    expect(result[0]!.props.resize).toBe("contain");
  });

  test("child resize overrides grid default", () => {
    const child = Video({ src: "a.mp4" });
    (child.props as Record<string, unknown>).resize = "cover";

    const result = asArray(Grid({ columns: 1, children: [child] }));

    expect(result[0]!.props.resize).toBe("cover");
  });

  test("infers columns from children length when not specified", () => {
    const children = [
      Video({ src: "a.mp4" }),
      Video({ src: "b.mp4" }),
      Video({ src: "c.mp4" }),
    ] as VargElement[];

    const result = asArray(Grid({ children }));

    expect((result[0]!.props.width as string).startsWith("33.33")).toBe(true);
    expect((result[1]!.props.width as string).startsWith("33.33")).toBe(true);
    expect((result[2]!.props.width as string).startsWith("33.33")).toBe(true);
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

    expect(result[0]!.props.top).toBe("0%");
    expect(result[0]!.props.height).toBe("50%");
    expect(result[0]!.props.resize).toBe("cover");
    expect(result[0]!.props.cropPosition).toBe("top");

    expect(result[1]!.props.top).toBe("50%");
    expect(result[1]!.props.height).toBe("50%");
    expect(result[1]!.props.resize).toBe("cover");
    expect(result[1]!.props.cropPosition).toBe("bottom");
  });

  test("horizontal split with mixed Slot positions", () => {
    const video1 = Video({ src: "a.mp4" });
    const video2 = Video({ src: "b.mp4" });

    const slot1 = Slot({ class: "fit-cover pos-left", children: video1 });
    const slot2 = Slot({ class: "fit-contain pos-right", children: video2 });

    const result = asArray(
      Split({ direction: "horizontal", children: [slot1, slot2] }),
    );

    expect(result[0]!.props.resize).toBe("cover");
    expect(result[0]!.props.cropPosition).toBe("left");

    expect(result[1]!.props.resize).toBe("contain");
    expect(result[1]!.props.cropPosition).toBe("right");
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
      Slot({ class: "fit-cover pos-top-left", children: videos[0]! }),
      Slot({ class: "fit-cover pos-top-right", children: videos[1]! }),
      Slot({ class: "fit-contain pos-bottom-left", children: videos[2]! }),
      Slot({ class: "fit-fill pos-bottom-right", children: videos[3]! }),
    ];

    const result = asArray(Grid({ columns: 2, rows: 2, children: slots }));

    expect(result[0]!.props.cropPosition).toBe("top-left");
    expect(result[1]!.props.cropPosition).toBe("top-right");
    expect(result[2]!.props.cropPosition).toBe("bottom-left");
    expect(result[2]!.props.resize).toBe("contain");
    expect(result[3]!.props.cropPosition).toBe("bottom-right");
    expect(result[3]!.props.resize).toBe("stretch");
  });
});
