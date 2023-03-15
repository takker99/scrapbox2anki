import type { Result } from "./deps/scrapbox.ts";
import { BaseLine } from "./deps/scrapbox.ts";
import type { NoteType } from "./deps/deno-anki.ts";
import { packRows, parseToRows } from "./deps/scrapbox-parser.ts";

/** note typeデータの書式が不正だったときに投げるエラー */
export interface InvalidNoteTypeError {
  name: "InvalidNoteTypeError";
  message: string;
}

/** 既定のNote type */
export const defaultNoteType: NoteType = {
  name: "Basic (Cloze)",
  id: 1677417085373,
  fields: [
    { name: "Text", description: "問題文" },
    { name: "SourceURL", description: "問題の取得元URL" },
  ],
  isCloze: true,
  templates: [{
    name: "Card 1",
    answer: '{{cloze:Text}}<br><a href="{{SourceURL}}">source</a>',
    question: "{{cloze:Text}}\n{{type:Text}}",
  }],
  css: `.card {
  display: flex;
  justify-content: center;
  font-family: arial;
  font-size: 20px;
  color: black;
  background-color: white;
}
.cloze {
  font-weight: bold;
  color: blue;
}
.nightMode .cloze {
  color: lightblue;
}`,
};

export const parseNoteType = (
  lines: BaseLine[],
): Result<NoteType | undefined, InvalidNoteTypeError> => {
  if (lines.length === 0) return { ok: true, value: undefined };
  const packs = packRows(
    parseToRows(lines.map((line) => line.text).join("\n")),
    { hasTitle: true },
  );

  /** note type id */
  let id: number | undefined;
  /** note type name */
  let name: string | undefined;
  /** the updated time of the note type (UNIX time) */
  let updated = 0;
  let answer: string | undefined;
  let question: string | undefined;

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
        // filenameが"note type"のもののみ通す
        if (!pack.rows[0].text.endsWith("note type")) break;
        const table = Object.fromEntries(
          pack.rows.map(({ text }) => text.trim().split(/\s+/)),
        ) as Record<string, string>;

        if (Object.hasOwn(table, "name") && !name) {
          if (!table.name) {
            return { ok: false, value: makeError("Note type name not found.") };
          }
          name = table.name;
        }
        if (Object.hasOwn(table, "id") && !id) {
          if (!table.id) {
            return { ok: false, value: makeError("Note type id not found.") };
          }
          const idNum = parseInt(table.id);
          if (isNaN(idNum)) {
            return {
              ok: false,
              value: makeError("Note type id is not number."),
            };
          }
          id = idNum;
        }
        if (Object.hasOwn(table, "answer") && !answer) {
          if (!table.answer) {
            return {
              ok: false,
              value: makeError("answer not found."),
            };
          }
          answer = table.answer;
        }
        if (Object.hasOwn(table, "question") && !question) {
          if (!table.question) {
            return {
              ok: false,
              value: makeError("question not found."),
            };
          }
          question = table.question;
        }

        break;
      }
    }
  }

  return {
    ok: true,
    value: id && name
      ? {
        name,
        id,
        updated,
        // 今回は穴埋め特化のMVPを作るので、fieldは決め打ちにする
        fields: structuredClone(defaultNoteType.fields),
        isCloze: true,
        templates: [{
          name: "Card 1",
          answer: answer ?? defaultNoteType.templates[0].answer,
          question: question ?? defaultNoteType.templates[0].question,
        }],
        css: defaultNoteType.css,
      }
      : undefined,
  };
};

const makeError = (message: string): InvalidNoteTypeError => ({
  name: "InvalidNoteTypeError",
  message,
});
