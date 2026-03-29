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

      // Default empty structure if nothing is set
      return new Response(JSON.stringify({
        sections: [
          { title: "一般参加", names: [] },
          { title: "登壇者", names: [] },
          { title: "スタッフ", names: [] }
        ],
        sponsors: {}
      }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
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

      // Simple validation of structure
      if (!data.sections || !Array.isArray(data.sections)) {
        throw new Error("Invalid credits.json format (missing sections array)");
      }

      await saveCredits(data);
      return new Response(null, { status: 303, headers: { Location: "/?credits_success=true" } });
    } catch (err) {
      console.error("Failed to upload credits JSON:", err);
      return new Response(`Upload failed: ${err.message}`, { status: 400 });
    }
  }
};
