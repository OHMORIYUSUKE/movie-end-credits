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

### 1. 基本設定 (`scripts/config.json`)
このファイルはプロジェクトの動作を決定する最も重要な設定ファイルです。Git管理対象外（`.gitignore`）のため、手動で作成してください。`scripts/config.example.json` をコピーして作成することをお勧めします。

```bash
cp scripts/config.example.json scripts/config.json
```

- **`mediaPath`**: 写真を読み込むフォルダを指定します。
- **`audioPath`**: 背景音楽のパスを指定します。この音楽の長さに合わせて動画の尺が自動計算されます。
- **`participantsCsv`**: 一般参加者のリストが記載されたCSVのパスを指定します。
- **`sponsorHeader`**: スポンサーセクションのタイトルの文字列を指定します（例: 「スポンサー」）。
- **`sponsorsCsv`**: スポンサーのリストが記載されたCSVのパスを指定します。
- **`slotMappings`**: CSV内の「参加枠名」を整理するために使用します。例えば「スタッフ枠（事前に指名された方のみ）」を単に「スタッフ」と表示させたい場合などに設定します。記号が含まれていても正確に一致すれば置換されます。

### 2. 自動生成されるデータの編集
`npm run update-all` を実行すると、以下の2つのファイルが `src/` ディレクトリに生成されます。これらを直接編集することで、細かい調整が可能です。

#### `src/credits.json`（クレジット表示内容）
CSVから抽出された参加者とスポンサーのリストです。
- 誤字脱字の修正
- 特定の人の削除
- 表示順序の変更
などは、このファイルを直接編集して保存してください。

#### `src/generated-config.json`（メディア・動画設定）
写真のリストや動画のフレーム数（尺）が記録されています。
- **`photos`**: スライドショーに表示するファイル名のリストです。特定の写真を非表示にしたい場合は配列から削除してください。
- **`durationInFrames`**: 動画の総フレーム数です。音楽の長さを変えずに動画だけを少し伸ばしたい場合などに調整します。

> [!CAUTION]
> `npm run update-all` を再実行すると、`src/credits.json` と `src/generated-config.json` は **上書きされます。** 手動で編集した内容は失われるため注意してください。

---

## ⚠️ 注意事項

- **Git管理**: 素材ファイルおよび自動生成されるJSONファイル（`src/credits.json`, `src/generated-config.json`）は `.gitignore` により管理対象外です。
- **OS依存**: `update-all` コマンド内の再生時間取得は macOS 標準の `afinfo` を使用しているため、macOS 環境での実行を想定しています。
