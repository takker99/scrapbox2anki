/// <reference lib="deno.unstable" />

import {
  Block,
  CodeBlock,
  convertToBlock,
  Line,
  Node,
  packRows,
  parse,
  parseToRows,
  Table,
} from "./deps/scrapbox-parser.ts";
import { encodeTitleURI, toTitleLc } from "./deps/scrapbox.ts";
import { Line as BaseLine } from "./type.ts";
import { detectNoteTitle } from "./detectNoteTitle.ts";
import { parsePath, Path } from "./path.ts";
import { convert } from "./sb2html.ts";

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

  const notes = new Map<
    string,
    Omit<Note, "deck" | "noteType" | "fields"> & {
      // scrapbox記法としてparseするfieldは`true`を入れる
      fields: Map<string, [boolean, string]>;
    }
  >();
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
        const { guid, name, isScrapboxSyntax } = noteTitle;

        const note = notes.get(guid) ??
          {
            guid,
            id: Infinity,
            updated: -Infinity,
            fields: new Map<string, [boolean, string]>([[
              "SourceURL",
              [
                false,
                `https://scrapbox.io/${project}/${encodeTitleURI(title)}#${
                  lines[counter].id
                }`,
              ],
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
        const [isSyntax, content] = note.fields.get(name) ?? [true, ""];
        note.fields.set(
          name,
          [
            isSyntax && isScrapboxSyntax,

            content ? `${content}\n${codeBlock.content}` : codeBlock.content,
          ],
        );

        notes.set(guid, note);
        break;
      }
    }
  }

  return [...notes.values()].map(({ fields: fieldsUnparsed, ...note }) => {
    // 構文解析しつつ、tagsを取り出す
    const tags: string[] = [];
    const dupCheck = new Set<string>();
    const crawlTag = (tag: string) => {
      const tagLc = toTitleLc(tag);
      if (dupCheck.has(tagLc)) return;
      dupCheck.add(tagLc);
      tags.push(tag);
    };
    const fields = new Map<string, string>();

    // 先にnote取得元project nameとpage titleをtagに入れておく
    crawlTag(project);
    crawlTag(title);

    for (
      const [guid, [isScrapboxSyntax, content]] of fieldsUnparsed.entries()
    ) {
      if (!isScrapboxSyntax) {
        fields.set(guid, content);
        continue;
      }
      const html = convert(
        parse(content, { hasTitle: false }) as (Table | CodeBlock | Line)[],
        project,
        crawlTag,
      );
      fields.set(guid, html);
    }

    return ({ ...note, deck: deckRef, noteType: noteTypeRef, fields, tags });
  });
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
