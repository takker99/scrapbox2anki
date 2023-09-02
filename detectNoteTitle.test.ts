/// <reference lib="deno.ns" />

import { detectNoteTitle, NoteTitle } from "./detectNoteTitle.ts";
import { assertEquals } from "./deps/testing.ts";

Deno.test("detectNoteTitle()", async (t) => {
  const testCases: [string, NoteTitle | undefined][] = [
    ["javascript", undefined],
    ["javascript(ts)", undefined],
    ["(ts)", undefined],
    ["jK99#2pa.note", { guid: "jK99#2pa", name: "", isScrapboxSyntax: true }],
    ["jK99#2pa.note()", undefined],
    ["jK99#2pa.nota", undefined],
    ["jK99#2pa.note(txt)", {
      guid: "jK99#2pa",
      name: "",
      isScrapboxSyntax: false,
    }],
    [".note", undefined],
    ["jK99#2pa.note.description", {
      guid: "jK99#2pa",
      name: "description",
      isScrapboxSyntax: true,
    }],
    ["jK99#2pa.note.image and audio", {
      guid: "jK99#2pa",
      name: "image and audio",
      isScrapboxSyntax: true,
    }],
    ["jK99#2pa.note.test.note", {
      guid: "jK99#2pa",
      name: "test.note",
      isScrapboxSyntax: true,
    }],
    ["jK99#2pa.note.answer()", {
      guid: "jK99#2pa",
      name: "answer()",
      isScrapboxSyntax: true,
    }],
    ["jK99#2pa.note.answer(txt)", {
      guid: "jK99#2pa",
      name: "answer",
      isScrapboxSyntax: false,
    }],
    ["jK99#2pa.note.answer(txt)aa", {
      guid: "jK99#2pa",
      name: "answer(txt)aa",
      isScrapboxSyntax: true,
    }],
  ];

  for (const [input, output] of testCases) {
    await t.step(input, () => assertEquals(detectNoteTitle(input), output));
  }
});
