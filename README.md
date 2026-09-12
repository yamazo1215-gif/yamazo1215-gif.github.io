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
3. `node review-artwork.mjs` で画像一覧を作り、選んだ候補を `artwork_decisions.json` に保存する

決定ファイルの構造（IDはレビュー画面から出力された値を使用）:

```json
[
  {
    "work_id": "対象作品のID",
    "decision": "accept",
    "suggestion_id": "候補のID"
  }
]
```

### 採用反映

`node approve-artwork.mjs artwork_decisions.json` はdry-runです。確認後 `node approve-artwork.mjs artwork_decisions.json --apply` で反映します。

### 画像保存（任意）

`releases.json` の外部画像を `assets/covers` に保存する場合:

`node fetch-artwork.mjs` で検査、`node fetch-artwork.mjs --apply` で保存します。

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

## Artwork Resolver v2

詳細な設計、スコア、変更点、安全対策とWorks自動更新の接続案は [ARTWORK_RESOLVER_V2.md](ARTWORK_RESOLVER_V2.md) を参照。

`node find-artwork.mjs` → `node review-artwork.mjs` で候補と画像一覧を作ります。`artwork-review.html` で画像・根拠を確認し、選択した承認JSONを保存してください。95以上も初回・週次には自動反映しません。既存画像付きWorksはスキップします。

`Collect artwork candidates` Actionsは候補をArtifactsへ保存するだけです。公開masterへのWorks自動mergeは未実装です。
