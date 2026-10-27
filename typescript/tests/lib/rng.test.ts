import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/lib/rng.js';

/*
 * 言語をまたぐ固定値。Python のテストにも同じ名前の表があり、Python のテスト
 * （python/tests/lib/test_cross_language.py）が、このファイルを文字列として読んで、
 * 2つが等しいことを検証する。値は2つの言語の実装で別々に出し、一致を確認してから貼った。
 *
 * 囲みの注釈は、配列の最初の行と最後の行に置く。囲みの外に置いた行は、このファイルの
 * テストは使うのに、Python のテストは比べられないので、Python のテストが止まる。
 * 囲みの注釈の間には、1行に1件だけを `[数, 数, …],` の形で書く。空の行・注釈・
 * 2件を1行に書いた行があると、Python のテストが止まる。囲みの注釈の文言と名前も変えない。
 * 表を書き換えたら、Python のテストも走らせる（AGENTS.md の検査）。
 *
 * 種を導く関数（deriveSeed）のテストと、その固定値の表は rng-derive-seed.test.ts にある。
 */

/** 種と、その種で最初に生成した5つの値。 */
const FIRST_VALUES: readonly (readonly [seed: number, ...values: number[]])[] = [
  // 言語をまたぐ固定値：FIRST_VALUES ここから
  [12345, 0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061],
  [1, 0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849],
  [0, 0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111, 0.46732782293111086],
  [0xffffffff, 0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677, 0.8452364315744489],
  // 言語をまたぐ固定値：FIRST_VALUES ここまで
];

/** 種と、その種で 0 から 9 までの列の順を入れ替えた結果。 */
const SHUFFLED: readonly (readonly [seed: number, ...order: number[]])[] = [
  // 言語をまたぐ固定値：SHUFFLED ここから
  [2024, 9, 2, 0, 1, 7, 3, 4, 5, 6, 8],
  [12345, 6, 4, 8, 0, 1, 7, 5, 3, 2, 9],
  [0xffffffff, 3, 0, 9, 4, 2, 7, 6, 5, 1, 8],
  // 言語をまたぐ固定値：SHUFFLED ここまで
];

/** 表の、`seed` で最初に生成した5つの値。 */
function firstValuesOf(seed: number): number[] {
  const row = FIRST_VALUES.find(([rowSeed]) => rowSeed === seed);
  if (row === undefined) throw new Error(`表に無い種: ${seed}`);
  return row.slice(1);
}

/** 0 から `size - 1` までの列。 */
function range(size: number): number[] {
  return Array.from({ length: size }, (_, i) => i);
}

describe('固定値', () => {
  it('種ごとに、最初に生成する5つの値が表のとおり', () => {
    // 掛け算を Math.imul でなく `*` で書くと、2**53 を超えて丸められ、ここが食い違う。
    for (const [seed, ...values] of FIRST_VALUES) {
      const rng = new Rng(seed);
      expect(values.map(() => rng.random()), String(seed)).toEqual(values);
    }
  });

  it('種ごとに、順を入れ替えた結果が表のとおり', () => {
    // 混ぜる向き（後ろから）と、生成した値から添字を作る式がずれると食い違う。
    for (const [seed, ...order] of SHUFFLED) {
      expect(new Rng(seed).shuffled(range(10)), String(seed)).toEqual(order);
    }
  });
});

describe('種と状態', () => {
  it('負の種と 2**32 以上の種は、下位 32 ビットとして扱う', () => {
    // Python 版の `seed & 0xFFFFFFFF` と同じ扱い。-1 は 0xffffffff と同じ並びになる。
    for (const [seed, same] of [
      [-1, 0xffffffff],
      [2 ** 32 + 5, 5],
    ] as const) {
      const a = new Rng(seed);
      const b = new Rng(same);
      expect(a.state).toBe(same);
      expect(range(5).map(() => a.random())).toEqual(range(5).map(() => b.random()));
    }
  });

  it('状態は、生成したあとも 0 以上 2**32 未満', () => {
    // 状態は1回ごとに一定の幅だけ進み、2**32 で割った余りになる（mulberry32 の決まり）。
    // 進めたあとの `>>> 0` を忘れても、生成する値は変わらない（ビット演算が 32 ビットに
    // 読み直す）。状態だけが範囲の外へ出て、状態を比べたときに食い違って見える。
    // それをここで見つける。
    const rng = new Rng(0xffffffff);
    for (let k = 1; k <= 3; k += 1) {
      rng.random();
      expect(rng.state).toBe((0xffffffff + k * 0x6d2b79f5) % 2 ** 32);
    }
  });

  it('違う種からは違う並びが出る', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(range(20).map(() => a.random())).not.toEqual(range(20).map(() => b.random()));
  });
});

