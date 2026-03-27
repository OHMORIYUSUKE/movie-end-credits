import { PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { listPhotoMetadata, PhotoMetadata } from "../utils/kv.ts";
import { getCookies } from "https://deno.land/std@0.208.0/http/cookie.ts";
import AdminDashboard from "../islands/AdminDashboard.tsx";

export const handler = {
  async GET(req: Request, ctx: any) {
    const cookies = getCookies(req.headers);
    const isAdmin = cookies.isAdmin === "true";
    const url = new URL(req.url);
    const success = url.searchParams.get("success") === "true";

    // 管理者の場合はメタデータのみ取得
    const photos = isAdmin ? await listPhotoMetadata(false) : [];

    // 動画の尺から最大枚数を計算する
    let videoPhotoCapacity = 0;
    let videoDurationSeconds = 0;
    try {
      const configUrl = new URL("../video-config.json", import.meta.url);
      const configContent = await Deno.readTextFile(configUrl);
      const config = JSON.parse(configContent);
      
      const durationInFrames = config.durationInFrames;
      const fps = config.fps;
      const secondsPerPhoto = config.secondsPerPhoto || 4;
      const startDelayFrames = config.startDelayFrames || 0;
      const endDelayFrames = config.endDelayFrames || 0;
      
      videoDurationSeconds = durationInFrames / fps;
      const activeDurationSeconds = (durationInFrames - startDelayFrames - endDelayFrames) / fps;
      videoPhotoCapacity = Math.floor(activeDurationSeconds / secondsPerPhoto);
      
      console.log(`[DEBUG] config loaded: duration=${durationInFrames}, fps=${fps}, capacity=${videoPhotoCapacity}`);
    } catch (err) {
      console.error("[DEBUG] Could not load video-config.json:", err.message);
      // Fallback: Parsing Root.tsx if config.json is missing
      try {
        const rootUrl = new URL("../../../src/Root.tsx", import.meta.url);
        const rootContent = await Deno.readTextFile(rootUrl);
        const durationMatch = rootContent.match(/durationInFrames=\{(\d+)\}/);
        const fpsMatch = rootContent.match(/fps=\{(\d+)\}/);
        if (durationMatch && fpsMatch) {
          const durationInFrames = parseInt(durationMatch[1]);
          const fps = parseInt(fpsMatch[1]);
          videoDurationSeconds = durationInFrames / fps;
          const activeDurationSeconds = videoDurationSeconds - 2.5;
          videoPhotoCapacity = Math.floor(activeDurationSeconds / 4);
        }
      } catch (_) { }
    }
    
    const configUrl = new URL("../video-config.json", import.meta.url);
    const configContent = await Deno.readTextFile(configUrl);
    const config = JSON.parse(configContent);
    const secondsPerPhoto = config.secondsPerPhoto || 4;
    const fps = config.fps || 30;
    const startDelayFrames = config.startDelayFrames || 0;
    const endDelayFrames = config.endDelayFrames || 0;
    
    return ctx.render({ photos, isAdmin, success, videoPhotoCapacity, videoDurationSeconds, secondsPerPhoto, fps, startDelayFrames, endDelayFrames });
  },
};

export default function Home({ data }: PageProps<{ 
  photos: PhotoMetadata[]; 
  isAdmin: boolean; 
  success: boolean; 
  videoPhotoCapacity: number; 
  videoDurationSeconds: number; 
  secondsPerPhoto: number;
  fps: number;
  startDelayFrames: number;
  endDelayFrames: number;
}>) {
  const { photos, isAdmin, success, videoPhotoCapacity, videoDurationSeconds, secondsPerPhoto, fps, startDelayFrames, endDelayFrames } = data;

  return (
    <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <Head>
        <title>【劇場版】アニメから得た学びを発表会2026 - 写真投稿</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div style={{ maxWidth: isAdmin ? "1200px" : "500px", margin: "0 auto", padding: "20px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "1.25rem", margin: 0, fontWeight: "800", color: "#333" }}>
            {isAdmin ? "管理者用 管理パネル" : "思い出をアップロード"}
          </h1>
          {isAdmin && (
            <a href="/logout" style={{ fontSize: "0.8rem", color: "#ff4d4f", textDecoration: "none" }}>ログアウト</a>
          )}
        </header>

        {/* 成功メッセージ */}
        {success && (
          <div style={{ 
            backgroundColor: "#d1e7dd", 
            color: "#0f5132", 
            padding: "16px", 
            borderRadius: "12px", 
            marginBottom: "20px",
            border: "1px solid #badbcc",
            textAlign: "center",
            fontWeight: "bold"
          }}>
            ✅ アップロード完了！<br />
            ありがとうございます！
          </div>
        )}

        {!isAdmin ? (
          <>
            {/* メインメッセージ (ユーザー用) */}
            <div style={{ 
              backgroundColor: "#ffffff", 
              padding: "24px", 
              borderRadius: "16px", 
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              marginBottom: "24px",
              border: "1px solid #e9ecef"
            }}>
              <p style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#0d6efd", marginBottom: "12px", textAlign: "center" }}>
                📸 みんなでエンドロールを<br />作り上げよう！
              </p>
              <p style={{ fontSize: "0.9rem", color: "#495057", lineHeight: "1.6", marginBottom: "16px" }}>
                <strong>【劇場版】アニメから得た学びを発表会2026</strong> の楽しい瞬間の写真を<strong>どしどしアップロードしてください！</strong><br />
                エンドロールを彩る思い出として、イベント内や広報で利用させていただく可能性があります。
              </p>
              
              <div style={{ fontSize: "0.75rem", color: "#6c757d", borderTop: "1px solid #eee", paddingTop: "12px" }}>
                <p style={{ marginBottom: "4px" }}>
                  ※投稿された写真は、内容を検討のうえ採用させていただきます。
                </p>
                <p>
                  ※写真は<a href="https://fortee.jp/engineers-anime-2026/page/privacy-policy" target="_blank" style={{ color: "#0d6efd" }}>プライバシーポリシー</a>に基づき適切に取り扱います。
                </p>
              </div>
            </div>

            {/* アップロードフォーム (ユーザー用) */}
            <div style={{ 
              backgroundColor: "#ffffff", 
              padding: "24px", 
              borderRadius: "16px", 
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              border: "1px solid #e9ecef"
            }}>
              <form action="/api/photos" method="POST" enctype="multipart/form-data">
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "12px", fontWeight: "bold", fontSize: "0.9rem" }}>
                    写真を選択 (複数OK):
                  </label>
                  <input 
                    type="file" 
                    name="file" 
                    accept="image/*" 
                    multiple 
                    required 
                    style={{ 
                      width: "100%", 
                      padding: "12px", 
                      border: "2px dashed #dee2e6", 
                      borderRadius: "8px",
                      fontSize: "0.85rem"
                    }} 
                  />
                </div>
                <button type="submit" style={{ 
                  width: "100%", 
                  padding: "16px", 
                  background: "#0d6efd", 
                  color: "white", 
                  border: "none", 
                  borderRadius: "12px", 
                  cursor: "pointer", 
                  fontSize: "1rem",
                  fontWeight: "bold",
                  boxShadow: "0 4px 6px rgba(13, 110, 253, 0.25)"
                }}>
                  写真を送る 🚀
                </button>
              </form>
            </div>
          </>
        ) : (
          /* 管理者用プレビュー */
          <AdminDashboard 
            initialPhotos={photos} 
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
