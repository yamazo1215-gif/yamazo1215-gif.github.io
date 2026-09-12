# Artwork Resolver v2 — 設計・運用

2026-09-12。公開ベースライン: `48837c34f0aef8871a2999442f3a48560cd56a53`。

## 調査結果

- masterは113件（song 90 / score 23）、画像確定済みWorksは5件。Featuredとの重複を含め公開表示は9か所。
- AniListは21件、masterとのID一致も21件。しかし画像URLが空のレコードが多く、ID照合だけでは画像は増えない。
- 旧find-artworkはAniListのwork.id一致、または既存URLにMusicBrainz release/release-group IDが含まれる場合だけを処理。既存のMusicBrainzデータのwork→recording参照を使っていなかった。
- 旧コードはreleaseのIDもrelease-groupエンドポイントへ送信していた。新コードはentity種別を維持する。
- legacy作品はtrack_titleがアルバム名、artistが曲目・クレジットになっている場合がある。自動的に意味を推測してmasterを書き換えない。
- package.jsonと外部npm依存はない。Node 22以上の標準APIだけを使用。
- pages.ymlは週次にanilist.json/musicbrainz.jsonを取得しArtifactsに保存するが、buildはmasterとreleasesのみを読む。画像探索・承認もmasterへの情報マージも接続されていなかった。

## 変更範囲

- find-artwork.mjs: 既存確定作品のスキップ、プロバイダー別探索、候補・失敗情報集約。
- artwork/matching.mjs: 正規化、候補ID、証拠付きスコア、競合検出、masterのfingerprint。
- artwork/providers.mjs: AniList、MusicBrainz→CAA、iTunes、既存出典OGP。
- artwork/http.mjs: 公開HTTPS検査、制限サイズ・時間・リトライ・キャッシュ。
- approve-artwork.mjs: 一括事前検証、dry-run、既存画像保護、監査証跡・バックアップ。
- fetch-artwork.mjs: 明示適用、取得GETのステータス/image MIME/実バイト検査（CDNのMIME誤表記時は拡張子を実バイトで判定）、最大8MB、パス検査。
- validate-artwork.mjs: 上位候補の実画像GET・MIME/バイト検査（保存・公開なし）。
- review-artwork.mjs: ローカルHTMLレビュー画面・承認JSONのダウンロード。
- artwork.test.mjs: ネットワーク不要の照合・誤マッチ・承認・失敗系テスト。
- .github/workflows/artwork.yml: 公開処理とは独立した候補収集Artifacts。
- README.md / .gitignore / artwork_candidates.json / この資料。

build.mjs、template.html、styles.css、app.js、公開master/releaseデータ、既存pages.ymlは今回変更しない。

## 判定方式

confidenceは統計的な正解確率ではなく、説明可能な照合スコア。

|証拠|加点|
|---|---:|
|タイトル完全一致（NFKC、大小文字・空白・記号を正規化）|45|
|TVアニメ・Movie等の先頭補助表記だけ除去して一致|40|
|アーティスト全体一致（CV表記を正規化）|25|
|アーティスト構成員一致|15（自動不可）|
|年一致|10|
|年不一致|-20（保留上限）|
|カテゴリ整合|Anime 20 / その他5|
|既存ID・明示URLの同一性|40|
|recording→releaseの収録関係|10|
|既存出典ページ由来|20（自動不可）|
|ページタイトルに作品タイトルを含む|25（完全一致時は加算しない）|

合計は0〜100。95以上auto_eligible、70〜94review、70未満hold。
タイトル不一致、年不一致、legacyの曖昧メタデータ、共通OGPは上限69。アーティスト不明・部分一致、年不明、OGP、AniListのタイトル検索のみ、複数収録盤の高スコア競合は自動不可。タイトル違いをID点数で押し切らない。シーズン番号、同語反復、Live/Remix/OST等は削除しない。

初回・週次とも自動適用しない。auto_eligibleも候補として保存する。承認はユーザーがレビュー画面で選択する。将来機械承認を追加する際のmode=autoにも閾値・blockersに加え、直近7日以内の実画像検査成功を要求する。画像検査は既定で各Worksの最上位候補、--allで全候補、--retry-failedで失敗候補だけを対象にする。

## 探索経路

1. 画像があるwork.imageまたはrelease artworkをスキップ。
2. Score/AnimeはローカルAniListのID/タイトル照合。不足時はAniList日本語検索（戻り値の英語・romaji別名も照合）。一般ゲームはAniList対象外、既存ページOGPを使用。
3. Songは既存MusicBrainzのrecording URLを優先。収録リリースの先頭5件まで調べ、CAAのfront画像のみ採用候補にする。recordingがない場合は曲名＋アーティストの検索で上位候補を照合。
4. Song/AlbumはiTunes日本ストア検索を補助に使用。返された画像URLをそのまま保存し、サイズURLを推測して書き換えない。利用条件確認のため常に人間承認対象、ローカル保存処理からは除外。
5. リモート☆ホストは実HTMLを確認した商品画像枠・商品名・収録曲・発売日の専用抽出を併用。ロゴや特典欄の画像は対象外。旧データは引き続き保留。
6. 既存official_url/source_urlのOGP。URLフィールド名だけで公式と断定しない。ロゴ/common/default等、小サイズ、別ページに共通の画像は保留。任意のimg・広告・サイト全体をクロールしない。事務所HPは収集しない。

