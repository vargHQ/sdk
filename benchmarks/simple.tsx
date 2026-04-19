/** @jsxImportSource vargai */

import {
  Captions,
  Clip,
  Image,
  Music,
  Overlay,
  Render,
  Speech,
  Title,
  Video,
} from "vargai/react";

export default (
  <Render width={1920} height={1080} fps={30}>
    <Clip duration={3}>
      <Video src="video1.mp4" />
      <Title text="Welcome" />
    </Clip>

    <Clip duration={4}>
      <Image src="image1.jpg" />
      <Speech text="Hello world" />
    </Clip>

    <Clip duration={3}>
      <Video src="video2.mp4" />
    </Clip>

    <Clip duration={2}>
      <Image src="image2.jpg" />
    </Clip>

    <Clip duration={3}>
      <Video src="video3.mp4" />
      <Speech text="Another segment" />
    </Clip>

    <Overlay left={50} top={50} width={200} height={200}>
      <Video src="overlay.mp4" />
    </Overlay>

    <Music src="bg.mp3" />
    <Captions />
  </Render>
);
