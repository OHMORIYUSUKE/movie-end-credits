import { useState, useMemo, useEffect } from "preact/hooks";
import { PhotoMetadata, MusicMetadata } from "../utils/kv.ts";

interface AdminDashboardProps {
  initialPhotos: PhotoMetadata[];
  initialMusic: MusicMetadata[];
  videoPhotoCapacity: number;
  videoDurationSeconds: number;
  secondsPerPhoto: number;
  fps: number;
  startDelayFrames: number;
  endDelayFrames: number;
}

export default function AdminDashboard({ 
  initialPhotos, 
  initialMusic,
  videoPhotoCapacity, 
  videoDurationSeconds,
  secondsPerPhoto,
  fps,
  startDelayFrames,
  endDelayFrames
}: AdminDashboardProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [music, setMusic] = useState(initialMusic);
  const [credits, setCredits] = useState<any>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    // 尺が未設定の音声があれば、クライアントサイドで計算してサーバーに送る
    const updateMissingDurations = async () => {
      for (const m of music) {
        if (!m.duration) {
          console.log(`Calculating duration for: ${m.name}`);
          try {
            const audio = new Audio();
            audio.src = `/api/music?id=${m.id}`;
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
              await fetch("/api/music", { method: "POST", body: formData });
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
    fetch("/api/credits").then(res => res.json()).then(data => setCredits(data)).catch(() => {});
  }, []);

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
      const res = await fetch("/api/photos", { method: "POST", body: formData });
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
      const res = await fetch("/api/photos", { method: "POST", body: formData });
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
      const res = await fetch("/api/music", { method: "POST", body: formData });
      if (res.ok) {
        if (action === "delete") setMusic(music.filter(m => m.id !== item.id));
        else if (action === "select") setMusic(music.map(m => ({ ...m, active: m.id === item.id })));
      }
    } catch (err) { alert("通信エラーが発生しました。"); }
    finally { setLoadingId(null); }
  };

  const handleMusicUpload = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
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
      const res = await fetch("/api/music", { method: "POST", body: formData });
      if (res.ok) window.location.reload();
      else alert("アップロードに失敗しました。");
    } catch (err) { alert("エラーが発生しました。"); }
    finally { setLoadingId(null); }
  };

  const handleCreditsUpload = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fileInput = form.querySelector('input[name="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setLoadingId("credits-upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/credits", { method: "POST", body: formData });
      if (res.ok) {
        const newData = await fetch("/api/credits").then(r => r.json());
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
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: "4px" }}>
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  );

  const StarIcon = ({ filled }: { filled: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={filled ? "#ffc107" : "none"} stroke={filled ? "#ffc107" : "currentColor"} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: "4px" }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );

  const isOverCapacity = selectedCount > videoPhotoCapacity;

  return (
    <div>
      {/* 🖼️ ロゴ管理パネル */}
      <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "16px", marginBottom: "24px", border: "1px solid #e9ecef", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>🖼️ ロゴ管理</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
          <div style={{ padding: "10px", border: "1px dashed #ddd", borderRadius: "8px", backgroundColor: "#f8f9fa", textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "#888", marginBottom: "8px" }}>現在のロゴ</div>
            <img src={`/api/logo?t=${Date.now()}`} style={{ height: "60px", width: "auto", display: "block" }} onError={(e) => (e.currentTarget.style.display='none')} />
          </div>
          <form action="/api/logo" method="POST" encType="multipart/form-data" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input type="file" name="file" accept="image/*" required style={{ fontSize: "0.8rem" }} />
            <button type="submit" style={{ padding: "6px 16px", background: "#0d6efd", color: "white", border: "none", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>ロゴを更新</button>
          </form>
        </div>
      </div>

      {/* 🎵 音楽管理パネル */}
      <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "16px", marginBottom: "24px", border: "1px solid #e9ecef", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>🎵 音楽管理</h3>
        <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "10px" }}>
          <form onSubmit={handleMusicUpload} style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>MP3をアップロード:</label>
            <input type="file" name="file" accept="audio/mpeg" required style={{ fontSize: "0.8rem" }} />
            <button type="submit" disabled={loadingId === "music-upload"} style={{ padding: "6px 16px", background: "#0d6efd", color: "white", border: "none", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer", opacity: loadingId === "music-upload" ? 0.6 : 1 }}>
              {loadingId === "music-upload" ? "アップロード中..." : "アップロード"}
            </button>
          </form>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {music.length === 0 && <div style={{ fontSize: "0.85rem", color: "#6c757d", textAlign: "center", padding: "10px" }}>音楽がありません</div>}
          {music.map(m => (
            <div key={m.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", padding: "12px", backgroundColor: m.active ? "#e7f1ff" : "#fff", borderRadius: "10px", border: m.active ? "2px solid #0d6efd" : "1px solid #dee2e6", gap: "15px" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "15px", minWidth: "300px" }}>
                <div style={{ fontSize: "0.9rem", fontWeight: m.active ? "bold" : "normal", display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
                  {m.active ? <span style={{ color: "#0d6efd" }}>▶️</span> : null} {m.name} <span style={{ fontSize: "0.75rem", color: "#888", fontWeight: "normal" }}>{formatDuration(m.duration)}</span>
                </div>
                <audio controls src={`/api/music?id=${m.id}`} style={{ flex: 1, height: "32px" }} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {!m.active && (
                  <button onClick={() => performMusicAction("select", m)} disabled={!!loadingId} style={{ padding: "6px 12px", background: "#198754", color: "white", border: "none", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>使用する</button>
                )}
                <button onClick={() => performMusicAction("delete", m)} disabled={!!loadingId} style={{ padding: "6px 12px", background: "#fff", color: "#dc3545", border: "1px solid #dc3545", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 📝 クレジット管理パネル */}
      <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "16px", marginBottom: "24px", border: "1px solid #e9ecef", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>📝 クレジット（名前リスト）管理</h3>
        <p style={{ fontSize: "0.8rem", color: "#6c757d", marginBottom: "16px" }}>
          変換スクリプト（<code>node scripts/csv-to-json.js</code>）で作成した <code>credits.json</code> をアップロードして、エンドロールの名前リストを更新します。
        </p>
        <form onSubmit={handleCreditsUpload} style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: "250px" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>credits.json を選択:</label>
            <input type="file" name="file" accept=".json" required style={{ fontSize: "0.8rem" }} />
          </div>
          <button type="submit" disabled={loadingId === "credits-upload"} style={{ padding: "10px 24px", background: "#0d6efd", color: "white", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: "bold", cursor: "pointer", opacity: loadingId === "credits-upload" ? 0.6 : 1 }}>
            {loadingId === "credits-upload" ? "更新中..." : "JSONをアップロードして更新 🔄"}
          </button>
        </form>
        {credits && (
          <div style={{ backgroundColor: "#f8f9fa", padding: "15px", borderRadius: "10px", border: "1px solid #dee2e6" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#6c757d", marginBottom: "8px" }}>現在のクレジット内容:</div>
            <pre style={{ fontSize: "0.75rem", margin: 0, overflow: "auto", maxHeight: "200px", backgroundColor: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #eee" }}>
              <code>{JSON.stringify(credits, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>

      {/* ステータスパネル */}
      <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginBottom: "24px", border: "1px solid #e9ecef", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
        <div>
          <div style={{ fontSize: "0.8rem", color: "#6c757d", marginBottom: "4px" }}>動画の長さ</div>
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{videoDurationSeconds.toFixed(1)} 秒</div>
          <div style={{ fontSize: "0.7rem", color: "#adb5bd" }}>{fps} fps / {secondsPerPhoto}秒/枚</div>
        </div>
        <div>
          <div style={{ fontSize: "0.8rem", color: "#6c757d", marginBottom: "4px" }}>最大収容枚数</div>
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{videoPhotoCapacity} 枚</div>
          <div style={{ fontSize: "0.7rem", color: "#adb5bd" }}>ディレイ: 開始 {startDelayFrames}f / 終了 {endDelayFrames}f</div>
        </div>
        <div>
          <div style={{ fontSize: "0.8rem", color: "#6c757d", marginBottom: "4px" }}>採用済み / 候補 / 総枚数</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: selectedCount > videoPhotoCapacity ? "#dc3545" : "#198754" }}>{selectedCount}</span>
            <span style={{ fontSize: "0.9rem", color: "#6c757d" }}>/ {videoPhotoCapacity}</span>
            <span style={{ fontSize: "0.9rem", color: "#adb5bd", marginLeft: "8px" }}>(全 {totalCount} 枚)</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "#adb5bd" }}>（うち「必ず採用」: {featuredCount}枚）</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <button onClick={initializePhotos} disabled={loadingId === "init"} style={{ padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", opacity: loadingId === "init" ? 0.6 : 1 }}>初期選択をやり直す</button>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ width: "100%", height: "8px", backgroundColor: "#e9ecef", borderRadius: "4px", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${Math.min(100, (featuredCount / videoPhotoCapacity) * 100)}%`, height: "100%", backgroundColor: "#ffc107" }} />
            <div style={{ width: `${Math.min(100 - (featuredCount / videoPhotoCapacity) * 100, ((selectedCount - featuredCount) / videoPhotoCapacity) * 100)}%`, height: "100%", backgroundColor: "#198754" }} />
          </div>
          {isOverCapacity && <div style={{ fontSize: "0.75rem", color: "#dc3545", marginTop: "8px", fontWeight: "bold" }}>⚠️ 最大枚数を超えています！（1枚あたりの表示時間が短くなりますが、すべて表示されます）</div>}
          {!isOverCapacity && selectedCount > 0 && selectedCount < videoPhotoCapacity && <div style={{ fontSize: "0.75rem", color: "#198754", marginTop: "8px", fontWeight: "bold" }}>💡 画像が少ない場合、自動的に表示間隔を調整して尺に収めるようになっています。</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
        {sortedPhotos.map((photo) => {
          const isSelected = photo.selected;
          return (
            <div key={photo.id} style={{ border: isSelected ? "2px solid #198754" : "1px solid #ddd", padding: "12px", borderRadius: "12px", position: "relative", backgroundColor: "white", boxShadow: isSelected ? "0 4px 12px rgba(25, 135, 84, 0.15)" : "0 2px 4px rgba(0,0,0,0.05)", transition: "all 0.2s" }}>
              <div style={{ opacity: isSelected ? 1 : 0.4, transition: "opacity 0.2s" }}>
                <div style={{ position: "relative" }}>
                  <img src={`/api/photo_data?timestamp=${photo.timestamp}&id=${photo.id}`} style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px" }} loading="lazy" />
                  {photo.featured && <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(255, 193, 7, 0.95)", color: "black", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>🌟 必ず採用</div>}
                  {isSelected && !photo.featured && <div style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(25, 135, 84, 0.95)", color: "white", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>✅ 採用中</div>}
                </div>
                <div style={{ fontSize: "12px", marginTop: "8px", display: "flex", alignItems: "center" }}>
                  {isSelected ? <span style={{ color: "#198754", fontWeight: "bold", backgroundColor: "#d1e7dd", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>採用中</span> : <span style={{ color: "#6c757d", fontWeight: "bold", backgroundColor: "#e9ecef", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>非表示</span>}
                </div>
                <div style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>📸 {new Date(photo.timestamp).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <button onClick={() => performAction("toggle-featured", photo)} disabled={loadingId === photo.id} style={{ width: "100%", padding: "8px", background: photo.featured ? "#fff3cd" : "#f8f9fa", color: "#664d03", border: "1px solid #ffeeba", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}><StarIcon filled={photo.featured} /> {photo.featured ? "「必ず採用」を解除" : "「必ず採用」にする"}</button>
                <button onClick={() => performAction("toggle-selected", photo)} disabled={loadingId === photo.id || photo.featured} style={{ width: "100%", padding: "8px", background: photo.featured ? "#eee" : (isSelected ? "#d1e7dd" : "#f8f9fa"), color: photo.featured ? "#999" : (isSelected ? "#0f5132" : "#495057"), border: "1px solid #ced4da", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>{isSelected ? "✅ 採用中 (解除)" : "➕ 採用する"}</button>
                <button onClick={() => performAction("delete", photo)} disabled={loadingId === photo.id} style={{ width: "100%", padding: "8px", background: "#fff", color: "#dc3545", border: "1px solid #dc3545", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}><TrashIcon /> 削除</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
