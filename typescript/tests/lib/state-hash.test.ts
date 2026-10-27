import { describe, expect, it } from 'vitest';
import { StateHasher } from '../../src/lib/state-hash.js';

/*
 * src/lib/state-hash.ts のテスト。部品の約束（混ぜる順・区切り・小数のビット列・受ける範囲・
 * 8桁の表記）を確認する。
 *
 * 下の4つの表は言語をまたぐ固定値で、書き方の決まりは rng.test.ts の冒頭と同じ。
 * Python のテスト（python/tests/lib/test_cross_language.py）がこのファイルも読み、
 * Python のテストの同じ名前の表と等しいことを検証する。表を書き換えたら、Python のテストも走らせる。
 * 表のセルは数だけなので、文字列は符号位置の並びで書く。値は2つの言語の実装で別々に出し、
 * 一致を確認してから貼った。空の要約と MIXED_HASHES の1行目は、animal-bomber の
 * TypeScript 版が出した値（811c9dc5・2fbdec8f）とも同じ。
 */

/** 要約と、左から順に混ぜた整数。整数が無い行は、何も混ぜていない要約。 */
const INT_HASHES: readonly (readonly [hash: number, ...values: number[]])[] = [
  // 言語をまたぐ固定値：INT_HASHES ここから
  [0x811c9dc5],
  [0x4b95f515, 0],
  [0xfb69b604, 1],
  [0xe3160fb1, -1],
  [0xe3160fb1, 0xffffffff],
  [0xcb952b95, -2147483648],
  [0x6316d931, 2147483647],
  [0xcb952b95, 2147483648],
  [0xded89066, 1, 2],
  [0x0677f096, 2, 1],
  // 言語をまたぐ固定値：INT_HASHES ここまで
];

/** 要約と、左から順に混ぜた小数。 */
const FLOAT_HASHES: readonly (readonly [hash: number, ...values: number[]])[] = [
  // 言語をまたぐ固定値：FLOAT_HASHES ここから
  [0x0c927168, 0.5],
  [0x9be17165, 0.0],
  [0x1be23ae5, -0.0],
  [0x075ad7f6, 0.30000000000000004],
  [0xc5cc6029, 0.3],
  [0x8c557dc0, -1.5],
  [0x3e801244, 5e-324],
  [0xec87c46d, 1.7976931348623157e308],
  [0xbc918289, 0.1, 0.2],
  [0x77344ba9, 0.2, 0.1],
  // 言語をまたぐ固定値：FLOAT_HASHES ここまで
];

/**
 * 要約と、混ぜた文字列1つの符号位置。UTF-8 で 1・2・3・4 バイトになる文字（'abc'・'é'・
 * '日本語'・'𠮷'）と、その境目の符号位置。
 */
const TEXT_HASHES: readonly (readonly [hash: number, ...codePoints: number[]])[] = [
  // 言語をまたぐ固定値：TEXT_HASHES ここから
  [0x4b95f515],
  [0xfe7f7188, 0x61, 0x62, 0x63],
  [0xd64871f3, 0xe9],
  [0x571bbdce, 0x65e5, 0x672c, 0x8a9e],
  [0x6e7cd8fe, 0x20bb7],
  [0xdc24fb3d, 0x0, 0x7f, 0x80, 0x7ff, 0x800, 0xd7ff, 0xe000, 0xffff, 0x10000, 0x10ffff],
  // 言語をまたぐ固定値：TEXT_HASHES ここまで
];

/** 要約と、整数・小数・文字列（符号位置）・真偽値（1 か 0）・整数をこの順で混ぜた値。 */
const MIXED_HASHES: readonly (readonly [
  hash: number,
  first: number,
  value: number,
  flag: number,
  last: number,
  ...codePoints: number[],
])[] = [
  // 言語をまたぐ固定値：MIXED_HASHES ここから
  [0x2fbdec8f, 1, 0.5, 1, -7, 0x61, 0x62, 0x63],
  [0x52067a81, 0xffffffff, -0.0, 0, 0],
  [0x254964f5, -2147483648, 0.1, 0, 2147483648, 0x65e5, 0x672c, 0x8a9e],
  // 言語をまたぐ固定値：MIXED_HASHES ここまで
];

/** 整数を左から順に混ぜた要約。 */
function ints(...values: number[]): StateHasher {
  const hasher = new StateHasher();
  for (const value of values) hasher.addInt(value);
  return hasher;
}

