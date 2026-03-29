import { Handlers } from "$fresh/server.ts";
import { saveLogo, getLogo } from "../../utils/kv.ts";
import { getCookies } from "https://deno.land/std@0.208.0/http/cookie.ts";
import { decodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

export const handler: Handlers = {
  async GET(req) {
    const logo = await getLogo();
    if (!logo) return new Response("Not found", { status: 404 });
    
    const parts = logo.base64.split(",");
    const base64Data = parts.length > 1 ? parts[1] : parts[0];
    const bytes = decodeBase64(base64Data);
    
    return new Response(bytes, {
      headers: {
        "Content-Type": logo.mimeType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=10, must-revalidate",
      },
    });
  },

  async POST(req) {
    const cookies = getCookies(req.headers);
    if (cookies.isAdmin !== "true") return new Response("Unauthorized", { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return new Response("No file", { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i += 1000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 1000) as any);
    }
    const base64 = `data:${file.type};base64,${btoa(binary)}`;
    
    await saveLogo(file.name, file.type, base64);
    return new Response(null, { status: 303, headers: { Location: "/?logo_success=true" } });
  }
};
