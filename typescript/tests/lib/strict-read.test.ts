import { describe, expect, it } from 'vitest';
import {
  type JsonObject,
  readArray,
  readFloat,
  readInt,
  readObject,
  readString,
} from '../../src/lib/strict-read.js';
import { expectCallerError, expectStop } from './error-head.js';

/*
 * src/lib/strict-read.ts の、項目を1つ取り出す関数のテスト。
 * JSON の文字列の読み込みは strict-read-json.test.ts、決めた文字列への読み替えは
 * strict-read-choice.test.ts が見る。項目の型と範囲の約束は、文字列の読み方とも、種類の決め方とも
 * 別の理由で変わるので、ファイルを分けた。
 */

/** 0 以上 10 以下の整数として読む。 */
function count0To10(obj: JsonObject, key: string): number {
  return readInt(obj, key, { minimum: 0, maximum: 10 });
}

describe('項目が無い', () => {
  it.each([
    ['readInt', count0To10],
    ['readFloat', readFloat],
    ['readString', readString],
    ['readArray', (obj: JsonObject, key: string) => readArray(obj, key, readString)],
    ['readObject', readObject],
  ])('無い項目は、どの読み取りでも止まる：%s', (_name, read: (obj: JsonObject, key: string) => unknown) => {
    // 既定値で埋めると、読んだ側だけ違う値で先へ進む。
    expectStop(() => read({ size: 1 }, 'count'), 'count が無い');
  });

  it.each(['toString', '__proto__', 'constructor'])('オブジェクトが持つ名前 %s も、項目に無ければ無い', (key) => {
    // `in` で有無を見ると、'toString' in {} は真になる。'__proto__' は Object.prototype を返し、
    // オブジェクトとして読めてしまう。
    expectStop(() => readObject({}, key), `${key} が無い`);
  });

  it('値が null の項目は、無いのでなく型が違う', () => {
    expectStop(() => count0To10({ count: null }, 'count'), 'count が安全な整数でない: null');
  });

  it('値が undefined の項目は、書いてあるので型が違う', () => {
    // JSON からは作られないが、手で作ったオブジェクトにはある。
    expectStop(() => count0To10({ count: undefined }, 'count'), 'count が安全な整数でない: undefined');
  });
});

describe('整数', () => {
  it.each<[unknown, string]>([
    [true, 'count が安全な整数でない: true'],
    [1.5, 'count が安全な整数でない: 1.5'],
    ['1', 'count が安全な整数でない: "1"'],
    [[1], 'count が安全な整数でない: 配列'],
    [{ value: 1 }, 'count が安全な整数でない: オブジェクト'],
    [Object.create(null), 'count が安全な整数でない: オブジェクト'],
    [NaN, 'count が安全な整数でない: NaN'],
    [Infinity, 'count が安全な整数でない: Infinity'],
    // 2**53 は、隣の 2**53 + 1 と区別できない。範囲の確認より先に止める。
    [2 ** 53, 'count が安全な整数でない: 9007199254740992'],
    [11, 'count が 0 以上 10 以下でない: 11'],
    [-1, 'count が 0 以上 10 以下でない: -1'],
  ])('整数でない値と範囲の外は止まる：%s', (raw, head) => {
    expectStop(() => count0To10({ count: raw }, 'count'), head);
  });

  it.each([0, 10, 5])('最小と最大そのものは読める：%s', (raw) => {
    // 上の表が「どの値も止める」だけで通ってしまわないための対照。
    expect(count0To10({ count: raw }, 'count')).toBe(raw);
  });

  it('範囲が1つの値だけでも読める', () => {
    expect(readInt({ count: -3 }, 'count', { minimum: -3, maximum: -3 })).toBe(-3);
  });

  it('安全な整数の端まで読める', () => {
    const range = { minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER };
    expect(readInt({ count: Number.MAX_SAFE_INTEGER }, 'count', range)).toBe(Number.MAX_SAFE_INTEGER);
    expect(readInt({ count: -Number.MAX_SAFE_INTEGER }, 'count', range)).toBe(-Number.MAX_SAFE_INTEGER);
  });

  it('-0 は 0 として返す', () => {
    // JSON.parse('-0') は -0。Object.is で比べる所（このリポジトリの Command の既定の比べ方）では、
    // -0 と 0 は別の値になる。
    expect(Object.is(count0To10({ count: -0 }, 'count'), 0)).toBe(true);
  });

  it.each<[number, number, string]>([
    // NaN を渡すと大小の比べがどれも偽になり、どの値も範囲の内側に見える。
    [Number.NaN, 10, '安全な整数でない（最小）: NaN'],
    [0, Number.NaN, '安全な整数でない（最大）: NaN'],
    [0, Infinity, '安全な整数でない（最大）: Infinity'],
    [0, 10.5, '安全な整数でない（最大）: 10.5'],
    [10, 0, '範囲の最小は最大以下にする: 10 > 0'],
  ])('呼ぶ側が渡した範囲の誤りは、ReadError でなく RangeError で止まる：%s から %s', (minimum, maximum, head) => {
    expectCallerError(() => readInt({ count: 5 }, 'count', { minimum, maximum }), head);
  });
});

