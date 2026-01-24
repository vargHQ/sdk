# 2016 Deep Learning Nostalgia Video - Recreation Prompt

## Overview
Create a 22-second nostalgic video showcasing 2016 deep learning technologies with Tumblr pink/purple aesthetic, minimal white text overlays, and dreamy chillwave music.

---

## Step 1: Prepare Reference Images

Place the following images in `/Downloads/nostalgia-pack/`:
- `tensorflow.jpeg` - TensorFlow logo
- `keras.jpeg` - Keras logo
- `gans.jpeg` - GAN faces
- `DCGAN.png` - DCGAN architecture
- `rnn-vs-lstm.png` - RNN vs LSTM diagram
- `vgg16.png.webp` - VGG16 architecture
- `tesla-k80.jpeg` - NVIDIA Tesla K80 GPU
- `theano.jpg` - Theano logo
- `xgboost.jpg` - XGBoost logo
- `LDA.jpg` - LDA visualization
- `matrix-factorization.png` - Matrix factorization
- `wave-net.png.webp` - WaveNet
- `Deep Compression.png` - Deep compression

---

## Step 2: Create vargai TSX File

Create `2016-deep-learning-nostalgia.tsx`:

```tsx
/** @jsxImportSource vargai */
import { Render, Clip, Image, Music } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

const pack = "/Users/YOUR_USERNAME/Downloads/nostalgia-pack";

// Tumblr 2016 aesthetic prompt suffix
const tumblrStyle = "tumblr aesthetic, soft grunge, pastel pink and purple color grading, faded blacks, high contrast, grainy film texture, soft dreamy glow, vintage instagram filter, nostalgic 2016 vibes, soft blur vignette, ethereal lighting";

export default (
  <Render width={1080} height={1080}>
    {/* 2016 Nostalgia Music */}
    <Music 
      prompt="2016 nostalgia music, dreamy chillwave synthwave, soft lo-fi beats, vaporwave aesthetic, tumblr vibes, melancholic nostalgic melody, reverb-heavy synth pads, slow tempo 80bpm, emotional ambient electronic, retrowave, pastel aesthetic soundtrack"
      duration={28}
      volume={0.7}
    />

    {/* 1. TensorFlow */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `TensorFlow logo and neural network, ${tumblrStyle}`, images: [`${pack}/tensorflow.jpeg`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 2. Keras */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `Keras deep learning library logo, ${tumblrStyle}`, images: [`${pack}/keras.jpeg`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 3. GANs */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `Generative adversarial network faces, ${tumblrStyle}`, images: [`${pack}/gans.jpeg`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 4. DCGAN */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `DCGAN deep convolutional generative adversarial network architecture, ${tumblrStyle}`, images: [`${pack}/DCGAN.png`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 5. RNN vs LSTM */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `RNN and LSTM recurrent neural network comparison diagram, ${tumblrStyle}`, images: [`${pack}/rnn-vs-lstm.png`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 6. VGG16 */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `VGG16 convolutional neural network architecture layers, ${tumblrStyle}`, images: [`${pack}/vgg16.png.webp`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 7. Tesla K80 GPU */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `NVIDIA Tesla K80 GPU for deep learning, ${tumblrStyle}`, images: [`${pack}/tesla-k80.jpeg`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 8. Theano */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `Theano deep learning framework logo, ${tumblrStyle}`, images: [`${pack}/theano.jpg`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 9. XGBoost */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `XGBoost gradient boosting machine learning logo, ${tumblrStyle}`, images: [`${pack}/xgboost.jpg`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 10. LDA */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `LDA latent dirichlet allocation topic modeling visualization, ${tumblrStyle}`, images: [`${pack}/LDA.jpg`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 11. Matrix Factorization */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `Matrix factorization decomposition diagram, ${tumblrStyle}`, images: [`${pack}/matrix-factorization.png`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 12. WaveNet */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `WaveNet audio generation neural network, ${tumblrStyle}`, images: [`${pack}/wave-net.png.webp`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 13. Deep Compression */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `Deep compression neural network pruning quantization, ${tumblrStyle}`, images: [`${pack}/Deep Compression.png`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
    
    {/* 14. Deep Learning 2016 <3 - Final slide */}
    <Clip duration={2}>
      <Image
        prompt={{ text: `Deep Learning 2016 love heart aesthetic, neural network brain with pink hearts floating, nostalgic tech vibes, ${tumblrStyle}, dreamy romantic AI aesthetic, soft pink purple gradient, love letter to deep learning era`, images: [`${pack}/tensorflow.jpeg`] }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
  </Render>
);
```

---

## Step 3: Render vargai Video

```bash
bunx vargai@latest render 2016-deep-learning-nostalgia.tsx --verbose
```

Output: `output/2016-deep-learning-nostalgia.mp4` (28 seconds with music)

---

## Step 4: Create Remotion Project for Text Overlays

### 4.1 Initialize Remotion Project

```bash
mkdir 2016-nostalgia-motion && cd 2016-nostalgia-motion
npm init -y
npm install remotion @remotion/cli @remotion/transitions
mkdir -p src public out
```

### 4.2 Copy vargai output to public folder

```bash
cp ../output/2016-deep-learning-nostalgia.mp4 public/
```

### 4.3 Create `src/Root.tsx`

