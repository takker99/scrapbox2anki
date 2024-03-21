import { Block, Node } from "./deps/scrapbox-parser.ts";

/** Blockに含まれるiconを出現順にすべて取り出す */
export const getIcons = (block: Block): string[] => {
  switch (block.type) {
    case "line":
      return block.nodes.flatMap((node) => getIconsFromNode(node));
    case "table":
      return block.cells.flatMap((row) =>
        row.flatMap((cell) => cell.flatMap((node) => getIconsFromNode(node)))
      );
    default:
      return [];
  }
};
const getIconsFromNode = (node: Node): string[] => {
  switch (node.type) {
    case "icon":
    case "strongIcon":
      return [node.path];
    case "decoration":
    case "quote":
      return node.nodes.flatMap((node) => getIconsFromNode(node));
    default:
      return [];
  }
};
