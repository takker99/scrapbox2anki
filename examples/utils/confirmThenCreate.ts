import { Page } from "../../type.ts";
import { makeNotes } from "../../mod.ts";
import { makeCollection, makePackage } from "../../deps/deno-anki.ts";
import type { JSZip as JSZipType } from "../../deps/jsZip.ts";
import { SqlJsStatic } from "../../deps/sql.ts";

export interface ConfirmThenCreateInit {
  JSZip: typeof JSZipType;
  sql: SqlJsStatic;
}

/** apkg作成の流れをひとまとめにしたもの
 *
 * 警告とエラーがあれば確認画面を表示し、okのときのみapkgを作成する
 */
export const confirmThenCreate = async (
  project: string,
  pages: Page[],
  init: ConfirmThenCreateInit,
): Promise<Blob | undefined> => {
  const { notes, warnings, errors } = await makeNotes(project, pages);
  if (warnings.size > 0 || errors.size > 0) {
    const lines = [
      `There are ${warnings.size} warnings and ${errors.size} errors.`,
      "",
      "Warnings:",
      "\t(page), (has deck?), (has note type?), (skipped)",
      ...[...warnings.entries()].map((
        [path, warning],
      ) =>
        [
          `\t${path}`,
          warning.deckNotSpecified ? "x" : "o",
          warning.noteTypeNotSpecified ? "x" : "o",
          warning.skipped,
        ].join("\n")
      ),
      "",
      "Errors",
      ...[...errors.entries()].map((
        [path, error],
      ) => `\t${path}\t${error.name}: ${error.message}`),
      "",
      "Do you want to create .apkg?",
    ];
    if (!globalThis.confirm(lines.join("\n"))) return;
  }

  return makePackage(
    makeCollection(notes, init.sql),
    {},
    //@ts-ignore 外部moduleが使っているJSZipのversionの食い違いで、どうしても型エラーが生じてしまう
    init.JSZip,
  );
};
