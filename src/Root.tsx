import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import generatedConfig from "./generated-config.json";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EndCredits"
        component={MyComposition}
        durationInFrames={generatedConfig.durationInFrames}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
