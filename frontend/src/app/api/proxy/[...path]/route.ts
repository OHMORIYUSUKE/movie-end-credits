import { NextRequest, NextResponse } from "next/server";

const DENO_API_BASE = "http://localhost:8000/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}

async function proxy(req: NextRequest, paramsPromise: Promise<{ path: string[] }>) {
  const { path } = await paramsPromise;
  const subPath = path.join("/");
  const url = new URL(req.url);
  const targetUrl = `${DENO_API_BASE}/${subPath}${url.search}`;
  
  console.log(`[Proxy] ${req.method} ${targetUrl}`);
  
  const headers = new Headers(req.headers);
  headers.delete("host");
  
  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: headers,
      redirect: 'manual'
    };
    
    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = await req.arrayBuffer();
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    
    // Get all Set-Cookie headers properly
    const setCookies = response.headers.getSetCookie();
    
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      if (location) {
        let redirectUrl;
        try {
          redirectUrl = new URL(location);
          if (redirectUrl.hostname === "localhost") {
            redirectUrl.port = url.port;
          }
        } catch (e) {
          redirectUrl = new URL(location, url.origin);
        }
        
        const redirectResponse = NextResponse.redirect(redirectUrl.toString(), response.status);
        
        // Copy headers except location
        responseHeaders.forEach((value, key) => {
          if (key.toLowerCase() !== "location" && key.toLowerCase() !== "set-cookie") {
            redirectResponse.headers.set(key, value);
          }
        });
        
        // Append each cookie separately
        setCookies.forEach(cookie => {
          redirectResponse.headers.append("Set-Cookie", cookie);
        });
        
        return redirectResponse;
      }
    }
    
    const data = await response.arrayBuffer();
    const finalResponse = new NextResponse(data, {
      status: response.status,
      headers: responseHeaders,
    });
    
    // Ensure all cookies are appended to the final response
    finalResponse.headers.delete("Set-Cookie");
    setCookies.forEach(cookie => {
      finalResponse.headers.append("Set-Cookie", cookie);
    });
    
    return finalResponse;
  } catch (error) {
    console.error("[Proxy Error]", error);
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}
