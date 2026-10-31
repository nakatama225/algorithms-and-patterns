/**
 * 格子と幅優先の最短経路 — 1本の配列で持つ格子と、最初の目的地までの最短経路。
 *
 * - `Grid`：格子の入れ物。左上から行ごとに並べた1本の配列で持つ。外を読むと、作るときに決めた値
 *   （`outside`）を返し、外へ書くと止まる
 * - `findPath`：重みの無い格子で、条件を満たす最初のマスまでの最短経路を、幅優先で求める。
 *   `Grid` を受けず、列と行の数と、通れるかを答える関数だけで動く。格子の入れ物を使わない
 *   呼ぶ側でも使える
 *
 * 計算は、整数の足し算・掛け算と、余りと切り捨ての割り算だけで書く。固定値の表は持たず、約束は
 * 「同じ入力から、起動のたびに同じ結果を出す」だけ（README の「決定性を崩す書き方の検査」）。
 * Python 版（`python/src/algorithms_and_patterns/lib/grid.py`）も同じ形。
 *
 * TypeScript の number は整数と小数を区別しないので、列と行の数・マスの位置・歩数・隣への差分が
 * 安全な整数（絶対値が 2**53 未満の整数）かを実行時に確認する。小数のマスは範囲の確認を
 * 通り（0 ≤ 0.5 < 3）、添字が小数になって、配列は undefined を返し、書き込みは配列の要素に
 * ならない。Python 版は int の型で受けるので、型検査に任せている。
 */

import { checkAtLeast, checkInteger } from './safe-integer.js';

/** 格子のマスの位置。左上が (0, 0) で、列（`col`）は右へ、行（`row`）は下へ増える。 */
export interface Cell {
  readonly col: number;
  readonly row: number;
}

/** 隣への差分（列, 行）。 */
export type Offset = readonly [col: number, row: number];

/**
 * 上下左右の隣への差分を、右・左・下・上の順に並べたもの。`findPath` の既定の順。
 *
 * 同じ長さの経路がいくつもあるとき、どれを返すかは隣を試す順で決まる。既定の値として
 * どの呼び出しにも同じ配列を渡すので、書き換えられないよう凍らせている（`readonly` は型検査
 * だけの約束で、実行時には止まらない）。
 */
export const FOUR_NEIGHBOURS: readonly Offset[] = Object.freeze([
  Object.freeze([1, 0] as const),
  Object.freeze([-1, 0] as const),
  Object.freeze([0, 1] as const),
  Object.freeze([0, -1] as const),
]);

/**
 * 格子の入れ物。左上から行ごとに並べた1本の配列で持つ。
 *
 * 添字の計算（行 × 列の数 + 列）をこのクラスの中だけに閉じ込め、外からはマスの位置（`Cell`）で
 * しか触れない。設定で noUncheckedIndexedAccess を有効にしているので、配列を添字で読むと
 * undefined を含む型になる。範囲をここで確認して `T` を返し、その扱いを呼ぶ側へ広げない。
 *
 * 外を読むと、作るときに決めた値（`outside`）を返す。通れないものを表す値を外の値にすれば、
 * 使う側は読むたびに範囲を確認しなくてよい。外へ書くのは止める。
 */
export class Grid<T> {
  /** 列の数。 */
  readonly cols: number;
  /** 行の数。 */
  readonly rows: number;
  readonly #cells: T[];
  readonly #outside: T;

  /**
   * 左上から行ごとに並べた値から格子を作る。`cells` は写して持つ。
   *
   * @param cols 列の数。1 以上の安全な整数
   * @param rows 行の数。1 以上の安全な整数
   * @param cells 左上から行ごとに並べた、cols × rows 個の値
   * @param outside 外を読んだときに返す値
   * @throws RangeError 列か行の数が 1 以上の安全な整数でないとき、または `cells` の数が
   *   cols × rows でないとき。負の数どうしの積は正になるので、数が合っても列と行の数を見る
   */
  constructor(cols: number, rows: number, cells: readonly T[], outside: T) {
    checkAtLeast('列の数', cols, 1);
    checkAtLeast('行の数', rows, 1);
    if (cells.length !== cols * rows) {
      throw new RangeError(`値の数が合わない: ${cells.length} !== ${cols}×${rows}`);
    }
    this.cols = cols;
    this.rows = rows;
    this.#cells = [...cells];
    this.#outside = outside;
  }