describe('生成する回数', () => {
  it('random・below・between・chance・choice は1回呼ぶと乱数を1回だけ生成し、clone は生成しない', () => {
    // 生成する回数が呼び方で変わると、同じ種でもそれ以降の並びが全部ずれる。
    const rng = new Rng(1);
    const steps: readonly (() => unknown)[] = [
      () => rng.random(),
      () => rng.below(10),
      () => rng.below(1),
      () => rng.between(3, 5),
      () => rng.chance(0.5),
      () => rng.choice(['a', 'b', 'c']),
    ];
    expect(rng.calls).toBe(0);
    steps.forEach((step, index) => {
      step();
      expect(rng.calls).toBe(index + 1);
    });
    rng.clone();
    expect(rng.calls).toBe(steps.length);
  });

  it('chance は 0 なら必ず外れ、1 なら必ず当たり、どちらも乱数を1回生成する', () => {
    const rng = new Rng(11);
    expect(range(1000).some(() => rng.chance(0))).toBe(false);
    expect(range(1000).every(() => rng.chance(1))).toBe(true);
    expect(rng.calls).toBe(2000);
  });

  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [10, 9],
  ])('shuffled は、要素の数より1少ない回数だけ生成する：%i 個なら %i 回', (size, calls) => {
    const rng = new Rng(5);
    rng.shuffled(range(size));
    expect(rng.calls).toBe(calls);
  });
});

describe('範囲と添字', () => {
  it('below は、生成した値に上限を掛けて切り捨てた整数', () => {
    // 期待値は、表の最初の5つの値から別に求める。2**53 - 1 は受けられる最大の上限。
    for (const limit of [1, 7, 10, 2 ** 32, 2 ** 53 - 1]) {
      const rng = new Rng(12345);
      const expected = firstValuesOf(12345).map((value) => Math.floor(value * limit));
      expect(range(5).map(() => rng.below(limit)), String(limit)).toEqual(expected);
    }
  });

  it('below は 0 以上上限未満の整数を、端の値まで出す', () => {
    const rng = new Rng(42);
    expect(new Set(range(1000).map(() => rng.below(7)))).toEqual(new Set(range(7)));
  });

  it('between は start 以上 stop 未満の整数を、端の値まで出す', () => {
    const rng = new Rng(9);
    const expected = new Set(range(7).map((i) => i - 3));
    expect(new Set(range(1000).map(() => rng.between(-3, 4)))).toEqual(expected);
  });

  it('between は、幅がちょうど 2**53 - 1 の範囲からも選ぶ', () => {
    // 幅の確認を `>=` で比べる形にすると、ここで止まる。
    const first = firstValuesOf(12345)[0] ?? NaN;
    const start = -(2 ** 52);
    const expected = start + Math.floor(first * (2 ** 53 - 1));
    expect(new Rng(12345).between(start, 2 ** 52 - 1)).toBe(expected);
  });

  it('choice は、below で選んだ添字の要素を返す', () => {
    const items = [...'abcdefghij'];
    const rng = new Rng(12345);
    const expected = firstValuesOf(12345).map((value) => items[Math.floor(value * 10)]);
    expect(range(5).map(() => rng.choice(items))).toEqual(expected);
  });

  it('choice は、1個の列からその要素を選び、乱数を1回生成する', () => {
    const rng = new Rng(1);
    expect(rng.choice(['x'])).toBe('x');
    expect(rng.calls).toBe(1);
  });

  it('chance は、生成した値が確率より小さいときだけ当たる', () => {
    // 表の値ちょうどを確率に渡すと外れ、それよりわずかに大きいと当たる。`<=` で比べると逆になる。
    const first = firstValuesOf(12345)[0] ?? NaN;
    expect(new Rng(12345).chance(first)).toBe(false);
    expect(new Rng(12345).chance(first + Number.EPSILON)).toBe(true);
  });
});

