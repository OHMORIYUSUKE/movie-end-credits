import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import videoConfig from "./video-config.json";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EndCredits"
        component={MyComposition}
        durationInFrames={videoConfig.durationInFrames}
        fps={videoConfig.fps}
        width={1280}
        height={720}
      />
    </>
  );
};
