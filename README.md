# 輪ごむの空き箱

個人ブログ サイト

## 開発

```bash
# 開発サーバーの起動
pnpm dev

# ビルド
pnpm build

# OGP画像の生成をスキップしてビルド時間を短縮
pnpm build:skip-og

# R2キャッシュを使用してビルド
pnpm build:with-r2

# ビルド結果のプレビュー
pnpm preview
```

## R2キャッシュの設定

OGP画像の生成はビルド時間を増加させるため、Cloudflare R2にキャッシュする機能を実装しています。

### 設定方法

1. Cloudflareアカウントを作成し、R2バケットを作成する
2. `wrangler.toml`の設定を確認し、必要に応じて変更する
3. Cloudflareの認証情報を設定する
4. `USE_R2_CACHE=true`環境変数を設定してビルドする

### 環境変数

- `SKIP_OG`: `true`に設定するとOGP画像の生成をスキップします
- `USE_R2_CACHE`: `true`に設定するとR2キャッシュを使用します

## TODOリスト

- [x] Zennの記事を引っ張ってくる
- [x] OGコンポーネントを作る
- [x] tag機能をつける
- [x] code-blockにline-numberを付ける
  - [x] スマホビューではline-numberを消す
  参考： https://blog.flotes.app/posts/bulletproof-typescript?ref=dailydev
- [x] code-blockにはタイトルも付けれるようにする
- [x] R2を使ったOGP画像のキャッシュ機能
