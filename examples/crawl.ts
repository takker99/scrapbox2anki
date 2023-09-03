/** 前回実行時から更新された問題だけをapkgに書き出す */

/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
// <reference lib="dom" />
import { getCodeBlock, Page } from "../deps/scrapbox.ts";
import type { JSZip as JSZipType } from "../deps/jsZip.ts";
import { getAllUpdatedPages } from "./utils/getAllUpdatedPages.ts";
import { confirmThenCreate } from "./utils/confirmThenCreate.ts";
import { patch, Scrapbox, useStatusBar } from "../deps/scrapbox-userscript.ts";
declare const scrapbox: Scrapbox;
declare const JSZip: typeof JSZipType;

await (async () => {
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
    const res = await getCodeBlock(project, settingTitle, "json");

    if (!res.ok) return 0;
    try {
      const json = JSON.parse(res.value);
      if (typeof json.checked !== "number") return 0;
      return json.checked;
    } catch (e: unknown) {
      if (!(e instanceof SyntaxError)) throw e;
      return 0;
    }
  };

  /** apkgを書き出した日時を書き込む */
  const setChecked = (checked: number) =>
    patch(project, settingTitle, () => [
      settingTitle,
      "This page is automatically generated. DO NOT EDIT ANYTHING, WHITCH WILL BE OVERWRITTEN.",
      "",
      "code:json",
      ` ${JSON.stringify({ checked })}`,
    ]);

  const prevChecked = await getChecked();
  const checked = Math.floor(new Date().getTime() / 1000);
  const pages: Page[] = [];
  const promises: Promise<void>[] = [];
  let terminate = false;
  const { render, dispose } = useStatusBar();
  let animationId: number | undefined;
  const updateProgress = () => {
    if (animationId !== undefined) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(() => {
      render({ type: "spinner" }, {
        type: "text",
        text: `loading ${pages.length} pages updated after ${new Date(
          prevChecked * 1000,
        )}`,
      });
    });
  };
  try {
    for await (
      const [promise] of getAllUpdatedPages(project, prevChecked)
    ) {
      if (terminate) break;
      promises.push(promise.then((result) => {
        if (!result.ok) {
          console.error(result.value);
          alert(`${result.value.name} ${result.value.message}`);
          terminate = true;
          return;
        }
        pages.push(result.value);
        updateProgress();
      }));
    }
    await Promise.all(promises);

    const apkg = await confirmThenCreate(project, pages, { JSZip, sql });
    if (!apkg) return;

    render({ type: "spinner" }, {
      type: "text",
      text: `creating .apkg from ${pages.length} pages...`,
    });
    render({ type: "spinner" }, {
      type: "text",
      text: "created. updating .ankirc...",
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
