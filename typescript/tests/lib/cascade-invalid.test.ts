import { describe, expect, it } from 'vitest';
import { cascade, earliestTimes } from '../../src/lib/cascade.js';
import { fakeReaches } from './fake-reaches.js';

/*
 * src/lib/cascade.ts の、連鎖の一括処理と最も早い時刻が止める値のテスト。
 * たどり方は cascade.test.ts が、時刻の扱いは cascade-earliest-times.test.ts が見る。
 * 受け取る値の約束は、たどり方とは別の理由で変わるので、ファイルを分けた。
 */

describe('要素の数', () => {
  it('負の要素の数は止まる', () => {
    expect(() => cascade(-1, [], fakeReaches([]).reaches)).toThrow('要素の数は 0 以上');
  });

  it.each([1.5, NaN, Infinity, 2 ** 53])('要素の数が %s なら止まる', (count) => {
    // new Uint8Array(1.5) は黙って長さ 1 の配列になる。
    expect(() => cascade(count, [], fakeReaches([]).reaches)).toThrow('安全な整数でない（要素の数）');
  });
});

describe('起点', () => {
  it.each([-1, 3, 4])('範囲の外の起点 %s は、たどる前に止まる', (start) => {
    // 範囲の外の起点が後ろにあっても、前の起点からたどり始める前に止まる。
    const { reaches, asked } = fakeReaches([[0, 1]]);
    expect(() => cascade(3, [0, start], reaches)).toThrow('起点が範囲の外');
    expect(asked).toEqual([]);
  });

  it.each([0.5, NaN, -0.5])('小数や NaN の起点 %s は、たどる前に止まる', (start) => {
    // 0.5 は範囲の確認を通り（0 ≤ 0.5 < 3）、Uint8Array の小数の添字には印が付かない。
    const { reaches, asked } = fakeReaches([[0, 1]]);
    expect(() => cascade(3, [0, start], reaches)).toThrow('安全な整数でない（起点）');
    expect(asked).toEqual([]);
  });

  it('要素の数が 0 なら、どの起点も範囲の外', () => {
    expect(() => cascade(0, [0], fakeReaches([]).reaches)).toThrow('起点が範囲の外');
  });
});

describe('届く相手', () => {
  it.each([-1, 3])('reaches が範囲の外の添字 %s を返すと止まる', (target) => {
    expect(() => cascade(3, [0], fakeReaches([[0, target]]).reaches)).toThrow('0 から届く相手が範囲の外');
  });

  it.each([0.5, NaN])('reaches が小数や NaN の添字 %s を返すと止まる', (target) => {
    expect(() => cascade(3, [0], fakeReaches([[0, target]]).reaches)).toThrow('安全な整数でない（0 から届く相手）');
  });

  it.each([-1, 2, 0.5])('最も早い時刻でも、範囲の外か小数の添字 %s は止まる', (target) => {
    expect(() => earliestTimes([5, 1], fakeReaches([[1, target]]).reaches)).toThrow('1 から届く相手');
  });
});

describe('時刻', () => {
  it('NaN の時刻は、たどる前に止まる', () => {
    // NaN は大小を比べるとどれも偽になり、並べた順が決まらない。
    const { reaches, asked } = fakeReaches([[0, 1]]);
    expect(() => earliestTimes([1, 2, NaN], reaches)).toThrow('時刻が NaN: 2 番目');
    expect(asked).toEqual([]);
  });

  it('空きのある配列の空きも、NaN と同じく止める', () => {
    // eslint の no-sparse-arrays に当たらないよう、長さを決めてから値を入れる。
    const times = new Array<number>(3);
    times[0] = 1;
    times[2] = 2;
    expect(() => earliestTimes(times, fakeReaches([]).reaches)).toThrow('時刻が NaN: 1 番目');
  });
});
