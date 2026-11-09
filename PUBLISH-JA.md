# yamazo.jp 公開・切り替え手順

## 1. GitHub Pagesを公開する

1. `yamazo1215-gif` でGitHubへログイン。
2. 公開リポジトリ `yamazo1215-gif.github.io` を作成。このフォルダのソース一式（`.github/workflows/pages.yml` を含む）を `main` ブランチに配置。
3. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。
4. `Publish yamazo.jp` のpush実行の成功を確認。初回公開はAniList API停止中でも保存済み41件で作れる。
5. `https://yamazo1215-gif.github.io/` を開き、動画、Works、連絡先を確認。
6. API復旧後、Actionsの `Run workflow` を実行し、Musicクレジットの取得と公開の両方が成功したことを確認。

## 2. ドメイン設定画面を特定する

2026-09-09時点の権威DNSは `ns-cloud-a1` ～ `ns-cloud-a4.googledomains.com`。この情報だけでは現在の契約先を断定できない。

Google Domainsで購入していたドメインはSquarespaceへ移行している可能性がある。まず https://account.squarespace.com/domains でGoogleアカウントを使ってログインし、`yamazo.jp` があるか確認。Google Sitesはサイト編集画面であり、DNSの編集画面とは別。

## 3. GitHub側で先に独自ドメインを登録する

1. 可能ならGitHubのアカウント **Settings → Pages → Add a domain** で `yamazo.jp` を検証。GitHubが表示するTXT名・値をDNSへ追加する。TXT値は画面が発行する実際の値を使う。
2. リポジトリ **Settings → Pages → Custom domain** に `yamazo.jp` を保存。
3. その後DNSを変更する。先にDNSだけ変更しない。

## 4. DNS変更

現在のレコードを保存してから、Webサイト用のA/AAAA/CNAMEだけを更新する。メール用MXとTXT（SPF/DKIM/DMARC）、Google確認用TXTは維持する。

| 種類 | ホスト | 値 |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | yamazo1215-gif.github.io |

TTLはサービスの既定値でよい。`@`の旧Web用A、競合するAAAA、`www`の旧CNAMEは置き換える。IPv6を利用する場合は旧AAAAを次の4つへ置換：`2606:50c0:8000::153`、`2606:50c0:8001::153`、`2606:50c0:8002::153`、`2606:50c0:8003::153`。

DNSの反映と証明書の用意には最大24時間ほどかかる場合がある。GitHub PagesのDNSチェックが通り、証明書が利用可能になったら **Enforce HTTPS** を有効にする。`yamazo.jp` と `www.yamazo.jp` の両方で新サイトとHTTPSを確認する。

## 5. 継続運用

新作が公開されたときに、チャットで作品名・担当・公開日・公式リンクを伝えて追加する運用です。画像は任意です。

1. 内容と既存作品との重複を確認し、`yamazo_works_master.json` を更新する。画像を追加する場合は、必要に応じて `releases.json` も更新する。
2. テスト・ビルド・表示を確認し、公開する変更を `main` に反映する。`main` の更新で `Publish yamazo.jp` が実行される。
3. Actionsの公開成功と、実際の掲載内容を確認する。

`Publish yamazo.jp` と `Collect artwork candidates` の週次実行は停止済みです。どちらもActionsの `Run workflow` による手動実行は残しています。AniList・MusicBrainzの取得結果や画像候補は、掲載作品へ自動追加されません。

定期実行を止めても、公開済みサイトやGitに保存された作品・画像設定は維持されます。再公開は保存済みの作品データから行えるため、定期実行の維持を目的とする2か月ごとの再有効化は不要です。

## 参照

- GitHub独自ドメイン公式手順：https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- GitHub定期実行の制限：https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
