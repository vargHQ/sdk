# varg.ai sdk

video generation and editing tools sdk

## folder structure

```
sdk/
│
├── utilities/
│
├── lib/
│   ├── pymovie/
│   ├── opencv/
│   ├── fal/
│   ├── higgsfield/
│   ├── ffmpeg/
│   ├── remotion.dev/
│   └── motion.dev/
│
├── service/
│   ├── image/
│   ├── video/
│   ├── edit/           # video editing
│   ├── sync/           # lipsync
│   ├── captions/
│   └── voice/
│
└── pipeline/
    └── cookbooks/
```

## modules

### lib
core libraries for video/audio processing:
- pymovie: python video editing
- opencv: computer vision operations
- fal: serverless ai models
- higgsfield: video generation
- ffmpeg: video/audio encoding
- remotion.dev: react-based video rendering
- motion.dev: motion graphics

### service
main service layer:
- image: image generation and processing
- video: video generation
- edit: video editing operations
- sync: lipsync processing
- captions: caption generation
- voice: voice synthesis and processing

### pipeline
- cookbooks: processing pipelines