APIの上限に合わせ、MusicBrainz等は最低1.1秒、AniListは2.2秒、iTunesは3.2秒のリクエスト間隔。429/5xxは最大3回、待ち時間は最大30秒。成功レスポンスは7日、404は1日キャッシュ。Cover Art Archiveの503等は他ソースへの切替を優先して同一実行で再試行しない。作品は最大3件を並行処理し、ホストごとの呼び出し予約で間隔を維持する。途中結果はartwork_candidates.progress.jsonへ保存し、次回起動時に復元する。HTTP/DNS/パース失敗は候補ごとに記録し、同一masterの以前の候補は自動採用不可にして保持。キャッシュはローカル作業用でGit対象外。

## 操作

```sh
node find-artwork.mjs
node validate-artwork.mjs
node review-artwork.mjs
```

artwork-review.htmlをブラウザで開く。初期選択はゼロ。高確度・承認待ち・保留・候補なしで絞り込み可能。選択して `artwork_decisions.json` をダウンロードし、リポジトリ内へ保存する。

```sh
node approve-artwork.mjs artwork_decisions.json
# dry-runの差分を確認した上で実反映
node approve-artwork.mjs artwork_decisions.json --apply
node --test *.test.mjs
node build.mjs
```

旧approveの「引数1つで書き込み」は変更。v2はデフォルトdry-runで、書き込みには--applyが必要。旧候補JSONは再生成が必要。絶対パスの決定ファイルも使用可能。

```sh
node find-artwork.mjs --work WORK_ID --refresh
node find-artwork.mjs --limit 10
node find-artwork.mjs --cached
node find-artwork.mjs --offline
node fetch-artwork.mjs --release RELEASE_ID
node fetch-artwork.mjs --release RELEASE_ID --apply
```

--workは対象限定で確定作品も再探索できる。ただし既存画像の置換はapproveで拒否し、別途確認したデータ編集として行う。--refreshはレスポンスキャッシュを使わず再取得。--cachedは外部アクセスせず既存API/HTMLキャッシュで再照合。--offlineは外部アクセスせずローカルAniListと以前の候補だけを使用。対象外の未確定候補は保持する。

承認は全件事前検証。不明候補・重複決定・masterの変更・既存確定画像・release画像衝突は一括拒否。バックアップは.artwork-backups。catalog→masterの順に各ファイルをatomic renameするが、2ファイル全体のOSトランザクションではない。途中停止時は同じバックアップフォルダの両ファイルを復元する。同時に複数の承認プロセスを実行しない。

候補収集とレビューHTMLはdistへ入らない。CIは候補Artifactsを保存するだけでmasterのmergeやPages公開を行わない。承認済み差分のGitHub反映・公開は別工程。

## 長期のWorks更新接続案（未実装）

1. sync-anilist / sync-musicbrainzの完全成功スナップショットから差分候補を生成。
2. source IDで既存masterを照合。同名だけで新規登録・統合しない。
3. creditの対象者・役割・出典URL・取得日時と差分をworks_update_candidates.jsonへ出力。作曲/編曲/ギター等の役割を明示マッピングし、不明・別人・楽曲とアルバムの混同は保留。
4. 人間が新規作品・役割変更・日付変更を承認。取得失敗やソースから消えた作品は削除しない。
5. masterのfingerprintとID重複を検証してmerge。手入力リンク、画像、featured、credit_noteは保護。
6. 未設定作品にArtwork Resolverを接続し、必要な画像承認を実施。
7. ブランチ差分をレビュー→テスト/build→GitHub反映→Pages Actions成功→公開HTML・画像実表示を確認。

PAT/SSHの新設定、通常git push認証の修正は今回行わない。

## 外部仕様の参照

- https://musicbrainz.org/doc/MusicBrainz_API
- https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- https://musicbrainz.org/doc/MusicBrainz_API/Search
- https://coverartarchive.org/
- https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
- https://anilist.gitbook.io/anilist-apiv2-docs/

画像の同一性判定と画像の利用条件は別問題。各出典・画像の利用条件は承認時に確認できるようURLを残す。iTunes画像は公開用途の条件があるため、自動承認・自動ローカル保存を行わない。

タイトル検索の無関係な結果は候補一覧から除外（タイトルの完全一致・包含・収録盤名包含のいずれもないもの）。生の検索応答はキャッシュで調査できる。保留の類似候補は残す。

初回実行の件数・検証結果・未実装部分は `ARTWORK_PROGRESS.md` を参照。

2026-09-12追記: 所有者が誤記載と確認したミックスのみの13作品をmasterから除外。将来のWorks mergeは works_exclusions.json のIDを必ず除外対象として扱う。取得元スナップショットの生データは証跡として保持する。
