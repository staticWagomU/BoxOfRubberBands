import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";

export default function rehypeToc(options = {}) {
  const {
    headings = ["h2", "h3"],
    className = "toc",
    title = "目次",
    titleClassName = "toc-title",
    listClassName = "toc-list",
    listItemClassName = "toc-item",
    linkClassName = "toc-link",
    collapsible = true,
    defaultOpen = true,
    // PC用とモバイル用で分けるかどうか
    splitView = true,
    pcClassName = "toc-pc",
  } = options;

  return function transformer(tree) {
    // 記事内の見出しを収集
    const headingNodes = [];
    visit(tree, "element", (node) => {
      if (headings.includes(node.tagName)) {
        const text = toString(node);
        // 簡易的なスラッグ生成（日本語対応）
        let id = node.properties.id || createSlug(text);
        
        // 見出しにIDがなければ追加、または同名IDがある場合は重複を避ける
        if (!node.properties.id) {
          // 同名の見出しに対して一意のIDを生成する
          let uniqueId = id;
          let counter = 1;
          while (headingNodes.some(h => h.id === uniqueId)) {
            uniqueId = `${id}-${counter}`;
            counter++;
          }
          node.properties.id = uniqueId;
          id = uniqueId;
        }
        
        headingNodes.push({
          tagName: node.tagName,
          text,
          id,
        });
      }
    });

    // 見出しがなければTOCを作成しない
    if (headingNodes.length === 0) {
      return;
    }

    // TOCアイテムの生成関数
    function createTocItems() {
      return headingNodes.map((heading) => {
        const link = {
          type: "element",
          tagName: "a",
          properties: { 
            class: linkClassName, 
            href: `#${heading.id}` 
          },
          children: [{ type: "text", value: heading.text }]
        };
        
        return {
          type: "element",
          tagName: "li",
          properties: { 
            class: `${listItemClassName} depth-${heading.tagName.substring(1)}`
          },
          children: [link]
        };
      });
    }

    // TOCコンポーネントの生成関数
    function createTocComponent(additionalClassName = '', isPC = false) {
      const tocItems = createTocItems();
      
      const tocList = {
        type: "element",
        tagName: "ul",
        properties: { class: listClassName },
        children: tocItems
      };
      
      // 折りたたみ機能をつける場合はdetails/summaryを使用
      let tocComponent;
      if (collapsible) {
        const tocSummary = {
          type: "element",
          tagName: "summary",
          properties: { class: titleClassName },
          children: [{ type: "text", value: title }]
        };
        
        const tocDetails = {
          type: "element",
          tagName: "details",
          properties: { 
            class: `${className}-details`,
            open: isPC ? true : defaultOpen ? "open" : null // PC版は常に開く
          },
          children: [tocSummary, tocList]
        };
        
        tocComponent = {
          type: "element",
          tagName: "div",
          properties: { 
            class: additionalClassName ? `${className} ${additionalClassName}` : className
          },
          children: [tocDetails]
        };
      } else {
        const tocTitle = {
          type: "element",
          tagName: "h2",
          properties: { class: titleClassName },
          children: [{ type: "text", value: title }]
        };
        
        tocComponent = {
          type: "element",
          tagName: "div",
          properties: { 
            class: additionalClassName ? `${className} ${additionalClassName}` : className
          },
          children: [tocTitle, tocList]
        };
      }
      
      return tocComponent;
    }
    
    // モバイル用とPC用のTOCを作成
    const mobileTocContainer = createTocComponent('toc-mobile');
    const pcTocContainer = createTocComponent(pcClassName, true);

    // モバイル用TOCを最初のh1またはh2の前に挿入
    let mobileTocInserted = false;
    visit(tree, "element", (node, index, parent) => {
      if (!mobileTocInserted && (node.tagName === "h1" || node.tagName === "h2")) {
        parent.children.splice(index, 0, mobileTocContainer);
        mobileTocInserted = true;
        return [visit.SKIP, index + 1];
      }
    });

    // 見出しが見つからなかった場合は、最初の段落の前に挿入
    if (!mobileTocInserted) {
      visit(tree, "element", (node, index, parent) => {
        if (!mobileTocInserted && node.tagName === "p") {
          parent.children.splice(index, 0, mobileTocContainer);
          mobileTocInserted = true;
          return [visit.SKIP, index + 1];
        }
      });
    }

    // それでも挿入できなかった場合は、ツリーの先頭に挿入
    if (!mobileTocInserted && tree.children && tree.children.length > 0) {
      tree.children.unshift(mobileTocContainer);
    }
    
    // PC用TOCをツリーの最後に追加
    if (tree.children && tree.children.length > 0) {
      tree.children.push(pcTocContainer);
    }
  };
}

// 簡易的なスラッグ生成関数
function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\p{L}\p{N}]/gu, "-") // 英数字と日本語文字以外をハイフンに
    .replace(/-+/g, "-") // 連続するハイフンを一つに
    .replace(/^-|-$/g, ""); // 先頭と末尾のハイフンを削除
}