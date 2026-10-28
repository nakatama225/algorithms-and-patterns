import type { Reaches } from '../../src/lib/cascade.js';

/*
 * 連鎖の一括処理のテストが使う、偽の届く関係。テストの補助で、src には対応しない。
 *
 * - fakeReaches：届く関係を [元, 先] の組で持ち、尋ねられた添字を順に控える
 * - allRelations：少ない要素の間の、ありうるすべての届く関係。素朴な求め方と突き合わせる
 *   テストが、全部の場合を並べるのに使う
 */

/** 届く関係の組 [元, 先]。 */
export type Pair = readonly [source: number, target: number];

/**
 * 届く関係を [元, 先] の組で持ち、尋ねられた添字を `asked` に順に控える `reaches` を作る。
 *
 * 同じ元の組は、書いた順に先を返す。尋ねられた回数が `limit` を超えたら止める。
 * 印を付けない誤った実装でも、輪で回り続けずにテストが終わる。
 */
export function fakeReaches(
  pairs: readonly Pair[],
  limit = 100,
): { readonly reaches: Reaches; readonly asked: number[] } {
  const asked: number[] = [];
  const reaches = (index: number): number[] => {
    asked.push(index);
    if (asked.length > limit) throw new Error(`reaches を ${limit} 回より多く呼んだ`);
    return pairs.filter(([source]) => source === index).map(([, target]) => target);
  };
  return { reaches, asked };
}

/**
 * `count` 個の要素の間の、ありうるすべての届く関係。
 *
 * 自分自身へ届く組も含める。組の数は `count` の2乗なので、関係の数は 2 の `count * count` 乗に
 * なる。3 個なら 512 通り。
 */
export function* allRelations(count: number): Generator<Pair[], void, undefined> {
  const pairs: Pair[] = [];
  for (let source = 0; source < count; source += 1) {
    for (let target = 0; target < count; target += 1) pairs.push([source, target]);
  }
  // 組の数は 32 未満の前提で、ビットの演算で選ぶ（3 個なら 9 組）。
  for (let mask = 0; mask < 1 << pairs.length; mask += 1) {
    yield pairs.filter((_, bit) => ((mask >> bit) & 1) === 1);
  }
}
