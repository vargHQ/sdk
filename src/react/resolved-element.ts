import type { File } from "../ai-sdk/file";
import type { Segment, WordTiming } from "../speech/types";
import { type AudioNode, makeAudioNode } from "./audio-element";
import type {
  ElementMeta,
  SliceSegment,
  VargElement,
  VargElementType,
  VargNode,
} from "./types";

/** Memoized derived audio nodes — one AudioNode per resolved element. */
const audioNodeCache = new WeakMap<object, AudioNode>();

/**
 * A VargElement that has been resolved via `await`.
 *
 * Contains the generated file, probed duration, and other metadata.
 * Satisfies the VargElement interface structurally, so it can be used
 * anywhere a VargElement is accepted (Clip children, Captions src, etc.).
 *
 * Supports destructuring for speech elements:
 * ```tsx
 * const { audio, segments, words, duration } = await Speech({
 *   voice: "adam",
 *   children: ["Welcome.", "Main content.", "Thanks."]
 * });
 *
 * // segments[i] is a ResolvedElement<"speech"> — use as clip child or video audio
 * <Clip duration={segments[0].duration}>{segments[0]}</Clip>
 * Video({ prompt: { images: [portrait], audio: segments[0] } })
 * ```
 */
export class ResolvedElement<T extends VargElementType = VargElementType> {
  readonly type: T;
  readonly props: Record<string, unknown>;
  readonly children: VargNode[];
  readonly meta: ElementMeta;

  constructor(
    element: { type: T; props: Record<string, unknown>; children: VargNode[] },
    meta: ElementMeta,
  ) {
    this.type = element.type;
    this.props = element.props;
    this.children = element.children;
    this.meta = meta;
  }

  /** Duration of the generated media in seconds. 0 for images. */
  get duration(): number {
    return this.meta.duration;
  }

  /** The generated file (image, video, audio). */
  get file(): File {
    return this.meta.file;
  }

  /**
   * Derived audio node for this element.
   *
   * - Speech parents: an `AudioNode` wrapping the same audio file, preserving
   *   word timings — usable everywhere the speech element was (clip child,
   *   `prompt.audio`, `Captions src`), plus `.transcribe()`, `.silenceSegments()`,
   *   `.range()`, `.speechRange()`.
   * - Video parents: an `AudioNode` that extracts the audio track via
   *   ffmpeg on `await`.
   * - Audio elements return themselves.
   *
   * Memoized: repeated access returns the same node.
   * Enables `const { audio, segments } = await Speech(...)`.
   */
  get audio(): AudioNode {
    if (this.type === "audio") return this as unknown as AudioNode;
    let node = audioNodeCache.get(this);
    if (!node) {
      node = makeAudioNode({
        parent: this as unknown as VargElement<"video"> | VargElement<"speech">,
      });
      audioNodeCache.set(this, node);
    }
    return node;
  }

  /** Aspect ratio of the generated media, if applicable. */
  get aspectRatio(): string | undefined {
    return this.meta.aspectRatio;
  }

  /**
   * Word-level timing data from ElevenLabs character alignment.
   * Available on speech elements when the provider returns alignment data.
   */
  get words(): WordTiming[] | undefined {
    return this.meta.words;
  }

  /**
   * Segments from Speech or Slice elements.
   * - Speech: `Segment[]` with `.text`, `.start`, `.end`
   * - Slice: `SliceSegment[]` with `.url`, `.index`, `.start`, `.end`
   */
  get segments(): T extends "slice" ? SliceSegment[] : Segment[] {
    return (this.meta.segments ?? []) as T extends "slice"
      ? SliceSegment[]
      : Segment[];
  }
}
