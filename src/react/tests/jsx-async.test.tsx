/**
 * Async JSX components — compile-time + runtime coverage.
 *
 * This file is the type-level guard for `JSX.ElementType` accepting async
 * components (`async function Scene(): Promise<VargElement>`). If the JSX
 * typing regresses, `<AsyncScene />` below fails `tsc` — no
 * `@ts-expect-error` required.
 */

import { describe, expect, test } from "bun:test";
import { Clip, Render } from "../elements";
import { resolveLazy } from "../renderers/resolve-lazy";
import type { VargElement } from "../types";

/** Async component with props — must typecheck in JSX without workarounds. */
async function AsyncScene({ duration }: { duration: number }) {
  // No awaited generation here — just async function shape.
  return <Clip duration={duration} />;
}

/** Sync component alongside, to ensure both shapes coexist. */
function SyncScene({ duration }: { duration: number }) {
  return <Clip duration={duration} />;
}

describe("async JSX components", () => {
  test("async component in JSX is wrapped as __lazy", () => {
    const tree = (
      <Render width={720} height={720}>
        <AsyncScene duration={2} />
        <SyncScene duration={1} />
      </Render>
    );

    expect(tree.type).toBe("render");
    const [lazy, sync] = tree.children as VargElement[];
    expect(lazy?.type).toBe("__lazy");
    expect(sync?.type).toBe("clip");
  });

  test("resolveLazy materializes async components into real elements", async () => {
    const tree = (
      <Render width={720} height={720}>
        <AsyncScene duration={3} />
      </Render>
    );

    const resolved = (await resolveLazy(tree)) as VargElement;
    const clip = resolved.children[0] as VargElement;
    expect(clip.type).toBe("clip");
    expect(clip.props.duration).toBe(3);
  });
});
