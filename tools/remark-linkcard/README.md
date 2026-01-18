# remark-link-card

Astro用のremarkプラグイン。Markdownファイル内の独立したURLを自動的にリンクカードに変換します。

## 特徴

- 🔍 独立したURL（行単独のURL）のみを検出
- 📦 OGPメタデータをJSONキャッシュに保存
- ⚡ 次回ビルド時はキャッシュを使用しフェッチをスキップ
- ⏱️ キャッシュの有効期限設定
- 🛡️ フェッチ失敗時のフォールバック対応

## インストール

必要な依存パッケージ:

```bash
npm install unist-util-visit
```

## 使用方法

### astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';
import { remarkLinkCard } from './src/plugins/remark-link-card';

export default defineConfig({
  markdown: {
    remarkPlugins: [
      // デフォルト設定
      remarkLinkCard,
      
      // または、オプションを指定
      [remarkLinkCard, {
        cachePath: './src/cache/link-cards.json',
        cacheMaxAge: 7 * 24 * 60 * 60 * 1000, // 7日
        fetchTimeout: 5000,
        className: 'link-card',
        fallbackOnError: true,
      }],
    ],
  },
});
```

### オプション

| オプション | 型 | デフォルト | 説明 |
|-----------|-----|---------|------|
| `cachePath` | `string` | `"./src/cache/link-cards.json"` | キャッシュJSONファイルの出力先パス |
| `cacheMaxAge` | `number` | `604800000` (7日) | キャッシュの有効期限（ミリ秒） |
| `fetchTimeout` | `number` | `5000` | フェッチのタイムアウト（ミリ秒） |
| `className` | `string` | `"link-card"` | リンクカードのHTMLクラス名 |
| `fallbackOnError` | `boolean` | `true` | フェッチ失敗時に通常リンクとして表示するか |
| `headless` | `boolean \| "marker"` | `false` | Headless UIモード（後述） |
| `tagName` | `string` | `"link-card"` | Markerモード時のカスタム要素タグ名 |

## Headless UIモード

スタイリングを完全にカスタマイズしたい場合に使用します。

### headless: false（デフォルト）

完全なHTML構造を出力します:

```html
<a href="..." class="link-card" target="_blank" rel="noopener noreferrer">
  <div class="link-card__image">...</div>
  <div class="link-card__content">...</div>
</a>
```

### headless: true

data属性のみを持つシンプルな要素を出力します。CSSやJSで自由にスタイリング可能:

```javascript
[remarkLinkCard, { headless: true }]
```

出力:

```html
<a href="https://example.com" 
   class="link-card" 
   target="_blank" 
   rel="noopener noreferrer"
   data-link-card
   data-title="Example Site"
   data-description="This is an example site."
   data-image="https://example.com/og-image.png"
   data-site-name="example.com">
</a>
```

CSS例（data属性を使用）:

```css
.link-card {
  display: block;
}

.link-card::before {
  content: attr(data-title);
  font-weight: bold;
}

.link-card::after {
  content: " - " attr(data-site-name);
  color: gray;
}
```

### headless: "marker"

カスタム要素としてマーカーのみを出力。Astroコンポーネントやrehypeプラグインで置換するためのモード:

```javascript
[remarkLinkCard, { 
  headless: "marker",
  tagName: "link-card-placeholder"  // カスタムタグ名
}]
```

出力:

```html
<link-card-placeholder 
  data-url="https://example.com"
  data-title="Example Site"
  data-description="This is an example site."
  data-image="https://example.com/og-image.png"
  data-site-name="example.com">
</link-card-placeholder>
```

#### Astroでの置換例

rehypeプラグインでカスタム要素をAstroコンポーネントに置換:

```typescript
// rehype-link-card-component.ts
import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

export function rehypeLinkCardComponent() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'link-card-placeholder') {
        // AstroコンポーネントのインポートHTMLに変換
        // または、独自のHTML構造に変換
      }
    });
  };
}
```

または、Content Collectionsのレンダリング時にカスタムコンポーネントを使用:

```astro
---
// components/LinkCard.astro
const { url, title, description, image, siteName } = Astro.props;
---
<a href={url} class="my-custom-link-card">
  <!-- 独自のデザイン -->
</a>
```

## 検出ルール

以下のパターンのみがリンクカードに変換されます:

### ✅ 対象

```markdown
https://example.com

<https://example.com>

[https://example.com](https://example.com)
```

### ❌ 対象外

```markdown
詳しくは https://example.com を参照してください。

[参考サイト](https://example.com)

- https://example.com
```

## 出力されるHTML

```html
<a href="https://example.com" class="link-card" target="_blank" rel="noopener noreferrer">
  <div class="link-card__image">
    <img src="https://example.com/og-image.png" alt="" loading="lazy" />
  </div>
  <div class="link-card__content">
    <div class="link-card__title">Example Site</div>
    <div class="link-card__description">This is an example site.</div>
    <div class="link-card__meta">
      <span class="link-card__site">example.com</span>
    </div>
  </div>
</a>
```

## CSS例

```css
.link-card {
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.2s;
}

.link-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.link-card__image {
  flex-shrink: 0;
  width: 120px;
}

.link-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.link-card__content {
  flex: 1;
  padding: 12px 16px;
  min-width: 0;
}

.link-card__title {
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-card__description {
  margin-top: 4px;
  font-size: 0.875rem;
  color: #64748b;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.link-card__meta {
  margin-top: 8px;
  font-size: 0.75rem;
  color: #94a3b8;
}
```

## キャッシュファイル

キャッシュは以下の形式で保存されます:

```json
{
  "https://example.com": {
    "url": "https://example.com",
    "title": "Example Site",
    "description": "This is an example site.",
    "image": "https://example.com/og-image.png",
    "siteName": "example.com",
    "fetchedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## .gitignore

キャッシュファイルをリポジトリに含めたくない場合:

```gitignore
src/cache/
```

逆に、ビルド時間を短縮するためにキャッシュをコミットする運用も有効です。

## License

MIT
