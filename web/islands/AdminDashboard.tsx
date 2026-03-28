import { useState, useMemo } from "preact/hooks";
import { PhotoMetadata } from "../utils/kv.ts";

interface AdminDashboardProps {
  initialPhotos: PhotoMetadata[];
  videoPhotoCapacity: number;
  videoDurationSeconds: number;
  secondsPerPhoto: number;
  fps: number;
  startDelayFrames: number;
  endDelayFrames: number;
}

export default function AdminDashboard({ 
  initialPhotos, 
  videoPhotoCapacity, 
  videoDurationSeconds,
  secondsPerPhoto,
  fps,
  startDelayFrames,
  endDelayFrames
}: AdminDashboardProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const featuredCount = useMemo(() => photos.filter(p => p.featured).length, [photos]);
  const selectedCount = useMemo(() => photos.filter(p => p.selected).length, [photos]);
  const totalCount = photos.length;
  
  // 実際に採用される（表示される）写真のリスト
  const activePhotos = useMemo(() => {
    return photos.filter(p => p.selected).sort((a, b) => a.timestamp - b.timestamp);
  }, [photos]);

  const initializePhotos = async () => {
    if (!confirm("現在の選択状態をリセットし、時系列で均等に再選択しますか？")) return;
    setLoadingId("init");
    try {
      const formData = new FormData();
      formData.append("action", "select-initial");
      formData.append("capacity", videoPhotoCapacity.toString());
      const res = await fetch("/api/photos", { method: "POST", body: formData });
      if (res.ok) {
        // Refresh page to get new data
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert("初期化に失敗しました。サーバーが起動しているか確認してください。");
    } finally {
      setLoadingId(null);
    }
  };

  const performAction = async (action: string, photo: PhotoMetadata) => {
    if (loadingId) return;
    
    if (action === "delete") {
      if (!confirm(`この画像を完全に削除しますか？\n(削除するとデータベースからも完全に消えます)`)) return;
    }

    setLoadingId(photo.id);

    try {
      const formData = new FormData();
      formData.append("action", action);
      formData.append("timestamp", photo.timestamp.toString());
      formData.append("id", photo.id);
      
      if (action === "toggle-featured") {
        formData.append("featured", (!photo.featured).toString());
      } else if (action === "toggle-selected") {
        formData.append("selected", (!photo.selected).toString());
      }

      const res = await fetch("/api/photos", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        let newPhotos = photos;
        if (action === "delete") {
          newPhotos = photos.filter(p => p.id !== photo.id);
        } else if (action === "toggle-featured") {
          const featured = !photo.featured;
          newPhotos = photos.map(p => p.id === photo.id ? { ...p, featured, selected: featured ? true : p.selected } : p);
        } else if (action === "toggle-selected") {
          newPhotos = photos.map(p => p.id === photo.id ? { ...p, selected: !p.selected } : p);
        }
        setPhotos(newPhotos);
      } else {
        alert("操作に失敗しました。");
      }
    } catch (err) {
      console.error(err);
      alert("通信エラーが発生しました。");
    } finally {
      setLoadingId(null);
    }
  };

  const sortedPhotos = [...photos].sort((a, b) => a.timestamp - b.timestamp);

  // SVG Icons
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
      {/* ステータスパネル */}
      <div style={{ 
        backgroundColor: "white", 
        padding: "20px", 
        borderRadius: "16px", 
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        marginBottom: "24px",
        border: "1px solid #e9ecef",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "20px"
      }}>
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
            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: selectedCount > videoPhotoCapacity ? "#dc3545" : "#198754" }}>
              {selectedCount}
            </span>
            <span style={{ fontSize: "0.9rem", color: "#6c757d" }}>/ {videoPhotoCapacity}</span>
            <span style={{ fontSize: "0.9rem", color: "#adb5bd", marginLeft: "8px" }}>(全 {totalCount} 枚)</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "#adb5bd" }}>（うち「必ず採用」: {featuredCount}枚）</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <button 
            onClick={initializePhotos}
            disabled={loadingId === "init"}
            style={{
              padding: "8px 16px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "bold",
              opacity: loadingId === "init" ? 0.6 : 1
            }}
          >
            初期選択をやり直す
          </button>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ width: "100%", height: "8px", backgroundColor: "#e9ecef", borderRadius: "4px", overflow: "hidden", display: "flex" }}>
            <div style={{ 
              width: `${Math.min(100, (featuredCount / videoPhotoCapacity) * 100)}%`, 
              height: "100%", 
              backgroundColor: "#ffc107" 
            }} title="必ず採用" />
            <div style={{ 
              width: `${Math.min(100 - (featuredCount / videoPhotoCapacity) * 100, ((selectedCount - featuredCount) / videoPhotoCapacity) * 100)}%`, 
              height: "100%", 
              backgroundColor: "#198754" 
            }} title="選択済み" />
          </div>
          {isOverCapacity && (
            <div style={{ fontSize: "0.75rem", color: "#dc3545", marginTop: "8px", fontWeight: "bold" }}>
              ⚠️ 最大枚数を超えています！（1枚あたりの表示時間が短くなりますが、すべて表示されます）
            </div>
          )}
          {!isOverCapacity && selectedCount > 0 && selectedCount < videoPhotoCapacity && (
            <div style={{ fontSize: "0.75rem", color: "#198754", marginTop: "8px", fontWeight: "bold" }}>
              💡 画像が少ない場合、自動的に表示間隔を調整して尺に収めるようになっています。
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
        {sortedPhotos.map((photo) => {
          const isSelected = photo.selected;
          return (
            <div key={photo.id} style={{ 
              border: isSelected ? "2px solid #198754" : "1px solid #ddd", 
              padding: "12px", 
              borderRadius: "12px", 
              position: "relative", 
              backgroundColor: "white", 
              boxShadow: isSelected ? "0 4px 12px rgba(25, 135, 84, 0.15)" : "0 2px 4px rgba(0,0,0,0.05)",
              transition: "all 0.2s"
            }}>
              {/* 画像部分 */}
              <div style={{ opacity: isSelected ? 1 : 0.4, transition: "opacity 0.2s" }}>
                <div style={{ position: "relative" }}>
                  <img 
                    src={`/api/photo_data?timestamp=${photo.timestamp}&id=${photo.id}`} 
                    style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px" }} 
                    loading="lazy"
                  />
                  {photo.featured && (
                    <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(255, 193, 7, 0.95)", color: "black", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
                      🌟 必ず採用
                    </div>
                  )}
                  {isSelected && !photo.featured && (
                    <div style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(25, 135, 84, 0.95)", color: "white", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
                      ✅ 採用中
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "12px", marginTop: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minHeight: "18px", display: "flex", alignItems: "center" }}>
                  {isSelected ? (
                    <span style={{ color: "#198754", fontWeight: "bold", backgroundColor: "#d1e7dd", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>採用中 (表示されます)</span>
                  ) : (
                    <span style={{ color: "#6c757d", fontWeight: "bold", backgroundColor: "#e9ecef", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>非表示 (枠外)</span>
                  )}
                </div>
                <div style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>
                  📸 撮影日時: {new Date(photo.timestamp).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <button 
                  onClick={() => performAction("toggle-featured", photo)}
                  disabled={loadingId === photo.id}
                  style={{ 
                    width: "100%", padding: "8px", 
                    background: photo.featured ? "#fff3cd" : "#f8f9fa", 
                    color: "#664d03", 
                    border: "1px solid #ffeeba", 
                    borderRadius: "8px", 
                    cursor: loadingId === photo.id ? "not-allowed" : "pointer", 
                    fontSize: "12px", fontWeight: "bold",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  <StarIcon filled={photo.featured} /> {photo.featured ? "「必ず採用」を解除" : "「必ず採用」にする"}
                </button>

                <button 
                  onClick={() => performAction("toggle-selected", photo)}
                  disabled={loadingId === photo.id || photo.featured}
                  style={{ 
                    width: "100%", padding: "8px", 
                    background: photo.featured ? "#eee" : (isSelected ? "#d1e7dd" : "#f8f9fa"), 
                    color: photo.featured ? "#999" : (isSelected ? "#0f5132" : "#495057"), 
                    border: "1px solid #ced4da", 
                    borderRadius: "8px", cursor: (loadingId === photo.id || photo.featured) ? "not-allowed" : "pointer", 
                    fontSize: "12px", fontWeight: "bold",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  {isSelected ? "✅ 採用中 (解除)" : "➕ 採用する"}
                </button>

                <button 
                  onClick={() => performAction("delete", photo)}
                  disabled={loadingId === photo.id}
                  style={{ 
                    width: "100%", padding: "8px", 
                    background: "#fff", color: "#dc3545", 
                    border: "1px solid #dc3545", borderRadius: "8px", cursor: loadingId === photo.id ? "not-allowed" : "pointer", 
                    fontSize: "12px", fontWeight: "bold",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  <TrashIcon /> 削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
