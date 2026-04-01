import { Handlers } from "$fresh/server.ts";
import { setCookie } from "https://deno.land/std@0.208.0/http/cookie.ts";

export const handler: Handlers = {
  async POST(req) {
    const formData = await req.formData();
    const password = formData.get("password");
    const adminPassword = Deno.env.get("ADMIN_PASSWORD") || "admin123";

    if (password === adminPassword) {
      const headers = new Headers();
      setCookie(headers, {
        name: "isAdmin",
        value: "true",
        path: "/",
        httpOnly: true,
        maxAge: 60 * 60 * 24, // 1日
      });
      // Redirect back to home
      const referer = req.headers.get("referer");
      let redirectUrl = "/";
      if (referer) {
        const url = new URL(referer);
        redirectUrl = url.origin + "/";
      }
      headers.set("Location", redirectUrl);
      return new Response(null, {
        status: 303,
        headers,
      });
    } else {
      return new Response("パスワードが正しくありません", { status: 401 });
    }
  },
};
