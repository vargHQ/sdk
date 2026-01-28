# editly implementation plan

## goal

match the original editly interface/types so users can use the same config format, but implement everything with pure ffmpeg (no headless-gl, no Fabric.js, no canvas dependencies).

## process

1. implement feature
2. create test that generates output video
3. tell user what to look for in the output (specific visual behavior to verify)
4. wait for user confirmation before moving to next feature

## instructions

implement features one by one. check with user and show examples before moving on to the next feature.

---

## layer types

| layer | status | notes |
|-------|--------|-------|
| video | ✅ done | originX/originY, cutFrom/cutTo, contain-blur |
| image | ✅ done | zoomDirection in/out/left/right, contain-blur |
| image-overlay | ✅ done | position presets, PositionObject, Ken Burns zoom/pan |
| title | ✅ done | fontPath, fontFamily, start/stop timing |
| subtitle | ✅ done | centered bottom, background box, start/stop timing |
| title-background | ✅ done | title with gradient/color background |
| news-title | ✅ done | colored bar with text, top/bottom, start/stop timing |
| slide-in-text | ✅ done | animated text sliding from left, start/stop timing |
| fill-color | ✅ done | |
| pause | ✅ done | aliased to fill-color |
| radial-gradient | ✅ done | |
| linear-gradient | ✅ done | |
| rainbow-colors | ✅ done | animated hue rotation |
| audio | ✅ done | works as clip layer with cutFrom/cutTo/mixVolume |
| detached-audio | ✅ done | clip-relative timing with start offset |
| canvas | 🚫 skip | requires dependencies |
| fabric | 🚫 skip | requires dependencies |
| gl | 🚫 skip | requires dependencies |

## transitions

| feature | status | notes |
|---------|--------|-------|
| ffmpeg xfade | ✅ working | ~40 transitions available |
| gl-transitions | 🚫 skip | requires headless-gl |
| audio crossfade | ✅ done | afade in/out during transitions |

## audio

| feature | status | notes |
|---------|--------|-------|
| audioFilePath | ✅ done | |
| audioTracks | ✅ done | cutFrom/cutTo/start/mixVolume |
| loopAudio | ✅ done | loops background audio to match video duration |
| keepSourceAudio | ✅ done | extracts audio from video clips, syncs with cutFrom |
| clipsAudioVolume | ✅ done | controls volume of source video audio |
| outputVolume | ✅ done | |
| audioNorm | ✅ done | dynaudnorm filter with gaussSize/maxGain |

## config

| option | status | notes |
|--------|--------|-------|
| defaults.layer | ✅ done | applies common props to all layers |
| defaults.layerType | ✅ done | applies type-specific defaults |
| layer start/stop timing | ✅ done | enable expression for text layers |
| contain-blur resize | ✅ done | blurred background instead of black bars |
| custom fonts | ✅ done | fontPath and fontFamily support |

---

## implementation order

### phase 1: complete existing layers
1. [x] video: add originX/originY ✅
2. [x] image: add zoomDirection left/right ✅
3. [x] title: add fontPath/fontFamily support ✅

### phase 2: missing layer types
4. [x] image-overlay layer ✅
5. [x] subtitle layer ✅
6. [x] title-background layer ✅
7. [x] rainbow-colors layer ✅
8. [x] news-title layer ✅
9. [x] slide-in-text layer ✅

### phase 3: audio features
10. [x] audio layer (as clip layer, not just audioTracks) ✅
11. [x] detached-audio layer ✅
12. [x] loopAudio ✅
13. [x] keepSourceAudio ✅
14. [x] clipsAudioVolume ✅
15. [x] audioNorm ✅
16. [x] audioTracks cutFrom/cutTo/start ✅

### phase 4: advanced features
17. [x] layer start/stop timing ✅
18. [x] contain-blur resize mode ✅
19. [x] defaults.layer / defaults.layerType ✅
20. [x] audio crossfade during transitions ✅

---

## ffmpeg xfade transitions (available)

these work out of the box:
- fade, fadeblack, fadewhite, fadeslow
- wipeleft, wiperight, wipeup, wipedown
- slideleft, slideright, slideup, slidedown
- circlecrop, rectcrop
- distance, fadegrayscale
- hblur, pixelize, diagtl, diagtr, diagbl, diagbr
- hlslice, hrslice, vuslice, vdslice
- dissolve, radial, smoothleft, smoothright, smoothup, smoothdown
- circleopen, circleclose, vertopen, vertclose, horzopen, horzclose
- squeezev, squeezeh, zoomin, hlwind, hrwind, vuwind, vdwind
- coverleft, coverright, coverup, coverdown
- revealleft, revealright, revealup, revealdown

---

## key differences from original editly

### continuous video overlays

when the same video file is used as an overlay (with `left`/`top`/`width`/`height` positioning) across multiple clips, our implementation automatically makes it continuous:

1. `collectVideoOverlays()` groups overlay videos by path
2. calculates `totalDuration` across all clips
3. uses a single ffmpeg input stream
4. overlays it on the final composited video

this means if you add `{ type: "video", path: "pip.mp4", left: 0.73, top: 0.73, width: 0.25, height: 0.25 }` to each clip, the video plays continuously across the timeline (not restarting per clip).

**limitation**: the overlay video must be long enough to cover the total timeline. if your timeline is 12s but the overlay video is 5s, it stops at 5s.

---

## progress log

<!-- append progress here as we implement -->
