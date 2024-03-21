/// <reference lib="deno.ns" />

import { assertSnapshot } from "./deps/testing.ts";
import { parseDeck } from "./deck.ts";
import page1 from "./sample-deck1.json" with { type: "json" };
import page2 from "./sample-page1.json" with { type: "json" };

Deno.test("parseDeck()", async (t) => {
  await t.step("not found", async (t) => {
    await assertSnapshot(t, parseDeck(page1));
  });
  await t.step("found", async (t) => {
    await assertSnapshot(t, parseDeck(page2));
  });
});
