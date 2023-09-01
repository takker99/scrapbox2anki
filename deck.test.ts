/// <reference lib="deno.ns" />

import { assertSnapshot } from "./deps/testing.ts";
import { parseDeck } from "./deck.ts";
import lines from "./sample-deck1.json" assert { type: "json" };
import lines2 from "./sample-page1.json" assert { type: "json" };

Deno.test("parseDeck()", async (t) => {
  await t.step("not found", async (t) => {
    await assertSnapshot(t, parseDeck(lines));
  });
  await t.step("found", async (t) => {
    await assertSnapshot(t, parseDeck(lines2));
  });
});
