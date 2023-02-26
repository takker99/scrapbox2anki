import type { Result } from "./deps/scrapbox.ts";
import { parse } from "./deps/csv.ts";
import type { Deck } from "./deps/deno-anki.ts";

/** deckデータの書式が不正だったときに投げるエラー */
export interface InvalidDeckError {
  name: "InvalidDeckError";
  message: string;
}

export const parseDeck = (csv: string): Result<Deck, InvalidDeckError> => {
  const data = parse(csv);
  const csvData = new Map<string, string>(data.map(([f, s]) => [f, s]));
  const name = csvData.get("name");
  if (!name) return { ok: false, value: makeError("Deck name not found.") };
  const id_ = csvData.get("id");
  if (!id_) return { ok: false, value: makeError("Deck id not found.") };
  const id = parseInt(id_);
  if (isNaN(id)) {
    return { ok: false, value: makeError("Deck id is not number.") };
  }

  const deck: Deck = { name, id };
  const description = csvData.get("description");
  if (description) deck.description = description;

  return { ok: true, value: deck };
};

const makeError = (message: string): InvalidDeckError => ({
  name: "InvalidDeckError",
  message,
});
