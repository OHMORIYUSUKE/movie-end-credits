import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import generatedConfig from "./generated-config.json";
import credits from "./credits.json";

// Helper to get static path from public-relative path in config
const getStaticPath = (fileName: string) => {
  const baseDir = (generatedConfig.mediaPath as string).replace(/^public\//, '');
  return staticFile(`${baseDir}/${fileName}`);
};

const photos = (generatedConfig.photos as string[]).map(name => getStaticPath(name));
const logoSrc = staticFile(((generatedConfig as any).logoPath as string || "public/logo/logo.svg").replace(/^public\//, ''));
const audioSrc = staticFile((generatedConfig.audioPath as string).replace(/^public\//, ''));

type CreditItem = 
  | { type: 'staff'; role: string; name: string }
  | { type: 'header'; text: string; large?: boolean }
  | { type: 'participant'; name: string }
  | { type: 'rank'; text: string; large: boolean }
  | { type: 'sponsor'; name: string; large: boolean }
  | { type: 'spacer'; height: number }
  | { type: 'logo'; src: string; height: number };

const creditItems: CreditItem[] = [
  // Participants from CSV
  ...Object.entries(credits.participants as Record<string, string[]>).flatMap(([slotName, names]) => [
    { type: 'header' as const, text: slotName },
    { type: 'spacer' as const, height: 50 },
    ...names.map(name => ({ type: 'participant' as const, name })),
    { type: 'spacer' as const, height: 150 },
  ]),

  { type: 'spacer', height: 150 },
  { type: 'header', text: (generatedConfig as any).sponsorHeader || 'スポンサー' },
  { type: 'spacer', height: 100 },
  ...Object.entries(credits.sponsors).reverse().flatMap(([rank, names]) => [
    { type: 'rank' as const, text: rank, large: true },
    { type: 'spacer' as const, height: 40 }, // Space after rank
    ...names.map(name => ({ type: 'sponsor' as const, name, large: true })),
    { type: 'spacer' as const, height: 100 },
  ]),
  { type: 'spacer', height: 200 },
  { type: 'logo', src: logoSrc, height: 300 }
];

export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { height, durationInFrames, fps } = useVideoConfig();

  const DELAY_FRAMES = 0.5 * fps; // 0.5 second delay
  const END_DELAY_FRAMES = 2 * fps; // 2 seconds delay at the end
  const activeDuration = durationInFrames - DELAY_FRAMES - END_DELAY_FRAMES;

  // Photo settings from config
  const configPhotoDisplaySeconds = (generatedConfig as any).photoDisplaySeconds;
  const configPhotoFadeFrames = (generatedConfig as any).photoFadeFrames || 15;

  // Scroll logic: calculate total height
  const getItemHeight = (item: CreditItem) => {
    switch (item.type) {
      case 'staff': return 120;
      case 'header': return 120;
      case 'participant': return 50;
      case 'rank': return 70;
      case 'sponsor': return 60;
      case 'spacer': return item.height;
      case 'logo': return item.height;
      default: return 0;
    }
  };

  const totalCreditsHeight = creditItems.reduce((acc, item) => acc + getItemHeight(item), 0) + height;
  
  let scrollY = height;
  if (frame >= DELAY_FRAMES && frame < durationInFrames - END_DELAY_FRAMES) {
    scrollY = interpolate(
      frame - DELAY_FRAMES,
      [0, activeDuration],
      [height, -totalCreditsHeight + height]
    );
  } else if (frame >= durationInFrames - END_DELAY_FRAMES) {
    scrollY = -totalCreditsHeight + height;
  }

  // Photo rotation: switch photo evenly across active duration or use config
  const photoFrameDuration = photos.length > 0 
    ? (configPhotoDisplaySeconds ? configPhotoDisplaySeconds * fps : activeDuration / photos.length) 
    : activeDuration;
  const activeFrame = Math.max(0, frame - DELAY_FRAMES);
  const photoIndex = photos.length > 0 ? Math.min(
    photos.length - 1,
    Math.floor(activeFrame / photoFrameDuration)
  ) : 0;
  const currentPhoto = photos[photoIndex];

  // Photo fade in/out:
  const localFrame = activeFrame % photoFrameDuration;
  const fadeDuration = configPhotoFadeFrames;
  const photoOpacity = (photos.length === 0 || frame < DELAY_FRAMES || frame > durationInFrames - END_DELAY_FRAMES)
    ? 0
    : interpolate(
        localFrame,
        [0, fadeDuration, photoFrameDuration - fadeDuration, photoFrameDuration],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );

  return (
    <AbsoluteFill style={{ backgroundColor: "black", color: "white", fontFamily: "sans-serif" }}>
      <Sequence from={DELAY_FRAMES} durationInFrames={activeDuration}>
        <Audio src={audioSrc} />
      </Sequence>

      {/* Left side: Photos */}
      <div
        style={{
          position: "absolute",
          width: "50%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "40px",
        }}
      >
        {photos.length > 0 && (
          <Img
            src={currentPhoto}
            style={{
              width: "80%",
              height: "auto",
              maxHeight: "80%",
              objectFit: "cover",
              opacity: photoOpacity,
              boxShadow: "0 0 20px rgba(255, 255, 255, 0.2)",
            }}
          />
        )}
      </div>

      {/* Right side: Scrolling Staff Credits */}
      <div
        style={{
          position: "absolute",
          right: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            transform: `translateY(${scrollY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {creditItems.map((item, index) => {
            const itemHeight = getItemHeight(item);
            if (item.type === 'spacer') return <div key={index} style={{ height: itemHeight }} />;
            
            return (
              <div
                key={index}
                style={{
                  height: itemHeight,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  color: "white",
                }}
              >
                {item.type === 'staff' && (
                  <>
                    <div style={{ fontSize: "22px", opacity: 0.8, letterSpacing: "2px", marginBottom: "5px" }}>
                      {item.role}
                    </div>
                    <div style={{ fontSize: "34px", fontWeight: "bold" }}>{item.name}</div>
                  </>
                )}
                {item.type === 'header' && (
                  <div style={{ 
                    fontSize: "30px", 
                    fontWeight: "bold", 
                    letterSpacing: "4px",
                    borderBottom: "1px solid white",
                    paddingBottom: "5px",
                    marginBottom: "15px"
                  }}>
                    {item.text}
                  </div>
                )}
                {item.type === 'participant' && (
                  <div style={{ fontSize: "26px" }}>{item.name}</div>
                )}
                {item.type === 'rank' && (
                  <div style={{ fontSize: "30px", fontWeight: "bold" }}>
                    {item.text}
                  </div>
                )}
                {item.type === 'sponsor' && (
                  <div style={{ fontSize: "30px", fontWeight: "bold" }}>
                    {item.name}
                  </div>
                )}
                {item.type === 'logo' && (
                  <Img 
                    src={item.src} 
                    style={{ 
                      height: "120px", 
                      width: "auto",
                      display: "block",
                      margin: "0 auto",
                    }} 
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
