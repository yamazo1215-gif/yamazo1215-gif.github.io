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

## サントラ盤と媒体・版

劇伴担当作品は `category: "score"`、発売された音源は `category: "soundtrack"` として分けます。サントラ盤は `related_work_id`（必要なら `related_work_ids` も）で担当作品を参照します。作品の放送開始日をサントラ発売日に転用しません。

サントラの `release_editions` には確認できた媒体ごとの情報を保存します。

- `format`: `CD`、`配信`、`BD/DVD特典CD` など、実際の入手形態
- `title`: 版名。Complete Editionなど収録内容が異なる場合は明示
- `release_date`: 当該版の発売日・配信開始日。確認できない場合は省略
- `catalog_number`: CD品番、または特典が付属するパッケージ品番
- `note`: 収録曲数、封入対象、他盤との重複など
- `url` / `link_label`: その版を確認できる公式商品ページや配信先

同一音源のCDと配信を別作品として水増しせず、同じカードの版情報として表示します。収録内容が異なる版を単純な「CD・配信」だけで同一視しないよう、詳細で曲数・版名を区別します。カードの `release_date` はそのカードで扱う音源の確認済み初出日です。特典CDを単独販売CDとして表示しません。

`related_releases` は、収録曲の完全一致を確認していない過去の封入特典など、関連商品を詳細欄に記録する項目です。`release_editions` と同じ表示項目を使いますが、別商品として区別し、カードの発売日・媒体・件数には加えません。
