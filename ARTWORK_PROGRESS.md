# Artwork Resolver v2 — 実装・実収集結果

2026-09-12。作業場所: `/Users/yamazo/Documents/ChatGPT/サイト制作/yamazo-site`。
ベースコミット: `48837c34f0aef8871a2999442f3a48560cd56a53`。

## 完了

既存画像探索・承認・保存・build・週次Actionsを調査し、原因と設計を提示してからv2を実装。
設計・変更ファイル・スコア・誤マッチ対策・将来のWorks merge接続案は `ARTWORK_RESOLVER_V2.md`。

|対象|件数|
|---|---:|
|公開master|113|
|既存画像付き（保護・スキップ）|5|
|今回処理した未設定Works|108|
|画像候補あり|83|
|高確度 auto_eligible|3|
|承認待ち review（高確度なし）|44|
|保留候補のみ|36|
|候補なし|25|
|候補画像の対応レコード総数|191|

候補数は正解・採用・公開済み件数ではない。保留には共通OGP、年・タイトルの相違、旧データの曖昧さを含む。
高確度3作品: RobiHachi / One Room セカンドシーズン / 少年メイド。
初回は高確度も含め全件未採用。masterとreleasesに書き込みはしていない。

## 実画像・操作検証

- 最上位候補を各作品1件ずつGET。重複を除く79画像中、78画像成功、1画像404。82作品に読み込み成功した上位候補がある。
- 404は `https://tower.jp/common/meta/ogp.png`。共通画像としても保留、承認不可。
- Pony CanyonのJPEG画像がimage/gifで配信される例を確認。image MIMEと実バイトを検証し、拡張子は実際のJPEG/PNG/WebP形式で決定するよう修正。
- レビュー画面の検索・ラジオ選択・絞り込みを確認。出力された承認JSONをブラウザ上でJSON.parseし、選択したwork_id/suggestion_idの1件が正しく出力されることを確認。
- In-app Browserのdownloadイベント取得はタイムアウトしたため、ファイル保存イベント自体は未確認。保存ボタンはダウンロードに加えてコピー可能なJSON欄も表示する。JSONの内容・構文は確認済み。
- PCと390px幅で表示確認。390px時のdocument scrollWidthは375で横はみ出しなし。
- ネットワーク不要のテスト29件成功（既存15件＋v2の14件）。構文チェック・build・git diff --check成功。
- 生成HTML、master、releasesのSHA-256が作業開始時と同一。公開サイトのデータ・表示コードは変更していない。

## 外部取得の制約

- MusicBrainz recording→release探索は実行したが、Cover Art Archiveの転送先Internet Archiveで502/503・タイムアウト等が発生。この実行でCAAの画像候補は得られていない。
- AniList・iTunes・公式ディスコグラフィー・OGPで補完。無関係な検索結果は候補から除外。
- `errors`は135件の取得失敗・キャッシュ未取得記録。全件収集後に最新照合ルールでキャッシュ再評価したため、候補ファイルの一部エラーはOffline cache missで示される。外部APIが正常だったという意味ではない。
- iTunesは返却された100px画像を使用。拡大URLを推測していない。公開利用条件確認のため自動承認・自動ローカル保存対象外。
- 残る25件は手作業検索済みではない。上流サービス復旧後の再実行や作品ごとの補助メタデータ追加で改善余地がある。

## 次の操作

1. `artwork-review.html` を開き、候補・出典を見て採用画像を選ぶ。
2. 承認JSONを保存。ダウンロードできない場合は表示されたJSONをコピーして `artwork_decisions.json` として保存する。
3. `node approve-artwork.mjs artwork_decisions.json` でdry-run。
4. `node approve-artwork.mjs artwork_decisions.json --apply` で承認内容を反映。
5. テスト・build・差分確認後にGitHub反映・Pages公開確認。

今回のコードはローカルに実装済み、GitHubには未反映。新しい候補収集Actionsもリポジトリへ反映するまでは稼働しない。
新規Worksの検出・credit検証・masterへの承認mergeは設計のみで未実装。通常git push認証、PAT、SSH、DNSは変更していない。

## ユーザー承認反映（2026-09-12 20:04以降）

- 最新のダウンロード `artwork_decisions (2).json` を採用。以前の1件だけのファイルは画面検証時のもので対象外。
- 72件の承認を `artwork_decisions.json` に保存し、全件dry-run成功後に適用。
- 選択された未検査9候補（重複を除く7画像）を追加GET検査し、すべて成功。
- 画像付きWorksは5→77件、全Worksは113件を維持。72件のrelease_id追加以外のWorksメタデータは不変。
- 29テスト・build・git diff --check成功。生成HTMLのWorks画像77件を確認。
- 反映前のmaster/releaseペアは .artwork-backups に保存済み。
- ここまでローカル反映。GitHub反映・Pages公開はまだ実行していない。

## 公開前修正（2026-09-12）

- ユーザー指定により役割が「ミックス」のみの13作品をmasterから削除。リミックスのみの作品、編曲等との併記作品は維持。
- Worksは100件、画像付き77件。29テスト・build・差分検査成功。
- 再追加防止用の判断記録を works_exclusions.json に保存。将来のmaster mergeではこの除外リストを尊重する。
- ユーザーから公開許可を受領。既存mainとローカルHEADの一致をfetchで確認。
