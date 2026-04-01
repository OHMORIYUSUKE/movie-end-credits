import { cookies } from "next/headers";
import AdminDashboard from "@/components/AdminDashboard";

interface PhotoMetadata {
  id: string;
  name: string;
  timestamp: number;
  visible: boolean;
  featured: boolean;
  selected?: boolean;
}

interface MusicMetadata {
  id: string;
  name: string;
  timestamp: number;
  duration?: number;
  active: boolean;
}

async function getInitialData() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("isAdmin")?.value === "true";

  // Deno API からデータを取得
  // クライアント側からもアクセスできるように、プロキシを経由する
  const apiBase = "http://localhost:8000/api";
  const clientApiBase = "/api/proxy";
  
  const [photosRes, musicRes] = await Promise.all([
    fetch(`${apiBase}/photos`, { cache: 'no-store' }),
    fetch(`${apiBase}/music`, { cache: 'no-store' }),
    fetch(`${apiBase}/credits`, { cache: 'no-store' })
  ]);

  const photos: PhotoMetadata[] = await photosRes.json().catch(() => []);
  const music: MusicMetadata[] = await musicRes.json().catch(() => []);
  
  // デフォルト設定
  let fps = 30;
  let secondsPerPhoto = 4;
  let startDelayFrames = 0;
  let endDelayFrames = 0;

  const activeMusic = music.find(m => m.active) || music[0];
  const musicDurationSec = activeMusic?.duration || 180;
  const videoDurationSeconds = musicDurationSec + (startDelayFrames + endDelayFrames) / fps;
  const videoPhotoCapacity = Math.floor(musicDurationSec / secondsPerPhoto);

  return {
    photos,
    music,
    isAdmin,
    videoPhotoCapacity,
    videoDurationSeconds,
    secondsPerPhoto,
    fps,
    startDelayFrames,
    endDelayFrames,
    clientApiBase
  };
}

export default async function Home(props: { searchParams: Promise<{ success?: string }> }) {
  const searchParams = await props.searchParams;
  const success = searchParams.success === "true";
  const data = await getInitialData();
  const { photos, music, isAdmin, videoPhotoCapacity, videoDurationSeconds, secondsPerPhoto, fps, startDelayFrames, endDelayFrames, clientApiBase } = data;

  return (
    <div className="bg-[#f8f9fa] min-h-screen">
      <div className="max-w-[1200px] mx-auto p-5">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-xl m-0 font-extrabold text-[#333]">
            {isAdmin ? "管理者用 管理パネル" : "思い出をアップロード"}
          </h1>
          {isAdmin && (
            <a href="/api/proxy/logout" className="text-sm text-[#ff4d4f] no-underline">ログアウト</a>
          )}
        </header>

        {success && (
          <div className="bg-[#d1e7dd] text-[#0f5132] p-4 rounded-xl mb-5 border border-[#badbcc] text-center font-bold">
            ✅ アップロード完了！ありがとうございます！
          </div>
        )}

        {!isAdmin ? (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm mb-10 border border-[#e9ecef]">
              <p className="text-[1.1rem] font-bold text-[#0d6efd] mb-3 text-center">
                📸 みんなでエンドロールを作り上げよう！
              </p>
              <p className="text-sm text-[#495057] leading-relaxed mb-4">
                <strong>【劇場版】アニメから得た学びを発表会2026</strong> の楽しい瞬間の写真を<strong>どしどしアップロードしてください！</strong><br />
                エンドロールを彩る思い出として、イベント内や広報で利用させていただく可能性があります。
              </p>
              
              <div className="text-[0.75rem] text-[#6c757d] border-t border-gray-100 pt-3 mb-5">
                <p className="mb-1">※投稿された写真は、動画の尺などの都合により、採用されない場合があります。あらかじめご了承ください。</p>
                <p>※写真は<a href="https://fortee.jp/engineers-anime-2026/page/privacy-policy" target="_blank" className="text-[#0d6efd]">プライバシーポリシー</a>に基づき適切に取り扱います。</p>
              </div>

              <form action="/api/proxy/photos" method="POST" encType="multipart/form-data">
                <div className="mb-5">
                  <input type="file" name="file" accept="image/*" multiple required className="w-full p-3 border-2 border-dashed border-[#dee2e6] rounded-lg text-sm" />
                </div>
                <button type="submit" className="w-full p-4 bg-[#0d6efd] text-white border-none rounded-xl cursor-pointer text-base font-bold">写真を送る 🚀</button>
              </form>
            </div>

            <div className="mt-14 border-t-2 border-dashed border-[#dee2e6] pt-10">
              <h2 className="text-[1.4rem] font-bold text-[#333] mb-6 text-center">
                みんなが投稿した思い出 🎞️
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                {photos.length === 0 && (
                  <div className="col-span-full text-center text-[#999] py-14 bg-white rounded-2xl">
                    まだ写真がありません。最初の1枚を投稿しよう！
                  </div>
                )}
                {photos.map((photo) => (
                  <div key={photo.id} className="rounded-xl overflow-hidden shadow-sm bg-white relative">
                    <img src={`/api/proxy/photo_data?timestamp=${photo.timestamp}&id=${photo.id}`} className="w-full h-[140px] object-cover" loading="lazy" />
                    {photo.featured && (
                      <div className="absolute top-2 right-2 bg-yellow-400/90 px-1.5 py-0.5 rounded text-[10px] font-bold">🌟</div>
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
            apiBase={clientApiBase}
          />
        )}
      </div>
    </div>
  );
}
