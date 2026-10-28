import { describe, expect, it } from 'vitest';
import { earliestTimes } from '../../src/lib/cascade.js';
import { allRelations, fakeReaches, type Pair } from './fake-reaches.js';

/*
 * src/lib/cascade.ts のうち、最も早い時刻（earliestTimes）のテスト。
 * たどり方は cascade.test.ts が、止める値は cascade-invalid.test.ts が見る。
 * 最も早い時刻は一括処理と同じたどり方を使うが、時刻の扱い（無限大・同じ時刻の順・
 * 印を共有すること）は、たどり方とは別の理由で変わるので、ファイルを分けた。
 */

/** 組の並びを届く関係にして、earliestTimes を呼ぶ。 */
function run(times: readonly number[], pairs: readonly Pair[]): number[] {
  return earliestTimes(times, fakeReaches(pairs).reaches);
}

describe('時刻が伝わる', () => {
  it('届いた相手は起点と同じ時刻になる', () => {
    expect(run([1, 5], [[0, 1]])).toEqual([1, 1]);
  });

  it('何段でも伝わる', () => {
    // 添字の順に1回だけ見直す形では、1段しか伝わらない並び。
    expect(run([9, 8, 7, 1], [[3, 2], [2, 1], [1, 0]])).toEqual([1, 1, 1, 1]);
  });

  it('届かない要素は自分の時刻のまま', () => {
    // 全部の要素を最も小さい時刻にするだけの誤りとの対照。
    expect(run([1, 5, 3], [[0, 1]])).toEqual([1, 1, 3]);
  });

  it('自分の時刻のほうが早ければ、届いても変わらない', () => {
    expect(run([4, 2], [[0, 1]])).toEqual([4, 2]);
  });

  it('遅い要素から早い要素へ届いても、早い時刻は書き換わらない', () => {
    // 時刻 5 の要素 0 が時刻 2 の要素 1 へ届き、どちらも要素 2 へ届く。
    // 起点ごとに新しい印でたどると、要素 0 の連鎖が要素 1 と 2 をたどり直し、どちらも 5 に書き換わる。
    expect(run([5, 2, 9], [[0, 1], [1, 2], [0, 2]])).toEqual([5, 2, 2]);
  });

  it('ひし形と輪と自分自身でも止まる', () => {
    const pairs: Pair[] = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 0], [3, 3]];
    expect(run([3, Infinity, Infinity, Infinity], pairs)).toEqual([3, 3, 3, 3]);
  });

  it('空なら空', () => {
    expect(run([], [])).toEqual([]);
  });
});

describe('無限大と負の時刻', () => {
  it('無限大の要素は自分では発火せず、届かなければ無限大のまま', () => {
    const { reaches, asked } = fakeReaches([[0, 1], [1, 2]]);
    expect(earliestTimes([Infinity, 2, Infinity], reaches)).toEqual([Infinity, 2, 2]);
    // 要素 0 は発火しないので、届く相手を尋ねない。
    expect(asked).toEqual([1, 2]);
  });

  it('すべて無限大なら、reaches を呼ばない', () => {
    const { reaches, asked } = fakeReaches([[0, 1], [1, 0]]);
    expect(earliestTimes([Infinity, Infinity], reaches)).toEqual([Infinity, Infinity]);
    expect(asked).toEqual([]);
  });

  it('負の時刻と負の無限大も受ける', () => {
    expect(run([-Infinity, -3, 0.5, 7], [[0, 2], [1, 3]])).toEqual([-Infinity, -3, -Infinity, -3]);
  });

  it('時刻は足し引きせず、渡した値をそのまま返す', () => {
    // 0.1 + 0.2 は 0.30000000000000004。丸めたり計算し直したりすると変わる。
    const early = 0.1 + 0.2;
    expect(run([early, 1], [[0, 1]])).toEqual([early, early]);
  });
});

describe('reaches を呼ぶ回数と順', () => {
  it('印を共有し、どの要素の届く相手も1度しか尋ねない', () => {
    // 起点ごとに新しい印でたどると、決まった要素の先を毎回たどり直す。
    // どの要素からも全部の要素へ届くので、たどり直すと4回より多く尋ねる。
    const pairs: Pair[] = [];
    for (let source = 0; source < 4; source += 1) {
      for (let target = 0; target < 4; target += 1) pairs.push([source, target]);
    }
    const { reaches, asked } = fakeReaches(pairs);
    expect(earliestTimes([4, 3, 2, 1], reaches)).toEqual([1, 1, 1, 1]);
    expect(asked).toEqual([3, 0, 1, 2]);
  });

  it('同じ時刻なら添字の小さい要素から発火する', () => {
    const { reaches, asked } = fakeReaches([[1, 0], [0, 1]]);
    expect(earliestTimes([4, 4], reaches)).toEqual([4, 4]);
    expect(asked).toEqual([0, 1]);
  });

  it('渡した時刻の配列を書き換えない', () => {
    // 凍らせた配列を書き換えると、厳格モードのモジュールでは TypeError になる。
    const times = Object.freeze([5, 1]);
    expect(earliestTimes(times, fakeReaches([[1, 0]]).reaches)).toEqual([1, 1]);
    expect(times).toEqual([5, 1]);
  });
});

/**
 * 全部の組を比べ、変化が無くなるまで繰り返す素朴な求め方。
 *
 * animal-bomber の見積もりと同じ形。早い要素が遅い要素へ届いていれば、遅いほうを早いほうに
 * 合わせる。値は小さくなる一方で、取りうる値は `times` の中だけなので、必ず止まる。
 */
function byRepeatedRelaxing(times: readonly number[], pairs: readonly Pair[]): number[] {
  const result = [...times];
  let changed = true;
  while (changed) {
    changed = false;
    for (const [source, target] of pairs) {
      const [from, to] = [result[source] as number, result[target] as number];
      if (from < to) {
        result[target] = from;
        changed = true;
      }
    }
  }
  return result;
}

it('3個の要素の全部の関係と時刻の組で、素朴な求め方と一致する', () => {
  // 名前を付けた例で見落とした形を、全部の場合で見る。期待値は、印も並べ替えも使わない
  // 別の求め方で作る。時刻は 1・2・無限大の3つから選び、同じ時刻と無限大の重なりも含める。
  const choices = [1, 2, Infinity];
  let cases = 0;
  for (const pairs of allRelations(3)) {
    for (const a of choices) {
      for (const b of choices) {
        for (const c of choices) {
          const times = [a, b, c];
          expect(run(times, pairs), JSON.stringify({ pairs, times })).toEqual(byRepeatedRelaxing(times, pairs));
          cases += 1;
        }
      }
    }
  }
  // 並べた場合の数が減ると、見る形が黙って減る。
  expect(cases).toBe(512 * 27);
});