describe('範囲の外の引数は、乱数を生成する前に止まる', () => {
  it.each([0, -1])('below(%i)', (limit) => {
    // 0 を渡して 0 が返ると、「選べるものが無い」ことに気づけない。
    const rng = new Rng(1);
    expect(() => rng.below(limit)).toThrow(RangeError);
    expect(rng.calls).toBe(0);
  });

  it.each([
    [3, 3],
    [5, 3],
  ])('between(%i, %i)', (start, stop) => {
    const rng = new Rng(1);
    expect(() => rng.between(start, stop)).toThrow(`start=${start}, stop=${stop}`);
    expect(rng.calls).toBe(0);
  });

  it('between の幅が 2**53 - 1 を超えると、渡した start と stop を出して止まる', () => {
    // 両端はどちらも安全な整数。幅の確認を below に任せると、渡していない「上限」の値が出る。
    const rng = new Rng(1);
    expect(() => rng.between(-(2 ** 52), 2 ** 52)).toThrow(
      `start=${-(2 ** 52)}, stop=${2 ** 52}`,
    );
    expect(rng.calls).toBe(0);
  });

  it.each([50, 1.01, -0.1, NaN])('chance(%s)', (probability) => {
    // 百分率（50）と取り違えると、黙って「必ず当たる」になる。
    const rng = new Rng(1);
    expect(() => rng.chance(probability)).toThrow(RangeError);
    expect(rng.calls).toBe(0);
  });

  it('空の列からは選べない', () => {
    // 文言まで見る。空の確認が無くても below(0) が止まるので、例外の種類だけでは区別できない。
    const rng = new Rng(1);
    expect(() => rng.choice([])).toThrow('空の列からは選べない');
    expect(rng.calls).toBe(0);
  });
});

describe('整数でない引数（TypeScript だけ）', () => {
  // number は整数と小数を区別しない。Python 版は int の型で受け、型検査が止める。
  it.each([1.5, NaN, Infinity, -Infinity, 2 ** 53])('種 %s は止まる', (seed) => {
    // `>>> 0` に通すと、1.5 は 1 に、NaN と無限大は 0 になり、黙って別の種になる。
    // 2**53 以上の数は、受け取った時点ですでに丸められているかもしれない。
    expect(() => new Rng(seed)).toThrow(RangeError);
  });

  it.each([1.5, NaN, Infinity, 2 ** 53])('below の上限 %s は止まる', (limit) => {
    const rng = new Rng(1);
    expect(() => rng.below(limit)).toThrow(RangeError);
    expect(rng.calls).toBe(0);
  });

  it.each([
    [0.5, 3],
    [0, 2.5],
    // 幅（stop - start）は安全な整数でも、start か stop が安全な整数でなければ止まる。
    // 下の2つは、below の確認では止まらず、start と stop の確認だけが止める。
    [-(2 ** 53), 10 - 2 ** 53],
    [2 ** 53 - 10, 2 ** 53],
  ])('between(%s, %s) は止まる', (start, stop) => {
    const rng = new Rng(1);
    expect(() => rng.between(start, stop)).toThrow(RangeError);
    expect(rng.calls).toBe(0);
  });
});

describe('渡した列と、元の乱数を書き換えない', () => {
  it('shuffled は渡した列を書き換えず、要素を失わない', () => {
    const source = Object.freeze(range(10));
    const result = new Rng(2024).shuffled(source);
    expect(source).toEqual(range(10));
    // 混ざっていること自体も確認する。そのまま返していたら意味が無い。
    expect(result).not.toEqual(source);
    expect([...result].sort((a, b) => a - b)).toEqual(source);
  });

  it('shuffled は、0 個と 1 個の列でも新しい配列を返す', () => {
    // 引数をそのまま返すと、呼び出し側が結果を書き換えたときに元も変わる。
    for (const items of [[], [7]]) {
      const result = new Rng(5).shuffled(items);
      expect(result).toEqual(items);
      expect(result).not.toBe(items);
    }
  });

  it('clone は元を進めずに、同じ先を見せる', () => {
    const rng = new Rng(555);
    rng.random();
    const before = rng.state;
    const ahead = rng.clone();
    const predicted = range(5).map(() => ahead.random());
    expect(rng.state).toBe(before);
    expect(range(5).map(() => rng.random())).toEqual(predicted);
  });

  it('clone は、生成した回数を 0 から数え直す', () => {
    const rng = new Rng(1);
    rng.random();
    rng.random();
    expect(rng.clone().calls).toBe(0);
  });
});
