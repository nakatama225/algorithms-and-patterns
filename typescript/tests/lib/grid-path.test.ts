import { describe, expect, it } from 'vitest';
import { FOUR_NEIGHBOURS, findPath, Grid, type Cell, type Offset, type PathOptions } from '../../src/lib/grid.js';

/*
 * src/lib/grid.ts のうち、幅優先の最短経路（findPath）の探し方のテスト。
 * 止める値（格子の外の出発点・整数でない値・負の歩数）は grid-path-invalid.test.ts が、
 * 格子の入れ物（Grid）は grid.test.ts が見る。
 *
 * どのテストも、格子を小さくし、探す歩数（maxDistance）を 8 以下にしている。訪れた印を付けない
 * 誤った実装でも、探す数が歩数で抑えられ、テストが終わる。
 */

/**
 * 5列3行の格子。'#' は通れないマス。外も通れないマスとして読む。
 *
 *   . . . . .
 *   . # . # .
 *   . . . . .
 */
const LINES = ['.....', '.#.#.', '.....'];
const COLS = 5;
const ROWS = 3;
const CORNER: Cell = { col: 0, row: 0 };
/** 左上の角から各マスまでの歩数。null は通れないマス。 */
const DISTANCES: readonly (readonly (number | null)[])[] = [
  [0, 1, 2, 3, 4],
  [1, null, 3, null, 5],
  [2, 3, 4, 5, 6],
];

/** 上の5列3行の格子。 */
function maze(): Grid<string> {
  return new Grid(COLS, ROWS, [...LINES.join('')], '#');
}

/** `grid` の '.' のマスを通れるとする関数。 */
function openCells(grid: Grid<string>): (cell: Cell) => boolean {
  return (cell) => grid.at(cell) === '.';
}

/** そのマスに着いたら目的地、という条件。 */
function at(target: Cell): (cell: Cell, distance: number) => boolean {
  return (cell) => cell.col === target.col && cell.row === target.row;
}

/** どのマスも通れる、どのマスも目的地、のどちらにも使う。 */
const anywhere = (): boolean => true;

/**
 * findPath を呼ぶ。既定は5列3行の格子で、'.' のマスを通れるとし、どのマスも目的地、
 * 探す歩数は 8。
 */
function search(start: Cell, options: Partial<PathOptions> = {}, [cols, rows] = [COLS, ROWS]): Cell[] | null {
  return findPath(cols, rows, start, { passable: openCells(maze()), goal: anywhere, maxDistance: 8, ...options });
}

/** マスの位置を、並びに書きやすい [列, 行] の組にする。 */
function pairs(path: readonly Cell[] | null): [number, number][] | null {
  return path === null ? null : path.map((cell) => [cell.col, cell.row]);
}

/** 受け取った引数を `log` に足し、`answer` を返す関数。passable と goal の呼ばれ方を記録するのに使う。 */
function recorder<A extends unknown[]>(log: A[], answer: boolean): (...args: A) => boolean {
  return (...args) => {
    log.push(args);
    return answer;
  };
}

describe('最短の経路', () => {
  it('出発点の次のマスから目的地までを返す', () => {
    expect(pairs(search({ col: 0, row: 1 }, { goal: at({ col: 0, row: 2 }) }))).toEqual([[0, 2]]);
  });

  it('通れないマスを避けて回り道する', () => {
    // (1, 0) から (1, 2) は縦に2マスだが、間の (1, 1) が通れないので4歩。
    const path = search({ col: 1, row: 0 }, { goal: at({ col: 1, row: 2 }) });
    expect(pairs(path)).toEqual([[2, 0], [2, 1], [2, 2], [1, 2]]);
  });

  it('届かなければ null', () => {
    expect(search(CORNER, { goal: at({ col: 1, row: 1 }) })).toBeNull();
  });

  it('格子の入れ物を使わずに、関数だけで探せる', () => {
    // 3列目の上の2マスを塞ぐと、上の行から右の端へ行くには3行目まで下りて回る。
    // (3, 2) からは右を上より先に試すので、右の端の列を上る。
    const path = search(CORNER, {
      passable: (cell) => cell.col !== 2 || cell.row === 2,
      goal: at({ col: 4, row: 0 }),
    });
    expect(pairs(path)).toEqual([[1, 0], [1, 1], [1, 2], [2, 2], [3, 2], [4, 2], [4, 1], [4, 0]]);
  });

  it('まだ置いていない障害も、passable に足して表せる', () => {
    // 格子を書き換えずに「ここが塞がったら」を試せる。(2, 0) から (2, 2) へは、間の (2, 1) が
    // 塞がると6歩。右を左より先に試すので、右から回る。
    // マスはオブジェクトなので、Set には中身でなく同じものかで入る。鍵は添字の数にする。
    const grid = maze();
    const planned = new Set([1 * COLS + 2]);
    const path = search({ col: 2, row: 0 }, {
      passable: (cell) => grid.at(cell) === '.' && !planned.has(cell.row * COLS + cell.col),
      goal: at({ col: 2, row: 2 }),
    });
    expect(pairs(path)).toEqual([[3, 0], [4, 0], [4, 1], [4, 2], [3, 2], [2, 2]]);
    // 格子そのものは書き換わっていない。
    expect(grid.at({ col: 2, row: 1 })).toBe('.');
  });
});

