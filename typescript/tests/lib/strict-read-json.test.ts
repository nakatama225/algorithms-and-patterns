import { describe, expect, it } from 'vitest';
import { parseJsonObject, readFloat, readInt } from '../../src/lib/strict-read.js';
import { expectStop } from './error-head.js';

/*
 * src/lib/strict-read.ts の、JSON の文字列を読み込む関数（parseJsonObject）のテスト。
 * 項目を1つ取り出す関数は strict-read.test.ts が見る。文字列の読み方（JSON.parse が黙って読むものを
 * どう断るか）は、項目の型の約束とは別の理由で変わるので、ファイルを分けた。
 */

it('外側のオブジェクトを返す', () => {
  expect(parseJsonObject('{"count": 1, "names": ["a"]}')).toEqual({ count: 1, names: ['a'] });
});

describe('断る数', () => {
  it.each([
    '{"x": 1e400}',
    '{"x": -1e400}',
    // JavaScript は整数も小数として読むので、桁の多い整数も無限大になる。
    `{"x": ${'1'.repeat(400)}}`,
    // 読まない項目の奥にあっても、読み込む所で止める。
    '{"x": [1, {"y": 1E400}]}',
  ])('無限大になる数は止まる：%s', (text) => {
    // JSON.parse は、どれも黙って Infinity として読む。
    const error = expectStop(() => parseJsonObject(text), 'JSON として読めない: 小数の範囲を超える数');
    expect(error.cause).toBeInstanceOf(RangeError);
  });

  it.each(['{"x": NaN}', '{"x": Infinity}', '{"x": -Infinity}'])('JSON に無い数は止まる：%s', (text) => {
    // JSON.parse が SyntaxError で断る。Python の json は数として読むので、Python 版は自分で断る。
    const error = expectStop(() => parseJsonObject(text), 'JSON として読めない');
    expect(error.cause).toBeInstanceOf(SyntaxError);
  });

  it.each<[string, number]>([
    ['{"x": 1e300}', 1e300],
    ['{"x": 1e-400}', 0],
  ])('小数の範囲に収まる指数の数は読める：%s', (text, expected) => {
    // 上の表が「指数の数をどれも止める」だけで通ってしまわないための対照。
    expect(readFloat(parseJsonObject(text), 'x')).toBe(expected);
  });
});

describe('外側', () => {
  it.each([
    ['[1]', 'JSON の外側がオブジェクトでない: 配列'],
    ['1', 'JSON の外側がオブジェクトでない: 1'],
    ['"a"', 'JSON の外側がオブジェクトでない: "a"'],
    ['null', 'JSON の外側がオブジェクトでない: null'],
    ['true', 'JSON の外側がオブジェクトでない: true'],
  ])('外側がオブジェクトでなければ止まる：%s', (text, head) => {
    expectStop(() => parseJsonObject(text), head);
  });

  it.each(['', '{', "{'a': 1}", '{"a": 1,}', '{"a": 1} x'])('JSON として読めない文字列は止まる：%j', (text) => {
    expectStop(() => parseJsonObject(text), 'JSON として読めない');
  });
});

describe('JSON.parse が別の例外を出すもの', () => {
  it('入れ子が深すぎる文字列も、ReadError で止まる', () => {
    // 無限大を断るために JSON.parse に渡す関数（reviver）は、入れ子を深さの数だけ呼び出しを重ねて
    // たどるので、深すぎると RangeError になる。どの深さで止まるかは実行環境で違う。
    const depth = 100_000;
    expectStop(() => parseJsonObject(`{"x": ${'['.repeat(depth)}${']'.repeat(depth)}}`), 'JSON として読めない');
  });
});

describe('見ないもの', () => {
  it('同じ項目名が2度あると、後の値を読む', () => {
    // 断らない。JSON.parse は後の値を使い、見つける手段が無い。Python 版もそろえて断らない。
    expect(readInt(parseJsonObject('{"a": 1, "a": 2}'), 'a', { minimum: 0, maximum: 9 })).toBe(2);
  });

  it('-0 は、整数の項目では 0、小数の項目では -0 として読む', () => {
    // Python の json は -0 を整数の 0 として読むので、Python 版は小数の項目でも 0 になる。
    const obj = parseJsonObject('{"n": -0, "x": -0}');
    expect(Object.is(readInt(obj, 'n', { minimum: -1, maximum: 1 }), 0)).toBe(true);
    expect(Object.is(readFloat(obj, 'x'), -0)).toBe(true);
  });

  it('__proto__ という名前の項目も、ただの項目として読む', () => {
    // JSON.parse は自分の項目として作る。Python 版にも同じテストがある。
    expect(readInt(parseJsonObject('{"__proto__": 1}'), '__proto__', { minimum: 0, maximum: 1 })).toBe(1);
  });

  it('JSON.parse が返す値では、1.0 と 1e3 を整数と見分けられない', () => {
    // JSON.parse は 1.0 を 1 に、1e3 を 1000 にする。Python 版は小数として読み、整数の項目では止める。
    // Node.js 26 は reviver の第3引数に書いたままの字面を渡すが、型の設定（ES2022）の JSON.parse の
    // 型は reviver に2つの引数しか無いので、使っていない。
    const obj = parseJsonObject('{"a": 1.0, "b": 1e3}');
    expect(readInt(obj, 'a', { minimum: 0, maximum: 1000 })).toBe(1);
    expect(readInt(obj, 'b', { minimum: 0, maximum: 1000 })).toBe(1000);
  });
});
