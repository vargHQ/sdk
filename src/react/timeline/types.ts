export type TimelineFormat = "otio" | "fcpxml";

export type ExportMode = "rendered" | "placeholders";

export interface TimelineExportOptions {
  format: TimelineFormat;
  mode: ExportMode;
  output: string;
  cache?: string;
  quiet?: boolean;
}

export interface TimelineAsset {
  id: string;
  type: "video" | "image" | "audio";
  path: string;
  prompt?: string;
  isPlaceholder: boolean;
  duration?: number;
  width?: number;
  height?: number;
}

export interface TimelineClipItem {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
  volume?: number;
  position?: { x: number | string; y: number | string };
  size?: { width: number | string; height: number | string };
  zoom?: "in" | "out" | "left" | "right";
  resizeMode?: string;
}

export interface TimelineTransition {
  type: string;
  duration: number;
  afterClipIndex: number;
}

export interface TimelineTextItem {
  id: string;
  type: "title" | "subtitle";
  text: string;
  startTime: number;
  duration: number;
  position?: string;
  color?: string;
  backgroundColor?: string;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: "video" | "audio";
  items: TimelineClipItem[];
}

export interface Timeline {
  name: string;
  fps: number;
  width: number;
  height: number;
  duration: number;
  videoTracks: TimelineTrack[];
  audioTracks: TimelineTrack[];
  textItems: TimelineTextItem[];
  transitions: TimelineTransition[];
  assets: TimelineAsset[];
  metadata: {
    exportMode: ExportMode;
    exportedAt: string;
    sourceFile?: string;
  };
}

export interface TimelineExportResult {
  timelinePath: string;
  format: TimelineFormat;
  assets: TimelineAsset[];
  summary: {
    clips: number;
    audioTracks: number;
    transitions: number;
    placeholders: number;
    duration: number;
  };
}
