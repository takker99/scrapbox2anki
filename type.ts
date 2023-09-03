/** メタデータ付き行
 *
 * scrapbox2ankiで必要なものだけ抽出している
 */
export interface Line {
  text: string;
  id: string;
  created: number;
  updated: number;
}

/** ページデータ
 *
 * scrapbox2ankiで必要なものだけ抽出している
 */
export interface Page {
  title: string;
  created: number;
  updated: number;
  lines: Line[];
}
