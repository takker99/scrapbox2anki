import type { Result } from "./deps/scrapbox.ts";
import type { BaseLine } from "./deps/scrapbox.ts";
import type { Deck } from "./deps/deno-anki.ts";
import {
  convertToBlock,
  packRows,
  parseToRows,
} from "./deps/scrapbox-parser.ts";

/** deckデータの書式が不正だったときに投げるエラー */
export interface InvalidDeckError {
  name: "InvalidDeckError";
  message: string;
}
/** deckが見つからなかったときに投げるエラー */
export interface DeckNotFoundError {
  name: "DeckNotFoundError";
  message: string;
}

/** ページ本文からDeckを抽出する
 *
 * @param lines メタデータつきページ本文
 * @return 解析結果。テーブルが見つからなければ`undefined`を返す
 */
export const parseDeck = (
  lines: BaseLine[],
): Result<Deck, InvalidDeckError | DeckNotFoundError> => {
  if (lines.length === 0) {
    return {
      ok: false,
      value: {
        name: "DeckNotFoundError",
        message: "This is an empty page so no deck is found.",
      },
    };
  }
  const packs = packRows(
    parseToRows(lines.map((line) => line.text).join("\n")),
    { hasTitle: true },
  );

  /** json text of deck setting */
  let json = "";
  /** the updated time of the deck (UNIX time) */
  let updated = 0;
  /** 現在読んでいる`pack.rows[0]`の行番号 */
  let counter = 0;
  const fileName = "deck.json";

  // 設定を読み込む
  for (const pack of packs) {
    switch (pack.type) {
      case "title":
      case "line":
        counter++;
        break;
      case "table":
        counter += pack.rows.length;
        break;
      case "codeBlock": {
        updated = Math.max(
          ...lines.slice(counter, counter + pack.rows.length).map((line) =>
            line.updated
          ),
          updated,
        );
        counter += pack.rows.length;

        const block = convertToBlock(pack);
        if (block.type !== "codeBlock") throw Error("Must be a codeblock");
        if (!block.fileName.endsWith(fileName)) break;

        json += `\n${block.content}`;

        break;
      }
    }
  }

  // validation
  if (json.trim() === "") {
    return {
      ok: false,
      value: {
        name: "DeckNotFoundError",
        message: "No deck settings found in the page.",
      },
    };
  }
  try {
    const deck: unknown = JSON.parse(json);
    if (typeof deck !== "object" || deck == null) {
      return { ok: false, value: makeError("Deck setting must be an object.") };
    }
    if (!("name" in deck)) {
      return { ok: false, value: makeError("Deck name is not found.") };
    }
    if (typeof deck.name !== "string") {
      return { ok: false, value: makeError("Deck name must be string.") };
    }
    if (!("id" in deck)) {
      return { ok: false, value: makeError("Deck id not found.") };
    }
    if (typeof deck.id !== "number") {
      return { ok: false, value: makeError("Deck id must be number.") };
    }
    if (
      "description" in deck && typeof deck.description !== "string"
    ) {
      return {
        ok: false,
        value: makeError("Deck description must be string."),
      };
    }
    return {
      ok: true,
      value: {
        id: deck.id,
        name: deck.name,
        updated,
        ...("description" in deck
          ? { description: deck.description as string }
          : {}),
      },
    };
  } catch (e: unknown) {
    if (e instanceof SyntaxError) {
      return {
        ok: false,
        value: makeError(e.message),
      };
    }
    throw e;
  }
};

const makeError = (message: string): InvalidDeckError => ({
  name: "InvalidDeckError",
  message,
});
