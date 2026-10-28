import { describe, expect, it } from 'vitest';
import { findPath, type Cell, type PathOptions } from '../../src/lib/grid.js';

/*
 * src/lib/grid.ts のうち、幅優先の最短経路（findPath）が止める値のテスト。
 * 探し方は grid-path.test.ts が、格子の入れ物（Grid）は grid.test.ts が見る。
 * 受け取る値の約束は、探し方とは別の理由で変わるので、ファイルを分けた。
 */

const CORNER: Cell = { col: 0, row: 0 };

/** どのマスも通れて、どのマスも目的地として、findPath を呼ぶ。既定は5列3行の格子で、探す歩数は 8。 */
function search(start: Cell, options: Partial<PathOptions> = {}, [cols, rows] = [5, 3]): Cell[] | null {
  return findPath(cols, rows, start, { passable: () => true, goal: () => true, maxDistance: 8, ...options });
}

describe('出発点', () => {
  const OUTSIDE_STARTS: Cell[] = [{ col: -1, row: 0 }, { col: 5, row: 0 }, { col: 0, row: -1 }, { col: 0, row: 3 }];

  it.each(OUTSIDE_STARTS)('格子の外の出発点 ($col, $row) は止まる', (start) => {
    expect(() => search(start)).toThrow('出発点が格子の外');
  });

  it.each([[0, 3], [3, 0], [-2, -2]])('列 %s、行 %s なら、どの出発点も外として止まる', (cols, rows) => {
    expect(() => search(CORNER, {}, [cols, rows])).toThrow('出発点が格子の外');
  });

  it.each([
    { col: 0.5, row: 0 },
    { col: 0, row: 0.5 },
    { col: NaN, row: 0 },
  ])('小数や NaN の出発点 ($col, $row) は止まる', (start) => {
    // 範囲の確認は通ってしまい（0 ≤ 0.5 < 5）、添字が小数になる。
    expect(() => search(start)).toThrow('安全な整数でない（出発点の');
  });
});

describe('列と行の数', () => {
  it.each([1.5, NaN, Infinity, 2 ** 53])('列か行の数が %s なら止まる', (size) => {
    // 列の数が 2.5 だと、出発点 (2, 0) は中にあるとみなされ、添字が小数になる。
    expect(() => search(CORNER, {}, [size, 3])).toThrow('安全な整数でない（列の数）');
    expect(() => search(CORNER, {}, [3, size])).toThrow('安全な整数でない（行の数）');
  });
});

describe('歩数', () => {
  it.each([-1, 1.5, NaN, Infinity])('maxDistance が %s なら止まる', (maxDistance) => {
    // 0 に丸めると、呼ぶ側の誤り（引き算の取り違えなど）に気づけない。Infinity で
    // 「上限なし」を表す形は受けない（Python 版は int で受ける）。
    expect(() => search(CORNER, { maxDistance })).toThrow('探す歩数');
  });
});

describe('隣への差分', () => {
  it.each([
    [0.5, 0],
    [0, 0.5],
    [NaN, 0],
    [0, Infinity],
  ] as const)('隣への差分 (%s, %s) は、探す前に止まる', (dCol, dRow) => {
    // 小数の差分で進むと、範囲の確認を通ったまま、添字が小数のマスへ進む。
    // 探し始めてから止めると、passable と goal をすでに呼んだあとになる。
    const asked: Cell[] = [];
    const passable = (cell: Cell): boolean => {
      asked.push(cell);
      return true;
    };
    expect(() => search(CORNER, { passable, order: [[1, 0], [dCol, dRow]] })).toThrow('安全な整数でない（隣への差分の');
    expect(asked).toEqual([]);
  });
});
