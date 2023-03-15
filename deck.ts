import type { Result } from "./deps/scrapbox.ts";
import { BaseLine } from "./deps/scrapbox.ts";
import type { Deck } from "./deps/deno-anki.ts";
import { packRows, parseToRows } from "./deps/scrapbox-parser.ts";

/** deckデータの書式が不正だったときに投げるエラー */
export interface InvalidDeckError {
  name: "InvalidDeckError";
  message: string;
}

/** ページ本文からDeckを抽出する
 *
 * @param lines メタデータつきページ本文
 * @return 解析結果。テーブルが見つからなければ`undefined`を返す
 */
export const parseDeck = (
  lines: BaseLine[],
): Result<Deck | undefined, InvalidDeckError> => {
  if (lines.length === 0) return { ok: true, value: undefined };
  const packs = packRows(
    parseToRows(lines.map((line) => line.text).join("\n")),
    { hasTitle: true },
  );

  /** deck id */
  let id: number | undefined;
  /** deck name */
  let name: string | undefined;
  /** deck description */
  let description: string | undefined;
  /** the updated time of the deck (UNIX time) */
  let updated = 0;

  /** 現在読んでいる`pack.rows[0]`の行番号 */
  let counter = 0;
  // deckが書かれたtableから各設定を読み出す
  for (const pack of packs) {
    switch (pack.type) {
      case "title":
      case "line":
        counter++;
        break;
      case "codeBlock":
        counter += pack.rows.length;
        break;
      case "table": {
        updated = Math.max(
          ...lines.slice(counter, counter + pack.rows.length).map((line) =>
            line.updated
          ),
          updated,
        );
        counter += pack.rows.length;
        // filenameが"deck"のもののみ通す
        if (!pack.rows[0].text.endsWith("deck")) break;
        const table = Object.fromEntries(
          pack.rows.map(({ text }) => text.trim().split(/\s+/)),
        ) as Record<string, string>;

        if (Object.hasOwn(table, "name") && !name) {
          if (!table.name) {
            return { ok: false, value: makeError("Deck name not found.") };
          }
          name = table.name;
        }
        if (Object.hasOwn(table, "id") && !id) {
          if (!table.id) {
            return { ok: false, value: makeError("Deck id not found.") };
          }
          const idNum = parseInt(table.id);
          if (isNaN(idNum)) {
            return { ok: false, value: makeError("Deck id is not number.") };
          }
          id = idNum;
        }
        description ??= table["description"];

        break;
      }
    }
  }

  return {
    ok: true,
    value: id && name ? { id, name, description, updated } : undefined,
  };
};

const makeError = (message: string): InvalidDeckError => ({
  name: "InvalidDeckError",
  message,
});
