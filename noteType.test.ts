/// <reference lib="deno.ns" />

import { parseNoteType } from "./noteType.ts";
import { assertSnapshot } from "./deps/testing.ts";
import found from "./sample-noteType1.json" with { type: "json" };
import notFound from "./sample-deck1.json" with { type: "json" };
import splitted from "./sample-page1.json" with { type: "json" };

Deno.test("parseNoteType()", async (t) => {
  await t.step("not found", async (t) => {
    await assertSnapshot(t, parseNoteType(notFound));
  });
  await t.step("found", async (t) => {
    await assertSnapshot(t, parseNoteType(found));
  });
  await t.step("splitted", async (t) => {
    await assertSnapshot(t, parseNoteType(splitted));
  });
});
