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
 * @example
 * ```tsx
 * // Single string
 * const audio = await Speech({ voice: "adam", children: "Hello world" });
 * audio.duration  // 3.8
 * audio.words     // [{word: "Hello", start: 0, end: 0.5}, ...]
 *
 * // Array children — segments with lazy audio slicing
 * const audio = await Speech({
 *   voice: "adam",
 *   children: ["Welcome.", "Main content.", "Thanks."]
 * });
 * audio.segments[0].duration  // 2.1
 * audio.segments[0].audio()   // Promise<Uint8Array> (ffmpeg slice)
 *
 * <Clip duration={audio.segments[0].duration}>
 *   <Video prompt={{ images: [portrait], audio: await audio.segments[0].audio() }}
 *          model="veed-fabric-1.0" />
 * </Clip>
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

  /** The generated file. */
  get file(): File {
    return this.meta.file;
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
   * Speech segments corresponding to each entry in the `children` array.
   * Available when `children` was passed as a `string[]` to `Speech()`.
   * Each segment has start/end timestamps and a lazy `.audio()` method
   * that extracts just that segment's bytes via ffmpeg.
   */
  get segments(): Segment[] | undefined {
    return this.meta.segments;
  }
}
