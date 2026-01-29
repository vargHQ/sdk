import type { Timeline, TimelineAsset, TimelineClipItem } from "./types";

interface OTIORationalTime {
  OTIO_SCHEMA: "RationalTime.1";
  rate: number;
  value: number;
}

interface OTIOTimeRange {
  OTIO_SCHEMA: "TimeRange.1";
  start_time: OTIORationalTime;
  duration: OTIORationalTime;
}

interface OTIOExternalReference {
  OTIO_SCHEMA: "ExternalReference.1";
  available_range: OTIOTimeRange | null;
  metadata: Record<string, unknown>;
  target_url: string;
  name: string;
}

interface OTIOClip {
  OTIO_SCHEMA: "Clip.1";
  effects: unknown[];
  markers: unknown[];
  enabled: boolean;
  media_reference: OTIOExternalReference;
  metadata: Record<string, unknown>;
  name: string;
  source_range: OTIOTimeRange | null;
}

interface OTIOTrack {
  OTIO_SCHEMA: "Track.1";
  children: OTIOClip[];
  effects: unknown[];
  kind: "Video" | "Audio";
  markers: unknown[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  name: string;
  source_range: null;
}

interface OTIOStack {
  OTIO_SCHEMA: "Stack.1";
  children: OTIOTrack[];
  effects: unknown[];
  markers: unknown[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  name: string;
  source_range: null;
}

interface OTIOTimeline {
  OTIO_SCHEMA: "Timeline.1";
  metadata: Record<string, unknown>;
  name: string;
  tracks: OTIOStack;
}

function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

function createRationalTime(seconds: number, fps: number): OTIORationalTime {
  return {
    OTIO_SCHEMA: "RationalTime.1",
    rate: fps,
    value: secondsToFrames(seconds, fps),
  };
}

function createTimeRange(
  startSeconds: number,
  durationSeconds: number,
  fps: number,
): OTIOTimeRange {
  return {
    OTIO_SCHEMA: "TimeRange.1",
    start_time: createRationalTime(startSeconds, fps),
    duration: createRationalTime(durationSeconds, fps),
  };
}

function createClip(
  item: TimelineClipItem,
  asset: TimelineAsset,
  fps: number,
  clipIndex: number,
): OTIOClip {
  const availableRange = asset.duration
    ? createTimeRange(0, asset.duration, fps)
    : null;

  const sourceRange = createTimeRange(item.trimStart ?? 0, item.duration, fps);

  return {
    OTIO_SCHEMA: "Clip.1",
    effects: [],
    markers: [],
    enabled: true,
    media_reference: {
      OTIO_SCHEMA: "ExternalReference.1",
      available_range: availableRange,
      metadata: asset.prompt
        ? { prompt: asset.prompt, isPlaceholder: asset.isPlaceholder }
        : {},
      target_url: asset.path,
      name: `Media-${String(clipIndex + 1).padStart(3, "0")}`,
    },
    metadata: {},
    name: `Clip-${String(clipIndex + 1).padStart(3, "0")}`,
    source_range: sourceRange,
  };
}

function createTrack(
  name: string,
  kind: "Video" | "Audio",
  items: TimelineClipItem[],
  assets: Map<string, TimelineAsset>,
  fps: number,
): OTIOTrack {
  const clips: OTIOClip[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const asset = assets.get(item.assetId);
    if (!asset) continue;
    clips.push(createClip(item, asset, fps, i));
  }

  return {
    OTIO_SCHEMA: "Track.1",
    children: clips,
    effects: [],
    kind,
    markers: [],
    enabled: true,
    metadata: {},
    name,
    source_range: null,
  };
}

export function toOTIO(timeline: Timeline): OTIOTimeline {
  const assetMap = new Map(timeline.assets.map((a) => [a.id, a]));

  const videoTracks: OTIOTrack[] = timeline.videoTracks.map((track) =>
    createTrack(track.name, "Video", track.items, assetMap, timeline.fps),
  );

  const audioTracks: OTIOTrack[] = timeline.audioTracks.map((track) =>
    createTrack(track.name, "Audio", track.items, assetMap, timeline.fps),
  );

  return {
    OTIO_SCHEMA: "Timeline.1",
    metadata: {
      varg: {
        exportMode: timeline.metadata.exportMode,
        exportedAt: timeline.metadata.exportedAt,
        sourceFile: timeline.metadata.sourceFile,
        resolution: { width: timeline.width, height: timeline.height },
      },
    },
    name: timeline.name,
    tracks: {
      OTIO_SCHEMA: "Stack.1",
      children: [...videoTracks, ...audioTracks],
      effects: [],
      markers: [],
      enabled: true,
      metadata: {},
      name: "tracks",
      source_range: null,
    },
  };
}

export function exportOTIO(timeline: Timeline): string {
  const otio = toOTIO(timeline);
  return JSON.stringify(otio, null, 2);
}
