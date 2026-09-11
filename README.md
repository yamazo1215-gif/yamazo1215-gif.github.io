# yamazo official website

yamazo（山田知広）の公式サイトです。ページ表示は `yamazo_works_master.json` だけをWorksの情報源として使います。

## Worksの更新

1. `yamazo_works_master.json` を完成版に置き換える
2. `node build.mjs` を実行する
3. `dist/` を公開する

HTMLやJavaScriptの編集は不要です。現在のJSONは旧表示内容を機械的に移した仮データで、完全な実績一覧ではありません。

各項目は `category`, `work_title`, `track_title`, `artist`, `year`, `release_date`, `roles`, `credit_note`, `official_url`, `apple_music`, `spotify`, `youtube`, `featured` を受け取ります。画像がある場合だけ、任意の `image` も利用できます。空欄は表示されません。

`category` は `score`, `song`, `original`, `performance` に対応します。担当は `roles` の配列を省略せず、その順番で表示します。Featured Worksには `featured: true` の項目だけが表示されます。

外部サイトの自動取得は現在停止しています。正式なWorks Masterを公開前に確認する運用です。
