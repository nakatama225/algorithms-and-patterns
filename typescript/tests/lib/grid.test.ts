import { describe, expect, it } from 'vitest';
import { Grid, type Cell } from '../../src/lib/grid.js';

/*
 * src/lib/grid.ts のうち、格子の入れ物（Grid）のテスト。
 * 幅優先の最短経路（findPath）は grid-path.test.ts と grid-path-invalid.test.ts が見る。探索は
 * 格子の入れ物を受けずに動き、変わる理由が違うので、ファイルを分けた。
 */

/** 外を読んだときの値。どのマスの値とも違う数にして、外を読んだのか、別のマスを読んだのかを見分ける。 */
const OUTSIDE = -1;

/**
 * 3列2行で、左上から行ごとに 0 から 5 を並べた格子。
 *
 *   0 1 2
 *   3 4 5
 */
function grid(): Grid<number> {
  return new Grid(3, 2, [0, 1, 2, 3, 4, 5], OUTSIDE);
}

/** 格子のすべての値を、左上から行ごとに並べる。 */
function valuesOf<T>(subject: Grid<T>): T[] {
  return [...subject.cells()].map(([, value]) => value);
}

describe('読み書き', () => {
  it('作った値を、マスの位置で読める', () => {
    const subject = grid();
    expect(subject.at({ col: 0, row: 0 })).toBe(0);
    expect(subject.at({ col: 2, row: 0 })).toBe(2);
    expect(subject.at({ col: 0, row: 1 })).toBe(3);
    expect(subject.at({ col: 2, row: 1 })).toBe(5);
    expect([subject.cols, subject.rows]).toEqual([3, 2]);
  });

  it('書いたマスだけが変わる', () => {
    const subject = grid();
    subject.put({ col: 1, row: 1 }, 40);
    expect(valuesOf(subject)).toEqual([0, 1, 2, 3, 40, 5]);
  });

  it('cells は、左上から行ごとに、すべてのマスと値を返す', () => {
    // 列と行を取り違えると、2行目の先頭が (0, 1) でなく (1, 0) になる。
    expect([...grid().cells()]).toEqual([
      [{ col: 0, row: 0 }, 0],
      [{ col: 1, row: 0 }, 1],
      [{ col: 2, row: 0 }, 2],
      [{ col: 0, row: 1 }, 3],
      [{ col: 1, row: 1 }, 4],
      [{ col: 2, row: 1 }, 5],
    ]);
  });

  it('作ったあとに元の配列を書き換えても、格子は変わらない', () => {
    // 写さずに持つと、呼ぶ側が元の配列を使い回したときに、格子が黙って変わる。
    const values = [0, 1, 2, 3, 4, 5];
    const subject = new Grid(3, 2, values, OUTSIDE);
    values[0] = 99;
    expect(subject.at({ col: 0, row: 0 })).toBe(0);
  });

  it('1マスの格子', () => {
    const subject = new Grid(1, 1, ['a'], '外');
    expect(subject.at({ col: 0, row: 0 })).toBe('a');
    expect(subject.at({ col: 1, row: 0 })).toBe('外');
    expect([...subject.cells()]).toEqual([[{ col: 0, row: 0 }, 'a']]);
  });
});

describe('外', () => {
  const OUTSIDE_CELLS: Cell[] = [
    { col: -1, row: 0 },
    { col: 3, row: 0 },
    { col: 0, row: -1 },
    { col: 0, row: 2 },
    { col: 3, row: 1 },
    { col: -1, row: -1 },
  ];

  it.each(OUTSIDE_CELLS)('外の ($col, $row) を読むと、作るときに決めた値を返す', (cell) => {
    // 範囲を見ずに添字を計算すると、(3, 0) は次の行の先頭 (0, 1) の値を返す。
    const subject = grid();
    expect(subject.contains(cell)).toBe(false);
    expect(subject.at(cell)).toBe(OUTSIDE);
  });

  it.each([
    { col: 0, row: 0 },
    { col: 2, row: 0 },
    { col: 0, row: 1 },
    { col: 2, row: 1 },
  ])('四隅の ($col, $row) は中にある', (cell) => {
    // 上の確認が「どのマスも外とみなす」だけで通ってしまわないための対照。
    expect(grid().contains(cell)).toBe(true);
  });

  it.each(OUTSIDE_CELLS)('外の ($col, $row) へ書くと止まり、どのマスも変わらない', (cell) => {
    // 外へ書こうとするのは呼ぶ側の誤り。黙って何もしないと、誤りに気づけない。
    // 添字で書くと、(3, 0) は (0, 1) を書き換える。
    const subject = grid();
    expect(() => subject.put(cell, 99)).toThrow('格子の外は書き換えられない');
    expect(valuesOf(subject)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('止める値', () => {
  it.each([0, 5, 7])('値の数が %s で、列と行の積と合わなければ止まる', (count) => {
    const values = Array.from({ length: count }, (_, index) => index);
    expect(() => new Grid(3, 2, values, OUTSIDE)).toThrow('値の数が合わない');
  });

  it.each([
    [0, 3, 0],
    [3, 0, 0],
    [-2, -2, 4],
    [-1, -3, 3],
  ])('列 %s、行 %s は、値の数（%s）が積と合っても止まる', (cols, rows, count) => {
    // 負の数どうしの積は正なので、値の数を比べるだけでは通ってしまう。
    expect(count).toBe(cols * rows);
    const values = Array.from({ length: count }, (_, index) => index);
    expect(() => new Grid(cols, rows, values, OUTSIDE)).toThrow('1 以上');
  });

  it.each([1.5, NaN, Infinity, 2 ** 53])('列か行の数が %s なら止まる', (size) => {
    // 小数の列の数で添字を計算すると、配列は undefined を返す。
    expect(() => new Grid(size, 1, [0], OUTSIDE)).toThrow('安全な整数でない（列の数）');
    expect(() => new Grid(1, size, [0], OUTSIDE)).toThrow('安全な整数でない（行の数）');
  });

  it.each([
    { col: 0.5, row: 0 },
    { col: 0, row: 0.5 },
    { col: NaN, row: 0 },
    { col: 0, row: Infinity },
  ])('小数や NaN のマス ($col, $row) は、読むのも書くのも止まる', (cell) => {
    // 範囲の確認は通ってしまい（0 ≤ 0.5 < 3）、添字が小数になる。読むと undefined を返し、
    // 書き込みは配列の要素にならず、cells にも表れない。
    const subject = grid();
    expect(() => subject.contains(cell)).toThrow(RangeError);
    expect(() => subject.at(cell)).toThrow(RangeError);
    expect(() => subject.put(cell, 99)).toThrow(RangeError);
    expect(valuesOf(subject)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
