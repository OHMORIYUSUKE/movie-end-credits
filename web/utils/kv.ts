const kv = await Deno.openKv();

const CHUNK_SIZE = 60 * 1024; // 60KB chunks

// --- 📸 Photos ---

export interface PhotoMetadata {
  id: string;
  name: string;
  timestamp: number;
  visible: boolean;
  featured: boolean;
  selected?: boolean;
}

export interface PhotoData extends PhotoMetadata {
  base64: string;
}

// --- 🎵 Music ---

export interface MusicMetadata {
  id: string;
  name: string;
  timestamp: number;
  duration?: number;
  active: boolean;
}

export async function saveMusic(name: string, base64: string, duration?: number) {
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  const list = await listMusic();
  const active = list.length === 0;
  const metadata: MusicMetadata = { id, name, timestamp, duration, active };
  
  await kv.set(["music_metadata", timestamp, id], metadata);
  for (let i = 0; i * CHUNK_SIZE < base64.length; i++) {
    const chunk = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await kv.set(["music_chunks", id, i], chunk);
  }
}

export async function listMusic(): Promise<MusicMetadata[]> {
  const iter = kv.list<MusicMetadata>({ prefix: ["music_metadata"] });
  const music: MusicMetadata[] = [];
  for await (const res of iter) music.push(res.value);
  return music.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getActiveMusic(): Promise<MusicMetadata | null> {
  const list = await listMusic();
  return list.find(m => m.active) || list[0] || null;
}

export async function getMusicData(id: string): Promise<string> {
  const iter = kv.list<string>({ prefix: ["music_chunks", id] });
  const chunks: string[] = [];
  for await (const res of iter) {
    const index = res.key[res.key.length - 1] as number;
    chunks[index] = res.value;
  }
  return chunks.join("");
}

export async function setActiveMusic(id: string) {
  const list = await listMusic();
  const atomic = kv.atomic();
  for (const m of list) {
    atomic.set(["music_metadata", m.timestamp, m.id], { ...m, active: m.id === id });
  }
  await atomic.commit();
}

export async function setMusicDuration(timestamp: number, id: string, duration: number) {
  const entry = await kv.get<MusicMetadata>(["music_metadata", timestamp, id]);
  if (entry.value) {
    await kv.set(["music_metadata", timestamp, id], { ...entry.value, duration });
    return true;
  }
  return false;
}

export async function deleteMusic(timestamp: number, id: string) {
  const atomic = kv.atomic();
  atomic.delete(["music_metadata", timestamp, id]);
  const chunks = kv.list({ prefix: ["music_chunks", id] });
  for await (const res of chunks) atomic.delete(res.key);
  await atomic.commit();
}

// --- 🖼️ Logo ---

export interface LogoData {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
}

export async function saveLogo(name: string, mimeType: string, base64: string) {
  const id = "current_logo";
  const logo: Omit<LogoData, "base64"> = { id, name, mimeType };
  
  await kv.set(["logo_metadata"], logo);
  // Clear old chunks
  const oldChunks = kv.list({ prefix: ["logo_chunks"] });
  for await (const res of oldChunks) await kv.delete(res.key);
  
  for (let i = 0; i * CHUNK_SIZE < base64.length; i++) {
    const chunk = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await kv.set(["logo_chunks", i], chunk);
  }
}

export async function getLogo(): Promise<LogoData | null> {
  const meta = await kv.get<Omit<LogoData, "base64">>(["logo_metadata"]);
  if (!meta.value) return null;
  
  let base64 = "";
  const chunkEntries = kv.list<string>({ prefix: ["logo_chunks"] });
  for await (const chunk of chunkEntries) base64 += chunk.value;
  
  return { ...meta.value, base64 };
}

// --- Photo Functions ---

export async function savePhoto(name: string, base64: string, customTimestamp?: number) {
  const timestamp = customTimestamp || Date.now();
  const id = timestamp.toString() + "_" + Math.random().toString(36).slice(2, 9);
  const metadata: PhotoMetadata = { id, name, timestamp, visible: true, featured: false, selected: false };
  await kv.set(["photos", timestamp, id], metadata);
  for (let i = 0; i * CHUNK_SIZE < base64.length; i++) {
    const chunk = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
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
    if (entry.value) atomic.set(["photos", update.timestamp, update.id], { ...entry.value, ...update.updates });
  }
  await atomic.commit();
}

export async function listPhotoMetadata(onlyVisible = false): Promise<PhotoMetadata[]> {
  const photos: PhotoMetadata[] = [];
  const entries = kv.list<PhotoMetadata>({ prefix: ["photos"] });
  for await (const entry of entries) {
    const metadata = entry.value;
    if (onlyVisible && !metadata.visible) continue;
    photos.push({ ...metadata, featured: !!metadata.featured, selected: !!metadata.selected });
  }
  return photos.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getPhotoData(timestamp: number, id: string): Promise<PhotoData | null> {
  const entry = await kv.get<PhotoMetadata>(["photos", timestamp, id]);
  if (!entry.value) return null;
  let base64 = "";
  const chunkEntries = kv.list<string>({ prefix: ["photo_chunks", timestamp, id] });
  for await (const chunk of chunkEntries) base64 += chunk.value;
  return { ...entry.value, featured: !!entry.value.featured, selected: !!entry.value.selected, base64 };
}

export async function deletePhoto(timestamp: number, id?: string) {
  if (id) {
    await kv.delete(["photos", timestamp, id]);
    const chunkEntries = kv.list({ prefix: ["photo_chunks", timestamp, id] });
    for await (const entry of chunkEntries) await kv.delete(entry.key);
  }
}
