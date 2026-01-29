import { Clip, Image, Music, Render, Title, Video } from "..";

export default (
  <Render width={1920} height={1080} fps={30}>
    <Music prompt="upbeat corporate music, inspiring" />

    <Clip duration={3}>
      <Video prompt="aerial shot of mountains at sunrise, cinematic" />
      <Title position="center">Welcome</Title>
    </Clip>

    <Clip duration={4} transition={{ name: "fade", duration: 0.5 }}>
      <Image
        prompt="modern office building, glass facade, blue sky"
        zoom="in"
      />
      <Title position="bottom">Our Vision</Title>
    </Clip>

    <Clip duration={3} transition={{ name: "crosswipe", duration: 0.8 }}>
      <Video prompt="team meeting, diverse professionals, collaborative" />
    </Clip>
  </Render>
);
