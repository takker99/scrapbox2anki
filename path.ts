import { toTitleLc } from "./deps/scrapbox.ts";

/** scrapboxのページを一意に特定するパス */
export interface Path {
  project: string;
  title: string;
}

/** /:project/:title 形式のパスから:projectと:titleを抜き出す。
 *
 * それ以外は、page titleをそのまま渡されたと解釈する。
 */
export const parsePath = (path: string, defaultProject: string): Path => {
  const [, project, title] = path.match(/^\/([\w\-]+)\/(.+)$/) ?? [];
  return project && title
    ? { project, title }
    : { project: defaultProject, title: path };
};

/** Pathの同一性判定 */
export const isSame = (left: Path, right: Path): boolean =>
  left.project === right.project &&
  toTitleLc(left.title) === toTitleLc(right.title);
