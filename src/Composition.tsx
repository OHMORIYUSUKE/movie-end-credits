import React, { useEffect, useState, useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  delayRender,
  continueRender,
} from "remotion";
import credits from "./generated/credits.json";
import videoConfig from "./generated/video-config.json";

interface PhotoData {
  id: string;
  name: string;
  timestamp: number;
  featured: boolean;
  selected?: boolean;
}

interface MusicMetadata {
  id: string;
  name: string;
  duration?: number;
  active: boolean;
}

type CreditItem = 
  | { type: 'staff'; role: string; name: string }
  | { type: 'header'; text: string; large?: boolean }
  | { type: 'participant'; name: string }
  | { type: 'rank'; text: string; large: boolean }
  | { type: 'sponsor'; name: string; large: boolean }
  | { type: 'spacer'; height: number }
  | { type: 'logo'; src: string; height: number };

export const MyComposition: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [musicData, setMusicData] = useState<MusicMetadata | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [handle] = useState(() => delayRender());
  const frame = useCurrentFrame();
  const { height, durationInFrames, fps } = useVideoConfig();

  const DELAY_FRAMES = videoConfig.startDelayFrames ?? (0.5 * fps);
  const END_DELAY_FRAMES = videoConfig.endDelayFrames ?? (2 * fps);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/api/photos").then(res => res.json()),
      fetch("http://localhost:8000/api/music").then(res => res.json()),
      fetch("http://localhost:8000/api/logo").then(res => res.ok ? "http://localhost:8000/api/logo" : null)
    ])
      .then(([allPhotos, allMusic, logo]: [PhotoData[], MusicMetadata[], string | null]) => {
        const finalPhotos = allPhotos
          .filter(p => p.selected)
          .sort((a, b) => a.timestamp - b.timestamp);
        setPhotos(finalPhotos);

        const activeMusic = allMusic.find(m => m.active) || allMusic[0];
        setMusicData(activeMusic || null);
        setLogoUrl(logo);
        
        continueRender(handle);
      })
      .catch((err) => {
        console.error("Failed to fetch data:", err);
        continueRender(handle);
      });
  }, [handle]);

  // クレジットが流れるための有効な尺（全フレームからディレイを引いたもの）
  const activeDurationFrames = useMemo(() => {
    return durationInFrames - DELAY_FRAMES - END_DELAY_FRAMES;
  }, [durationInFrames, DELAY_FRAMES, END_DELAY_FRAMES]);

  // 音楽の尺（Audioコンポーネント用。基本は activeDurationFrames と一致するはず）
  const musicDurationFrames = useMemo(() => {
    if (musicData?.duration) {
      return Math.floor(musicData.duration * fps);
    }
    return activeDurationFrames;
  }, [musicData, activeDurationFrames, fps]);

  const creditItems: CreditItem[] = useMemo(() => {
    const items: CreditItem[] = [
      ...((credits as any).sections || []).flatMap((section: any) => [
        { type: 'header' as const, text: section.title },
        { type: 'spacer' as const, height: 50 },
        ...section.names.map((name: string) => ({ type: 'participant' as const, name })),
        { type: 'spacer' as const, height: 150 },
      ]),
      { type: 'spacer', height: 150 },
      { type: 'header', text: '個人スポンサー' },
      { type: 'spacer', height: 100 },
      ...Object.entries((credits as any).sponsors || {}).reverse().flatMap(([rank, names]: [string, any]) => [
        { type: 'rank' as const, text: rank, large: true },
        { type: 'spacer' as const, height: 40 },
        ...(names as string[]).map(name => ({ type: 'sponsor' as const, name, large: true })),
        { type: 'spacer' as const, height: 100 },
      ]),
      { type: 'spacer', height: 200 }
    ];

    if (logoUrl) {
      items.push({ type: 'logo', src: logoUrl, height: 300 });
    } else {
      items.push({ type: 'logo', src: staticFile((videoConfig as any).logoPath || "logo/logo.svg"), height: 300 });
    }
    return items;
  }, [logoUrl]);

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
  
  // スクロール速度の計算: activeDurationFrames 内で全クレジットを流し切る
  let scrollY = height;
  if (frame >= DELAY_FRAMES && frame < DELAY_FRAMES + activeDurationFrames) {
    scrollY = interpolate(
      frame - DELAY_FRAMES,
      [0, activeDurationFrames],
      [height, -totalCreditsHeight + height]
    );
  } else if (frame >= DELAY_FRAMES + activeDurationFrames) {
    scrollY = -totalCreditsHeight + height;
  }

  // Photo rotation & opacity logic (remains synchronized with active duration)
  const currentPhoto = useMemo(() => {
    if (photos.length === 0) return null;
    const photoFrameDuration = activeDurationFrames / photos.length;
    const activeFrame = Math.max(0, frame - DELAY_FRAMES);
    const photoIndex = Math.min(photos.length - 1, Math.floor(activeFrame / photoFrameDuration));
    return photos[photoIndex];
  }, [photos, activeDurationFrames, frame, DELAY_FRAMES]);

  const photoOpacity = useMemo(() => {
    if (photos.length === 0) return 0;
    const photoFrameDuration = activeDurationFrames / photos.length;
    const activeFrame = Math.max(0, frame - DELAY_FRAMES);
    const localFrame = activeFrame % photoFrameDuration;
    const fadeDuration = 15;
    if (frame < DELAY_FRAMES || frame > DELAY_FRAMES + activeDurationFrames) return 0;
    return interpolate(
      localFrame, 
      [0, fadeDuration, photoFrameDuration - fadeDuration, photoFrameDuration], 
      [0, 1, 1, 0], 
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }, [photos.length, activeDurationFrames, frame, DELAY_FRAMES]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black", color: "white", fontFamily: "sans-serif" }}>
      {musicData && (
        <Sequence from={DELAY_FRAMES} durationInFrames={musicDurationFrames}>
          <Audio src={`http://localhost:8000/api/music?id=${musicData.id}`} />
        </Sequence>
      )}

      <div style={{ position: "absolute", width: "50%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", padding: "40px" }}>
        {currentPhoto && (
          <Img
            src={`http://localhost:8000/api/photo_data?timestamp=${currentPhoto.timestamp}&id=${currentPhoto.id}`}
            style={{ width: "80%", height: "auto", maxHeight: "80%", objectFit: "cover", opacity: photoOpacity, boxShadow: "0 0 20px rgba(255, 255, 255, 0.2)" }}
          />
        )}
      </div>

      <div style={{ position: "absolute", right: 0, width: "50%", height: "100%", overflow: "hidden" }}>
        <div style={{ transform: `translateY(${scrollY}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {creditItems.map((item, index) => {
            const itemHeight = getItemHeight(item);
            if (item.type === 'spacer') return <div key={index} style={{ height: itemHeight }} />;
            return (
              <div key={index} style={{ height: itemHeight, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", color: "white" }}>
                {item.type === 'staff' && (
                  <>
                    <div style={{ fontSize: "22px", opacity: 0.8, letterSpacing: "2px", marginBottom: "5px" }}>{item.role}</div>
                    <div style={{ fontSize: "34px", fontWeight: "bold" }}>{item.name}</div>
                  </>
                )}
                {item.type === 'header' && <div style={{ fontSize: "30px", fontWeight: "bold", letterSpacing: "4px", borderBottom: "1px solid white", paddingBottom: "5px", marginBottom: "15px" }}>{item.text}</div>}
                {item.type === 'participant' && <div style={{ fontSize: "26px" }}>{item.name}</div>}
                {item.type === 'rank' && <div style={{ fontSize: "30px", fontWeight: "bold" }}>{item.text}</div>}
                {item.type === 'sponsor' && <div style={{ fontSize: "30px", fontWeight: "bold" }}>{item.name}</div>}
                {item.type === 'logo' && <Img src={item.src} style={{ height: "120px", width: "auto", display: "block", margin: "0 auto" }} />}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
