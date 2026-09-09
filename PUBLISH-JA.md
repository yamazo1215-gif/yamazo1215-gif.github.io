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

毎週月曜06:17（日本時間）にAniListを確認。失敗時は公開中のサイトを維持。更新結果と保存データはActionsに記録する。

**GitHubの注意点：** 公開リポジトリで60日間リポジトリ活動がないと定期実行が停止するため、2か月に1度はActionsを確認し、停止していたら再有効化が必要。永続的な完全放置を求める場合は外部スケジューラ等の追加設定が必要になる。

## 参照

- GitHub独自ドメイン公式手順：https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- GitHub定期実行の制限：https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
