import type { Result } from "./deps/scrapbox.ts";
import { Page } from "./type.ts";
import type { Field, NoteType, Template } from "./deps/deno-anki.ts";
import { parse } from "./deps/scrapbox-parser.ts";

/** note typeデータの書式が不正だったときに投げるエラー */
export interface InvalidNoteTypeError {
  name: "InvalidNoteTypeError";
  message: string;
}
/** note typeのJSONに文法エラーがあったときに投げるエラー */
export interface NoteTypeSyntaxError {
  name: "NoteTypeSyntaxError";
  message: string;
}
/** note typeが見つからなかったときに投げるエラー */
export interface NoteTypeNotFoundError {
  name: "NoteTypeNotFoundError";
  message: string;
}

export type NoteTypeError =
  | NoteTypeNotFoundError
  | InvalidNoteTypeError
  | NoteTypeSyntaxError;

/** scrapbox2ankiで自動生成するfields
 *
 * これらは以下の配列の順に末尾に自動挿入される。
 */
export const reservedFields: Field[] = [
  { name: "SourceURL", description: "問題の取得元URL" },
];

/** ページからNote Typeを抽出する
 *
 * @param page ページデータ
 * @return 解析結果
 */
export const parseNoteType = (
  page: Page,
): Result<NoteType, NoteTypeError> => {
  if (page.lines.length === 0) {
    return {
      ok: false,
      value: {
        name: "NoteTypeNotFoundError",
        message: "This is an empty page so no note type is found.",
      },
    };
  }
  const blocks = parse(
    page.lines.map((line) => line.text).join("\n"),
    { hasTitle: true },
  );

  /** 現在読んでいる`pack.rows[0]`の行番号 */
  let counter = 0;

  const fileName = "noteType.json";
  /** json text of deck setting */
  let json = "";
  const cssName = "css";
  let css = "";
  const latexPreName = "pre.tex";
  let latexPre = "";
  const latexPostName = "post.tex";
  let latexPost = "";
  const questionExt = ".question.html";
  const answerExt = ".answer.html";
  const templateMap = new Map<string, [string, string]>();

  // 設定を読み込む
  for (const block of blocks) {
    switch (block.type) {
      case "title":
      case "line":
        counter++;
        break;
      case "table":
        counter += block.cells.length + 1;
        break;
      case "codeBlock": {
        const lineCount = block.content.split("\n").length + 1;
        counter += lineCount;

        const fragment = `\n${block.content}`;
        switch (block.fileName) {
          case fileName:
            json += fragment;
            break;
          case cssName:
            css += fragment;
            break;
          case latexPreName:
            latexPre += fragment;
            break;
          case latexPostName:
            latexPost += fragment;
            break;
          default: {
            if (block.fileName.endsWith(questionExt)) {
              const name = [...block.fileName].slice(0, -questionExt.length)
                .join("");
              const template = templateMap.get(name) ?? ["", ""];
              template[0] += fragment;
              templateMap.set(name, template);
              break;
            }
            if (block.fileName.endsWith(answerExt)) {
              const name = [...block.fileName].slice(0, -answerExt.length)
                .join("");
              const template = templateMap.get(name) ?? ["", ""];
              template[1] += fragment;
              templateMap.set(name, template);
              break;
            }
            break;
          }
        }

        break;
      }
    }
  }

  // validation
  if (json.trim() === "") {
    return {
      ok: false,
      value: {
        name: "NoteTypeNotFoundError",
        message: "No note type settings found in the page.",
      },
    };
  }

  try {
    const noteType: unknown = JSON.parse(json);
    if (typeof noteType !== "object" || noteType == null) {
      return {
        ok: false,
        value: makeError("Note type setting must be an object."),
      };
    }
    if (!("name" in noteType)) {
      return { ok: false, value: makeError("Note type name is not found.") };
    }
    if (typeof noteType.name !== "string") {
      return { ok: false, value: makeError("Note type name must be string.") };
    }
    if (!("id" in noteType)) {
      return { ok: false, value: makeError("Note type id not found.") };
    }
    if (typeof noteType.id !== "number") {
      return { ok: false, value: makeError("Note type id must be number.") };
    }
    if (!("fields" in noteType)) {
      return { ok: false, value: makeError("Note type must have fields.") };
    }
    if (!Array.isArray(noteType.fields)) {
      return { ok: false, value: makeError("`fields` must be an array.") };
    }
    // verify fields
    const fields: Field[] = [];
    for (const fld of noteType.fields) {
      const field: unknown = fld;
      switch (typeof field) {
        case "string":
          if (reservedFields.some(({ name }) => field === name)) break;
          fields.push({ name: field });
          break;
        case "object": {
          if (field == null || !("name" in field)) {
            return {
              ok: false,
              value: makeError("Each field object must have `name`."),
            };
          }
          if (typeof field.name !== "string") {
            return {
              ok: false,
              value: makeError("The name of a field must be a string."),
            };
          }
          if (reservedFields.some(({ name }) => field.name === name)) break;
          const item: Field = { name: field.name };

          if ("description" in field) {
            if (typeof field.description !== "string") {
              return {
                ok: false,
                value: makeError(
                  "The description of a field must be a string.",
                ),
              };
            }
            item.description = field.description;
          }
          if ("rtl" in field) {
            if (typeof field.rtl !== "boolean") {
              return {
                ok: false,
                value: makeError(
                  "The rtl of a field must be a boolean.",
                ),
              };
            }
            item.rtl = field.rtl;
          }
          if ("font" in field) {
            if (typeof field.font !== "string") {
              return {
                ok: false,
                value: makeError(
                  "The font of a field must be a string.",
                ),
              };
            }
            item.font = field.font;
          }
          if ("fontSize" in field) {
            if (typeof field.fontSize !== "number") {
              return {
                ok: false,
                value: makeError(
                  "The fontSize of a field must be a number.",
                ),
              };
            }
            item.fontSize = field.fontSize;
          }

          fields.push(item);
          break;
        }
        default:
          return {
            ok: false,
            value: makeError(
              "Members of `fields` must be a string or an object.",
            ),
          };
      }
    }
    fields.push(...reservedFields);
    // verify templates
    const templates: Template[] = [];
    if (templateMap.size === 0) {
      return {
        ok: false,
        value: makeError("Note type must have one or more template."),
      };
    }
    for (const [name, [question, answer]] of templateMap.entries()) {
      if (question.trim() === "") {
        return {
          ok: false,
          value: makeError(`"${name}${questionExt}" is empty.`),
        };
      }
      if (answer.trim() === "") {
        return {
          ok: false,
          value: makeError(`"${name}${answerExt}" is empty.`),
        };
      }
      templates.push({ name, question, answer });
    }

    const noteType_: NoteType = {
      name: noteType.name,
      id: noteType.id,
      updated: page.updated,
      fields,
      templates,
    };

    // set optional values
    if (css.trim() !== "") noteType_.css = css;
    if (latexPre.trim() !== "" && latexPost.trim() !== "") {
      noteType_.latex = [latexPre, latexPost];
    }
    if ("isCloze" in noteType) {
      if (typeof noteType.isCloze !== "boolean") {
        return { ok: false, value: makeError("`isCloze` must be number.") };
      }
      noteType_.isCloze = noteType.isCloze;
    }

    return {
      ok: true,
      value: noteType_,
    };
  } catch (e: unknown) {
    if (e instanceof SyntaxError) {
      return {
        ok: false,
        value: { name: "NoteTypeSyntaxError", message: e.message },
      };
    }
    throw e;
  }
};

const makeError = (message: string): InvalidNoteTypeError => ({
  name: "InvalidNoteTypeError",
  message,
});
