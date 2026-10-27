import { describe, expect, it } from 'vitest';
import { deriveSeed } from '../../src/lib/rng.js';

/*
 * src/lib/rng.ts の deriveSeed のテスト。乱数の本体（Rng）のテストは rng.test.ts にある。
 * 種を導く式と乱数を生成する式は別々に変わるので、ファイルを分けた。
 *
 * 下の DERIVED_SEEDS は言語をまたぐ固定値で、書き方の決まりは rng.test.ts の冒頭と同じ。
 * Python のテスト（python/tests/lib/test_cross_language.py）がこのファイルも読み、
 * Python のテストの同じ名前の表と等しいことを検証する。表を書き換えたら、Python のテストも走らせる。
 */

/** 元の種と番号、そこから導いた種。 */
const DERIVED_SEEDS: readonly (readonly [seed: number, stream: number, derived: number])[] = [
  // 言語をまたぐ固定値：DERIVED_SEEDS ここから
  [12345, 0, 2654423432],
  [12345, 1, 1013891931],
  [12345, 2, 3668335914],
  [0, 0, 2654435761],
  [0, 4294967294, 1640531535],
  [0xffffffff, 0, 1640531534],
  [0xffffffff, 7, 239350391],
  [-1, 7, 239350391],
  [4294967301, 3, 2027808449],
  // 言語をまたぐ固定値：DERIVED_SEEDS ここまで
];

/** 0 から `size - 1` までの列。 */
function range(size: number): number[] {
  return Array.from({ length: size }, (_, i) => i);
}

describe('固定値', () => {
  it('種と番号から導いた種が表のとおり', () => {
    for (const [seed, stream, derived] of DERIVED_SEEDS) {
      expect(deriveSeed(seed, stream), `${seed}, ${stream}`).toBe(derived);
    }
  });
});

describe('種と番号', () => {
  it('番号が違えば違う種になり、元の種とも違う', () => {
    // 番号に 1 を足さないと、番号 0 が元の種をそのまま返す。
    for (const seed of [0, 12345, 0xffffffff]) {
      const derived = [...range(1000), 2 ** 32 - 2].map((stream) => deriveSeed(seed, stream));
      expect(new Set(derived).size, String(seed)).toBe(derived.length);
      expect(derived, String(seed)).not.toContain(seed);
    }
  });

  it('元の種は、下位 32 ビットだけを使う', () => {
    for (const stream of [0, 7]) {
      expect(deriveSeed(-1, stream)).toBe(deriveSeed(0xffffffff, stream));
      expect(deriveSeed(2 ** 32 + 5, stream)).toBe(deriveSeed(5, stream));
    }
  });

  it('導いた種は 0 以上 2**32 未満の整数', () => {
    for (const seed of [-(2 ** 40), -1, 0, 2 ** 40]) {
      for (const stream of [0, 1, 2 ** 32 - 2]) {
        const derived = deriveSeed(seed, stream);
        expect(Number.isInteger(derived) && derived >= 0 && derived < 2 ** 32).toBe(true);
      }
    }
  });
});

describe('範囲の外の引数は止まる', () => {
  it.each([-1, 2 ** 32 - 1, 2 ** 40])('deriveSeed の番号 %s', (stream) => {
    // 2**32 - 1 は、1 を足すと下位 32 ビットが 0 になり、元の種がそのまま返る。
    expect(() => deriveSeed(12345, stream)).toThrow(RangeError);
  });

  // 以下は TypeScript だけ。number は整数と小数を区別しない。Python 版は int の型で受け、
  // 型検査が止める。
  it.each([
    [1.5, 0],
    [2 ** 53, 0],
    [0, 0.5],
    [0, NaN],
  ])('deriveSeed(%s, %s) は止まる', (seed, stream) => {
    expect(() => deriveSeed(seed, stream)).toThrow(RangeError);
  });
});
