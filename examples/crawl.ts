/** 前回実行時から更新された問題だけをapkgに書き出す */

/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
// <reference lib="dom" />
import { makeApkg } from "../mod.ts";
import { getPage, Page } from "../deps/scrapbox.ts";
import type { JSZip as JSZipType } from "../deps/jsZip.ts";
import { getAllUpdatedPages } from "./utils/getAllUpdatedPages.ts";
import { patch, Scrapbox, useStatusBar } from "../deps/scrapbox-userscript.ts";
declare const scrapbox: Scrapbox;
declare const JSZip: typeof JSZipType;

(async () => {
  if (!scrapbox) return;
  const { sql } = await import("./utils/prepare.ts");

  /** cache dataを書き込むページ
   *
   * ここに書き込まれたものは全て上書きされる
   */
  const settingTitle = ".ankirc";
  const project = scrapbox.Project.name;

  /** 前回apkgを書き出した日時を得る */
  const getChecked = async () => {
    const res = await getPage(project, settingTitle);

    if (!res.ok) return 0;
    const checked = res.value.lines.find((line) => /^\d+$/.test(line.text))
      ?.text ?? "0";
    return parseInt(checked);
  };

  /** apkgを書き出した日時を書き込む */
  const setChecked = (checked: number) =>
    patch(project, settingTitle, () => [
      settingTitle,
      "This page is automatically generated. DO NOT EDIT ANYTHING, WHITCH WILL BE OVERWRITTEN.",
      "",
      `${checked}`,
    ]);

  const prevChecked = await getChecked();
  const checked = Math.floor(new Date().getTime() / 1000);
  const pages: Page[] = [];
  const { render, dispose } = useStatusBar();
  try {
    for await (
      const result of getAllUpdatedPages(project, prevChecked)
    ) {
      if (!result.ok) {
        console.error(result.value);
        alert(`${result.value.name} ${result.value.message}`);
        return;
      }
      pages.push(result.value);
      render({ type: "spinner" }, {
        type: "text",
        text: `loading ${pages.length} pages updated after ${new Date(
          prevChecked * 1000,
        )}`,
      });
    }

    render({ type: "spinner" }, {
      type: "text",
      text: `creating .apkg from ${pages.length} pages`,
    });

    const { value: apkg } = await makeApkg(project, pages, {
      jsZip: JSZip,
      sql,
    });
    render({ type: "spinner" }, {
      type: "text",
      text: "created. updating .ankirc",
    });
    await setChecked(checked);
    render({ type: "check-circle" }, {
      type: "text",
      text: "successfully finished.",
    });

    const url = URL.createObjectURL(
      new Blob([apkg], { type: "application/octet-stream" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project}.apkg`;
    a.style.display = "none";
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    setTimeout(dispose, 1000);
  }
})();
