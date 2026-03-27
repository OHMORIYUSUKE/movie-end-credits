import { Handlers } from "$fresh/server.ts";
import { deleteCookie } from "https://deno.land/std@0.208.0/http/cookie.ts";

export const handler: Handlers = {
  GET(_req) {
    const headers = new Headers();
    deleteCookie(headers, "isAdmin", { path: "/" });
    headers.set("Location", "/");
    return new Response(null, {
      status: 303,
      headers,
    });
  },
};