  /**
   * マスが格子の中にあるか。
   *
   * @throws RangeError マスの列か行が安全な整数でないとき
   */
  contains(cell: Cell): boolean {
    checkCell('マス', cell);
    return inside(this.cols, this.rows, cell);
  }

  /**
   * そのマスの値。外なら `outside`。
   *
   * 範囲を見ずに添字を計算すると、右の端の外は次の行の先頭になり、別のマスの値を返す。
   *
   * @throws RangeError マスの列か行が安全な整数でないとき
   */
  at(cell: Cell): T {
    if (!this.contains(cell)) return this.#outside;
    // 中のマスの添字は 0 以上 cols × rows 未満で、配列の中にある。
    return this.#cells[cell.row * this.cols + cell.col] as T;
  }

  /**
   * そのマスの値を書き換える。
   *
   * 名前は Python 版にそろえて `put` にした（Python では、クラスの中で `set` という名前の
   * メソッドより後に書いた型注釈の `set[...]` が、そのメソッドを指してしまう）。
   *
   * @throws RangeError 外を指したとき、またはマスの列か行が安全な整数でないとき。外は読むと
   *   `outside` を返すだけの場所で、書き換えようとするのは呼ぶ側の誤り。黙って何もしないと、
   *   誤りに気づけない
   */
  put(cell: Cell, value: T): void {
    if (!this.contains(cell)) {
      throw new RangeError(`格子の外は書き換えられない: (${cell.col}, ${cell.row})`);
    }
    this.#cells[cell.row * this.cols + cell.col] = value;
  }

