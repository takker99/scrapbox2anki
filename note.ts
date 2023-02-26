/// <reference lib="deno.unstable" />

import {
  convertToBlock,
  Node,
  packRows,
  parse,
  parseToRows,
} from "./deps/scrapbox-parser.ts";
import { BaseLine, encodeTitleURI } from "./deps/scrapbox.ts";
import type { Note } from "./deps/deno-anki.ts";

export interface ParseResult {
  deckRef?: Path;
  noteTypeRef?: Path;
  notes: Omit<Note, "deck" | "noteType">[];
}
export interface Path {
  project: string;
  title: string;
}

const deckRegExp = /^deck:\[([^[\]]*)\.icon(?:\*[1-9]\d*)?\]/;
const noteTypeRegExp = /^noteType:\[([^[\]]*)\.icon(?:\*[1-9]\d*)?\]/;

export const parseNotes = (
  project: string,
  title: string,
  lines: BaseLine[],
): ParseResult => {
  const parsed: ParseResult = { notes: [] };
  if (lines.length === 0) return parsed;
  const packs = packRows(
    parseToRows(lines.map((line) => line.text).join("\n")),
    { hasTitle: true },
  );
  /** 分割されたコードブロックを結合するのに使う
   *
   * 1. `noteId`
   * 2. `lineId`
   * 3. `updated`
   * 4. `field`
   */
  const codes = new Map<string, [number, string, number, string]>();
  /** 現在読んでいる`pack.rows[0]`の行番号 */
  let counter = 0;
  for (const pack of packs) {
    switch (pack.type) {
      case "title":
        counter++;
        break;
      case "table":
        counter += pack.rows.length;
        break;
      case "line": {
        // iconがある行を雑に調べる
        const match = pack.rows[0].text.match(deckRegExp)?.[1];
        if (match) parsed.deckRef = parsePath(match, project);
        const match2 = pack.rows[0].text.match(noteTypeRegExp)?.[1];
        if (match2) parsed.noteTypeRef = parsePath(match2, project);
        counter++;
        break;
      }
      case "codeBlock": {
        // note id は、コードブロックを構成する行の作成日時のうち、一番古いものを採用する
        const noteId = Math.min(
          ...lines.slice(counter, counter + pack.rows.length).map((line) =>
            line.created * 1000
          ),
        );
        const lineId = lines[counter].id;
        const updated = Math.max(
          ...lines.slice(counter, counter + pack.rows.length).map((line) =>
            line.updated
          ),
        );
        counter += pack.rows.length;
        const codeBlock = convertToBlock(pack);
        if (codeBlock.type !== "codeBlock") throw SyntaxError();
        if (!codeBlock.fileName.endsWith(".note")) break;
        const guid = codeBlock.fileName.slice(0, -5);
        const prev = codes.get(guid);
        codes.set(
          guid,
          [
            noteId,
            lineId,
            updated * 1000,
            prev ? `${prev}\n${codeBlock.content}` : codeBlock.content,
          ],
        );
        break;
      }
    }
  }

  // codeblocksをnoteに変換する
  parsed.notes.push(...[...codes.entries()].map(
    ([guid, [noteId, lineId, updated, text]]) => ({
      guid,
      id: noteId,
      updated,
      fields: [
        // 改行は<br>に変換する
        text.replaceAll("\n", "<br>"),
        `https://scrapbox.io/${project}/${encodeTitleURI(title)}#${lineId}`,
      ],
      // textをさらにparseして、hashtagを取り出す
      tags: parse(text).flatMap((block) => {
        if (block.type !== "line") return [];
        return block.nodes.flatMap(
          (node) => getHashTags(node),
        );
      }),
    }),
  ));
  return parsed;
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

const parsePath = (path: string, defaultProject: string): Path => {
  const [, project, title] = path.match(/^\/([\w\-]+)\/(.+)$/) ?? [];
  return project && title
    ? { project, title }
    : { project: defaultProject, title: path };
};
