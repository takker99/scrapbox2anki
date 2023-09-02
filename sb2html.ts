import { CodeBlock, Line, Node, Table } from "./deps/scrapbox-parser.ts";
import { encodeTitleURI } from "./deps/scrapbox.ts";

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
 *  @return 変換後のHTML
 */
export const convert = (
  blocks: (Table | CodeBlock | Line)[],
  project: string,
  crawlTag: (tag: string) => void,
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
            ? convertTable(block, project, crawlTag)
            : `${indent}<li>\n${
              convertTable(block, project, crawlTag).split("\n").map((line) =>
                `${indent}${iUnit}${line}`
              ).join("\n")
            }\n${indent}</li>`,
        );
        break;
      case "line":
        {
          const content = block.nodes.map((node) =>
            convertNode(node, project, crawlTag)
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
): string => {
  const [head, ...lines] = table.cells.map(
    (cell) =>
      cell.map(
        (row) =>
          row.map((node) => convertNode(node, project, crawlTag)).join(""),
      ),
  );
  return `<table class="table">
${iUnit}<caption>${table.fileName}</caption>
${iUnit}<thead>
${iUnit}${iUnit}<tr>
${head?.map?.((row) => `${iUnit.repeat(3)}<th>${row}</th>`)?.join?.("\n") ?? ""}
${iUnit}${iUnit}</tr>
${iUnit}</thead>
${iUnit}<tbody>
${lines?.map?.(
    (line) =>
      `${iUnit}${iUnit}<tr>\n${
        line.map((row) => `${iUnit.repeat(3)}<td>${row}</td>`).join("\n")
      }\n${iUnit}${iUnit}</tr>`,
  )?.join?.("\n")}
${iUnit}</tbody>
</table>`;
};

const convertNode = (
  node: Node,
  project: string,
  crawlTag: (tag: string) => void,
): string => {
  switch (node.type) {
    case "quote":
      return `<span class="quote">${
        node.nodes.map((node) => convertNode(node, project, crawlTag)).join("")
      }</span>`;
    case "image":
    case "strongImage": {
      const image = `<img class="image" src="${escapeHtml(node.src)}" />`;
      return node.type === "image" ? image : `<strong>${image}</strong>`;
    }
    case "strongIcon":
    case "icon": {
      let src = "";
      let href = "";
      let alt = "";
      switch (node.pathType) {
        case "root":
          href = `https://scrapbox.io${node.path}`;
          src = `https://scrapbox.io/api/pages/${node.path}/icon`;
          alt = node.path.replace(/^\/[^\/]+\/(.*)/, "$1");
          break;
        case "relative":
          href = `https://scrapbox.io/${project}/${node.path}`;
          src = `https://scrapbox.io/api/pages/${project}/${node.path}/icon`;
          alt = node.path;
          break;
      }
      const icon =
        `<a class="icon" target="_blank" href="${href}"><img src="${src}" alt="${alt}" /></a>`;
      return node.type === "icon" ? icon : `<strong>${icon}</strong>`;
    }
    case "formula":
      return `\\( ${escapeHtml(node.formula)} \\)`;
    case "decoration": {
      const result = node.nodes.map((node) =>
        convertNode(node, project, crawlTag)
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
        node.nodes.map((node) => convertNode(node, project, crawlTag)).join("")
      }</strong>`;
    case "code":
      return `<code class="code">${escapeHtml(node.text)}</code>`;
    case "commandLine":
      return `<code class="cli">${node.symbol} ${escapeHtml(node.text)}</code>`;
    case "helpfeel":
      return `<code class="helpfeel">? ${escapeHtml(node.text)}</code>`;
    case "googleMap":
      return `<a class="google-map" href="https://www.google.com/maps/search/${node.place}/@${node.latitude},${node.longitude},${node.zoom}z">N${node.latitude},E${node.longitude},Z${node.zoom} ${node.place}</a>`;
    case "link": {
      switch (node.pathType) {
        case "root":
          return `<a class="page-link" target="_blank" href="https://scrapbox.io${node.href}">${
            escapeHtml(node.href)
          }</a>`;
        case "relative":
          return `<a class="page-link" target="_blank" href="https://scrapbox.io/${project}/${
            escapeHtml(
              encodeTitleURI(node.href),
            )
          }">${escapeHtml(node.href)}</a>`;
        default:
          return `<a class="link" target="_blank" href="${
            escapeHtml(node.href)
          }">${
            escapeHtml(
              node.content || node.href,
            )
          }</a>`;
      }
    }
    case "hashTag":
      crawlTag(node.href);
      return "";
    case "numberList":
      return `${node.number}. ${
        node.nodes.map((node) => convertNode(node, project, crawlTag)).join("")
      }`;
    case "blank":
      return node.text;
    case "plain":
      return escapeHtml(node.text);
  }
};
const escapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (m) => escapeMap[m as "&" | "<" | ">" | '"' | "'"]);
