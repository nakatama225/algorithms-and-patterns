import { describe, expect, it } from 'vitest';
import { ReadError, readChoice } from '../../src/lib/strict-read.js';
import { expectStop } from './error-head.js';

/*
 * src/lib/strict-read.ts の、文字列の項目を決めた文字列のどれかとして読む関数（readChoice）のテスト。
 * 項目を1つ取り出す関数は strict-read.test.ts が見る。種類の決め方は、項目の型の約束とは別の理由で
 * 変わるので、ファイルを分けた。
 */

const SHAPES = ['circle', 'square'] as const;

describe('決めた文字列への読み替え', () => {
  it('決めた文字列のどれかなら、その文字列を返す', () => {
    const shape: 'circle' | 'square' = readChoice({ shape: 'square' }, 'shape', SHAPES);
    expect(shape).toBe('square');
  });

  it('知らない値は止まり、決めた文字列を文に並べる', () => {
    // 既定の種類に倒すと、書く側が種類を足したことに気づけない。
    const error = expectStop(
      () => readChoice({ shape: 'triangle' }, 'shape', SHAPES),
      'shape が知らない値: "triangle"（"circle"・"square" のどれか）',
    );
    // Python 版は種類（Enum）が出した例外を __cause__ に残す。ここは種類に渡さないので、元の例外は無い。
    expect(error.cause).toBeUndefined();
  });

  it.each(['CIRCLE', 'Circle', ' circle', '', 'toString', 'length'])('大文字や前後の空白、配列の持つ名前 %j は読まない', (raw) => {
    // 配列の includes で比べるので、配列が持つ名前（length など）にも合わない。
    expectStop(() => readChoice({ shape: raw }, 'shape', SHAPES), 'shape が知らない値');
  });

  it.each<[unknown, string]>([
    [true, 'shape が文字列でない: true'],
    [1, 'shape が文字列でない: 1'],
    [null, 'shape が文字列でない: null'],
  ])('文字列でない値は、比べる前に止まる：%s', (raw, head) => {
    expectStop(() => readChoice({ shape: raw }, 'shape', SHAPES), head);
  });

  it('項目が無ければ止まる', () => {
    expectStop(() => readChoice({}, 'shape', SHAPES), 'shape が無い');
  });

  it('決めた文字列が空なら、どの値も読めない', () => {
    expect(() => readChoice({ shape: 'circle' }, 'shape', [])).toThrow(ReadError);
  });
});
