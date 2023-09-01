/// <reference lib="deno.ns" />

import { parseNoteType } from "./noteType.ts";
import { assertSnapshot } from "./deps/testing.ts";
import lines from "./sample-noteType1.json" assert { type: "json" };

Deno.test("parseNoteType()", async (t) => {
  await assertSnapshot(t, parseNoteType(lines));
});
