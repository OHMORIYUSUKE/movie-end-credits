# Movie End Credits (Remotion)

映画のエンドロール風の動画を作成する Remotion プロジェクトです。
左側に写真のスライドショー（EXIFによる時系列ソート）、右側にスタッフロールがスクロール表示されます。

---

## 🚀 クイックスタート

### 1. セットアップ
プロジェクトの依存関係をインストールします。

```bash
npm install
```

### 2. 素材の準備
`scripts/config.json` で指定された場所に素材を配置してください。デフォルト設定は以下の通りです。

| 素材 | デフォルトのパス | 備考 |
| :--- | :--- | :--- |
| **音楽** | `public/music/end.mp3` | 背景音楽（MP3形式） |
| **写真** | `public/photos/` | スライドショー用の画像（複数可。jpg, png, heic, webp, avif 等に対応） |
| **参加者CSV** | `public/credit/event_375981_participants.csv` | 一般参加者のリスト |
| **スポンサーCSV** | `public/credit/event_384080_participants.csv` | スポンサーのリスト |

### 3. データの更新
素材を配置・変更した後は、以下のコマンドを実行してクレジットデータとメディア設定を更新します。

```bash
# 全てのデータを一括更新
npm run update-all
```

このコマンドにより以下の処理が行われます：
- 設定されたCSVからクレジット情報（`src/credits.json`）を抽出
- 指定ディレクトリから写真を取得し `src/generated-config.json` を作成（EXIFデータに基づき時系列でソート）
- 指定された背景音楽（MP3）の長さに合わせて動画の尺を自動調整

### 4. プレビューとレンダリング

```bash
# ブラウザでプレビューを確認
npm run dev

# MP4形式で動画を書き出し
npx remotion render EndCredits out.mp4
```

---

## 🛠️ カスタマイズ

### 基本設定 (`scripts/config.json`)
素材のパスや表示名の置換ルールを設定できます。

```json
{
  "mediaPath": "public/photos",           // 写真が置かれているディレクトリ
  "audioPath": "public/music/end.mp3",    // 音楽ファイルのパス
  "participantsCsv": "public/credit/...", // 参加者CSVのパス
  "sponsorsCsv": "public/credit/...",     // スポンサーCSVのパス
  "slotMappings": {                       // CSV内の参加枠名を画面表示用に置換
    "一般参加枠": "一般参加",
    "枠": ""
  }
}
```

### クレジット内容の微調整
`npm run update-all` 実行後に生成される `src/credits.json` を直接編集することで、表示内容を細かく調整できます。

---

## ⚠️ 注意事項

- **Git管理**: 素材ファイルおよび自動生成されるJSONファイル（`src/credits.json`, `src/generated-config.json`）は `.gitignore` により管理対象外です。
- **OS依存**: `update-all` コマンド内の再生時間取得は macOS 標準の `afinfo` を使用しているため、macOS 環境での実行を想定しています。