describe('同じ長さの経路の選び方', () => {
  it('隣を右左下上の順に試し、先に届いた経路を返す', () => {
    // 左上の角から右下の角へは6歩で、同じ長さの経路がいくつもある。
    // 右を下より先に試すので、上の行を右の端まで進んでから下りる経路になる。
    const path = search(CORNER, { goal: at({ col: 4, row: 2 }) });
    expect(pairs(path)).toEqual([[1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2]]);
  });

  it('試す順を変えると、同じ長さの別の経路を返す', () => {
    // 上の確認が、順を見ずにたまたま同じ経路になっただけでないことの対照。
    // 上・下・左・右の順にすると、下を右より先に試すので、左の列を下りてから右へ進む。
    const order: Offset[] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const path = search(CORNER, { goal: at({ col: 4, row: 2 }), order });
    expect(pairs(path)).toEqual([[0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]);
  });

  it('既定の順は右左下上で、書き換えられない', () => {
    // どの呼び出しにも同じ配列を既定として渡すので、書き換わると、ほかの呼び出しの経路まで変わる。
    expect(FOUR_NEIGHBOURS).toEqual([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    expect(() => {
      (FOUR_NEIGHBOURS as Offset[]).reverse();
    }).toThrow(TypeError);
    expect(() => {
      (FOUR_NEIGHBOURS[0] as unknown as number[])[0] = 0;
    }).toThrow(TypeError);
    expect(FOUR_NEIGHBOURS[0]).toEqual([1, 0]);
  });

  it('試す順に無い向きへは進まない', () => {
    // 右と下だけにすると、右下の角から左上の角へは戻れない。
    const order: Offset[] = [[1, 0], [0, 1]];
    expect(search({ col: 4, row: 2 }, { passable: anywhere, goal: at(CORNER), order })).toBeNull();
    // 空の順なら、どこへも進まない。空の順を既定の順に置き換えると、隣へ進む。
    expect(search(CORNER, { passable: anywhere, order: [] })).toBeNull();
  });
});

describe('出発点', () => {
  it('出発点は目的地として見ない', () => {
    // どのマスも目的地なら、出発点でなく隣のマスまでの1歩を返す。
    const start = { col: 2, row: 1 };
    expect(pairs(search(start))).toEqual([[2, 2]]);
    expect(search(start, { goal: at(start) })).toBeNull();
  });

  it('出発点が通れないマスでも探せる', () => {
    // いま立っているマスが通れないマスになっていても、そこから出る道を探せる。
    const grid = maze();
    grid.put(CORNER, '#');
    const path = search(CORNER, { passable: openCells(grid), goal: at({ col: 2, row: 0 }) });
    expect(pairs(path)).toEqual([[1, 0], [2, 0]]);
  });

  it('出発点は、passable にも goal にも渡さない', () => {
    const asked: [Cell][] = [];
    const judged: [Cell, number][] = [];
    const options = { passable: recorder(asked, true), goal: recorder(judged, false), maxDistance: 4 };
    search({ col: 1, row: 1 }, options, [3, 3]);
    expect(judged).toHaveLength(8);
    expect(asked.map(([cell]) => cell)).not.toContainEqual({ col: 1, row: 1 });
    expect(judged.map(([cell]) => cell)).not.toContainEqual({ col: 1, row: 1 });
  });
});

describe('歩数', () => {
  it('goal は、届いたマスに、出発点に近い順に1回ずつ、歩数つきで呼ぶ', () => {
    // 歩数を渡し誤ると、「3マス以上離れた所」のような条件が誤って当たる。
    // 同じマスに2回呼ぶのは、訪れた印を付け忘れて、同じマスをまた並べたとき。
    const calls: [Cell, number][] = [];
    expect(search(CORNER, { goal: recorder(calls, false) })).toBeNull();
    const expected = DISTANCES.flatMap((line, row) =>
      line.flatMap((distance, col) => (distance === null || distance === 0 ? [] : [[col, row, distance]])),
    );
    const found = calls.map(([cell, distance]) => [cell.col, cell.row, distance]);
    const byPlace = (a: readonly number[], b: readonly number[]): number =>
      (a[1] ?? 0) - (b[1] ?? 0) || (a[0] ?? 0) - (b[0] ?? 0);
    expect(found.sort(byPlace)).toEqual(expected);
    const distances = calls.map(([, distance]) => distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('歩数を条件にした目的地', () => {
    // 3行目のマスのうち、3歩以上離れた最初のマス。(0, 2) は2歩なので当たらない。
    const path = search(CORNER, { goal: (cell, distance) => cell.row === 2 && distance >= 3 });
    expect(pairs(path)).toEqual([[0, 1], [0, 2], [1, 2]]);
  });

  it.each([
    // まっすぐ進める経路と、通れないマスを回る経路（縦に2マスで4歩）。
    [CORNER, { col: 4, row: 2 }, 6],
    [{ col: 1, row: 0 }, { col: 1, row: 2 }, 4],
  ])('ちょうど maxDistance の歩数の目的地には届き、1つ短いと null（%o → %o、%s 歩）', (start, target, distance) => {
    // 打ち切りの比べを「より大きい」と「以上」で取り違えると、どちらかで食い違う。
    const found = search(start, { goal: at(target), maxDistance: distance });
    expect(found).toHaveLength(distance);
    expect(found?.at(-1)).toEqual(target);
    expect(search(start, { goal: at(target), maxDistance: distance - 1 })).toBeNull();
  });

  it('maxDistance より遠いマスには、goal も passable も呼ばない', () => {
    // 打ち切りを取り出したときに見ると、1歩遠いマスにまで passable を呼ぶ。返す経路と goal の
    // 呼ばれ方は変わらないので、passable の側でも見る。
    const asked: Cell[] = [];
    const judged: [Cell, number][] = [];
    const isOpen = openCells(maze());
    const passable = (cell: Cell): boolean => {
      asked.push(cell);
      return isOpen(cell);
    };
    search(CORNER, { passable, goal: recorder(judged, false), maxDistance: 3 });
    const within = DISTANCES.flat().filter((d): d is number => d !== null && d >= 1 && d <= 3);
    const distances = judged.map(([, distance]) => distance);
    expect(distances.sort((a, b) => a - b)).toEqual(within.sort((a, b) => a - b));
    // 通れないマス（歩数が null）には、3歩以内のマスの隣として尋ねてよい。
    expect(asked.filter((cell) => (DISTANCES[cell.row]?.[cell.col] ?? 0) > 3)).toEqual([]);
  });

  it('maxDistance が 0 なら、隣が目的地でも null', () => {
    expect(search(CORNER, { maxDistance: 0 })).toBeNull();
  });

  it('1マスの格子では、進む先が無く null', () => {
    expect(search(CORNER, { passable: anywhere }, [1, 1])).toBeNull();
  });
});

describe('格子の端', () => {
  // 添字は 行 × 列の数 + 列 なので、端の外を添字にすると、別のマスを指す。
  it.each([
    // 右の端の外 (3, 0) は、添字では次の行の先頭 (0, 1)。
    [{ col: 2, row: 0 }, [1, 0]],
    // 左の端の外 (-1, 1) は、添字では前の行の末尾 (2, 0)。
    [{ col: 0, row: 1 }, [-1, 0]],
    // 上の外 (0, -1) は、添字では負の数。
    [{ col: 0, row: 0 }, [0, -1]],
    // 下の外 (0, 2) は、添字では配列の長さを超える。
    [{ col: 0, row: 1 }, [0, 1]],
  ] as const)('(%o) から %o の向きの外へは進まず、別のマスへ回り込まない', (start, offset) => {
    expect(search(start, { passable: anywhere, order: [offset] }, [3, 2])).toBeNull();
  });

  it('passable には、格子の中のマスだけを渡す', () => {
    const asked: [Cell][] = [];
    search(CORNER, { passable: recorder(asked, true), goal: () => false }, [3, 2]);
    expect(asked.length).toBeGreaterThan(0);
    const outside = asked.filter(([cell]) => cell.col < 0 || cell.col >= 3 || cell.row < 0 || cell.row >= 2);
    expect(outside).toEqual([]);
  });
});
