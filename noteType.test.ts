import { parseNoteType } from "./noteType.ts";
import { assertSnapshot } from "./deps/testing.ts";

Deno.test("parseNoteType()", async (t) => {
  await assertSnapshot(
    t,
    parseNoteType(
      `name,システム英単語用穴埋め問題
id,343480954545
isCloze,true
latex
css,https://scrapbox.io/api/code/takker/システム英単語用穴埋め問題案1/css`,
    ),
  );
});
