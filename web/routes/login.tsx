import { Handlers, PageProps } from "$fresh/server.ts";
import { setCookie } from "https://deno.land/std@0.208.0/http/cookie.ts";

export const handler: Handlers = {
  GET(_req, ctx) {
    return ctx.render();
  },
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
      headers.set("Location", "/");
      return new Response(null, {
        status: 303,
        headers,
      });
    } else {
      return new Response("パスワードが正しくありません", { status: 401 });
    }
  },
};

export default function LoginPage() {
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "400px", margin: "0 auto" }}>
      <h1>管理者ログイン</h1>
      <form method="POST">
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>パスワード:</label>
          <input 
            type="password" 
            name="password" 
            required 
            style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }} 
          />
        </div>
        <button 
          type="submit" 
          style={{ width: "100%", padding: "10px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          ログイン
        </button>
      </form>
      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        ※環境変数 ADMIN_PASSWORD が設定されていない場合のデフォルトは "admin123" です。
      </div>
    </div>
  );
}
