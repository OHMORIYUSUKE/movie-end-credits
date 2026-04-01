import { Handlers } from "$fresh/server.ts";
import { saveCredits, getCredits } from "../../utils/kv.ts";
import { getCookies } from "https://deno.land/std@0.208.0/http/cookie.ts";

export const handler: Handlers = {
  async GET(_req) {
    try {
      const data = await getCredits();
      if (data) return new Response(JSON.stringify(data), { 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });

      return new Response(JSON.stringify({
        sections: [{ title: "一般参加", names: [] }, { title: "登壇者", names: [] }, { title: "スタッフ", names: [] }],
        sponsors: {}
      }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  },

  async POST(req) {
    const cookies = getCookies(req.headers);
    if (cookies.isAdmin !== "true") return new Response("Unauthorized", { status: 401 });

    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      
      if (!file) return new Response("No file uploaded", { status: 400 });

      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.sections || !Array.isArray(data.sections)) {
        throw new Error("Invalid credits.json format (missing sections array)");
      }

      await saveCredits(data);
      const referer = req.headers.get("referer");
      let redirectUrl = "/?credits_success=true";
      if (referer) {
        const url = new URL(referer);
        redirectUrl = `${url.origin}/?credits_success=true`;
      }
      return new Response(null, { status: 303, headers: { Location: redirectUrl } });
    } catch (err) {
      console.error("Failed to upload credits JSON:", err);
      return new Response(`Upload failed: ${err.message}`, { status: 400 });
    }
  }
};
