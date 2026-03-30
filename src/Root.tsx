import "./index.css";
import { Composition, delayRender, continueRender } from "remotion";
import { MyComposition } from "./Composition";
import videoConfig from "./generated/video-config.example.json";

// APIのベースURL。Composition.tsx と合わせる。
const BASE_URL = (typeof process !== "undefined" && process.env.REMOTION_API_URL) 
  ? process.env.REMOTION_API_URL 
  : "https://movie-end-credits.uutan1108.deno.net/api";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EndCredits"
        component={MyComposition}
        calculateMetadata={async () => {
          const handle = delayRender("Fetching music duration...");
          try {
            const res = await fetch(`${BASE_URL}/music`);
            const allMusic = await res.json();
            const activeMusic = allMusic.find((m: any) => m.active) || allMusic[0];
            
            const fps = videoConfig.fps || 30;
            const startDelay = videoConfig.startDelayFrames ?? (0.5 * fps);
            const endDelay = videoConfig.endDelayFrames ?? (2 * fps);
            
            // 音声の長さを取得。取得できない場合は config の値（フォールバック）
            const musicDurationSec = activeMusic?.duration;
            
            if (!musicDurationSec) {
              console.warn("Music duration not found in API, using fallback from config");
              continueRender(handle);
              return {
                durationInFrames: videoConfig.durationInFrames,
              };
            }

            const durationInFrames = Math.ceil(musicDurationSec * fps) + startDelay + endDelay;
            console.log(`Dynamic duration set: ${durationInFrames} frames (${musicDurationSec}s + delays)`);

            continueRender(handle);
            return {
              durationInFrames,
            };
          } catch (err) {
            console.error("Failed to fetch dynamic duration:", err);
            continueRender(handle);
            return {
              durationInFrames: videoConfig.durationInFrames,
            };
          }
        }}
        fps={videoConfig.fps}
        width={1280}
        height={720}
      />
    </>
  );
};
