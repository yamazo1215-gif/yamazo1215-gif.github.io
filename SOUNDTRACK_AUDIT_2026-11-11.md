# サントラ盤確認・反映記録

## 反映

- 最新main `831daa69300cbe902075be3fa7cf075e58ecea08` を基準に作業。
- サントラ盤は2カードから11カード。版・媒体ごとにはカードを分割しない。
- 劇伴担当21件、楽曲等の既存情報は維持。
- CD、配信、BD/DVD特典CD、CD同梱特典を区別。版ごとの発売日、品番、曲数を詳細に記載。
- 花野井くんは1カードでCD32曲／配信Complete Edition44曲を表示。
- LOVE!は配信31曲／LOVE FOREVERに同梱の特典45曲を区別。単独販売CDと誤記しない。
- ヤマノススメ2018年3枚組は1カード。過去の特典3件は関連商品欄に記載し、2018年盤発売日を過去の特典日に置き換えない。全曲単位の同一性は未照合。
- サードシーズンの配信は販売ページで存在を確認。2022-10-12は原盤発売日表記のため、配信開始日は未入力。
- Next Summitは2023-02-03発売のBlu-ray/DVD第1巻初回生産特典CD。
- ハイカラにはETERNAL LOVE!の劇伴6曲が収録されるため、独立したETERNAL LOVE!盤を追加しない。
- 新規盤のジャケット画像は未追加。既存のハイカラ／花野井くんの正式盤画像を保持し、作品キービジュアルを盤画像に流用しない。

各盤の出典URLは `soundtracks.json` に収録。

## 他の担当作品の確認

以下は今回の確認で独立した劇伴盤を確認できなかったもの。未発売と断定するものではない。

- 勇者が死んだ！: BD付属CDはアフタートーク。https://heroisdead.com/product/bdbox/
- One Room サードシーズン: CDは主題歌3曲。https://oneroom-anime.com/products/
- Room Mate: DVD特典はピクチャードラマ。https://oneroom-anime.com/products_cat/disc_roommate/
- ミリオンドール: 掲載商品は主題歌／挿入歌。https://www.smiral-label.com/milliondoll/
- 美男高校地球防衛部HAPPY KISS!: きゃにめ特典CDはOP/EDソロ。https://boueibu.com/hk/package.html
- 美男高校地球防衛部LOVE!LOVE!LOVE!: コンプリートBOX付属は歌曲集。https://boueibu.com/ova/music.html

## 検証

- `node --test *.test.mjs`: 42テスト合格。
- `node build.mjs`: 成功。120件生成。
- `git diff --check`: 合格。
- 出力HTMLのサントラ件数、媒体ラベル、版別曲数、関連特典表示を静的検査。
- PC幅／スマホ幅でのブラウザ表示テストは未完了。Chromiumが実行環境の `socket() failed: Operation not permitted` で起動停止。実行審査経由でも同じ環境制限だった。
- 公開push/deployは未実施。

## 追加の表示調整

- ユーザー指定のハイカラ作品キービジュアルを取得し、1446×2048ピクセルの実画像を確認。
- `assets/covers/haikara-user-keyvisual.jpg` として原画像をそのまま保存。劇伴担当カードと冒頭Featuredで使用し、OSTジャケットは変更しない。
- 冒頭Featuredの画像はPC 120×160px、スマホ84×118pxの固定小サイズに変更。画像全体を保持し、見出し・余白も縮小。
- 追加後は44テスト合格、build成功、差分検査合格。
- ブラウザ実測・スクリーンショット検証は前記のChromium実行環境制約により未完了。CSS静的検査と生成HTML検査を実施した。

## 動画の追加コンパクト化

- 代表動画をPC最大360px／スマホ最大300pxに制限。16:9、全画面、元のYouTube動画・直接リンクを維持。
- 冒頭heroの最小高さを620pxから440pxへ変更。タブレット／スマホでは内容に応じた高さと狭めの余白に調整。
- 直接リンクの高さは44px以上を確保。
- 全46テスト、build、差分検査合格。ブラウザ実測は前記環境制約により未完了。

## 肩書き追加

- 既存のComposer / Arranger / Guitaristを保持し、Multi-instrumentalistを追加。
- Heroの上段ラベル・肩書き、About肩書き、ページtitleで英語表記を統一。description・keywordsには日本語「マルチインストゥルメンタリスト」も追加。
- 長くなった肩書きの折返しを許可し、Heroの内容による横方向の押し広げを防止。本文の活動説明は変更しない。
- 全47テスト、build、差分検査合格。公開は未実施。
