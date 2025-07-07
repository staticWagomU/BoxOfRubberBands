# R2 OGPキャッシング

このドキュメントでは、このプロジェクトにおけるCloudflare R2 OGP（Open Graph Protocol）キャッシングシステムの仕組みについて説明します。

## 概要

R2 OGPキャッシングシステムは、生成されたOGP画像とメタデータをCloudflare R2に保存し、以下を実現します：
- 既存のOGP画像の再生成をスキップすることによる高速ビルド
- デプロイメント間でアクセス可能な集中ストレージ
- ビルド時間と計算リソースの削減

## セットアップ

1. **R2バケットの作成**
   - Cloudflareダッシュボードにログイン
   - R2 > バケットを作成 に移動
   - `wrangler.toml`に記載された名前と一致するバケットを作成：
     - 本番環境: `box-of-rubber-bands`
     - プレビュー環境: `wagomu-ogp-cache-preview`

2. **API認証情報の生成**
   - R2 > R2 APIトークンの管理 に移動
   - オブジェクトの読み取り・書き込み権限を持つ新しいAPIトークンを作成
   - アクセスキーIDとシークレットアクセスキーを保存

3. **環境設定**
   ```bash
   cp .env.example .env
   # .envファイルに認証情報を記入
   ```

4. **環境変数の設定**
   ```env
   CLOUDFLARE_ACCOUNT_ID=your-account-id
   CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
   CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
   ```

## 使用方法

### R2キャッシュを使用したビルド
```bash
pnpm build:with-r2
```

このコマンドは：
1. R2から既存のOGPメタデータと画像リストをダウンロード
2. キャッシュされた画像の生成をスキップ
3. 新しいOGP画像のみを生成
4. 新しい画像と更新されたメタデータをR2にアップロード

### OGP生成のスキップ
```bash
pnpm build:skip-og
```

OGP画像生成を完全にスキップします（開発ビルドに便利）。

### 手動同期
```bash
pnpm ogp:sync
```

ローカルとR2間でOGP画像とメタデータを手動で同期します。

## 仕組み

### ディレクトリ構造
```
generated/
  ogp.json              # 外部リンクOGPメタデータ
  cached-ogp-images.json # R2内の画像リスト（ビルド時）
  
dist/daily/
  2024/
    12/
      2024-12-24.png    # 生成されたOGP画像
```

### R2構造
```
ogp/
  metadata.json         # 統合されたOGPメタデータ
  daily/
    2024/
      12/
        2024-12-24.png  # キャッシュされたOGP画像
```

### ビルドプロセス

1. **プレビルド** (`scripts/pre-build-ogp.mjs`)
   - R2からメタデータをダウンロード
   - キャッシュされた画像のリストを作成
   
2. **ビルド** (Astro)
   - キャッシュされた画像リストをチェック
   - 既存画像の生成をスキップ
   - 新しい画像のみを生成
   
3. **ポストビルド** (`scripts/post-build-ogp.mjs`)
   - 新しい画像をR2にアップロード
   - R2内のメタデータを更新

## 環境変数

| 変数 | 説明 | デフォルト |
|----------|-------------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | CloudflareアカウントID | 必須 |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 APIアクセスキー | 必須 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 APIシークレット | 必須 |
| `CLOUDFLARE_R2_BUCKET_NAME` | バケット名の上書き | wrangler.tomlから |
| `USE_R2_CACHE` | R2キャッシュを有効化 | `false` |
| `SKIP_OG` | OGP生成をスキップ | `false` |
| `NODE_ENV` | 環境（バケットに影響） | `development` |

## トラブルシューティング

### 画像がキャッシュされない
- R2認証情報が正しいか確認
- バケットが存在し、適切な権限を持っているか確認
- ビルドログでR2接続エラーを確認

### R2エラーでビルドが失敗する
- R2キャッシングは正常にローカル生成にフォールバック
- ネットワーク接続を確認
- API認証情報の有効期限が切れていないか確認

### キャッシュされた画像が使用されない
- `USE_R2_CACHE=true`が設定されているか確認
- `cached-ogp-images.json`が作成されているか確認
- 画像パスが期待される形式と一致しているか確認