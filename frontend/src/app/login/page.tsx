export default function LoginPage() {
  return (
    <div className="p-10 font-sans max-w-[400px] mx-auto mt-20 bg-white shadow-lg rounded-2xl border border-gray-100">
      <h1 className="text-2xl font-bold mb-6 text-center">管理者ログイン</h1>
      <form action="/api/proxy/login" method="POST">
        <div className="mb-5">
          <label className="block mb-2 text-sm font-bold text-gray-700">パスワード:</label>
          <input 
            type="password" 
            name="password" 
            required 
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" 
          />
        </div>
        <button 
          type="submit" 
          className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white border-none rounded-lg text-lg font-bold cursor-pointer transition-colors"
        >
          ログイン
        </button>
      </form>
      <div className="mt-8 text-sm text-gray-500 text-center">
        ※環境変数 ADMIN_PASSWORD が設定されていない場合のデフォルトは "admin123" です。
      </div>
    </div>
  );
}
