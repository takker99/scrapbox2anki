import { CodeBlock, Line, Node, Table } from "./deps/scrapbox-parser.ts";
import { encodeTitleURI, parseAbsoluteLink } from "./deps/scrapbox.ts";
import { escapeHtml } from "./escapeHTML.ts";
import { parsePath } from "./path.ts";

const iUnit = "  ";

export interface ConvertResult {
  content: string;
  tags: string[];
}

/** scrapbox記法で書かれたテキストをHTMLに変換する
 *
 * 仕様
 * - ulとliで箇条書きを組む
 * - <br>で改行
 * - hash tagsは切り取って別途返す
 *   - 重複除去はしない
 *
 *  @param blocks 変換するテキスト。scrapbox-parserで解析済みのobjectを渡す
 *  @param project ページが属するproject
 *  @param crawlTag tagを見つけたときに呼び出されるcallback
 *  @param crawlMedia media URLを見つけたときに呼び出されるcallback。返り値は置換後のfilename
 *  @return 変換後のHTML
 */
export const convert = (
  blocks: (Table | CodeBlock | Line)[],
  project: string,
  crawlTag: (tag: string) => void,
  crawlMedia: (url: URL) => string,
): string => {
  // このindent levelを基準にする
  const topIndentLevel = Math.min(...blocks.map((block) => block.indent));

  let level = 0;
  const result: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const newLevel = block.indent - topIndentLevel;

    // indent levelが減ったら</ul>を追加する
    for (let l = level; l > newLevel; l--) {
      result.push(`${iUnit.repeat(l - 1)}</ul>`);
    }
    // indent levelが増えたら<ul>を追加する
    for (let l = level; l < newLevel; l++) {
      result.push(`${iUnit.repeat(l)}<ul class="level-${l + 1}">`);
    }

    const indent = iUnit.repeat(newLevel);
    switch (block.type) {
      case "codeBlock":
        result.push(
          newLevel === 0
            ? convertCodeBlock(block)
            : `${indent}<li>\n${
              convertCodeBlock(block).split("\n").map((line) =>
                `${indent}${iUnit}${line}`
              ).join("\n")
            }\n${indent}</li>`,
        );
        break;
      case "table":
        result.push(
          newLevel === 0
            ? convertTable(block, project, crawlTag, crawlMedia)
            : `${indent}<li>\n${
              convertTable(block, project, crawlTag, crawlMedia).split("\n")
                .map((line) => `${indent}${iUnit}${line}`).join("\n")
            }\n${indent}</li>`,
        );
        break;
      case "line":
        {
          const content = block.nodes.map((node) =>
            convertNode(node, project, crawlTag, crawlMedia)
          )
            .join("");
          result.push(
            newLevel === 0
              ? `${content}${i + 1 === blocks.length ? "" : "<br/>"}`
              : `${indent}<li>${content}</li>`,
          );
        }
        break;
    }

    level = newLevel;
  }

  // </ul>の不足分を補う
  for (let l = level; l > 0; l--) {
    result.push(`${iUnit.repeat(l - 1)}</ul>`);
  }
  return result.join("\n");
};

const convertCodeBlock = (block: CodeBlock): string =>
  `<figure class="codeBlock">
${iUnit}<figcaption><code>${escapeHtml(block.fileName)}</code></figcaption>
${iUnit}<pre><code>${escapeHtml(block.content)}</code></pre>
</figure>`;

const convertTable = (
  table: Table,
  project: string,
  crawlTag: (tag: string) => void,
  crawlMedia: (url: URL) => string,
): string => {
  const [head, ...lines] = table.cells.map(
    (cell) =>
      cell.map(
        (row) =>
          row.map((node) => convertNode(node, project, crawlTag, crawlMedia))
            .join(""),
      ),
  );
  return `<table class="table">
${iUnit}<caption>${escapeHtml(table.fileName)}</caption>
${iUnit}<thead>
${iUnit}${iUnit}<tr>
${head?.map?.((row) => `${iUnit.repeat(3)}<th>${row}</th>`)?.join?.("\n") ?? ""}
${iUnit}${iUnit}</tr>
${iUnit}</thead>
${iUnit}<tbody>
${
    lines?.map?.(
      (line) =>
        `${iUnit}${iUnit}<tr>\n${
          line.map((row) => `${iUnit.repeat(3)}<td>${row}</td>`).join("\n")
        }\n${iUnit}${iUnit}</tr>`,
    )?.join?.("\n")
  }
${iUnit}</tbody>
</table>`;
};

