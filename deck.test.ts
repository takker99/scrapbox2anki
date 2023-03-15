import { assertSnapshot } from "./deps/testing.ts";
import { parseDeck } from "./deck.ts";
import lines from "./sample-deck1.json" assert { type: "json" };

Deno.test("parseDeck()", async (t) => {
  await assertSnapshot(t, parseDeck(lines));
});
