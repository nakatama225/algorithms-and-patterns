import { expect, it } from 'vitest';
import { parseDecimal } from '../../src/lib/decimal-text.js';
import { expectCallerError, expectStop } from './error-head.js';

/*
 * src/lib/decimal-text.ts の、10 進の整数を書いた文字列の読み取り（parseDecimal）のテスト。
 * 止まったことに加えて、止めた文の頭（何の数か、なぜか）まで比べる。
 */

const OPTIONS = { name: 'n', maximum: 100 } as const;

it.each<[string, number]>([
  ['0', 0],
  ['7', 7],
  ['100', 100],
])('書く側が書く形を読み、最大そのものも読める：%s', (text, expected) => {
  expect(parseDecimal(text, OPTIONS)).toBe(expected);
});

it.each([
  // Number('') は 0。
  '',
  // Number は前後の空白と改行を読み飛ばす。
  ' 1',
  '1 ',
  '1\n',
  '\t1',
  // 頭の 0 は、書く側が書かない形。
  '01',
  '00',
  '１',
  '1１',
  '٣',
  '-1',
  '+1',
  // Number('1e3') は 1000、Number('0x10') は 16。
  '1e3',
  '0x10',
  '1_000',
  '1.0',
  'a',
])('書く側が書かない形は止まる：%j', (text) => {
  expectStop(() => parseDecimal(text, OPTIONS), 'n が 10 進の整数の形でない');
});

// 安全な整数より大きい数は、範囲より先に、安全な整数でないとして止まる（下のテスト）。readInt と同じ順。
it.each(['101', '999', '1000', '9007199254740991'])('最大より大きい数は止まる：%s', (text) => {
  expectStop(() => parseDecimal(text, OPTIONS), `n が 0 以上 100 以下でない: ${text}`);
});

it('安全な整数より大きい数は、範囲の外としてでなく、安全な整数でないとして止まる', () => {
  // Number('9007199254740993') は 2**53 に丸まる。丸まった数を読むと、隣の数と区別できない。
  const options = { name: 'n', maximum: Number.MAX_SAFE_INTEGER };
  expect(parseDecimal('9007199254740991', options)).toBe(Number.MAX_SAFE_INTEGER);
  expectStop(() => parseDecimal('9007199254740993', options), 'n が安全な整数でない: 9007199254740993');
  expectStop(() => parseDecimal('1'.repeat(400), options), `n が安全な整数でない: ${'1'.repeat(400)}`);
});

it('最大が 0 なら 0 だけを読む', () => {
  expect(parseDecimal('0', { name: 'n', maximum: 0 })).toBe(0);
  expectStop(() => parseDecimal('1', { name: 'n', maximum: 0 }), 'n が 0 以上 0 以下でない: 1');
});

it.each<[number, string]>([
  // NaN を渡すと大小の比べが偽になり、どの数も最大以下に見える。
  [Number.NaN, '安全な整数でない（最大）: NaN'],
  [2 ** 60, '安全な整数でない（最大）: 1152921504606847000'],
  [-1, '最大は 0 以上にする: -1'],
])('呼ぶ側が渡した最大の誤りは、ReadError でなく RangeError で止まる：%s', (maximum, head) => {
  expectCallerError(() => parseDecimal('5', { name: 'n', maximum }), head);
});
