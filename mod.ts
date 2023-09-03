import {
  getPage,
  NotFoundError,
  NotLoggedInError,
  NotMemberError,
  Result,
  TooLongURIError,
} from "./deps/scrapbox.ts";
import { Deck, Note, NoteType } from "./deps/deno-anki.ts";
import { Path } from "./path.ts";
import { Page } from "./type.ts";
import { parseNotes } from "./note.ts";
import { DeckError, parseDeck } from "./deck.ts";
import { NoteTypeError, parseNoteType } from "./noteType.ts";

export type NetworkError =
  | NotFoundError
  | NotLoggedInError
  | NotMemberError
  | TooLongURIError;

export type DeckResult = Result<Deck, DeckError | NetworkError>;
export type { DeckError, NoteTypeError };

/** 読み込んだdecksのcache
 *
 * Promiseを入れることで、重複読み込みを避ける
 */
const decks = new Map<Key, Promise<DeckResult>>();

/** 指定されたdeckをcacheから読み込む
 *
 * cacheになければfetchする
 */
const getDeck = (path: Path): Promise<DeckResult> => {
  const deck = decks.get(toKey(path));
  // すでにfetch中のがあれば、それを待つ
  if (deck) return deck;

  const promise = (async () => {
    const result = await getPage(path.project, path.title);
    if (!result.ok) return result;
    return parseDeck(result.value);
  })();
  decks.set(toKey(path), promise);
  return promise;
};

type NoteTypeResult = Result<NoteType, NoteTypeError | NetworkError>;

/** 読み込んだnote typesのcache
 *
 * Promiseを入れることで、重複読み込みを避ける
 */
const noteTypes = new Map<Key, Promise<NoteTypeResult>>();

/** 指定されたnote typeをcacheから読み込む
 *
 * cacheになければfetchする
 */
const getNoteType = (path: Path): Promise<NoteTypeResult> => {
  const noteType = noteTypes.get(toKey(path));
  // すでにfetch中のがあれば、それを待つ
  if (noteType) return noteType;

  const promise = (async () => {
    const result = await getPage(path.project, path.title);
    if (!result.ok) return result;
    return parseNoteType(result.value);
  })();
  noteTypes.set(toKey(path), promise);
  return promise;
};

export interface Warning {
  /** deckが指定されていなかった */
  deckNotSpecified: boolean;

  /** note typeが指定されていなかった */
  noteTypeNotSpecified: boolean;

  /** 読み込みを飛ばしたnotes */
  skipped: number;
}

export interface MakeNoteResult {
  /** 与えられたページから抽出されたnotes */
  notes: Note[];

  /** 各ページ毎に集計した警告 */
  warnings: Map<`/${string}/${string}`, Warning>;

  /** deckやnote typeの読み込みエラー */
  errors: Map<Key, DeckError | NoteTypeError | NetworkError>;
}

/** ページを解析してAnkiのnotesを作る
 *
 * @param project ページが所属するproject name
 * @param pages 解析したいページ
 * @return 解析結果
 */
export const makeNotes = async (
  project: string,
  pages: Page[],
): Promise<MakeNoteResult> => {
  const warnings = new Map<Key, Warning>();
  const errors = new Map<Key, DeckError | NoteTypeError | NetworkError>();
  const notes: Note[] = [];

  for (const page of pages) {
    const key = toKey({ project, title: page.title });
    const warning: Warning = warnings.get(key) ??
      { deckNotSpecified: false, noteTypeNotSpecified: false, skipped: 0 };
    const parsedNotes = parseNotes(
      project,
      page.title,
      page.lines,
    );

    for (let i = 0; i < parsedNotes.length; i++) {
      const note = parsedNotes[i];
      if (!note.deck || !note.noteType) {
        if (!note.deck) {
          console.warn(`Deck is specified in ${key}`);
          warning.deckNotSpecified = true;
        }
        if (!note.noteType) {
          console.warn(`Note type is specified in ${key}`);
          warning.noteTypeNotSpecified = true;
        }
        warning.skipped = parsedNotes.length - i;
        break;
      }
      const deckRes = await getDeck(note.deck);
      if (!deckRes.ok) {
        console.warn(`${deckRes.value.name} ${deckRes.value.message}`);
        errors.set(toKey(note.deck), deckRes.value);
        warning.skipped = parsedNotes.length - i;
        break;
      }
      const deck = deckRes.value;
      const noteTypeRes = await getNoteType(note.noteType!);
      if (!noteTypeRes.ok) {
        console.warn(
          `${noteTypeRes.value.name} ${noteTypeRes.value.message}`,
        );
        errors.set(toKey(note.noteType), noteTypeRes.value);
        warning.skipped = parsedNotes.length - i;
        break;
      }
      const noteType = noteTypeRes.value;

      // unnamed fieldを先頭に持っていく
      const fields = noteType.fields.map((field, i) => {
        const name = typeof field === "string" ? field : field.name;
        const content = note.fields.get(name);
        return i === 0 ? content ?? note.fields.get("") ?? "" : content ?? "";
      });

      notes.push({
        guid: note.guid,
        id: note.id,
        updated: note.updated,
        tags: note.tags,
        fields,
        deck,
        noteType,
      });
    }
    if (
      warning.deckNotSpecified || warning.noteTypeNotSpecified ||
      warning.skipped > 0
    ) {
      warnings.set(key, warning);
    }
  }

  return { notes, warnings, errors };
};

type Key = `/${string}/${string}`;
const toKey = (path: Path): Key => `/${path.project}/${path.title}`;
