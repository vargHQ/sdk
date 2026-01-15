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
| video | ⚠️ partial | missing: originX/originY |
| image | ⚠️ partial | missing: zoomDirection left/right |
| image-overlay | ✅ done | position presets, PositionObject, Ken Burns zoom/pan |
| title | ⚠️ partial | missing: fontPath, fontFamily, ken burns |
| subtitle | ✅ done | centered bottom, background box, custom colors |
| title-background | ✅ done | title with gradient/color background |
| news-title | ❌ not implemented | need to implement |
| slide-in-text | ❌ not implemented | need to implement |
| fill-color | ✅ done | |
| pause | ✅ done | aliased to fill-color |
| radial-gradient | ✅ done | |
| linear-gradient | ✅ done | |
| rainbow-colors | ❌ not implemented | can do with ffmpeg hue filter |
| audio | ⚠️ partial | works as audioTracks, not as layer |
| detached-audio | ❌ not implemented | clip-relative timing |
| canvas | 🚫 skip | requires dependencies |
| fabric | 🚫 skip | requires dependencies |
| gl | 🚫 skip | requires dependencies |

## transitions

| feature | status | notes |
|---------|--------|-------|
| ffmpeg xfade | ✅ working | ~40 transitions available |
| gl-transitions | 🚫 skip | requires headless-gl |
| audio crossfade | ❌ not implemented | need acrossfade filter |

## audio

| feature | status | notes |
|---------|--------|-------|
| audioFilePath | ✅ done | |
| audioTracks | ⚠️ partial | missing: cutFrom/cutTo, start |
| loopAudio | ❌ not implemented | |
| keepSourceAudio | ❌ not implemented | |
| clipsAudioVolume | ❌ not implemented | |
| outputVolume | ✅ done | |
| audioNorm | ❌ not implemented | |

## config

| option | status | notes |
|--------|--------|-------|
| defaults.layer | ❌ not implemented | |
| defaults.layerType | ❌ not implemented | |
| layer start/stop timing | ❌ not implemented | |
| contain-blur resize | ❌ not implemented | |
| custom fonts | ❌ not implemented | |

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
7. [ ] rainbow-colors layer
8. [ ] news-title layer (if feasible with ffmpeg)
9. [ ] slide-in-text layer (if feasible with ffmpeg)

### phase 3: audio features
10. [ ] audio layer (as clip layer, not just audioTracks)
11. [ ] detached-audio layer
12. [ ] loopAudio
13. [ ] keepSourceAudio
14. [ ] clipsAudioVolume
15. [ ] audioNorm
16. [ ] audioTracks cutFrom/cutTo/start

### phase 4: advanced features
17. [ ] layer start/stop timing
18. [ ] contain-blur resize mode
19. [ ] defaults.layer / defaults.layerType
20. [ ] audio crossfade during transitions

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

## progress log

<!-- append progress here as we implement -->
