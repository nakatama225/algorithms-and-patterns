import { describe, expect, it } from 'vitest';
import { percentile } from '../../src/lib/percentile.js';

/*
 * src/lib/percentile.ts の、パーセンタイルのテスト。
 * 多くのテストは 1 から n までの値の列を使う。返った値が、そのまま小さいほうから数えた位置
 * （1 から数える）になる。
 */

/** 小数の割合を掛けて切り上げる形が、列の長さ 1〜2000 のどこかで整数の形と食い違う百分率。 */
const FLOAT_MISMATCHED = [7, 14, 17, 27, 28, 34, 54, 55, 56, 67, 68, 81];

/** 1 から n までの値の列。 */
function oneTo(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** 整数の割り算で求めた ceil(percent × n / 100)（余りが出れば1つ上げる）。 */
function exactRank(percent: number, n: number): number {
  const product = percent * n;
  return (product - (product % 100)) / 100 + (product % 100 === 0 ? 0 : 1);
}

/** 小数の割合を掛けて切り上げる形。 */
function floatRank(percent: number, n: number): number {
  return Math.ceil((percent / 100) * n);
}

describe('位置', () => {
  it.each([
    [100, 99, 99],
    [600, 99, 594],
    [100, 100, 100],
    [100, 50, 50],
    [100, 1, 1],
    [3, 50, 2],
    [1, 1, 1],
    [1, 100, 1],
  ])('%s 件の %s パーセンタイルは %s 番目の値で、補間しない', (n, percent, expected) => {
    // 位置の数え方がずれると、1つ上や1つ下の値を返し、合否の判定が甘くなる。
    expect(percentile(oneTo(n), percent)).toBe(expected);
  });

  it('150 件の 99 は、切り上げた 149 番目', () => {
    // 148.5 番目。Python の round（偶数への丸め）なら 148 番目。Math.round は 149 にするので、
    // このテストは Math.round との違いを見分けず、下の 160 件のテストが見分ける。
    expect(percentile(oneTo(150), 99)).toBe(149);
    expect(Math.round(148.5)).toBe(149);
  });

  it('160 件の 99 は、切り上げた 159 番目', () => {
    // 158.4 番目。最も近い整数に丸めると 158 番目を返し、本来より小さい値になる。
    expect(percentile(oneTo(160), 99)).toBe(159);
    expect(Math.round((99 * 160) / 100)).toBe(158);
  });

  it('100 件の 7 は 7 番目で、小数の割合を掛ける形とは違う', () => {
    // 小数の割合を掛けると 7.000000000000001 になり、切り上げて8番目を返す。
    expect(percentile(oneTo(100), 7)).toBe(7);
    expect((7 / 100) * 100).toBe(7.000000000000001);
    expect(floatRank(7, 100)).toBe(8);
  });

  it.each(FLOAT_MISMATCHED)('百分率 %s は、小数の割合を掛けると食い違う長さでも、整数で求めた位置を返す', (percent) => {
    const mismatched = oneTo(2000).filter((n) => floatRank(percent, n) !== exactRank(percent, n));
    expect(mismatched.length).toBeGreaterThan(0);
    for (const n of mismatched.slice(0, 3)) {
      expect(percentile(oneTo(n), percent)).toBe(exactRank(percent, n));
    }
  });

  it('小数の割合を掛けて食い違うのは、1 から 100 のうち 12 個', () => {
    // 百分率を整数で受ける理由。よく使う 50・95・99 は、この 12 個に含まれない。
    const lengths = oneTo(2000);
    const found = oneTo(100).filter((percent) =>
      lengths.some((n) => floatRank(percent, n) !== exactRank(percent, n)),
    );
    expect(found).toEqual(FLOAT_MISMATCHED);
  });

  it('99 件までは、99 パーセンタイルが最大と同じ', () => {
    // 99 件の 99 は ceil(98.01) = 99 番目。p99 を合否に使う側は、100 件より少ない列では合否を出さない。
    expect(percentile(oneTo(99), 99)).toBe(99);
    expect(percentile(oneTo(100), 99)).toBe(99);
    expect(percentile(oneTo(100), 100)).toBe(100);
  });
});

describe('並べ方', () => {
  it('測った順のまま渡しても、小さい順に並べてから位置を取る', () => {
    // 並べずに位置を取ると、測った順の3番目（17）を返す。
    const values = [30, 1, 17, 2, 16];
    expect(percentile(values, 50)).toBe(16);
    expect(percentile(values, 1)).toBe(1);
    expect(percentile(values, 100)).toBe(30);
  });

  it('数の大小で並べ、文字列の順では並べない', () => {
    // sort に比べる関数を渡さないと、数を文字列にして並べる。[10, 9, 1] は [1, 10, 9] になり、
    // 真ん中の値が 10 になる。
    expect([10, 9, 1].sort()).toEqual([1, 10, 9]);
    expect(percentile([10, 9, 1], 50)).toBe(9);
    expect(percentile([10, 9, 1], 100)).toBe(10);
  });

  it('渡した列は書き換えない', () => {
    // sort は配列そのものを並べ替える。写さずに当てると、呼んだ側の列の順が変わる。
    const values = [3, 1, 2];
    expect(percentile(values, 50)).toBe(2);
    expect(values).toEqual([3, 1, 2]);
  });

  it('同じ値が続く列でも位置で選ぶ', () => {
    expect(percentile([5, 5, 5, 5], 1)).toBe(5);
    expect(percentile([2, 1, 2, 3, 2], 50)).toBe(2);
    expect(percentile([2, 1, 2, 3, 2], 20)).toBe(1);
  });

  it('無限大は並べて端に置く', () => {
    const values = [Infinity, 1, -Infinity];
    expect(percentile(values, 100)).toBe(Infinity);
    expect(percentile(values, 1)).toBe(-Infinity);
  });
});

describe('止める値', () => {
  it.each([0, 101, -1, 1000])('百分率 %s は、1 から 100 の外なので止まる', (percent) => {
    // 端に丸めると、呼び出しの誤りに気づけない。0 は位置が 0 番目になり、検査が無いと undefined を返す。
    expect(() => percentile(oneTo(10), percent)).toThrow(RangeError);
    expect(() => percentile(oneTo(10), percent)).toThrow('1 以上 100 以下の整数');
  });

  it.each([50.5, 0.5, NaN, Infinity])('百分率 %s は、整数でないので止まる', (percent) => {
    // 50.0 は 50 と同じ値なので、区別できず受ける。
    expect(() => percentile(oneTo(10), percent)).toThrow('1 以上 100 以下の整数');
  });

  it('百分率の 50.0 は 50 と同じ値なので受ける', () => {
    expect(percentile(oneTo(10), 50.0)).toBe(5);
  });

  it('百分率に真偽値を渡すと、型検査が止め、実行しても整数でないので止まる', () => {
    // Python の bool は int の子なので型検査を通り、実行時に TypeError で止める。
    // @ts-expect-error 百分率は数で渡す
    expect(() => percentile(oneTo(10), true)).toThrow('1 以上 100 以下の整数');
  });

  it('空の列は止まる', () => {
    expect(() => percentile([], 50)).toThrow(RangeError);
    expect(() => percentile([], 50)).toThrow('空の列');
  });

  it.each([[[1, NaN]], [[NaN]], [[3, NaN, 1, 2]]])('NaN を含む列 %s は止まる', (values) => {
    // NaN はどの値と比べても偽なので、並べた順が崩れる。
    expect(() => percentile(values, 50)).toThrow(RangeError);
    expect(() => percentile(values, 50)).toThrow('NaN');
  });
});