const convertNode = (
  node: Node,
  project: string,
  crawlTag: (tag: string) => void,
  crawlMedia: (url: URL) => string,
): string => {
  switch (node.type) {
    case "quote":
      return `<span class="quote">${
        node.nodes.map((node) =>
          convertNode(node, project, crawlTag, crawlMedia)
        ).join("")
      }</span>`;
    case "image":
    case "strongImage": {
      const image = `<img class="image" src="${escapeHtml(node.src)}" />`;
      return node.type === "image" ? image : `<strong>${image}</strong>`;
    }
    case "strongIcon":
    case "icon": {
      const path = parsePath(node.path, project);
      const src =
        `https://scrapbox.io/api/pages/${path.project}/${path.title}/icon`;
      const href = `https://scrapbox.io/${path.project}/${path.title}`;
      const alt = node.path;

      const icon = `<a class="icon" target="_blank" href="${
        escapeHtml(href)
      }"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" /></a>`;
      return node.type === "icon" ? icon : `<strong>${icon}</strong>`;
    }
    case "formula":
      return `\\( ${escapeHtml(node.formula)} \\)`;
    case "decoration": {
      const result = node.nodes.map((node) =>
        convertNode(node, project, crawlTag, crawlMedia)
      ).join(
        "",
      );
      if (node.decos.length === 0) return result;
      return `<span class="${
        node.decos.map((deco) => `deco-${escapeHtml(deco)}`).join(" ")
      }">${result}</span>`;
    }
    case "strong":
      return `<strong>${
        node.nodes.map((node) =>
          convertNode(node, project, crawlTag, crawlMedia)
        ).join("")
      }</strong>`;
    case "code":
      return `<code class="code">${escapeHtml(node.text)}</code>`;
    case "commandLine":
      return `<code class="cli">${node.symbol} ${escapeHtml(node.text)}</code>`;
    case "helpfeel":
      return `<code class="helpfeel">? ${escapeHtml(node.text)}</code>`;
    case "googleMap":
      return `<a class="google-map" href="https://www.google.com/maps/search/${node.place}/@${node.latitude},${node.longitude},${node.zoom}z">N${node.latitude},E${node.longitude},Z${node.zoom} ${node.place}</a>`;
    // deno-lint-ignore no-fallthrough
    case "link": {
      switch (node.pathType) {
        case "relative":
        case "root": {
          const path = parsePath(node.href, project);
          const href = `https://scrapbox.io/${path.project}/${
            escapeHtml(encodeTitleURI(path.title))
          }`;
          return `<a class="page-link" target="_blank" href="${
            escapeHtml(href)
          }">${escapeHtml(node.href)}</a>`;
        }
        case "absolute": {
          // @ts-ignore node.pathType === "absolute"なはず
          const linkNode = parseAbsoluteLink(node);
          switch (linkNode.type) {
            case "absoluteLink":
            case "youtube":
            case "vimeo":
            case "spotify":
            case "anchor-fm":
              return `<a class="link" target="_blank" href="${
                escapeHtml(node.href)
              }">${escapeHtml(node.content || node.href)}</a>`;
            case "video":
            case "audio": {
              const filename = crawlMedia(new URL(node.href));
              const tag = linkNode.type;
              return `<${tag} class="${tag}" src="${
                escapeHtml(filename)
              }" controls></${tag}>`;
            }
          }
        }
      }
    }
    case "hashTag":
      crawlTag(node.href);
      return "";
    case "numberList":
      return `${node.number}. ${
        node.nodes.map((node) =>
          convertNode(node, project, crawlTag, crawlMedia)
        ).join("")
      }`;
    case "blank":
      return node.text;
    case "plain":
      return escapeHtml(node.text);
  }
};
