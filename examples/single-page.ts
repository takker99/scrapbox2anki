/** 今開いているページ中の問題だけapkgに書き出す */

/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
// <reference lib="dom" />
import { confirmThenCreate } from "./utils/confirmThenCreate.ts";
import { getPage } from "../deps/scrapbox.ts";
import type { JSZip as JSZipType } from "../deps/jsZip.ts";
import { Scrapbox, useStatusBar } from "../deps/scrapbox-userscript.ts";
declare const scrapbox: Scrapbox;
declare const JSZip: typeof JSZipType;

await (async () => {
  if (scrapbox?.Layout !== "page") return;
  const { sql } = await import("./utils/prepare.ts");
  const project = scrapbox.Project.name;
  const { render, dispose } = useStatusBar();
  try {
    render({ type: "spinner" }, {
      type: "text",
      text: `loading /${project}/${scrapbox.Page.title}`,
    });
    const result = await getPage(project, scrapbox.Page.title);
    if (!result.ok) {
      console.error(result.value);
      alert(`${result.value.name} ${result.value.message}`);
      return;
    }
    render({ type: "spinner" }, {
      type: "text",
      text: `creating .apkg from /${project}/${scrapbox.Page.title}`,
    });

    const apkg = await confirmThenCreate(project, [result.value], {
      JSZip,
      sql,
    });
    if (!apkg) return;
    const url = URL.createObjectURL(
      new Blob([apkg], { type: "application/octet-stream" }),
    );

    render({ type: "check-circle" }, {
      type: "text",
      text: "created.",
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "cloze.apkg";
    a.download = `${project}.apkg`;
    a.style.display = "none";
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    setTimeout(dispose, 1000);
  }
})();
