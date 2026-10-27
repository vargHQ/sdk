/**
 * Clip tree flattening — recursively flatten nested clips into leaf clips,
 * hoist captions, and defer container-level audio.
 *
 * Extracted from render.ts so renderRoot stays a thin orchestrator.
 */

import type { ClipProps, VargElement } from "../types";

export interface HoistedCaption {
  element: VargElement<"captions">;
  clipIndex: number;
  /**
   * Trim window of the leaf clip the captions were hoisted from.
   * Caption cue timings reference the clip's RAW media (whisper transcribes
   * the untrimmed audio), but the timeline shows [cutFrom, cutTo]. The
   * caption merge uses this window to re-base, drop, and clamp cues.
   * Absent for container/render-level captions (untrimmed window).
   */
  window?: CaptionWindow;
}

export interface CaptionWindow {
  /** Leaf clip's cutFrom (seconds into the raw media). */
  cutFrom: number;
  /** Leaf clip's cutTo (seconds into the raw media), if set. */
  cutTo?: number;
  /** Leaf clip's timeline duration, if numeric. */
  duration?: number;
}

/** Extract the caption trim window from a leaf clip's props. */
function captionWindow(props: ClipProps): CaptionWindow | undefined {
  const cutFrom = props.cutFrom;
  const cutTo = props.cutTo;
  const duration =
    typeof props.duration === "number" ? props.duration : undefined;
  if (cutFrom === undefined && cutTo === undefined) return undefined;
  return { cutFrom: cutFrom ?? 0, cutTo, duration };
}

export interface DeferredAudio {
  element: VargElement<"speech"> | VargElement<"music"> | VargElement<"audio">;
  clipIndex: number;
}

export interface FlattenResult {
  clipElements: VargElement<"clip">[];
  hoistedCaptions: HoistedCaption[];
  deferredAudioElements: DeferredAudio[];
}

/**
 * Recursively flatten nested clips into leaf clips.
 *
 * A "container clip" has child <Clip> elements. Its non-clip children
 * (Speech, Music, Captions) are hoisted/deferred to span the container's
 * time region, which starts at the first leaf clip's timeline position.
 *
 * A "leaf clip" has no child <Clip> elements — it contains visual/audio
 * layers and is rendered directly by editly.
 */
export function flattenClips(rootChildren: VargElement[]): FlattenResult {
  const clipElements: VargElement<"clip">[] = [];
  const hoistedCaptions: HoistedCaption[] = [];
  const deferredAudioElements: DeferredAudio[] = [];
  let clipIndexCounter = 0;

  function flattenClip(clipElement: VargElement<"clip">): void {
    const childClips: VargElement<"clip">[] = [];
    const nonClipChildren: VargElement[] = [];

    for (const child of clipElement.children) {
      if (!child || typeof child !== "object" || !("type" in child)) continue;
      const el = child as VargElement;
      if (el.type === "clip") {
        childClips.push(el as VargElement<"clip">);
      } else {
        nonClipChildren.push(el);
      }
    }

    if (childClips.length === 0) {
      // Leaf clip — hoist captions, keep everything else
      const currentClipIndex = clipIndexCounter++;
      const window = captionWindow(clipElement.props as ClipProps);
      const kept: typeof clipElement.children = [];
      for (const el of nonClipChildren) {
        if (el.type === "captions") {
          hoistedCaptions.push({
            element: el as VargElement<"captions">,
            clipIndex: currentClipIndex,
            window,
          });
        } else {
          kept.push(el);
        }
      }
      clipElements.push({
        ...clipElement,
        children: kept,
      } as VargElement<"clip">);
      return;
    }

    // Container clip — has child clips.
    const firstLeafClipIndex = clipIndexCounter;

    // Collect overlays from container level — inject into each child clip
    const containerOverlays: VargElement[] = [];
    for (const el of nonClipChildren) {
      if (el.type === "overlay") {
        containerOverlays.push(el);
      }
    }

    for (const childClip of childClips) {
      if (containerOverlays.length > 0) {
        childClip.children = [...childClip.children, ...containerOverlays];
      }
      flattenClip(childClip);
    }

    // Process remaining non-clip children at the container level
    for (const el of nonClipChildren) {
      if (el.type === "captions") {
        hoistedCaptions.push({
          element: el as VargElement<"captions">,
          clipIndex: firstLeafClipIndex,
        });
      } else if (
        el.type === "speech" ||
        el.type === "music" ||
        el.type === "audio"
      ) {
        deferredAudioElements.push({
          element: el as
            | VargElement<"speech">
            | VargElement<"music">
            | VargElement<"audio">,
          clipIndex: firstLeafClipIndex,
        });
      }
    }
  }

  for (const child of rootChildren) {
    if (child.type === "clip") {
      flattenClip(child as VargElement<"clip">);
    }
  }

  return { clipElements, hoistedCaptions, deferredAudioElements };
}
