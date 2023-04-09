import { installCDN } from "./installCDN.ts";
import type { InitSqlJsStatic } from "../../deps/sql.ts";

const version = "1.8.0";
const zipVersion = "3.10.1";
const wasmId = "6339056660dae0001f816bc1";

await Promise.all([
  installCDN(
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${version}/sql-wasm.min.js`,
    {
      id: "sqljs-cdn",
    },
  ),
  installCDN(
    `https://cdnjs.cloudflare.com/ajax/libs/jszip/${zipVersion}/jszip.min.js`,
    {
      id: "jszip-cdn",
    },
  ),
]);

declare const initSqlJs: InitSqlJsStatic;

// We must specify this locateFile function if we are loading a wasm file from anywhere other than the current html page's folder.
export const sql = await initSqlJs({
  locateFile: (file: string) =>
    file === "sql-wasm.wasm"
      ? `https://scrapbox.io/files/${wasmId}.wasm`
      : `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${version}/${file}`,
});
