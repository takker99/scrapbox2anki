import { assertSnapshot } from "./deps/testing.ts";
import json from "./sample-page.json" with { type: "json" };
import { parseNotes } from "./note.ts";

Deno.test("parseNotes", async (t) => {
  const { title, lines } = json;
  await assertSnapshot(t, parseNotes("takker-dist", title, lines)[0]);
});
