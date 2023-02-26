import type { Result } from "./deps/scrapbox.ts";
import { parse } from "./deps/csv.ts";
import type { NoteType } from "./deps/deno-anki.ts";

/** note typeデータの書式が不正だったときに投げるエラー */
export interface InvalidNoteTypeError {
  name: "InvalidNoteTypeError";
  message: string;
}

export const parseNoteType = (
  csv: string,
): Result<NoteType, InvalidNoteTypeError> => {
  const data = parse(csv);
  const csvData = new Map<string, string>(data.map(([f, s]) => [f, s]));
  const name = csvData.get("name");
  if (!name) {
    return { ok: false, value: makeError("Note Type name not found.") };
  }
  const id_ = csvData.get("id");
  if (!id_) return { ok: false, value: makeError("Note Type id not found.") };
  const id = parseInt(id_);
  if (isNaN(id)) {
    return { ok: false, value: makeError("Note Type id is not number.") };
  }

  const answer = csvData.get("answer") ??
    '{{cloze:Text}}<br><a href="{{SourceURL}}">source</a>';
  const question = csvData.get("question") ?? "{{cloze:Text}}\n{{type:Text}}";
  const noteType: NoteType = {
    name,
    id,
    // 今回は穴埋め特化のMVPを作るので、fieldは決め打ちにする
    fields: [
      { name: "Text", description: "問題文" },
      { name: "SourceURL", description: "問題の取得元URL" },
    ],
    isCloze: true,
    templates: [{
      name: "Card 1",
      answer,
      question,
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
  // updatedは/api/table/だけからは計算しにくいので省略する

  return { ok: true, value: noteType };
};

const makeError = (message: string): InvalidNoteTypeError => ({
  name: "InvalidNoteTypeError",
  message,
});
