import { Handlers } from "$fresh/server.ts";
import { deleteCookie } from "https://deno.land/std@0.208.0/http/cookie.ts";

export const handler: Handlers = {
  GET(req) {
    const headers = new Headers();
    deleteCookie(headers, "isAdmin", { path: "/", httpOnly: true });
    
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
  },
};
