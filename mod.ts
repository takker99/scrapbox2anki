import {
  getPage,
  NotFoundError,
  NotLoggedInError,
  NotMemberError,
  Page,
  Result,
  TooLongURIError,
} from "./deps/scrapbox.ts";
import {
  Deck,
  makeCollection,
  makePackage,
  NoteType,
} from "./deps/deno-anki.ts";
import { JSZip } from "./deps/jsZip.ts";
import { SqlJsStatic } from "./deps/sql.ts";
import { Path } from "./path.ts";
import { parseNotes } from "./note.ts";
import { DeckNotFoundError, InvalidDeckError, parseDeck } from "./deck.ts";
import {
  InvalidNoteTypeError,
  NoteTypeNotFoundError,
  parseNoteType,
} from "./noteType.ts";

/** 既定のdeck */
const defaultDeck: Deck = {
  name: "default",
  id: 1,
};

/** 既定のNote type */
export const defaultNoteType: NoteType = {
  name: "Basic (Cloze)",
  id: 1677417085373,
  fields: [
    { name: "Text", description: "問題文" },
    { name: "SourceURL", description: "問題の取得元URL" },
  ],
  isCloze: true,
  templates: [{
    name: "Card 1",
    answer: '{{cloze:Text}}<br><a href="{{SourceURL}}">source</a>',
    question: "{{cloze:Text}}\n{{type:Text}}",
  }],
};

type DeckResult = Result<
  Deck,
  | DeckNotFoundError
  | InvalidDeckError
  | NotFoundError
  | NotLoggedInError
  | NotMemberError
  | TooLongURIError
>;

/** 読み込んだdecksのcache
 *
 * Promiseを入れることで、重複読み込みを避ける
 */
const decks = new Map<Key, Promise<DeckResult>>();

/** 指定されたdeckをcacheから読み込む
 *
 * cacheになければfetchする
 *
 * `path`が`undefined`のときはdefaultのdeckを返す
 */
const getDeck = (path: Path | undefined): Promise<DeckResult> => {
  if (!path) return Promise.resolve({ ok: true, value: defaultDeck });
  const deck = decks.get(toKey(path));
  // すでにfetch中のがあれば、それを待つ
  if (deck) return deck;

  const promise = (async () => {
    const result = await getPage(path.project, path.title);
    if (!result.ok) return result;
    return parseDeck(result.value.lines);
  })();
  decks.set(toKey(path), promise);
  return promise;
};

type NoteTypeResult = Result<
  NoteType,
  | NoteTypeNotFoundError
  | InvalidNoteTypeError
  | NotFoundError
  | NotLoggedInError
  | NotMemberError
  | TooLongURIError
>;

/** 読み込んだnote typesのcache
 *
 * Promiseを入れることで、重複読み込みを避ける
 */
const noteTypes = new Map<Key, Promise<NoteTypeResult>>();

/** 指定されたnote typeをcacheから読み込む
 *
 * cacheになければfetchする
 */
const getNoteType = (path: Path | undefined): Promise<NoteTypeResult> => {
  if (!path) return Promise.resolve({ ok: true, value: defaultNoteType });
  const noteType = noteTypes.get(toKey(path));
  // すでにfetch中のがあれば、それを待つ
  if (noteType) return noteType;

  const promise = (async () => {
    const result = await getPage(path.project, path.title);
    if (!result.ok) return result;
    return parseNoteType(result.value.lines);
  })();
  noteTypes.set(toKey(path), promise);
  return promise;
};

export interface MakeApkgInit {
  jsZip: typeof JSZip;
  sql: SqlJsStatic;
}

export const makeApkg = async (
  project: string,
  pages: Page[],
  init: MakeApkgInit,
): Promise<{ ok: true; value: Blob }> => {
  const notes = (await Promise.all(pages.map((page) => {
    const notes = parseNotes(
      project,
      page.title,
      page.lines,
    );

    return Promise.all(notes.map(async (note) => {
      const deckRes = await getDeck(note.deck);
      if (!deckRes.ok) {
        console.warn(`${deckRes.value.name} ${deckRes.value.message}`);
      }
      const deck = deckRes.ok ? (deckRes.value ?? defaultDeck) : defaultDeck;

      const noteTypeRes = await getNoteType(note.noteType);
      if (!noteTypeRes.ok) {
        console.warn(`${noteTypeRes.value.name} ${noteTypeRes.value.message}`);
      }
      const noteType = noteTypeRes.ok
        ? (noteTypeRes.value ?? defaultNoteType)
        : defaultNoteType;

      const fields = noteType.fields.map((field, i) => {
        const name = typeof field === "string" ? field : field.name;
        const content = note.fields.get(name);
        return i === 0 ? content ?? note.fields.get("") ?? "" : content ?? "";
      });

      return {
        guid: note.guid,
        id: note.id,
        updated: note.updated,
        tags: note.tags,
        fields,
        deck,
        noteType,
      };
    }));
  }))).flat();

  return {
    ok: true,
    value: await makePackage(
      makeCollection(notes, init.sql),
      {},
      //@ts-ignore 外部moduleが使っているJSZipのversionの食い違いで、どうしても型エラーが生じてしまう
      init.jsZip,
    ),
  };
};

type Key = `/${string}/${string}`;
const toKey = (path: Path): Key => `/${path.project}/${path.title}`;
