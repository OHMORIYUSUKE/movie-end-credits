import { PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { listPhotoMetadata, PhotoMetadata, listMusic, MusicMetadata } from "../utils/kv.ts";
import { getCookies } from "https://deno.land/std@0.208.0/http/cookie.ts";
import AdminDashboard from "../islands/AdminDashboard.tsx";

export const handler = {
  async GET(req: Request, ctx: any) {
    const cookies = getCookies(req.headers);
    const isAdmin = cookies.isAdmin === "true";
    const url = new URL(req.url);
    const success = url.searchParams.get("success") === "true";

    // データの取得
    const photos = await listPhotoMetadata(false);
    const music = isAdmin ? await listMusic() : await listMusic(); // 一般ユーザーも音声情報を取得（同期のため）
    const activeMusic = music.find(m => m.active) || music[0];

    // デフォルト設定の読み込み
    let fps = 30;
    let secondsPerPhoto = 4;
    let startDelayFrames = 0;
    let endDelayFrames = 0;
    let configDurationInFrames = 180 * 30;

    try {
      const configUrl = new URL("../../src/generated/video-config.json", import.meta.url);
      const configContent = await Deno.readTextFile(configUrl);
      const config = JSON.parse(configContent);
      fps = config.fps || 30;
      secondsPerPhoto = config.secondsPerPhoto || 4;
      startDelayFrames = config.startDelayFrames || 0;
      endDelayFrames = config.endDelayFrames || 0;
      configDurationInFrames = config.durationInFrames;
    } catch (_) { }

    // 【重要】動画の尺をアクティブな音楽の長さに合わせる
    const musicDurationSec = activeMusic?.duration || (configDurationInFrames / fps);
    const videoDurationSeconds = musicDurationSec + (startDelayFrames + endDelayFrames) / fps;
    const activeDurationSeconds = musicDurationSec;
    const videoPhotoCapacity = Math.floor(activeDurationSeconds / secondsPerPhoto);
    
    return ctx.render({ photos, music, isAdmin, success, videoPhotoCapacity, videoDurationSeconds, secondsPerPhoto, fps, startDelayFrames, endDelayFrames });
  },
};

export default function Home({ data }: PageProps<{ 
  photos: PhotoMetadata[]; 
  music: MusicMetadata[];
  isAdmin: boolean; 
  success: boolean; 
  videoPhotoCapacity: number; 
  videoDurationSeconds: number; 
  secondsPerPhoto: number;
  fps: number;
  startDelayFrames: number;
  endDelayFrames: number;
}>) {
  const { photos, music, isAdmin, success, videoPhotoCapacity, videoDurationSeconds, secondsPerPhoto, fps, startDelayFrames, endDelayFrames } = data;

  return (
    <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <Head>
        <title>Movie End Credits - Photo Board</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div style={{ maxWidth: isAdmin ? "1200px" : "800px", margin: "0 auto", padding: "20px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "1.25rem", margin: 0, fontWeight: "800", color: "#333" }}>
            {isAdmin ? "管理者用 管理パネル" : "思い出をアップロード"}
          </h1>
          {isAdmin && (
            <a href="/logout" style={{ fontSize: "0.8rem", color: "#ff4d4f", textDecoration: "none" }}>ログアウト</a>
          )}
        </header>

        {success && (
          <div style={{ backgroundColor: "#d1e7dd", color: "#0f5132", padding: "16px", borderRadius: "12px", marginBottom: "20px", border: "1px solid #badbcc", textAlign: "center", fontWeight: "bold" }}>
            ✅ アップロード完了！ありがとうございます！
          </div>
        )}

        {!isAdmin ? (
          <>
            <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", marginBottom: "40px", border: "1px solid #e9ecef" }}>
              <p style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#0d6efd", marginBottom: "12px", textAlign: "center" }}>
                📸 みんなでエンドロールを作り上げよう！
              </p>
              <p style={{ fontSize: "0.9rem", color: "#495057", lineHeight: "1.6", marginBottom: "16px" }}>
                <strong>【劇場版】アニメから得た学びを発表会2026</strong> の楽しい瞬間の写真を<strong>どしどしアップロードしてください！</strong><br />
                エンドロールを彩る思い出として、イベント内や広報で利用させていただく可能性があります。
              </p>
              
              <div style={{ fontSize: "0.75rem", color: "#6c757d", borderTop: "1px solid #eee", paddingTop: "12px", marginBottom: "20px" }}>
                <p style={{ marginBottom: "4px" }}>※投稿された写真は、動画の尺などの都合により、採用されない場合があります。あらかじめご了承ください。</p>
                <p>※写真は<a href="https://fortee.jp/engineers-anime-2026/page/privacy-policy" target="_blank" style={{ color: "#0d6efd" }}>プライバシーポリシー</a>に基づき適切に取り扱います。</p>
              </div>

              <form action="/api/photos" method="POST" enctype="multipart/form-data">
                <div style={{ marginBottom: "20px" }}>
                  <input type="file" name="file" accept="image/*" multiple required style={{ width: "100%", padding: "12px", border: "2px dashed #dee2e6", borderRadius: "8px", fontSize: "0.85rem" }} />
                </div>
                <button type="submit" style={{ width: "100%", padding: "16px", background: "#0d6efd", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "1rem", fontWeight: "bold" }}>写真を送る 🚀</button>
              </form>
            </div>

            <div style={{ marginTop: "60px", borderTop: "2px dashed #dee2e6", paddingTop: "40px" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#333", marginBottom: "24px", textAlign: "center" }}>
                みんなが投稿した思い出 🎞️
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                {photos.length === 0 && (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#999", padding: "60px", backgroundColor: "#fff", borderRadius: "16px" }}>
                    まだ写真がありません。最初の1枚を投稿しよう！
                  </div>
                )}
                {photos.map((photo) => (
                  <div key={photo.id} style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", backgroundColor: "#fff", position: "relative" }}>
                    <img src={`/api/photo_data?timestamp=${photo.timestamp}&id=${photo.id}`} style={{ width: "100%", height: "140px", objectFit: "cover" }} loading="lazy" />
                    {photo.featured && (
                      <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(255, 193, 7, 0.9)", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>🌟</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <AdminDashboard 
            initialPhotos={photos} 
            initialMusic={music}
            videoPhotoCapacity={videoPhotoCapacity}
            videoDurationSeconds={videoDurationSeconds}
            secondsPerPhoto={secondsPerPhoto}
            fps={fps}
            startDelayFrames={startDelayFrames}
            endDelayFrames={endDelayFrames}
          />
        )}
      </div>
    </div>
  );
}
