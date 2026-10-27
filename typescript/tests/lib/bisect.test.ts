import { describe, expect, it } from 'vitest';
import { bisectLeft, bisectRight } from '../../src/lib/bisect.js';

/** 期待値を、二分探索とは別の道筋（先頭から数える）で作る。 */
function countBelow(sorted: readonly number[], value: number): number {
  return sorted.filter((item) => item < value).length;
}
function countAtOrBelow(sorted: readonly number[], value: number): number {
  return sorted.filter((item) => item <= value).length;
}

describe('bisectLeft と bisectRight', () => {
  it('空の列では、どちらも 0 を返す', () => {
    expect(bisectLeft([], 5)).toBe(0);
    expect(bisectRight([], 5)).toBe(0);
  });

  it('1件の列では、値がその項目より小さいか・等しいか・大きいかで位置が決まる', () => {
    expect([2, 3, 4].map((value) => bisectLeft([3], value))).toEqual([0, 0, 1]);
    expect([2, 3, 4].map((value) => bisectRight([3], value))).toEqual([0, 1, 1]);
  });

  it('同じ値が続く所では、left はその最初、right はその最後の次を返す', () => {
    // 2つの違いはここにだけ出る。取り違えると、同じ値が続く所で1つ以上ずれる。
    const sorted = [1, 2, 2, 2, 3];
    expect(bisectLeft(sorted, 2)).toBe(1);
    expect(bisectRight(sorted, 2)).toBe(4);
  });

  it('先頭の項目と等しい値では、left は 0、right は 1 を返す', () => {
    expect(bisectLeft([1, 2, 3], 1)).toBe(0);
    expect(bisectRight([1, 2, 3], 1)).toBe(1);
  });

  it('全部より小さい値は先頭、全部より大きい値は末尾を返す。無限大も同じ', () => {
    const sorted = [1, 2, 3];
    for (const value of [0, -Infinity]) {
      expect(bisectLeft(sorted, value)).toBe(0);
      expect(bisectRight(sorted, value)).toBe(0);
    }
    for (const value of [9, Infinity]) {
      expect(bisectLeft(sorted, value)).toBe(3);
      expect(bisectRight(sorted, value)).toBe(3);
    }
  });

  it('left は値より小さい項目の数、right は値以下の項目の数に等しい', () => {
    // 長さの偶奇と、同じ値が続く所を含む列で、間の値と項目そのものの値をすべて試す。
    const lists: readonly (readonly number[])[] = [
      [],
      [1],
      [1, 1],
      [0, 1, 1, 3, 5, 5, 5],
      [0, 1, 2, 3, 4, 5, 6, 7],
    ];
    for (const sorted of lists) {
      for (let value = -1; value <= 8; value += 0.5) {
        expect(bisectLeft(sorted, value)).toBe(countBelow(sorted, value));
        expect(bisectRight(sorted, value)).toBe(countAtOrBelow(sorted, value));
      }
    }
  });

  it('keyOf を渡すと、項目から取り出した値で探す', () => {
    const changes = [
      { step: 0, label: 'a' },
      { step: 3, label: 'b' },
      { step: 3, label: 'c' },
      { step: 8, label: 'd' },
    ];
    const stepOf = (change: { step: number }): number => change.step;
    expect(bisectLeft(changes, 3, stepOf)).toBe(1);
    expect(bisectRight(changes, 3, stepOf)).toBe(3);
    // 「7 以下で最後の項目」は、right の位置の1つ前にある。
    expect(changes[bisectRight(changes, 7, stepOf) - 1]?.label).toBe('c');
    expect(bisectLeft(changes, 9, stepOf)).toBe(4);
  });

  it('keyOf を省けるのは number の列だけで、ほかの列では型検査が止める', () => {
    // 省けると、既定の Number が項目を NaN にし、例外にならずに誤った位置を返す。
    // 下の2行の正しい位置はどちらも 1 だが、left は 0、right は列の長さの 2 になる。
    // 多重定義を緩めると下の行が型エラーにならず、`@ts-expect-error` が使われていないとして
    // 型検査が失敗する。
    const changes = [{ step: 1 }, { step: 3 }];
    // @ts-expect-error number の列でなければ keyOf が要る
    expect(bisectLeft(changes, 2)).toBe(0);
    // @ts-expect-error number の列でなければ keyOf が要る
    expect(bisectRight(changes, 2)).toBe(2);
  });

  it('探す値が NaN なら止まる', () => {
    // NaN はどの数と比べても偽になるので、探すと left は 0、right は列の長さを返す。
    // どちらも誤った位置なのに、例外にならずに使われてしまう。
    const sorted = [1, 2, 3];
    expect(() => bisectLeft(sorted, NaN)).toThrow(RangeError);
    expect(() => bisectRight(sorted, NaN)).toThrow(RangeError);
    expect(() => bisectLeft([{ at: 1 }], NaN, (item) => item.at)).toThrow(RangeError);
    expect(() => bisectRight([{ at: 1 }], NaN, (item) => item.at)).toThrow(RangeError);
    // 空の列でも止まる。探す前に確認している。
    expect(() => bisectRight([], NaN)).toThrow(RangeError);
  });

  it('列の中の NaN は検査しないが、位置は Python の bisect と同じになる', () => {
    // 期待値は Python の bisect_left・bisect_right に同じ列と値を渡して得たもの。
    // right を「項目が値以下なら右へ」と書くと、NaN の項目で左へ進み、ここがずれる。
    expect(bisectLeft([1, NaN, 3], 2)).toBe(1);
    expect(bisectRight([1, NaN, 3], 2)).toBe(2);
    expect(bisectLeft([0, NaN, NaN, 5], 1)).toBe(1);
    expect(bisectRight([0, NaN, NaN, 5], 1)).toBe(3);
  });

  it('長さが 2**31 を超える列でも、列の外を読まずに位置を求める', () => {
    // 中点を `(low + high) >> 1` で求めると、和が 2**31 以上のときに負になって列の外を読む。
    // この長さの配列は作れないので、i 番目に i を返す列を Proxy で作り、読んだ位置を控える。
    const length = 2 ** 32 - 1; // 配列の長さの上限
    const reads: number[] = [];
    const huge = new Proxy<number[]>([], {
      get(_target, property) {
        if (property === 'length') return length;
        const index = typeof property === 'string' ? Number(property) : NaN;
        if (!Number.isInteger(index) || index < 0 || index >= length) {
          throw new RangeError(`列の外を読んだ: ${String(property)}`);
        }
        reads.push(index);
        return index;
      },
    });

    const value = 3_000_000_000;
    expect(bisectLeft(huge, value)).toBe(value);
    // 長さが 2**32 - 1 なら、1回の探索で読むのは 32 項目まで。
    expect(reads.length).toBeLessThanOrEqual(32);
    reads.length = 0;
    expect(bisectRight(huge, value)).toBe(value + 1);
    expect(reads.length).toBeLessThanOrEqual(32);
  });
});
