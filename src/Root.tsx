import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EndCredits"
        component={MyComposition}
        durationInFrames={6841} // (224s * 30fps) + (4s * 30fps) = 6720 + 120 = 6840
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
