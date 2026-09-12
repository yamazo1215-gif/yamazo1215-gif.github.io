# yamazo official website

yamazo（山田知広）の公式サイトです。ページ表示は `yamazo_works_master.json` と `releases.json` を情報源として使います。

## Worksの更新

1. `yamazo_works_master.json` を完成版に置き換える
2. `node build.mjs` を実行する
3. `dist/` を公開する

HTMLやJavaScriptの編集は最小限で、データ更新はJSON差し替えで完了する構成です。

## 画像（ジャケ写）運用

表示は次の順で解決します。

1. `works.image`
2. `works.release_id` に紐づく `releases.json` の `artwork.src`
3. 画像未設定は文字ベース表示のまま

### 候補の作成

1. `node find-artwork.mjs`
2. `artwork_candidates.json` が作られる
3. 内容を確認して採用情報を `artwork_decisions.json` にまとめる

決定ファイル例:

```json
[
  {
    "work_id": "anilist-188138",
    "decision": "accept",
    "suggestion_id": "anilist-anilist-188138"
  }
]
```

### 採用反映

`node approve-artwork.mjs artwork_decisions.json`

### 画像保存（任意）

`releases.json` の外部画像を `assets/covers` に保存する場合:

`node fetch-artwork.mjs`

保存後は `dist/` 生成時に `assets/covers/*` をコピーします。

## データ項目

`yamazo_works_master.json` は以下を受け取ります。

- `category`
- `work_title`
- `track_title`
- `artist`
- `year`
- `release_date`
- `roles`
- `credit_note`
- `official_url`
- `apple_music`
- `spotify`
- `youtube`
- `featured`
- `image`（任意）
- `release_id`（任意、推奨）

`releases.json` は `id` と `artwork`（`src`, `provider`, `source_url`, `checked_at`）を持ちます。
