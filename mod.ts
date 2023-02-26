import {
  getTable,
  NotFoundError,
  NotLoggedInError,
  NotMemberError,
  Page,
  Result,
} from "./deps/scrapbox.ts";
import {
  Deck,
  makeCollection,
  makePackage,
  NoteType,
} from "./deps/deno-anki.ts";
import { JSZip } from "./deps/jsZip.ts";
import { SqlJsStatic } from "./deps/sql.ts";
import { parseNotes, Path } from "./note.ts";
import { InvalidDeckError, parseDeck } from "./deck.ts";
import { InvalidNoteTypeError, parseNoteType } from "./noteType.ts";

/** 既定のdeck */
const defaultDeck: Deck = {
  name: "default",
  id: 1,
};

/** 既定のNote type */
// @ts-ignore NoteTypeしか帰ってこないはず
const defaultNoteType: NoteType = parseNoteType(`name,Basic (Cloze)
id,1677417085373
isCloze,true`).value;

type DeckResult = Result<
  Deck,
  InvalidDeckError | NotFoundError | NotLoggedInError | NotMemberError
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
    const result = await getTable(path.project, path.title, "deck");
    if (!result.ok) return result;
    return parseDeck(result.value);
  })();
  decks.set(toKey(path), promise);
  return promise;
};

type NoteTypeResult = Result<
  NoteType,
  InvalidNoteTypeError | NotFoundError | NotLoggedInError | NotMemberError
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
    const result = await getTable(path.project, path.title, "note type");
    if (!result.ok) return result;
    return parseNoteType(result.value);
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
  const notes = (await Promise.all(pages.map(async (page) => {
    const { deckRef, noteTypeRef, notes: notes_ } = parseNotes(
      project,
      page.title,
      page.lines,
    );

    const deckRes = await getDeck(deckRef);
    if (!deckRes.ok) {
      console.warn(`${deckRes.value.name} ${deckRes.value.message}`);
    }
    const deck = deckRes.ok ? deckRes.value : defaultDeck;
    const noteTypeRes = await getNoteType(noteTypeRef);
    if (!noteTypeRes.ok) {
      console.warn(`${noteTypeRes.value.name} ${noteTypeRes.value.message}`);
    }
    const noteType = noteTypeRes.ok ? noteTypeRes.value : defaultNoteType;
    return notes_.map((note) => ({ deck, noteType, ...note }));
  }))).flat();

  return {
    ok: true,
    value: await makePackage(
      makeCollection(notes, init.sql),
      {},
      init.jsZip,
    ),
  };
};

type Key = `/${string}/${string}`;
const toKey = (path: Path): Key => `/${path.project}/${path.title}`;
