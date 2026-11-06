import { describe, expect, it } from 'vitest';
import { mbrSelect } from '../../src/lib/mbr.js';

/*
 * src/lib/mbr.ts の、最小ベイズリスクによる選択のテスト。
 * 多くのテストは、候補を 0 から n - 1 の番号にし、似ている度合いを表 table[候補][相手] で与える。
 * 平均を手で計算でき、関数を呼ぶ向きも表の行と列で見分けられる。Python 版のテストと同じ例を置いている。
 */

/** 表から、似ている度合いを返す関数を作る。 */
function byTable(table: readonly (readonly number[])[]): (candidate: number, other: number) => number {
  return (candidate, other) => table[candidate]?.[other] ?? Number.NaN;
}

/** 同じなら 1、違えば 0。 */
function same(a: string, b: string): number {
  return a === b ? 1 : 0;
}

function charBigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i + 1 < text.length; i += 1) grams.add(text.slice(i, i + 2));
  return grams;
}

/** 文字の 2-gram の集合の重なり。翻訳の候補を比べる物差しの小さな見本。 */
function bigramJaccard(a: string, b: string): number {
  const sa = charBigrams(a);
  const sb = charBigrams(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let common = 0;
  for (const gram of sa) if (sb.has(gram)) common += 1;
  return common / (sa.size + sb.size - common);
}

describe('選び方', () => {
  it('1つの相手と最も似ている候補ではなく、平均が最も高い候補を選ぶ', () => {
    // 候補 1 の平均は (0.9 + 0.1) / 2 = 0.5、候補 2 は (0.3 + 0.6) / 2 = 0.45、候補 0 は 0.3。
    // いちばん大きい 1 つの値（0.9）で選ぶ形とも、平均ではなく最大で比べる形とも、ここで結果が分かれる。
    const table = [
      [0, 0.2, 0.4],
      [0.9, 0, 0.1],
      [0.3, 0.6, 0],
    ];
    expect(mbrSelect([0, 1, 2], byTable(table))).toBe(1);
  });

  it('翻訳の候補では、ほかの候補と共通する訳を選ぶ', () => {
    // 文字の 2-gram の重なりの平均は、順に 0.0597・0.5495・0.4689・0.4675。
    // 「the silver was sent」は、ほかの銀の候補2つのどちらとも最もよく似ている。
    const candidates = [
      'a donkey ate the grain',
      'the silver was sent',
      'the silver is sent',
      'silver was sent',
    ];
    expect(mbrSelect(candidates, bigramJaccard)).toBe(1);
  });

  it('関数を候補と相手の向きで、自分以外の相手と1回ずつ呼ぶ', () => {
    // 呼ぶ回数は n × (n - 1)。向きを逆にすると、向きのある物差しで結果が変わる。
    const calls: [number, number][] = [];
    mbrSelect([0, 1, 2], (candidate, other) => {
      calls.push([candidate, other]);
      return 0;
    });
    expect(calls).toEqual([
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
    ]);
  });

  it('向きのある関数では、候補の側の値で選ぶ', () => {
    // 候補の側の長さだけを返す関数なら、最も長い候補を選ぶ。向きを逆にして呼ぶと、相手の側の長さの
    // 平均になり、自分を除くので最も短い候補を選ぶ。
    const candidates = ['ab', 'abcd', 'a'];
    expect(mbrSelect(candidates, (candidate) => candidate.length)).toBe(1);
    expect(mbrSelect(candidates, (_candidate, other) => other.length)).toBe(2);
  });

  it('平均が同じなら、前にある候補を選ぶ', () => {
    expect(mbrSelect(['a', 'b', 'c'], () => 0.5)).toBe(0);
    const table = [
      [0, 0.1, 0.1],
      [0.5, 0, 0.5],
      [0.5, 0.5, 0],
    ];
    expect(mbrSelect([0, 1, 2], byTable(table))).toBe(1);
  });

  it('同じ値の候補は別々に数え、支持として数える', () => {
    // 「a」が2回出ると、互いに 1 を足し合う。重複を数えたくなければ、呼ぶ側が先に除く。
    expect(mbrSelect(['b', 'a', 'c', 'a'], same)).toBe(1);
  });

  it('候補が1つなら、関数を呼ばずに 0 を返す', () => {
    const never = (): number => {
      throw new Error('候補が1つなら比べる相手がいない');
    };
    expect(mbrSelect(['only'], never)).toBe(0);
  });

  it('候補の列を書き換えない', () => {
    const candidates = ['b', 'a', 'a'];
    expect(mbrSelect(candidates, same)).toBe(1);
    expect(candidates).toEqual(['b', 'a', 'a']);
  });

  it('負の値も受ける', () => {
    // 距離に負の符号を付けたものを渡すと、ほかの点との距離の和が最も小さい点を選ぶ。数直線の上の点なら、
    // それは中央値の点（11）。離れた点（30）に引っ張られない。
    const positions = [0, 10, 11, 12, 30];
    expect(mbrSelect(positions, (a, b) => -Math.abs(a - b))).toBe(2);
  });
});

describe('止める値', () => {
  it('空の列は止まる', () => {
    expect(() => mbrSelect([], same)).toThrow(RangeError);
    expect(() => mbrSelect([], same)).toThrow('候補が空');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '有限の数でない値（%s）が返ると止まる',
    (bad) => {
      // どの候補・相手で発生したかを、止める文に書く。
      const table = [
        [0, 0.5, 0.5],
        [0.5, 0, bad],
        [0.5, 0.5, 0],
      ];
      expect(() => mbrSelect([0, 1, 2], byTable(table))).toThrow(RangeError);
      expect(() => mbrSelect([0, 1, 2], byTable(table))).toThrow('有限の数でない: 候補 1、相手 2');
    },
  );

  it('NaN があると、比べ方と並び順で結果が変わる', () => {
    // 検査を外すと、NaN の平均の候補を選ぶかが、比べ方と並び順で変わる。> で大きいほうを残す畳み込みは、
    // NaN が先頭なら NaN を、後ろなら 1 を残す。Math.max は NaN を返す。
    const larger = (a: number, b: number): number => (b > a ? b : a);
    expect([Number.NaN, 1].reduce(larger)).toBeNaN();
    expect([1, Number.NaN].reduce(larger)).toBe(1);
    expect(Math.max(1, Number.NaN)).toBeNaN();
  });
});
