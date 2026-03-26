# Movie End Credits (Remotion)

映画のエンドロール風の動画を作成する Remotion プロジェクトです。
左側に写真のスライドショー、右側にスタッフロールがスクロール表示されます。

---

## 🚀 クイックスタート

### 1. セットアップ
プロジェクトの依存関係をインストールします。

```bash
npm install
```

### 2. 素材の準備
以下のディレクトリに素材を配置してください。

| 素材 | 配置先 | 備考 |
| :--- | :--- | :--- |
| **音楽** | `public/music/end.mp3` | 背景音楽（MP3形式） |
| **写真** | `public/photos/` | スライドショー用の画像（複数可） |
| **CSV** | `public/credit/*.csv` | 参加者・スポンサーのリスト |

> [!NOTE]
> クレジット用のCSVは以下のファイル名である必要があります：
> - `event_375981_participants.csv` (一般参加者)
> - `event_384080_participants.csv` (スポンサー)

### 3. データの同期・更新
素材を配置・変更した後は、以下のコマンドを順に実行してプロジェクト設定を更新します。

```bash
# 写真リスト（src/photos.json）を更新
npm run update-photos

# クレジットデータ（src/credits.json）を更新
npm run update-credits

# 音楽の長さに合わせて動画の尺を自動調整
npm run update-duration
```

### 4. プレビューとレンダリング

```bash
# ブラウザでプレビューを確認
npm run dev

# MP4形式で動画を書き出し
npx remotion render EndCredits out.mp4
```

---

## 🛠️ カスタマイズ

### クレジット内容の微調整
`npm run update-credits` 実行後に生成される `src/credits.json` を直接編集することで、表示内容を細かく調整できます。

### レイアウト・演出の変更
`src/Composition.tsx` 内の数値を変更することで、演出を調整できます。

- `DELAY_FRAMES`: 開始・終了時の静止時間
- `fadeDuration`: 写真のフェードイン/アウト時間
- `fontSize`: 文字サイズ（各要素ごとに設定可能）

---

## ⚠️ 注意事項

- **Git管理**: `public/photos/` や `public/music/` 内のファイルは `.gitignore` により管理対象外です。
- **OS依存**: `update-duration` コマンドは macOS 標準の `afinfo` を使用しているため、macOS 環境での実行を想定しています。