describe('小数', () => {
  it.each<[unknown, string]>([
    [true, 'ratio が数でない: true'],
    ['1.5', 'ratio が数でない: "1.5"'],
    [null, 'ratio が数でない: null'],
    [NaN, 'ratio が有限の数でない: NaN'],
    [Infinity, 'ratio が有限の数でない: Infinity'],
    [-Infinity, 'ratio が有限の数でない: -Infinity'],
  ])('数でない値と NaN と無限大は止まる：%s', (raw, head) => {
    // parseJsonObject を通さずに作ったものには、NaN と無限大もありうる。
    expectStop(() => readFloat({ ratio: raw }, 'ratio'), head);
  });

  it.each([1.5, 2, 1e300])('数を読む：%s', (raw) => {
    expect(readFloat({ ratio: raw }, 'ratio')).toBe(raw);
  });

  it('-0 はそのまま返す', () => {
    // 整数の項目と違い、小数の -0 は 0 と別の値として持つことがある。
    expect(Object.is(readFloat({ ratio: -0 }, 'ratio'), -0)).toBe(true);
  });
});

describe('文字列', () => {
  it.each<[unknown, string]>([
    [1, 'name が文字列でない: 1'],
    [null, 'name が文字列でない: null'],
    [['a'], 'name が文字列でない: 配列'],
  ])('文字列でない値は止まる：%s', (raw, head) => {
    expectStop(() => readString({ name: raw }, 'name'), head);
  });

  it('空の文字列も読む', () => {
    expect(readString({ name: '' }, 'name')).toBe('');
  });
});

describe('配列', () => {
  it('要素を1つずつ読み、止めた文は要素の位置で始まる', () => {
    expectStop(() => readArray({ names: ['a', 2, 'c'] }, 'names', readString), 'names[1] が文字列でない: 2');
  });

  it('範囲を決めた整数の要素も読める', () => {
    expect(readArray({ sizes: [0, 10] }, 'sizes', count0To10)).toEqual([0, 10]);
    expectStop(() => readArray({ sizes: [0, 10, 11] }, 'sizes', count0To10), 'sizes[2] が 0 以上 10 以下でない');
  });

  it('オブジェクトの要素は、読んだオブジェクトから項目を読む', () => {
    const rows = readArray({ rows: [{ size: 1 }, { size: 2 }] }, 'rows', readObject);
    expect(rows.map((row) => count0To10(row, 'size'))).toEqual([1, 2]);
  });

  it('空の配列は空の配列', () => {
    expect(readArray({ names: [] }, 'names', readString)).toEqual([]);
  });

  it('空きのある配列の空きは、読まずに飛ばさない', () => {
    // map は空きを飛ばすので、要素を読まずに空きのある配列を返してしまう。
    // eslint の no-sparse-arrays に当たらないよう、長さを決めてから値を入れる。
    const names = new Array<unknown>(3);
    names[0] = 'a';
    names[2] = 'c';
    expectStop(() => readArray({ names }, 'names', readString), 'names[1] が文字列でない: undefined');
  });

  it.each<[unknown, string]>([
    ['ab', 'names が配列でない: "ab"'],
    [{ 0: 'a', length: 1 }, 'names が配列でない: オブジェクト'],
    [null, 'names が配列でない: null'],
  ])('配列でなければ止まる：%s', (raw, head) => {
    expectStop(() => readArray({ names: raw }, 'names', readString), head);
  });
});

describe('オブジェクト', () => {
  it.each<[unknown, string]>([
    [[], 'config がオブジェクトでない: 配列'],
    [null, 'config がオブジェクトでない: null'],
    ['{}', 'config がオブジェクトでない: "{}"'],
    [() => 1, 'config がオブジェクトでない: 関数'],
  ])('オブジェクトでなければ止まる：%s', (raw, head) => {
    expectStop(() => readObject({ config: raw }, 'config'), head);
  });

  it('中の項目も同じ関数で読む', () => {
    const config = readObject({ config: { size: 3 } }, 'config');
    expect(count0To10(config, 'size')).toBe(3);
    expectStop(() => count0To10(config, 'count'), 'count が無い');
  });
});

it('余分な項目があっても、読む項目は読める', () => {
  // 書く側が項目を足しても、読む側が知っている項目は読める。
  expect(count0To10({ count: 3, addedLater: [1, 2], note: null }, 'count')).toBe(3);
});
