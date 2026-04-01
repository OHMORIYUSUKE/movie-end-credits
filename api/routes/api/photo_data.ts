import { Handlers } from "$fresh/server.ts";
import { getPhotoData } from "../../utils/kv.ts";
import { decodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

export const handler: Handlers = {
  async GET(req) {
    const url = new URL(req.url);
    const timestamp = parseInt(url.searchParams.get("timestamp") || "");
    const id = url.searchParams.get("id") || "";
    
    if (isNaN(timestamp) || !id) {
      return new Response("Invalid parameters", { status: 400 });
    }

    try {
      const photo = await getPhotoData(timestamp, id);
      if (!photo || !photo.base64) {
        return new Response("Photo not found", { status: 404 });
      }

      const parts = photo.base64.split(",");
      let mimeType = "image/jpeg";
      let base64Data = photo.base64;

      if (parts.length > 1) {
        mimeType = parts[0].split(";")[0].split(":")[1] || "image/jpeg";
        base64Data = parts[1];
      }

      const bytes = decodeBase64(base64Data);
      return new Response(bytes, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      console.error("Error fetching photo data:", err);
      return new Response("Error fetching photo", { status: 500 });
    }
  },
};
