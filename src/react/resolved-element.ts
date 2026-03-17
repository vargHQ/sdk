import type { File } from "../ai-sdk/file";
import type { Segment, WordTiming } from "../speech/types";
import type { ElementMeta, VargElementType, VargNode } from "./types";

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
   * Self-reference for destructuring convenience.
   * Enables `const { audio, segments } = await Speech(...)`.
   * `audio` is the full resolved speech element — pass it anywhere a speech element is accepted.
   */
  get audio(): this {
    return this;
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
   * Speech segments — each is a `ResolvedElement<"speech">` with timing metadata.
   * Empty array when no segments. Each segment works as a clip child, video audio
   * input, or captions source.
   */
  get segments(): Segment[] {
    return this.meta.segments ?? [];
  }
}