/** 小数を左から順に混ぜた要約。 */
function floats(...values: number[]): StateHasher {
  const hasher = new StateHasher();
  for (const value of values) hasher.addFloat(value);
  return hasher;
}

/** バイト列を FNV-1a の 32 ビット版で混ぜた値。部品を通さずに期待値を作る。 */
function fnv1a(bytes: readonly number[]): number {
  let value = 0x811c9dc5;
  for (const byte of bytes) {
    // 掛け算は桁あふれしない BigInt で求めて、2**32 で割った余りを取る（Math.imul を使わない別の道筋）。
    value = Number((BigInt((value ^ byte) >>> 0) * 0x01000193n) % 2n ** 32n);
  }
  return value;
}

describe('固定値', () => {
  it('整数を混ぜた要約が表のとおり', () => {
    // 整数のバイトの順（下位から）と、2の補数への読み直しがずれると食い違う。
    for (const [hash, ...values] of INT_HASHES) {
      expect(ints(...values).value, String(values)).toBe(hash);
    }
  });

  it('小数を混ぜた要約が表のとおり', () => {
    // ビット列のバイトの順を実行環境に任せると、環境によって食い違う。
    for (const [hash, ...values] of FLOAT_HASHES) {
      expect(floats(...values).value, String(values)).toBe(hash);
    }
  });

  it('文字列を混ぜた要約が表のとおり', () => {
    // UTF-8 でなく UTF-16 の符号単位を混ぜると、ASCII の外で食い違う。
    for (const [hash, ...codePoints] of TEXT_HASHES) {
      const text = String.fromCodePoint(...codePoints);
      expect(new StateHasher().addText(text).value, String(codePoints)).toBe(hash);
    }
  });

  it('種類の違う値を続けて混ぜた要約が表のとおり', () => {
    for (const [hash, first, value, flag, last, ...codePoints] of MIXED_HASHES) {
      const text = String.fromCodePoint(...codePoints);
      const hasher = new StateHasher().addInt(first).addFloat(value).addText(text);
      expect(hasher.addBool(flag === 1).addInt(last).value, String(first)).toBe(hash);
    }
  });
});

describe('順と区切り', () => {
  it('混ぜる順が違えば別の値になる', () => {
    // 順を問わない混ぜ方（足し算など）にすると、入れ替わりを見逃す。
    expect(ints(1, 2).value).not.toBe(ints(2, 1).value);
    expect(floats(0.1, 0.2).value).not.toBe(floats(0.2, 0.1).value);
  });

  it('文字列の区切りが違えば別の値になる', () => {
    // バイトの数を混ぜないと、'ab' と 'c' が 'a' と 'bc' と同じ値になる。
    const a = new StateHasher().addText('ab').addText('c');
    const b = new StateHasher().addText('a').addText('bc');
    expect(a.value).not.toBe(b.value);
  });

  it('値の種類は混ぜない', () => {
    // 種類は、呼ぶ側が決めた混ぜる順で決まる前提にしている。
    // 真偽値は 1 と 0 の整数と、空の文字列はバイトの数 0 と同じ要約になる。
    expect(new StateHasher().addBool(true).value).toBe(ints(1).value);
    expect(new StateHasher().addBool(false).value).toBe(ints(0).value);
    expect(new StateHasher().addText('').value).toBe(ints(0).value);
  });
});

describe('混ぜるバイトの並び', () => {
  // 2つの言語で同じ要約を出すために決めた並び。期待するバイトは手で書いた。
  it('整数は、2の補数で下位のバイトから4バイト', () => {
    expect(ints(0x01020304).value).toBe(fnv1a([4, 3, 2, 1]));
    expect(ints(-2).value).toBe(fnv1a([0xfe, 0xff, 0xff, 0xff]));
  });

  it('小数は、IEEE 754 の 64 ビットを下位のバイトから8バイト', () => {
    // 1.0 のビット列は 0x3ff0000000000000。
    expect(floats(1.0).value).toBe(fnv1a([0, 0, 0, 0, 0, 0, 0xf0, 0x3f]));
  });

  it('文字列は、UTF-8 のバイト列と、文字の数でなくバイトの数', () => {
    // 文字の数は言語で数え方が違う（'𠮷' を TypeScript の length は 2、Python の len は 1）。
    // 'é' は1文字で2バイト。
    expect(new StateHasher().addText('é').value).toBe(fnv1a([0xc3, 0xa9, 2, 0, 0, 0]));
  });
});

