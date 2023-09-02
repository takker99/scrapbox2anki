/// <reference lib="deno.unstable" />

import {
  Block,
  convertToBlock,
  Node,
  packRows,
  parse,
  parseToRows,
} from "./deps/scrapbox-parser.ts";
import { BaseLine, encodeTitleURI } from "./deps/scrapbox.ts";
import { detectNoteTitle } from "./detectNoteTitle.ts";

/** 抽出したnote
 *
 * deckとnote typeの情報を参照できないため、 deno-anki の`Note`とは型が異なる
 */
export interface Note {
  guid: string;

  /** note ID */
  id: number;

  /** このnoteが属するdeckのデータが書き込まれているページへのパス */
  deck?: Path;

  /** このnoteが使うnote typeのデータが書き込まれているページへのパス */
  noteType?: Path;

  /** updated time of the note */
  updated: number;
  tags?: string[];

  /** field nameをキーとしたfield values
   *
   * unnamed fieldは`""`をキーとして格納する
   */
  fields: Map<string, string>;
}

/** scrapboxのページを一意に特定するパス */
export interface Path {
  project: string;
  title: string;
}

export const parseNotes = (
  project: string,
  title: string,
  lines: BaseLine[],
): Note[] => {
  if (lines.length === 0) return [];
  const packs = packRows(
    parseToRows(lines.map((line) => line.text).join("\n")),
    { hasTitle: true },
  );

  const notes = new Map<string, Omit<Note, "deck" | "noteType">>();
  let deckRef: Path | undefined;
  let noteTypeRef: Path | undefined;
  /** 現在読んでいる`pack.rows[0]`の行番号 */
  let counter = 0;
  for (const pack of packs) {
    switch (pack.type) {
      case "title":
        counter++;
        break;
      case "table":
      case "line": {
        counter += pack.rows.length;
        if (deckRef && noteTypeRef) break;

        // iconがある行を調べる
        const block = convertToBlock(pack);
        const icons = getIcons(block);
        for (const icon of icons) {
          if (icon.toLowerCase().startsWith("deck-")) {
            deckRef ??= parsePath(icon, project);
          }
          if (icon.toLowerCase().startsWith("notetype-")) {
            noteTypeRef ??= parsePath(icon, project);
          }
        }
        break;
      }
      case "codeBlock": {
        counter += pack.rows.length;
        const codeBlock = convertToBlock(pack);
        if (codeBlock.type !== "codeBlock") throw SyntaxError();

        const noteTitle = detectNoteTitle(codeBlock.fileName);
        if (!noteTitle) break;
        const { guid, name } = noteTitle;

        const note = notes.get(guid) ??
          {
            guid,
            id: Infinity,
            updated: -Infinity,
            fields: new Map<string, string>([[
              "SourceURL",
              `https://scrapbox.io/${project}/${encodeTitleURI(title)}#${
                lines[counter].id
              }`,
            ]]),
          };

        // note id は、コードブロックを構成する行の作成日時のうち、一番古いものを採用する
        note.id = Math.min(
          ...lines.slice(counter, counter + pack.rows.length).map((line) =>
            line.created * 1000
          ),
          note.id,
        );
        note.updated = Math.max(
          ...lines.slice(counter, counter + pack.rows.length).map((line) =>
            line.updated * 1000
          ),
          note.updated,
        );
        const content = note.fields.get(name);
        note.fields.set(
          name,
          // 改行は<br>に変換する
          (content ? `${content}<br>${codeBlock.content}` : codeBlock.content)
            .replaceAll("\n", "<br>"),
        );

        notes.set(guid, note);
        break;
      }
    }
  }

  return [...notes.values()].map((note) => ({
    ...note,
    deck: deckRef,
    noteType: noteTypeRef,
    // textをさらにparseして、hashtagを取り出す
    tags: parse(note.fields.get("") ?? "").flatMap((block) => {
      if (block.type !== "line") return [];
      return block.nodes.flatMap(
        (node) => getHashTags(node),
      );
    }),
  }));
};

const getHashTags = (node: Node): string[] => {
  switch (node.type) {
    case "hashTag":
      return [node.href];
    case "decoration":
    case "quote":
      return node.nodes.flatMap((node) => getHashTags(node));
    default:
      return [];
  }
};

/** Blockに含まれるiconを出現順にすべて取り出す */
const getIcons = (block: Block): string[] => {
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

const parsePath = (path: string, defaultProject: string): Path => {
  const [, project, title] = path.match(/^\/([\w\-]+)\/(.+)$/) ?? [];
  return project && title
    ? { project, title }
    : { project: defaultProject, title: path };
};
