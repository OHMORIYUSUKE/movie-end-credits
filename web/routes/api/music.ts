import { Handlers } from "$fresh/server.ts";
import { saveMusic, listMusic, setActiveMusic, setMusicDuration, deleteMusic, getMusicData } from "../../utils/kv.ts";
import { getCookies } from "https://deno.land/std@0.208.0/http/cookie.ts";
import { decodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

export const handler: Handlers = {
  async GET(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (id) {
      const base64 = await getMusicData(id);
      if (!base64) return new Response("Not found", { status: 404 });
      
      const parts = base64.split(",");
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      const bytes = decodeBase64(base64Data);
      
      const range = req.headers.get("range");
      const headers = {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      };

      if (!range) {
        return new Response(bytes as any, {
          headers: { ...headers, "Content-Length": bytes.byteLength.toString() }
        });
      }

      const partsRange = range.replace(/bytes=/, "").split("-");
      const start = parseInt(partsRange[0], 10);
      const end = partsRange[1] ? parseInt(partsRange[1], 10) : bytes.byteLength - 1;
      const chunk = bytes.slice(start, end + 1);

      return new Response(chunk as any, {
        status: 206,
        statusText: "Partial Content",
        headers: {
          ...headers,
          "Content-Length": chunk.byteLength.toString(),
          "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}`,
        }
      });
    }

    const music = await listMusic();
    return new Response(JSON.stringify(music), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  },

  async POST(req: Request) {
    const cookies = getCookies(req.headers);
    if (cookies.isAdmin !== "true") return new Response("Unauthorized", { status: 401 });

    const formData = await req.formData();
    const action = formData.get("action");

    if (action === "select") {
      const id = formData.get("id") as string;
      await setActiveMusic(id);
      return new Response(JSON.stringify({ success: true }), { headers: { "Access-Control-Allow-Origin": "*" } });
    }

    if (action === "update-duration") {
      const id = formData.get("id") as string;
      const timestamp = parseInt(formData.get("timestamp") as string);
      const duration = parseFloat(formData.get("duration") as string);
      await setMusicDuration(timestamp, id, duration);
      return new Response(JSON.stringify({ success: true }), { headers: { "Access-Control-Allow-Origin": "*" } });
    }

    if (action === "delete") {
      const id = formData.get("id") as string;
      const timestamp = parseInt(formData.get("timestamp") as string);
      await deleteMusic(timestamp, id);
      return new Response(JSON.stringify({ success: true }), { headers: { "Access-Control-Allow-Origin": "*" } });
    }

    const file = formData.get("file") as File;
    const durationStr = formData.get("duration") as string;
    const duration = durationStr ? parseFloat(durationStr) : undefined;
    
    if (!file || file.size === 0) return new Response("No file", { status: 400 });

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i += 1000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 1000) as any);
    }
    const base64 = `data:audio/mpeg;base64,${btoa(binary)}`;
    
    await saveMusic(file.name, base64, duration);
    return new Response(null, { status: 303, headers: { Location: "/?music_success=true" } });
  }
};