describe('小数のビット列', () => {
  it('わずかに違う小数を見分ける', () => {
    // 丸めてから混ぜると、ずれの始まりの小さな差を見逃す。
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(floats(0.1 + 0.2).value).not.toBe(floats(0.3).value);
  });

  it('0 と -0 は、等しくても別の値になる', () => {
    // `0 === -0` は true。そう書くと静的検査（no-compare-neg-zero）が止めるので、`===` と同じく
    // 0 と -0 を等しいとみなす includes で見る。
    expect([0].includes(-0)).toBe(true);
    expect(floats(0).value).not.toBe(floats(-0).value);
  });

  it('無限大は混ぜられる', () => {
    // 止めるのは NaN だけ。無限大のビット列は1通りに決まっている。
    const values = [Infinity, -Infinity, Number.MAX_VALUE].map((value) => floats(value).value);
    expect(new Set(values).size).toBe(3);
  });
});

describe('範囲', () => {
  it('32 ビットの端の整数は混ぜられる', () => {
    for (const value of [-(2 ** 31), 2 ** 32 - 1]) {
      const hashed = ints(value).value;
      expect(hashed >= 0 && hashed < 2 ** 32, String(value)).toBe(true);
    }
  });

  it('符号つきと符号なしで同じビットの並びになる整数は、同じ値になる', () => {
    // 符号つきの差と、符号なしの 32 ビットの値の両方を受けるための約束。
    expect(ints(-1).value).toBe(ints(0xffffffff).value);
    expect(ints(-(2 ** 31)).value).toBe(ints(2 ** 31).value);
  });

  it.each([-(2 ** 31) - 1, 2 ** 32, 10 ** 12])(
    '32 ビットに収まらない整数 %s は、要約を変えずに止まる',
    (value) => {
      // 下位 32 ビットだけを黙って混ぜると、違う値が同じ要約になる。
      const hasher = ints(7);
      expect(() => hasher.addInt(value)).toThrow('2**32 未満の整数');
      expect(hasher.value).toBe(ints(7).value);
    },
  );

  it.each([NaN, -NaN, Infinity - Infinity])('NaN（%s）は、要約を変えずに止まる', (value) => {
    // NaN を書き出したときのビット列は、仕様が実装に選ばせている。
    const hasher = ints(7);
    expect(() => hasher.addFloat(value)).toThrow('NaN');
    expect(hasher.value).toBe(ints(7).value);
  });

  it.each(['\ud800', 'a\udfffb', '\udc00\ud800'])(
    '対になっていないサロゲート %j は、要約を変えずに止まる',
    (text) => {
      // UTF-8 にできない。U+FFFD に置き換えると、違う文字列が同じ要約になる。
      // 3つ目は、後ろ半分が前に来ていて、対になっていない。
      const hasher = ints(7);
      expect(() => hasher.addText(text)).toThrow('サロゲート');
      expect(hasher.value).toBe(ints(7).value);
    },
  );

  it.each([1.5, -0.5, NaN, Infinity, -Infinity])(
    '整数でない数 %s は、addInt では止まる（TypeScript だけ）',
    (value) => {
      // number は整数と小数を区別しない。`| 0` に通すと、1.5 は 1 に、NaN は 0 に黙って変わる。
      // Python 版は int の型で受け、型検査が止める。
      const hasher = ints(7);
      expect(() => hasher.addInt(value)).toThrow(RangeError);
      expect(hasher.value).toBe(ints(7).value);
    },
  );
});

describe('表記', () => {
  it('16進表記は、0 で埋めた8桁の小文字', () => {
    // 先頭の 0 を落とすと、桁で揃えて見比べられない。
    expect(ints(2, 1).hex).toBe('0677f096');
    expect(ints(-1).hex).toBe('e3160fb1');
  });

  it('16進表記は、値と同じ数を表す', () => {
    for (const [, ...values] of INT_HASHES) {
      const hasher = ints(...values);
      expect(hasher.hex, String(values)).toMatch(/^[0-9a-f]{8}$/);
      expect(Number.parseInt(hasher.hex, 16), String(values)).toBe(hasher.value);
    }
  });

  it('混ぜるメソッドは自分を返し、続けて書ける', () => {
    const hasher = new StateHasher();
    expect(hasher.addInt(1)).toBe(hasher);
    expect(hasher.addFloat(0.5)).toBe(hasher);
    expect(hasher.addBool(true)).toBe(hasher);
    expect(hasher.addText('a')).toBe(hasher);
  });
});