```tsx
import { Composition } from "remotion";
import { NostalgiaVideo } from "./NostalgiaVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NostalgiaVideo"
      component={NostalgiaVideo}
      durationInFrames={840} // 28 seconds at 30fps
      fps={30}
      width={1080}
      height={1080}
    />
  );
};
```

### 4.4 Create `src/index.ts`

```tsx
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

### 4.5 Create `src/NostalgiaVideo.tsx`

```tsx
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
  Easing,
  AbsoluteFill,
  OffthreadVideo,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

// 14 Deep Learning topics
const topics = [
  { name: "TensorFlow" },
  { name: "Keras" },
  { name: "GANs" },
  { name: "DCGAN" },
  { name: "RNN/LSTM" },
  { name: "VGG16" },
  { name: "Tesla K80" },
  { name: "Theano" },
  { name: "XGBoost" },
  { name: "LDA" },
  { name: "Matrix Factor" },
  { name: "WaveNet" },
  { name: "Deep Compress" },
  { name: "DL 2016 ♡" },
];

// 2016 Minimalist White Text - Clean tumblr aesthetic
const MinimalText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Smooth fade in
  const opacity = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // Gentle slide up
  const translateY = interpolate(frame, [0, fps * 0.5], [30, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Fade out at end
  const fadeOut = interpolate(frame, [fps * 1.5, fps * 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalOpacity = opacity * fadeOut;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: finalOpacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          color: "white",
          fontSize: 42,
          fontWeight: 300,
          fontFamily: "'Helvetica Neue', 'Arial', sans-serif",
          letterSpacing: 8,
          textTransform: "lowercase",
          textShadow: `
            0 2px 20px rgba(0, 0, 0, 0.5),
            0 0 40px rgba(255, 255, 255, 0.3)
          `,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// Scene component - clean minimal 2016 aesthetic
const Scene: React.FC<{
  topic: { name: string };
  startFrame: number;
}> = ({ topic, startFrame }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background video */}
      <OffthreadVideo
        src={staticFile("2016-deep-learning-nostalgia.mp4")}
        startFrom={startFrame}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Minimal white text label */}
      <MinimalText text={topic.name} />

      {/* Subtle vignette */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// Main composition with fade transitions
export const NostalgiaVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  const sceneDuration = fps * 2; // 2 seconds per scene
  const transitionDuration = Math.floor(fps * 0.5); // 0.5 second fade

  const fadeTransition = fade();

  return (
    <TransitionSeries>
      {topics.map((topic, index) => (
        <React.Fragment key={topic.name}>
          <TransitionSeries.Sequence durationInFrames={sceneDuration}>
            <Scene topic={topic} startFrame={index * fps * 2} />
          </TransitionSeries.Sequence>
          
          {index < topics.length - 1 && (
            <TransitionSeries.Transition
              presentation={fadeTransition}
              timing={linearTiming({ durationInFrames: transitionDuration })}
            />
          )}
        </React.Fragment>
      ))}
    </TransitionSeries>
  );
};
```

---

## Step 5: Render Remotion Video

```bash
bunx remotion render src/index.ts NostalgiaVideo out/2016-nostalgia-motion.mp4
```

---

## Step 6: Trim to Final Length (22 seconds)

```bash
ffmpeg -i out/2016-nostalgia-motion.mp4 -t 22 -c copy out/2016-nostalgia-final.mp4 -y
```

---

## Final Output

`2016-nostalgia-final.mp4` - 22 second video featuring:

### Visual Style
- **Tumblr 2016 aesthetic**: Pastel pink/purple color grading, soft grunge, faded blacks
- **Grainy film texture** with dreamy glow
- **Vintage Instagram filter** look
- **Soft blur vignette**

### Text Overlays
- **Font**: Helvetica Neue, 300 weight (light)
- **Color**: White with soft shadow
- **Style**: Lowercase, 8px letter spacing
- **Position**: Bottom center
- **Animation**: Fade in + slide up, fade out before transition

### Transitions
- **Type**: Smooth fade between slides
- **Duration**: 0.5 seconds

### Audio
- **Style**: Dreamy chillwave/synthwave
- **Tempo**: ~80 BPM
- **Vibe**: Melancholic, nostalgic, vaporwave aesthetic

### Slides (14 total, 2 seconds each)
1. TensorFlow
2. Keras
3. GANs
4. DCGAN
5. RNN/LSTM
6. VGG16
7. Tesla K80
8. Theano
9. XGBoost
10. LDA
11. Matrix Factor
12. WaveNet
13. Deep Compress
14. DL 2016 ♡

---

## Key Prompts Used

### Tumblr Style Suffix
```
tumblr aesthetic, soft grunge, pastel pink and purple color grading, faded blacks, high contrast, grainy film texture, soft dreamy glow, vintage instagram filter, nostalgic 2016 vibes, soft blur vignette, ethereal lighting
```

### Music Prompt
```
2016 nostalgia music, dreamy chillwave synthwave, soft lo-fi beats, vaporwave aesthetic, tumblr vibes, melancholic nostalgic melody, reverb-heavy synth pads, slow tempo 80bpm, emotional ambient electronic, retrowave, pastel aesthetic soundtrack
```

### Final Slide Prompt
```
Deep Learning 2016 love heart aesthetic, neural network brain with pink hearts floating, nostalgic tech vibes, [tumblr style], dreamy romantic AI aesthetic, soft pink purple gradient, love letter to deep learning era
```
