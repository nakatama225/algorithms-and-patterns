import { describe, expect, it } from 'vitest';
import { signedDelta, wrap } from '../../src/lib/ring.js';

/*
 * src/lib/ring.ts の、輪の上の位置のテスト。
 * 固定値の表（WRAPPED・SIGNED_DELTAS）は Python のテスト（test_cross_language.py）も読み、
 * Python のテストの表と比べる。書き換えたら、Python のテストも走らせる。
 * 値は toBe（Object.is）で比べ、最後の桁と 0・-0 の違いまで見る。
 */

/** 位置・長さ・巻き戻した位置。 */
const WRAPPED: readonly (readonly [position: number, length: number, expected: number])[] = [
  // 言語をまたぐ固定値：WRAPPED ここから
  [-1e-20, 72, 0],
  [3.091666666666667, 72, 3.0916666666666686],
  [0.09166666666666667, 72, 0.09166666666666856],
  [71.99999999999999, 72, 0],
  [71.95833333333333, 72, 71.95833333333331],
  [5, 72, 5],
  [8.881784197001252e-16, 72, 0],
  [72, 72, 0],
  [-72.5, 72, 71.5],
  [143.9, 72, 71.9],
  [-0.0, 72, 0],
  [-81.57093076673938, 72, 62.42906923326062],
  [62.42906923326062, 72, 62.429069233260634],
  [1e17, 72, 64],
  [-1e17, 72, 8],
  [123456789.123, 72, 45.122999995946884],
  [-0.1, 0.3, 0.19999999999999998],
  [10, 3, 1],
  [-1, 3, 2],
  // 言語をまたぐ固定値：WRAPPED ここまで
];

/** 始点・終点・長さ・近いほうの道のり。 */
const SIGNED_DELTAS: readonly (readonly [start: number, end: number, length: number, expected: number])[] = [
  // 言語をまたぐ固定値：SIGNED_DELTAS ここから
  [70, 2, 72, 4],
  [2, 70, 72, -4],
  [2, 38, 72, 36],
  [38, 2, 72, -36],
  [5, 5, 72, 0],
  [0.1, 71.9, 72, -0.19999999999998863],
  [71.9, 0.1, 72, 0.19999999999998863],
  [3.0916666666666686, 71.95833333333331, 72, -3.133333333333354],
  [0, 0.5, 1, 0.5],
  [0.5, 0, 1, -0.5],
  [0.2, 0.7, 1, 0.49999999999999994],
  [0.7, 0.2, 1, -0.49999999999999994],
  // 言語をまたぐ固定値：SIGNED_DELTAS ここまで
];

describe('巻き戻し', () => {
  it.each(WRAPPED)('位置 %s を長さ %s で巻き戻すと %s', (position, length, expected) => {
    expect(wrap(position, length)).toBe(expected);
  });

  it('範囲の内の値も、長さを足した和が丸まると最後の桁が変わる', () => {
    // 止まっている間も巻き戻しを通すかどうかで、2つの言語の値が分かれる。
    // 5 は 72 を足した 77 が数でちょうど表せるので変わらない。2 の -50 乗は2進数でちょうど表せる値
    // だが、72 を足すと丸まり、0 になる。
    expect(wrap(3.091666666666667, 72)).toBe(3.0916666666666686);
    expect(wrap(5, 72)).toBe(5);
    expect(wrap(71.99999999999999, 72)).toBe(0);
    expect(wrap(8.881784197001252e-16, 72)).toBe(0);
  });

  it('2回通すと、もう一度変わることがある', () => {
    const once = wrap(-81.57093076673938, 72);
    expect(wrap(once, 72)).not.toBe(once);
  });

  it.each([-0, -72, -1e-20, 72, -144, 0])('位置 %s の答えは正の 0 で、-0 にならない', (position) => {
    expect(Object.is(wrap(position, 72), 0)).toBe(true);
  });

  it.each([-1e-300, -71.99999999999999, -36.5, 1e-300])('位置 %s の答えは 0 以上、長さ未満', (position) => {
    const wrapped = wrap(position, 72);
    expect(wrapped >= 0 && wrapped < 72).toBe(true);
  });
});

