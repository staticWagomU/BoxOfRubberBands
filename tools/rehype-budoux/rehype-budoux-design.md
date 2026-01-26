# rehype-budoux 設計書（ロバスト設計）

## 1. 目的
- BudouX を用いて日本語（将来は多言語）の自動改行ポイントを HTML に付与し、可読性とレイアウト安定性を向上させる。
- remark ではなく rehype（HAST）で処理し、HTML 構造を壊さずに他プラグインとの併用を前提とした堅牢な動作を実現する。

## 2. 非目標（Non-goals）
- Markdown 解析や AST 生成は行わない（入力は HAST を前提）。
- HAST 内の HTML サニタイズ機能は提供しない（別途 rehype-sanitize 等を使用）。
- CSS の挿入・管理は最小限（必要なら className を付与し、CSS は利用者が管理）。

## 3. 想定利用パイプライン
- 推奨: `remark -> (他の remark プラグイン) -> remark-rehype -> rehype-budoux -> (rehype-sanitize / rehype-stringify)`
- 既存の HTML を扱う場合: `rehype-parse -> rehype-budoux -> (rehype-sanitize / rehype-stringify)`

## 4. コア設計方針
1) **HAST の text ノードを書き換える**
   - `node.type` は変更しない。
   - ZWSP (U+200B) を挿入することで改行機会を追加する。

2) **HTML 構造の破壊を避ける**
   - element ノード（tag）や属性は維持する。
   - `script`, `style`, `code`, `pre`, `kbd`, `samp` 等は原則対象外。

3) **オプションで対象範囲を制御**
   - `include`/`exclude` セレクタや `ignoreTags` を提供。
   - HTML の「どこに」適用するかを明確にできる。

4) **安全性と互換性**
   - 生 HTML の注入はしない。
   - `rehype-raw` や `allowDangerousHtml` に依存しない設計。

## 5. 仕様（API）
### プラグイン名
- `rehype-budoux`

### オプション
```ts
export type RehypeBudouxOptions = {
  language?: 'ja' | 'zh-hans' | 'zh-hant' | 'th';
  parser?: budoux.Parser; // 外部から注入可能
  separator?: 'zwsp' | 'wbr';
  className?: string; // 追加する class
  include?: string | string[]; // CSS セレクタ
  exclude?: string | string[]; // CSS セレクタ
  ignoreTags?: string[]; // デフォルト: ['code', 'pre', 'script', 'style']
  minLength?: number; // 短い文字列はスキップ
  skip?: (text: string, node: import('hast').Text) => boolean; // 高度な除外
};
```

### デフォルト挙動
- `language: 'ja'`
- `separator: 'zwsp'`
- `ignoreTags: ['code', 'pre', 'script', 'style', 'kbd', 'samp']`
- `minLength: 2`
- `include/exclude` 未指定なら全体対象

## 6. 変換ルール詳細
### 6.1 対象ノード
- HAST `text` ノードのみを対象。
- 親が `ignoreTags` に含まれる場合は無視。
- `include` が指定された場合は 해당セレクタ内のみ。
- `exclude` に一致する場合は常に除外。

### 6.2 文字列変換
- BudouX `Parser.parse` でチャンク分割し、以下で再結合する。
  - `separator = 'zwsp'` の場合: `chunks.join('\u200B')`
  - `separator = 'wbr'` の場合: `chunks.join('<wbr>')` を HAST ノードに分解
- `separator = 'wbr'` の場合は、文字列として `<wbr>` を埋め込まず、
  `text` ノード分割 + `element` ノード（`wbr`）を挿入。

### 6.3 className 付与
- `className` が指定されている場合、
  `include` 対象の最上位要素に class を付与（重複は避ける）。
- `word-break: keep-all; overflow-wrap: anywhere;` の付与は **しない**。
  CSS は利用者側で制御する。

## 7. AST 変換アルゴリズム
1) `visit(tree, 'text', handler)` で全 text ノードを走査。
2) `ancestor` を辿り `ignoreTags` に該当する場合は skip。
3) `include/exclude` がある場合は `hast-util-select` を使用し対象判定。
4) `text.value` が `minLength` 未満なら skip。
5) `parser.parse(text.value)` を実行。
6) `separator` に従って `text` を置換 or 分割挿入。

## 8. エッジケース
- 既に ZWSP / WBR が含まれる場合の重複挿入
  - デフォルトは重複を許容。
  - 追加オプション `dedupe` を検討（必要なら後方互換で追加）。
- URL, 数字, 英文のみのテキストは `skip` で除外可能。
- `inlineCode` から変換された `code` タグは除外対象。

## 9. セキュリティ
- 生 HTML を生成しないため、XSS を拡大しない。
- `separator = 'wbr'` の場合も `element` ノードとして追加するため、
  文字列による HTML 注入は発生しない。

## 10. パフォーマンス
- `parser` は 1 回だけ生成し使い回す。
- `minLength` と `ignoreTags` により無駄な処理を削減。
- 大規模ドキュメントに対しても線形スキャンで完了。

## 11. テスト計画
### 単体
- `text` に ZWSP が正しく挿入されるか
- `code/pre/script/style` の除外確認
- `include/exclude` のセレクタ判定
- `separator: 'wbr'` のノード構造

### 結合
- `remark -> rehype` パイプラインで期待通りに出力されるか
- `rehype-sanitize` 併用時に `wbr` が保持されるか

## 12. 互換性と移行
- 既存 remark プラグインの利用者は、パイプラインの
  `remark-rehype` 以降に入れ替えることで移行可能。
- オプションは後方互換性を維持して追加。

## 13. 実装メモ（簡易）
- 依存候補:
  - `hast-util-select`（CSS セレクタ）
  - `unist-util-visit`（走査）
- バンドル方針: `unbuild` 維持

## 14. 例（利用イメージ）
```js
import rehypeBudoux from 'rehype-budoux';

unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeBudoux, { language: 'ja', separator: 'zwsp' })
  .use(rehypeStringify)
```

---

この設計は「他のプラグインと併用しても壊れない」ことを最優先にしています。
実装に移る場合は、この設計の 6〜8 章を基準に詳細化してください。
