import { assertSnapshot } from "./deps/testing.ts";
import { parseDeck } from "./deck.ts";

Deno.test("parseDeck()", async (t) => {
  await assertSnapshot(
    t,
    parseDeck(`id,44845749858349584
name,system-english
description,システム英単語系の問題集`),
  );
  await assertSnapshot(
    t,
    parseDeck(`id,44845749858349584
name,system-english`),
  );
  await assertSnapshot(
    t,
    parseDeck(`id,44845749858349584
name,
description,システム英単語系の問題集`),
  );
});
