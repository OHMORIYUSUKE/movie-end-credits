#!/usr/bin/env -S deno run -A --watch=static/,routes/

import dev from "$fresh/dev.ts";
import config from "./deno.json" with { type: "json" };

await dev(import.meta.url, "./main.ts", config);
