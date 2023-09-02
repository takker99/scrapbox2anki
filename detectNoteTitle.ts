export interface NoteTitle {
  /** fieldの格納先noteのguid */
  guid: string;

  /** field name */
  name: string;

  /** scrapbox記法として扱うかどうか */
  isScrapboxSyntax: boolean;
}

/** コードブロックのタイトルからNoteのguidとfield nameを抽出する */
export const detectNoteTitle = (fileName: string): NoteTitle | undefined => {
  if (!fileName.includes(".note")) return;

  const [, trimmed, lang] = fileName.match(/^(.+)\(([^()]+)\)$/) ??
    [, fileName];
  const matched = trimmed.match(/^(.+?)\.note(?:|\.(.+))$/);
  if (!matched) return;

  const [, guid, name = ""] = matched;
  return { guid, name, isScrapboxSyntax: !lang };
};
