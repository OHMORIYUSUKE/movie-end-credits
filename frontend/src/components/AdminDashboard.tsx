"use client";

import { useState, useMemo, useEffect } from "react";

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

interface AdminDashboardProps {
  initialPhotos: PhotoMetadata[];
  initialMusic: MusicMetadata[];
  videoPhotoCapacity: number;
  videoDurationSeconds: number;
  secondsPerPhoto: number;
  fps: number;
  startDelayFrames: number;
  endDelayFrames: number;
  apiBase: string;
}

export default function AdminDashboard({ 
  initialPhotos, 
  initialMusic,
  videoPhotoCapacity, 
  videoDurationSeconds,
  secondsPerPhoto,
  fps,
  startDelayFrames,
  endDelayFrames,
  apiBase
}: AdminDashboardProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [music, setMusic] = useState(initialMusic);
  const [credits, setCredits] = useState<any>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 尺が未設定の音声があれば、クライアントサイドで計算してサーバーに送る
    const updateMissingDurations = async () => {
      for (const m of music) {
        if (!m.duration) {
          console.log(`Calculating duration for: ${m.name}`);
          try {
            const audio = new Audio();
            audio.src = `${apiBase}/music?id=${m.id}`;
            await new Promise((resolve) => {
              audio.onloadedmetadata = () => resolve(true);
              audio.onerror = () => resolve(false);
            });
            if (audio.duration) {
              const formData = new FormData();
              formData.append("action", "update-duration");
              formData.append("id", m.id);
              formData.append("timestamp", m.timestamp.toString());
              formData.append("duration", audio.duration.toString());
              await fetch(`${apiBase}/music`, { method: "POST", body: formData, credentials: "include" });
              setMusic(prev => prev.map(p => p.id === m.id ? { ...p, duration: audio.duration } : p));
            }
          } catch (err) {
            console.error(`Failed to update duration for ${m.name}:`, err);
          }
        }
      }
    };
    updateMissingDurations();

    // クレジット情報の取得
    fetch(`${apiBase}/credits`).then(res => res.json()).then(data => setCredits(data)).catch(() => {});
  }, [music]);

  const featuredCount = useMemo(() => photos.filter(p => p.featured).length, [photos]);
  const selectedCount = useMemo(() => photos.filter(p => p.selected).length, [photos]);
  const totalCount = photos.length;
  
  const activePhotos = useMemo(() => {
    return photos.filter(p => p.selected).sort((a, b) => a.timestamp - b.timestamp);
  }, [photos]);

  const activeMusic = useMemo(() => music.find(m => m.active) || music[0], [music]);

  const initializePhotos = async () => {
    if (!confirm("現在の選択状態をリセットし、時系列で均等に再選択しますか？")) return;
    setLoadingId("init");
    try {
      const formData = new FormData();
      formData.append("action", "select-initial");
      formData.append("capacity", videoPhotoCapacity.toString());
      const res = await fetch(`${apiBase}/photos`, { method: "POST", body: formData, credentials: "include" });
      if (res.ok) window.location.reload();
    } catch (err) { alert("初期化に失敗しました。"); }
    finally { setLoadingId(null); }
  };

  const performAction = async (action: string, photo: PhotoMetadata) => {
    if (loadingId) return;
    if (action === "delete" && !confirm(`この画像を完全に削除しますか？`)) return;
    setLoadingId(photo.id);
    try {
      const formData = new FormData();
      formData.append("action", action);
      formData.append("timestamp", photo.timestamp.toString());
      formData.append("id", photo.id);
      if (action === "toggle-featured") formData.append("featured", (!photo.featured).toString());
      else if (action === "toggle-selected") formData.append("selected", (!photo.selected).toString());
      const res = await fetch(`${apiBase}/photos`, { method: "POST", body: formData, credentials: "include" });
      if (res.ok) {
        let newPhotos = photos;
        if (action === "delete") newPhotos = photos.filter(p => p.id !== photo.id);
        else if (action === "toggle-featured") {
          const featured = !photo.featured;
          newPhotos = photos.map(p => p.id === photo.id ? { ...p, featured, selected: featured ? true : p.selected } : p);
        } else if (action === "toggle-selected") {
          newPhotos = photos.map(p => p.id === photo.id ? { ...p, selected: !p.selected } : p);
        }
        setPhotos(newPhotos);
      }
    } catch (err) { alert("通信エラーが発生しました。"); }
    finally { setLoadingId(null); }
  };

  const performMusicAction = async (action: string, item: MusicMetadata) => {
    if (loadingId) return;
    if (action === "delete" && !confirm(`「${item.name}」を完全に削除しますか？`)) return;
    setLoadingId(item.id);
    try {
      const formData = new FormData();
      formData.append("action", action);
      formData.append("id", item.id);
      formData.append("timestamp", item.timestamp.toString());
      const res = await fetch(`${apiBase}/music`, { method: "POST", body: formData, credentials: "include" });
      if (res.ok) {
        if (action === "delete") setMusic(music.filter(m => m.id !== item.id));
        else if (action === "select") setMusic(music.map(m => ({ ...m, active: m.id === item.id })));
      }
    } catch (err) { alert("通信エラーが発生しました。"); }
    finally { setLoadingId(null); }
  };

  const handleMusicUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[name="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setLoadingId("music-upload");
    try {
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      await new Promise((resolve) => {
        audio.onloadedmetadata = () => resolve(true);
        audio.onerror = () => resolve(false);
      });
      const duration = audio.duration || 0;
      URL.revokeObjectURL(audio.src);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("duration", duration.toString());
      const res = await fetch(`${apiBase}/music`, { method: "POST", body: formData, credentials: "include" });
      if (res.ok) window.location.reload();
      else alert("アップロードに失敗しました。");
    } catch (err) { alert("エラーが発生しました。"); }
    finally { setLoadingId(null); }
  };

  const handleCreditsUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[name="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setLoadingId("credits-upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${apiBase}/credits`, { method: "POST", body: formData, credentials: "include" });
      if (res.ok) {
        const newData = await fetch(`${apiBase}/credits`).then(r => r.json());
        setCredits(newData);
        alert("クレジットを更新しました。");
      } else {
        alert("アップロードに失敗しました。");
      }
    } catch (err) { alert("エラーが発生しました。"); }
    finally { setLoadingId(null); }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `(${mins}:${secs.toString().padStart(2, "0")})`;
  };

  const sortedPhotos = [...photos].sort((a, b) => a.timestamp - b.timestamp);

  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  );

  const StarIcon = ({ filled }: { filled: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={filled ? "#ffc107" : "none"} stroke={filled ? "#ffc107" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );

  const isOverCapacity = selectedCount > videoPhotoCapacity;

  return (
    <div>
      {/* 🖼️ ロゴ管理パネル */}
      <div className="bg-white p-5 rounded-2xl mb-6 border border-gray-200 shadow-sm">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">🖼️ ロゴ管理</h3>
        <div className="flex flex-wrap gap-5 items-start">
          <div className="p-2 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
            <div className="text-[11px] color-[#888] mb-2">現在のロゴ</div>
            <img src={`${apiBase}/logo${mounted ? `?t=${Date.now()}` : ""}`} className="h-[60px] w-auto block" onError={(e) => (e.currentTarget.style.display='none')} />
          </div>
          <form action={`${apiBase}/logo`} method="POST" encType="multipart/form-data" className="flex gap-2 items-center">
            <input type="file" name="file" accept="image/*" required className="text-[13px]" />
            <button type="submit" className="px-4 py-1.5 bg-[#0d6efd] text-white border-none rounded-md text-[13px] font-bold cursor-pointer">ロゴを更新</button>
          </form>
        </div>
      </div>

      {/* 🎵 音楽管理パネル */}
      <div className="bg-white p-5 rounded-2xl mb-6 border border-gray-200 shadow-sm">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">🎵 音楽管理</h3>
        <div className="mb-5 p-4 bg-gray-50 rounded-lg">
          <form onSubmit={handleMusicUpload} className="flex flex-wrap gap-2 items-center">
            <label className="text-[13px] font-bold">MP3をアップロード:</label>
            <input type="file" name="file" accept="audio/mpeg" required className="text-[13px]" />
            <button type="submit" disabled={loadingId === "music-upload"} className="px-4 py-1.5 bg-[#0d6efd] text-white border-none rounded-md text-[13px] font-bold cursor-pointer disabled:opacity-60">
              {loadingId === "music-upload" ? "アップロード中..." : "アップロード"}
            </button>
          </form>
        </div>
        <div className="flex flex-col gap-2">
          {music.length === 0 && <div className="text-[14px] text-gray-500 text-center p-2">音楽がありません</div>}
          {music.map(m => (
            <div key={m.id} className={`flex flex-wrap items-center justify-between p-3 rounded-lg border ${m.active ? "bg-[#e7f1ff] border-[#0d6efd] border-2" : "bg-white border-gray-200"} gap-4`}>
              <div className="flex-1 flex items-center gap-4 min-w-[300px]">
                <div className={`text-[14px] ${m.active ? "font-bold" : "font-normal"} flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[250px]`}>
                  {m.active ? <span className="text-[#0d6efd]">▶️</span> : null} {m.name} <span className="text-[12px] text-gray-400 font-normal">{formatDuration(m.duration)}</span>
                </div>
                <audio controls src={`${apiBase}/music?id=${m.id}`} className="flex-1 h-8" />
              </div>
              <div className="flex gap-2">
                {!m.active && (
                  <button onClick={() => performMusicAction("select", m)} disabled={!!loadingId} className="px-3 py-1.5 bg-[#198754] text-white border-none rounded-md text-[13px] font-bold cursor-pointer">使用する</button>
                )}
                <button onClick={() => performMusicAction("delete", m)} disabled={!!loadingId} className="px-3 py-1.5 bg-white text-[#dc3545] border border-[#dc3545] rounded-md text-[13px] font-bold cursor-pointer">削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 📝 クレジット管理パネル */}
      <div className="bg-white p-5 rounded-2xl mb-6 border border-gray-200 shadow-sm">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">📝 クレジット（名前リスト）管理</h3>
        <p className="text-[13px] text-gray-500 mb-4">
          変換スクリプト（<code>node scripts/csv-to-json.js</code>）で作成した <code>credits.json</code> をアップロールして、エンドロールの名前リストを更新します。
        </p>
        <form onSubmit={handleCreditsUpload} className="flex gap-5 items-center flex-wrap mb-5">
          <div className="flex flex-col gap-2 flex-1 min-w-[250px]">
            <label className="text-[13px] font-bold">credits.json を選択:</label>
            <input type="file" name="file" accept=".json" required className="text-[13px]" />
          </div>
          <button type="submit" disabled={loadingId === "credits-upload"} className="px-6 py-2.5 bg-[#0d6efd] text-white border-none rounded-lg text-[14px] font-bold cursor-pointer disabled:opacity-60">
            {loadingId === "credits-upload" ? "更新中..." : "JSONをアップロードして更新 🔄"}
          </button>
        </form>
        {credits && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-[12px] font-bold text-gray-500 mb-2">現在のクレジット内容:</div>
            <pre className="text-[12px] m-0 overflow-auto max-h-[200px] bg-white p-2 rounded-md border border-gray-100">
              <code>{JSON.stringify(credits, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>

      {/* ステータスパネル */}
      <div className="bg-white p-5 rounded-2xl shadow-sm mb-6 border border-gray-200 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
        <div>
          <div className="text-[13px] text-gray-500 mb-1">動画の長さ</div>
          <div className="text-[19px] font-bold">{videoDurationSeconds.toFixed(1)} 秒</div>
          <div className="text-[11px] text-gray-400">{fps} fps / {secondsPerPhoto}秒/枚</div>
        </div>
        <div>
          <div className="text-[13px] text-gray-500 mb-1">最大収容枚数</div>
          <div className="text-[19px] font-bold">{videoPhotoCapacity} 枚</div>
          <div className="text-[11px] text-gray-400">ディレイ: 開始 {startDelayFrames}f / 終了 {endDelayFrames}f</div>
        </div>
        <div>
          <div className="text-[13px] text-gray-500 mb-1">採用済み / 候補 / 総枚数</div>
          <div className="flex items-baseline gap-1">
            <span className={`text-[19px] font-bold ${selectedCount > videoPhotoCapacity ? "text-[#dc3545]" : "text-[#198754]"}`}>{selectedCount}</span>
            <span className="text-[14px] text-gray-500">/ {videoPhotoCapacity}</span>
            <span className="text-[14px] text-gray-400 ml-2">(全 {totalCount} 枚)</span>
          </div>
          <div className="text-[11px] text-gray-400">（うち「必ず採用」: {featuredCount}枚）</div>
        </div>
        <div className="flex items-center justify-end">
          <button onClick={initializePhotos} disabled={loadingId === "init"} className="px-4 py-2 bg-gray-500 text-white border-none rounded-lg cursor-pointer text-[14px] font-bold disabled:opacity-60">初期選択をやり直す</button>
        </div>
        <div className="col-span-full">
          <div className="w-full h-2 bg-gray-200 rounded overflow-hidden flex">
            <div style={{ width: `${Math.min(100, (featuredCount / videoPhotoCapacity) * 100)}%` }} className="h-full bg-[#ffc107]" />
            <div style={{ width: `${Math.min(100 - (featuredCount / videoPhotoCapacity) * 100, ((selectedCount - featuredCount) / videoPhotoCapacity) * 100)}%` }} className="h-full bg-[#198754]" />
          </div>
          {isOverCapacity && <div className="text-[12px] text-[#dc3545] mt-2 font-bold">⚠️ 最大枚数を超えています！（1枚あたりの表示時間が短くなりますが、すべて表示されます）</div>}
          {!isOverCapacity && selectedCount > 0 && selectedCount < videoPhotoCapacity && <div className="text-[12px] text-[#198754] mt-2 font-bold">💡 画像が少ない場合、自動的に表示間隔を調整して尺に収めるようになっています。</div>}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        {sortedPhotos.map((photo) => {
          const isSelected = photo.selected;
          return (
            <div key={photo.id} className={`border rounded-xl p-3 relative bg-white transition-all shadow-sm ${isSelected ? "border-[#198754] border-2 shadow-md" : "border-gray-300"}`}>
              <div className={`transition-opacity ${isSelected ? "opacity-100" : "opacity-40"}`}>
                <div className="relative">
                  <img src={`${apiBase}/photo_data?timestamp=${photo.timestamp}&id=${photo.id}`} className="w-full h-[180px] object-cover rounded-lg" loading="lazy" />
                  {photo.featured && <div className="absolute top-2 right-2 bg-yellow-400/95 text-black rounded-md px-2 py-1 text-[11px] font-bold flex items-center shadow-sm">🌟 必ず採用</div>}
                  {isSelected && !photo.featured && <div className="absolute top-2 left-2 bg-[#198754]/95 text-white rounded-md px-2 py-1 text-[11px] font-bold flex items-center shadow-sm">✅ 採用中</div>}
                </div>
                <div className="text-[12px] mt-2 flex items-center">
                  {isSelected ? <span className="text-[#198754] font-bold bg-[#d1e7dd] px-1.5 py-0.5 rounded text-[10px]">採用中</span> : <span className="text-gray-500 font-bold bg-gray-200 px-1.5 py-0.5 rounded text-[10px]">非表示</span>}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">📸 {new Date(photo.timestamp).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                <button onClick={() => performAction("toggle-featured", photo)} disabled={loadingId === photo.id} className={`w-full p-2 border border-[#ffeeba] rounded-lg cursor-pointer text-[12px] font-bold flex items-center justify-center ${photo.featured ? "bg-yellow-100 text-yellow-900" : "bg-gray-50 text-yellow-800"}`}><StarIcon filled={photo.featured} /> {photo.featured ? "「必ず採用」を解除" : "「必ず採用」にする"}</button>
                <button onClick={() => performAction("toggle-selected", photo)} disabled={loadingId === photo.id || photo.featured} className={`w-full p-2 border border-gray-300 rounded-lg cursor-pointer text-[12px] font-bold flex items-center justify-center ${photo.featured ? "bg-gray-200 text-gray-400" : (isSelected ? "bg-[#d1e7dd] text-[#0f5132]" : "bg-gray-50 text-gray-700")}`}>{isSelected ? "✅ 採用中 (解除)" : "➕ 採用する"}</button>
                <button onClick={() => performAction("delete", photo)} disabled={loadingId === photo.id} className="w-full p-2 bg-white text-[#dc3545] border border-[#dc3545] rounded-lg cursor-pointer text-[12px] font-bold flex items-center justify-center"><TrashIcon /> 削除</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
