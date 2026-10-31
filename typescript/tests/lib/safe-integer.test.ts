import { describe, expect, it } from 'vitest';
import { checkAtLeast, checkInteger } from '../../src/lib/safe-integer.js';

/*
 * src/lib/safe-integer.ts の、安全な整数の確認のテスト。
 * 止めたときは、例外の型と文の全体を比べる。文の頭だけを見ると、名前や値を入れ損ねても通る。
 */

/** `call` が投げた例外を返す。投げなければ失敗にする。 */
function thrown(call: () => void): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  throw new Error('止まらなかった');
}

/** `call` が RangeError で止まり、文が `message` と同じであることを見る。 */
function expectRangeError(call: () => void, message: string): void {
  const error = thrown(call);
  expect(error).toBeInstanceOf(RangeError);
  expect((error as RangeError).message).toBe(message);
}

describe('checkInteger', () => {
  it.each([0, -0, 1, -1, 2 ** 53 - 1, -(2 ** 53 - 1)])('安全な整数 %s は通す', (value) => {
    expect(() => checkInteger('値', value)).not.toThrow();
  });

  it.each([
    [2 ** 53, '9007199254740992'],
    [-(2 ** 53), '-9007199254740992'],
    [0.5, '0.5'],
    [Number.NaN, 'NaN'],
    [Infinity, 'Infinity'],
    [-Infinity, '-Infinity'],
  ])('%s は止め、文に名前と値を入れる', (value, shown) => {
    // 2**53 は 2**53 + 1 と同じ数になり、隣の整数と区別できない。
    expectRangeError(() => checkInteger('種', value), `安全な整数でない（種）: ${shown}`);
  });
});

describe('checkAtLeast', () => {
  it.each([
    [1, 1],
    [2, 1],
    [0, 0],
    [-3, -3],
  ])('%s は下限 %s 以上なので通す', (value, min) => {
    expect(() => checkAtLeast('値', value, min)).not.toThrow();
  });

  it('下限より1小さい値は止め、文を名前で始める', () => {
    expectRangeError(() => checkAtLeast('列の数', 0, 1), '列の数は 1 以上にする: 0');
    expectRangeError(() => checkAtLeast('最大', -1, 0), '最大は 0 以上にする: -1');
  });

  it('NaN は下限の文でなく、安全な整数でないとして止める', () => {
    // 前提：NaN は大小の比べがどれも偽になるので、下限の確認だけでは通ってしまう。
    const value = Number.NaN;
    expect(value < 0).toBe(false);
    expectRangeError(() => checkAtLeast('探す歩数', value, 0), '安全な整数でない（探す歩数）: NaN');
  });

  it('小数は、下限の上でも下でも、安全な整数でないとして止める', () => {
    expectRangeError(() => checkAtLeast('刻みの数', 2.5, 0), '安全な整数でない（刻みの数）: 2.5');
    // 下限を先に見ると、こちらは「刻みの数は 0 以上にする」の文になる。
    expectRangeError(() => checkAtLeast('刻みの数', -0.5, 0), '安全な整数でない（刻みの数）: -0.5');
  });
});
