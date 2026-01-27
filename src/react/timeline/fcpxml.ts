import type { Timeline, TimelineAsset, TimelineClipItem } from "./types";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function secondsToFCPTime(seconds: number, fps: number): string {
  const frames = Math.round(seconds * fps);
  return `${frames}/${fps}s`;
}

function getFormatName(width: number, height: number, fps: number): string {
  if (width === 1920 && height === 1080) return `FFVideoFormat1080p${fps}`;
  if (width === 1280 && height === 720) return `FFVideoFormat720p${fps}`;
  if (width === 3840 && height === 2160) return `FFVideoFormat2160p${fps}`;
  if (width === 1080 && height === 1920)
    return `FFVideoFormatVertical1080p${fps}`;
  return `FFVideoFormat${height}p${fps}`;
}

function generateAssetXml(
  asset: TimelineAsset,
  index: number,
  formatId: string,
  fps: number,
): string {
  const id = `r${index * 2 + 1}`;
  const formatRef = `r${index * 2 + 2}`;
  const duration = asset.duration ?? 10;
  const hasVideo = asset.type === "video" || asset.type === "image" ? 1 : 0;
  const hasAudio = asset.type === "video" || asset.type === "audio" ? 1 : 0;

  return `    <asset id="${id}" src="${escapeXml(asset.path)}" start="0s" duration="${secondsToFCPTime(duration, fps)}" hasVideo="${hasVideo}" hasAudio="${hasAudio}" format="${formatRef}" audioSources="1" audioChannels="2" audioRate="48000"/>
    <format id="${formatRef}" name="${formatId}"/>`;
}

function generateAssetClipXml(
  item: TimelineClipItem,
  asset: TimelineAsset,
  assetIndex: number,
  fps: number,
): string {
  const ref = `r${assetIndex * 2 + 1}`;
  const start = secondsToFCPTime(item.trimStart ?? 0, fps);
  const duration = secondsToFCPTime(item.duration, fps);
  const name = escapeXml(asset.prompt ?? `Clip ${assetIndex + 1}`);
  const audioRole = asset.type === "audio" ? "dialogue" : "dialogue";

  return `                <asset-clip name="${name}" ref="${ref}" start="${start}" duration="${duration}" audioRole="${audioRole}"/>`;
}

export function exportFCPXML(timeline: Timeline): string {
  const formatName = getFormatName(
    timeline.width,
    timeline.height,
    timeline.fps,
  );

  const assetMap = new Map<string, { asset: TimelineAsset; index: number }>();
  let assetIndex = 0;
  for (const asset of timeline.assets) {
    assetMap.set(asset.id, { asset, index: assetIndex++ });
  }

  const assetsXml = timeline.assets
    .map((asset, i) => generateAssetXml(asset, i, formatName, timeline.fps))
    .join("\n");

  const allVideoItems = timeline.videoTracks.flatMap((t) => t.items);
  const clipsXml = allVideoItems
    .map((item) => {
      const entry = assetMap.get(item.assetId);
      if (!entry) return "";
      return generateAssetClipXml(item, entry.asset, entry.index, timeline.fps);
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.8">
  <resources>
${assetsXml}
  </resources>
  <library>
    <event name="${escapeXml(timeline.name)}">
      <project name="${escapeXml(timeline.name)}">
        <sequence format="r2">
          <spine>
${clipsXml}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
}
