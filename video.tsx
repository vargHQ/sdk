/** @jsxImportSource vargai */

import { elevenlabs, fal } from "vargai/ai";
import { Clip, Image, Music, Render } from "vargai/react";

const pack = "/Users/aleksandrmalysev/Downloads/nostalgia-pack";

// Tumblr 2016 aesthetic prompt suffix
const tumblrStyle =
  "tumblr aesthetic, soft grunge, pastel pink and purple color grading, faded blacks, high contrast, grainy film texture, soft dreamy glow, vintage instagram filter, nostalgic 2016 vibes, soft blur vignette, ethereal lighting";

export default (
  <Render width={1080} height={1080}>
    {/* 2016 Nostalgia Music */}
    <Music
      prompt="2016 nostalgia music, dreamy chillwave synthwave, soft lo-fi beats, vaporwave aesthetic, tumblr vibes, melancholic nostalgic melody, reverb-heavy synth pads, slow tempo 80bpm, emotional ambient electronic, retrowave, pastel aesthetic soundtrack"
      model={elevenlabs.musicModel()}
      duration={28}
      volume={0.7}
    />

    {/* 1. TensorFlow */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `TensorFlow logo and neural network, ${tumblrStyle}`,
          images: [`${pack}/tensorflow.jpeg`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 2. Keras */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `Keras deep learning library logo, ${tumblrStyle}`,
          images: [`${pack}/keras.jpeg`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 3. GANs */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `Generative adversarial network faces, ${tumblrStyle}`,
          images: [`${pack}/gans.jpeg`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 4. DCGAN */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `DCGAN deep convolutional generative adversarial network architecture, ${tumblrStyle}`,
          images: [`${pack}/DCGAN.png`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 5. RNN vs LSTM */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `RNN and LSTM recurrent neural network comparison diagram, ${tumblrStyle}`,
          images: [`${pack}/rnn-vs-lstm.png`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 6. VGG16 */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `VGG16 convolutional neural network architecture layers, ${tumblrStyle}`,
          images: [`${pack}/vgg16.png.webp`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 7. Tesla K80 GPU */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `NVIDIA Tesla K80 GPU for deep learning, ${tumblrStyle}`,
          images: [`${pack}/tesla-k80.jpeg`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 8. Theano */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `Theano deep learning framework logo, ${tumblrStyle}`,
          images: [`${pack}/theano.jpg`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 9. XGBoost */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `XGBoost gradient boosting machine learning logo, ${tumblrStyle}`,
          images: [`${pack}/xgboost.jpg`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 10. LDA */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `LDA latent dirichlet allocation topic modeling visualization, ${tumblrStyle}`,
          images: [`${pack}/LDA.jpg`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 11. Matrix Factorization */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `Matrix factorization decomposition diagram, ${tumblrStyle}`,
          images: [`${pack}/matrix-factorization.png`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 12. WaveNet */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `WaveNet audio generation neural network, ${tumblrStyle}`,
          images: [`${pack}/wave-net.png.webp`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 13. Deep Compression */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `Deep compression neural network pruning quantization, ${tumblrStyle}`,
          images: [`${pack}/Deep Compression.png`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>

    {/* 14. Deep Learning 2016 <3 - Final slide */}
    <Clip duration={2}>
      <Image
        prompt={{
          text: `Deep Learning 2016 love heart aesthetic, neural network brain with pink hearts floating, nostalgic tech vibes, ${tumblrStyle}, dreamy romantic AI aesthetic, soft pink purple gradient, love letter to deep learning era`,
          images: [`${pack}/tensorflow.jpeg`],
        }}
        model={fal.imageModel("nano-banana-pro/edit")}
        aspectRatio="1:1"
      />
    </Clip>
  </Render>
);