  /** すべてのマスと、その値を、左上から行ごとに返す。 */
  *cells(): Generator<[Cell, T], void, undefined> {
    for (let index = 0; index < this.#cells.length; index += 1) {
      const cell = { col: index % this.cols, row: Math.floor(index / this.cols) };
      yield [cell, this.#cells[index] as T];
    }
  }
}

/** `findPath` の探し方の条件。 */
export interface PathOptions {
  /** そのマスへ進めるか。格子の中のマスだけを渡す。 */
  readonly passable: (cell: Cell) => boolean;
  /** そのマスが目的地か。2つ目の引数は出発点からの歩数（1 以上）。 */
  readonly goal: (cell: Cell, distance: number) => boolean;
  /** 何歩先まで探すか。0 以上の安全な整数。ちょうどこの歩数のマスまでを見る。 */
  readonly maxDistance: number;
  /** 隣への差分を、試す順に並べたもの。ここに無い向きへは進まない。既定は `FOUR_NEIGHBOURS`。 */
  readonly order?: readonly Offset[];
}

/**
 * `start` から、`goal` を満たす最初のマスまでの最短経路を、幅優先で求める。
 *
 * どのマスへ進む手間も同じ（重みの無い格子）なので、幅優先で最初に見つかった経路が最短になる。
 * 重みを扱う探し方（ダイクストラ法や A*）は要らない。
 *
 * - 出発点は目的地として見ない。出発点が目的地かは、呼ぶ側が先に見る
 * - 出発点が通れるかは尋ねない。ほかのマスは、通れる（`passable` が真の）マスにだけ進む。
 *   目的地も、通れるマスの中から探す
 * - `goal` は、届いたマスに、出発点に近い順に1回ずつ呼ぶ。2つ目の引数の歩数で、
 *   「3マス以上離れた所」のような条件も書ける
 * - 同じ長さの経路がいくつもあるときは、隣を試す順（`order`）で先に届いたものを返す
 *
 * @param cols 列の数。安全な整数
 * @param rows 行の数。安全な整数
 * @param start 出発点。格子の中のマス
 * @returns 出発点の次のマスから目的地までの配列（長さが歩数）。見つからなければ null
 * @throws RangeError 列と行の数・出発点・歩数・隣への差分のどれかが安全な整数でないとき、
 *   `start` が格子の外のとき（列か行の数が 0 以下なら、どのマスも外）、または `maxDistance` が
 *   負のとき
 */
export function findPath(cols: number, rows: number, start: Cell, options: PathOptions): Cell[] | null {
  checkInteger('列の数', cols);
  checkInteger('行の数', rows);
  checkCell('出発点', start);
  if (!inside(cols, rows, start)) {
    throw new RangeError(`出発点が格子の外: (${start.col}, ${start.row})（${cols}×${rows}）`);
  }
  const { passable, goal, maxDistance, order = FOUR_NEIGHBOURS } = options;
  checkAtLeast('探す歩数', maxDistance, 0);
  for (const [dCol, dRow] of order) {
    checkInteger('隣への差分の列', dCol);
    checkInteger('隣への差分の行', dRow);
  }
  // 訪れた印と、どのマスから来たかを、マスの添字で読み書きする配列で持つ。マスを Set や Map の鍵にすると、
  // オブジェクトは同じものかで比べられ、中身が同じ別のオブジェクトを見分けない。
  // 来た所を Int32Array にしないのは、2**31 以上の添字が負の数に化けるため。数の配列は
  // 2**32 - 1 より長く作れず、作る所で止まる。
  const size = cols * rows;
  const seen = new Uint8Array(size);
  const cameFrom = new Array<number>(size).fill(-1);
  seen[start.row * cols + start.col] = 1;
  // 待ち行列は、配列と先頭の添字で持つ。配列の shift は残りを前へ詰めるので、要素が多いと遅い。
  const queue: { readonly cell: Cell; readonly distance: number }[] = [{ cell: start, distance: 0 }];
  for (let head = 0; head < queue.length; head += 1) {
    const { cell, distance } = queue[head] as { readonly cell: Cell; readonly distance: number };
    if (distance > 0 && goal(cell, distance)) {
      return rebuild(cell, distance, cameFrom, cols);
    }
    if (distance >= maxDistance) continue;
    for (const [dCol, dRow] of order) {
      const next = { col: cell.col + dCol, row: cell.row + dRow };
      // 添字にする前に、格子の中かを見る。見ないと、右の端の外が次の行の先頭になる。
      if (!inside(cols, rows, next)) continue;
      const index = next.row * cols + next.col;
      if (seen[index] === 1 || !passable(next)) continue;
      seen[index] = 1;
      cameFrom[index] = cell.row * cols + cell.col;
      queue.push({ cell: next, distance: distance + 1 });
    }
  }
  return null;
}

/**
 * 来た所をたどって、出発点の次から目的地までの配列にする。
 *
 * たどる回数を歩数で決めるので、来た所が壊れていても終わる。
 */
function rebuild(goal: Cell, distance: number, cameFrom: readonly number[], cols: number): Cell[] {
  const path: Cell[] = [];
  let index = goal.row * cols + goal.col;
  for (let walked = 0; walked < distance; walked += 1) {
    path.push({ col: index % cols, row: Math.floor(index / cols) });
    index = cameFrom[index] ?? -1;
  }
  path.reverse();
  return path;
}

/** `cell` が cols × rows の格子の中にあるか。 */
function inside(cols: number, rows: number, cell: Cell): boolean {
  return cell.col >= 0 && cell.col < cols && cell.row >= 0 && cell.row < rows;
}

/** マスの列と行が安全な整数かを確認する。 */
function checkCell(name: string, cell: Cell): void {
  checkInteger(`${name}の列`, cell.col);
  checkInteger(`${name}の行`, cell.row);
}
