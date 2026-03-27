const kv = await Deno.openKv();

const CHUNK_SIZE = 60 * 1024; // 60KB chunks

export interface PhotoMetadata {
  id: string;
  name: string;
  timestamp: number;
  visible: boolean;
  featured: boolean; // 優先表示フラグ
  selected?: boolean; // エンドロール採用フラグ
}

export interface PhotoData extends PhotoMetadata {
  base64: string;
}

export async function savePhoto(name: string, base64: string, customTimestamp?: number) {
  const timestamp = customTimestamp || Date.now();
  const id = timestamp.toString() + "_" + Math.random().toString(36).slice(2, 9);
  // 初期状態は表示、未選択
  const metadata: PhotoMetadata = { id, name, timestamp, visible: true, featured: false, selected: false };

  // 1. Save metadata
  await kv.set(["photos", timestamp, id], metadata);

  // 2. Save chunks individually
  for (let i = 0; i * CHUNK_SIZE < base64.length; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, base64.length);
    const chunk = base64.slice(start, end);
    await kv.set(["photo_chunks", timestamp, id, i], chunk);
  }
}

export async function updatePhotoMetadata(timestamp: number, id: string, updates: Partial<PhotoMetadata>) {
  const entry = await kv.get<PhotoMetadata>(["photos", timestamp, id]);
  if (entry.value) {
    await kv.set(["photos", timestamp, id], { ...entry.value, ...updates });
    return true;
  }
  return false;
}

export async function bulkUpdatePhotoMetadata(updates: { timestamp: number, id: string, updates: Partial<PhotoMetadata> }[]) {
  const atomic = kv.atomic();
  for (const update of updates) {
    const entry = await kv.get<PhotoMetadata>(["photos", update.timestamp, update.id]);
    if (entry.value) {
      atomic.set(["photos", update.timestamp, update.id], { ...entry.value, ...update.updates });
    }
  }
  await atomic.commit();
}

// 互換性のためのエイリアス
export async function updatePhotoVisibility(timestamp: number, visible: boolean, id?: string) {
  return await updatePhotoMetadata(timestamp, id || "", { visible });
}

export async function listPhotoMetadata(onlyVisible = false): Promise<PhotoMetadata[]> {
  const photos: PhotoMetadata[] = [];
  const entries = kv.list<PhotoMetadata>({ prefix: ["photos"] });

  for await (const entry of entries) {
    const metadata = entry.value;
    if (onlyVisible && !metadata.visible) continue;
    photos.push({ ...metadata, featured: !!metadata.featured, selected: !!metadata.selected });
  }

  return photos;
}

export async function getPhotoData(timestamp: number, id: string): Promise<PhotoData | null> {
  // Metadata
  let metadata: PhotoMetadata | null = null;
  const entry = await kv.get<PhotoMetadata>(["photos", timestamp, id]);
  if (entry.value) {
    metadata = entry.value;
  }

  if (!metadata) return null;

  // Chunks
  let base64 = "";
  const chunkEntries = kv.list<string>({ prefix: ["photo_chunks", timestamp, id] });
  for await (const chunk of chunkEntries) {
    base64 += chunk.value;
  }

  return { ...metadata, featured: !!metadata.featured, selected: !!metadata.selected, base64 };
}

export async function listPhotos(onlyVisible = false): Promise<PhotoData[]> {
  const metadataList = await listPhotoMetadata(onlyVisible);
  const photos: PhotoData[] = [];
  for (const meta of metadataList) {
    const data = await getPhotoData(meta.timestamp, meta.id);
    if (data) photos.push(data);
  }
  return photos;
}

export async function deletePhoto(timestamp: number, id?: string) {
  if (id) {
    await kv.delete(["photos", timestamp, id]);
    const chunkEntries = kv.list({ prefix: ["photo_chunks", timestamp, id] });
    for await (const entry of chunkEntries) {
      await kv.delete(entry.key);
    }
  }
}