describe('符号つきの差', () => {
  it.each(SIGNED_DELTAS)('%s から %s へ（長さ %s）は %s', (start, end, length, expected) => {
    expect(signedDelta(start, end, length)).toBe(expected);
  });

  it('ちょうど半周は、差の符号のまま', () => {
    // 半周を >= で比べると、2 から 38 が -36 に、38 から 2 が +36 に変わる。
    expect(signedDelta(2, 38, 72)).toBe(36);
    expect(signedDelta(38, 2, 72)).toBe(-36);
  });

  it.each(SIGNED_DELTAS)('%s と %s を入れ替えると、符号だけが変わる', (start, end, length, expected) => {
    // 同じ点は 0 のまま（-0 にならない）ので、0 は == で比べる。
    expect(signedDelta(end, start, length) === -expected).toBe(true);
  });

  it.each([
    [72, 2],
    [-1e-20, 2],
    [2, 74],
    [2, -0.5],
  ])('範囲の外の位置（%s から %s）は、巻き戻さずに止める', (start, end) => {
    // 中で巻き戻すと、範囲の内の値でも最後の桁が変わり、渡した2点の差と食い違う。
    expect(() => signedDelta(start, end, 72)).toThrow(RangeError);
    expect(() => signedDelta(start, end, 72)).toThrow('点が範囲の外');
  });
});

describe('止める値', () => {
  it.each([0, -72, NaN, Infinity, -Infinity])('長さ %s は止まる', (length) => {
    // 検査が無いと、負の長さでは答えが負になり（5 が -67）、ほかは NaN になる。
    expect(() => wrap(5, length)).toThrow(RangeError);
    expect(() => wrap(5, length)).toThrow('長さは 0 より大きい有限の数');
    expect(() => signedDelta(0, 0, length)).toThrow('長さは 0 より大きい有限の数');
  });

  it.each([1.5e308, 8.98846567431158e307])('巻き戻す長さ %s は、数の最大値の半分より大きいので止まる', (length) => {
    // 位置によっては、長さを足すときに無限大にあふれる。1e308 を長さ 1.5e308 で巻き戻すとき、検査が
    // 無いと NaN を返す。2つ目の長さは、最大値の半分の次に大きい数（2 の 1023 乗）。
    expect(() => wrap(1e308, length)).toThrow(RangeError);
    expect(() => wrap(1e308, length)).toThrow('数の最大値の半分以下にする');
  });

  it('巻き戻す長さがちょうど数の最大値の半分なら、あふれずに巻き戻す', () => {
    const half = Number.MAX_VALUE / 2;
    expect(wrap(8.988465674311578e307, half)).toBe(8.988465674311577e307);
    expect(wrap(-1, half)).toBe(0);
  });

  it('符号つきの差は、長さの上限を持たない', () => {
    // 差は1周より短いので、1周ぶんを足し引きしてもあふれない。
    expect(signedDelta(0, 1e308, 1.5e308)).toBe(-5e307);
    expect(signedDelta(1e308, 0, 1.5e308)).toBe(5e307);
  });

  it.each([NaN, Infinity, -Infinity])('巻き戻す位置 %s は止まる', (position) => {
    // % は NaN と無限大を黙って NaN にする。
    expect(() => wrap(position, 72)).toThrow('位置が有限の数でない');
  });

  it.each([NaN, Infinity, -Infinity])('差を取る点 %s は止まる', (value) => {
    expect(() => signedDelta(value, 0, 72)).toThrow('始点が範囲の外');
    expect(() => signedDelta(0, value, 72)).toThrow('終点が範囲の外');
  });
});
