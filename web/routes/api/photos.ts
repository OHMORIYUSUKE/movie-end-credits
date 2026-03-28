import { Handlers } from "$fresh/server.ts";
import { savePhoto, listPhotoMetadata, deletePhoto, updatePhotoMetadata, bulkUpdatePhotoMetadata } from "../../utils/kv.ts";
import { getCookies } from "https://deno.land/std@0.208.0/http/cookie.ts";
import exifr from "https://esm.sh/exifr@7.1.3";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const all = url.searchParams.get("all") === "true";
      const cookies = getCookies(req.headers);
      const isAdmin = cookies.isAdmin === "true";

      const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      
      if (!isAdmin && !isLocalhost) {
        return new Response(JSON.stringify([]), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // 📸 重要: base64を含まないメタデータのみを返すように変更
      const photos = await listPhotoMetadata(!(all && isAdmin));
      
      console.log(`[API GET] Found ${photos.length} photos (metadata only)`);

      return new Response(JSON.stringify(photos), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      console.error("GET /api/photos failed:", err);
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },

  async POST(req) {
    try {
      const formData = await req.formData();
      const action = formData.get("action");
      const cookies = getCookies(req.headers);
      const isAdmin = cookies.isAdmin === "true";

      if (action === "delete" || action === "toggle-featured" || action === "toggle-selected") {
        if (!isAdmin) return new Response("Unauthorized", { status: 401 });
        const timestamp = parseInt(formData.get("timestamp") as string);
        const id = formData.get("id") as string;
        if (action === "delete") await deletePhoto(timestamp, id);
        else if (action === "toggle-featured") {
          const featured = formData.get("featured") === "true";
          const updates: any = { featured };
          if (featured) updates.selected = true; // featured implies selected
          await updatePhotoMetadata(timestamp, id, updates);
        }
        else if (action === "toggle-selected") await updatePhotoMetadata(timestamp, id, { selected: formData.get("selected") === "true" });
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (action === "select-initial") {
        if (!isAdmin) return new Response("Unauthorized", { status: 401 });
        const capacity = parseInt(formData.get("capacity") as string);
        const photos = await listPhotoMetadata(false); // Get ALL photos
        
        // 1. Reset everyone to visible: true, featured: false, selected: false
        // This is the TRUE "initial" state
        const sortedAll = [...photos].sort((a, b) => a.timestamp - b.timestamp);
        
        const selectedIds = new Set<string>();
        if (sortedAll.length > 0) {
          if (sortedAll.length <= capacity) {
            sortedAll.forEach(p => selectedIds.add(p.id));
          } else {
            for (let i = 0; i < capacity; i++) {
              const index = capacity > 1 
                ? Math.floor(i * (sortedAll.length - 1) / (capacity - 1))
                : Math.floor(sortedAll.length / 2);
              selectedIds.add(sortedAll[index].id);
            }
          }
        }
        
        const updates = sortedAll.map(p => ({
          timestamp: p.timestamp,
          id: p.id,
          updates: { 
            visible: true, 
            featured: false, 
            selected: selectedIds.has(p.id) 
          }
        }));
        
        await bulkUpdatePhotoMetadata(updates);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      const files = formData.getAll("file") as File[];
      if (files.length === 0 || (files.length === 1 && files[0].size === 0)) return new Response("No files uploaded", { status: 400 });

      for (const file of files) {
        if (file.size === 0) continue;
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let captureTime = file.lastModified;
        try {
          const output = await exifr.parse(bytes, { pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"] });
          if (output) {
            const date = output.DateTimeOriginal || output.CreateDate || output.ModifyDate;
            if (date instanceof Date) captureTime = date.getTime();
          }
        } catch (_) { }
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i += 1000) {
          const chunk = bytes.subarray(i, Math.min(i + 1000, len));
          binary += String.fromCharCode.apply(null, chunk as any);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:${file.type};base64,${base64}`;
        await savePhoto(file.name, dataUrl, captureTime);
      }
      return new Response(null, { status: 303, headers: { Location: "/?success=true" } });
    } catch (err) {
      console.error("POST /api/photos failed:", err);
      return new Response(`Operation failed: ${err.message}`, { status: 500 });
    }
  },
};
