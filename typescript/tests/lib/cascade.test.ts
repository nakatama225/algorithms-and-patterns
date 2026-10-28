import { describe, expect, it } from 'vitest';
import { cascade } from '../../src/lib/cascade.js';
import { allRelations, fakeReaches, type Pair } from './fake-reaches.js';

/*
 * src/lib/cascade.ts のうち、一括処理（cascade）のたどり方のテスト。
 * 最も早い時刻（earliestTimes）は cascade-earliest-times.test.ts が、止める値は
 * cascade-invalid.test.ts が見る。
 *
 * 届く関係はどれも fakeReaches で渡す。尋ねられた回数に上限があるので、印を付けない誤った
 * 実装でも、輪で回り続けずにテストが終わる。
 */

/** 組の並びを届く関係にして、cascade を呼ぶ。 */
function run(count: number, starts: Iterable<number>, pairs: readonly Pair[]): number[] {
  return cascade(count, starts, fakeReaches(pairs).reaches);
}

describe('届く範囲', () => {
  it('何段でも届く', () => {
    expect(run(5, [0], [[0, 1], [1, 2], [2, 3], [3, 4]])).toEqual([0, 1, 2, 3, 4]);
  });

  it('届かない要素は発火しない', () => {
    // 全部の要素を返すだけの誤りとの対照。
    expect(run(4, [0], [[0, 1], [2, 3]])).toEqual([0, 1]);
  });

  it('届く向きは逆にたどらない', () => {
    // 1 から 0 へは届くが、0 から 1 へは届かない。
    expect(run(2, [0], [[1, 0]])).toEqual([0]);
  });

  it('起点が空なら空で、reaches を呼ばない', () => {
    const { reaches, asked } = fakeReaches([[0, 1]]);
    expect(cascade(2, [], reaches)).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('要素の数が 0 で起点も空なら空', () => {
    expect(run(0, [], [])).toEqual([]);
  });

  it('起点は一度だけ読める並びでもよい', () => {
    // 範囲を見るために読み切ってから、たどる。
    expect(run(3, [2, 0].values(), [[0, 1]])).toEqual([2, 0, 1]);
  });
});

describe('1度だけ発火する', () => {
  it('ひし形で2つの経路から届いても1度だけ', () => {
    // 取り出すときに印を付けると、3 を2度積み、2度返す。
    const { reaches, asked } = fakeReaches([[0, 1], [0, 2], [1, 3], [2, 3]]);
    expect(cascade(4, [0], reaches)).toEqual([0, 1, 2, 3]);
    expect(asked).toEqual([0, 1, 2, 3]);
  });

  it('重なった起点も1度だけ', () => {
    expect(run(2, [1, 1, 0, 1], [[0, 1]])).toEqual([1, 0]);
  });

  it('起点どうしが届き合っても1度だけ', () => {
    expect(run(2, [0, 1], [[0, 1], [1, 0]])).toEqual([0, 1]);
  });

  it('輪でも止まる', () => {
    const { reaches, asked } = fakeReaches([[0, 1], [1, 2], [2, 0]]);
    expect(cascade(3, [1], reaches)).toEqual([1, 2, 0]);
    expect(asked).toEqual([1, 2, 0]);
  });

  it('自分自身へ届いても止まる', () => {
    expect(run(2, [0], [[0, 0], [0, 1], [1, 1]])).toEqual([0, 1]);
  });
});

describe('発火する順', () => {
  it('起点をすべて先に積み、段の小さい順に返す', () => {
    // 起点ごとに連鎖を尽くす形だと [0, 1, 2, 3, 4] になる。
    expect(run(5, [0, 3], [[0, 1], [1, 2], [3, 4]])).toEqual([0, 3, 1, 4, 2]);
  });

  it('同じ段の中は、reaches が返した順', () => {
    // 添字の順に並べ直す誤りとの対照に、大きい添字を先に返す。
    expect(run(4, [0], [[0, 3], [0, 1], [0, 2]])).toEqual([0, 3, 1, 2]);
  });

  it('reaches は発火した要素にだけ、発火する順に1度ずつ呼ぶ', () => {
    const { reaches, asked } = fakeReaches([[0, 2], [2, 1], [2, 0], [1, 2], [3, 0]]);
    expect(cascade(4, [0], reaches)).toEqual([0, 2, 1]);
    expect(asked).toEqual([0, 2, 1]);
  });
});

/**
 * 起点から届く要素を、変化が無くなるまで組を全部見直す素朴な形で求める。
 * 待ち行列を使わず、たどる順にもよらない。添字の小さい順に返す。
 */
function reachable(count: number, starts: readonly number[], pairs: readonly Pair[]): number[] {
  const found = new Array<boolean>(count).fill(false);
  for (const start of starts) found[start] = true;
  let changed = true;
  while (changed) {
    changed = false;
    for (const [source, target] of pairs) {
      if (found[source] === true && found[target] === false) {
        found[target] = true;
        changed = true;
      }
    }
  }
  return [...found.keys()].filter((index) => found[index] === true);
}

it('3個の要素の全部の関係と起点で、素朴な求め方と同じ要素を1度ずつ返す', () => {
  // 名前を付けた例で見落とした形（輪と枝の組み合わせなど）を、全部の場合で見る。
  // 期待値は、待ち行列を使わず組を全部見直す別の求め方で作る。実装と同じ手順で期待値を作ると、
  // 両方が同じ誤りを持ち、テストが通ってしまう。
  const startSets = [[], [0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
  let cases = 0;
  for (const pairs of allRelations(3)) {
    for (const starts of startSets) {
      const fired = run(3, starts, pairs).sort((a, b) => a - b);
      expect(fired, JSON.stringify({ pairs, starts })).toEqual(reachable(3, starts, pairs));
      cases += 1;
    }
  }
  // 並べた場合の数が減ると、見る形が黙って減る。
  expect(cases).toBe(512 * 8);
});
