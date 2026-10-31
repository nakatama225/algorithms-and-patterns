import { describe, expect, it } from 'vitest';
import { breakLines, fillLines } from '../../src/lib/line-break.js';

/*
 * src/lib/line-break.ts の、行への詰め方（fillLines・breakLines）と止める値のテスト。
 * 幅は文字数を数える偽の測る関数で測る。単位の切り方は line-break.test.ts が見る。
 * 単位を詰める約束（測る回数・空白の扱い）は、切り方とは別の理由で変わるので、ファイルを分けた。
 */

/** 文字列の字の数 × 10。字は符号位置で数える（`.length` だと絵文字が2字になる）。 */
function textWidth(text: string): number {
  return [...text].length * 10;
}

/** 並べた単位の字の数 × 10。 */
function byLength(line: readonly string[]): number {
  return textWidth(line.join(''));
}

function isSpace(unit: string): boolean {
  return unit === ' ';
}

/** 1字ずつの並び。 */
function chars(text: string): string[] {
  return [...text];
}

describe('詰め方', () => {
  it('行の幅は、単位ごとの和でなく行のまま測って詰める', () => {
    // 1字ずつ測ると 12（丸めの分だけ広い）、行のまま測ると 1字 10 の測り方。幅 30 に3字まで収まる
    // （和は 36 で超えるが、行は 30）。和で決めると2字になる。
    const measure = (line: readonly string[]): number => ([...line.join('')].length === 1 ? 12 : byLength(line));
    expect(fillLines(chars('あいうえお'), 30, measure, isSpace)).toEqual([
      ['あ', 'い', 'う'],
      ['え', 'お'],
    ]);
  });

  it('和が幅に収まるうちは、行全体を測らない', () => {
    // 長い文で、単位を足すたびに行全体を測ると、行の長さの2乗の手間になる。
    const calls: string[][] = [];
    const measure = (line: readonly string[]): number => {
      calls.push([...line]);
      return byLength(line);
    };
    expect(fillLines(chars('あいうえお'), 50, measure, isSpace)).toEqual([chars('あいうえお')]);
    expect(calls.filter((call) => call.length > 1)).toEqual([]);
  });

  it('和が幅を超えたときだけ、行全体を測って決める', () => {
    const calls: string[][] = [];
    const measure = (line: readonly string[]): number => {
      calls.push([...line]);
      return byLength(line);
    };
    expect(fillLines(chars('あいうえお'), 30, measure, isSpace)).toEqual([
      ['あ', 'い', 'う'],
      ['え', 'お'],
    ]);
    expect(calls.filter((call) => call.length > 1)).toEqual([chars('あいうえ')]);
  });

  it('行の頭と終わりの空白を捨て、幅を超える1つは1行にする', () => {
    // 空白を残すと、行の頭が空白で始まり、行の終わりの空白が幅を食う。
    const units = ['ab', ' ', 'cdefgh', ' ', ' ', 'i', ' '];
    expect(fillLines(units, 30, byLength, isSpace)).toEqual([['ab'], ['cdefgh'], ['i']]);
  });

  it('文の頭の空白も捨てる', () => {
    // 行の頭の空白を残すと、1行目だけが空白の分だけ右にずれる。
    expect(fillLines([' ', ' ', 'ab'], 30, byLength, isSpace)).toEqual([['ab']]);
    expect(breakLines('  ab', 30, textWidth)).toEqual(['ab']);
  });

  it('行の中の空白は残す', () => {
    expect(fillLines(['ab', ' ', 'cd'], 50, byLength, isSpace)).toEqual([['ab', ' ', 'cd']]);
  });

  it('空白の幅も行の和に数える', () => {
    // 空白の幅を和に足さないと、和が収まって見え、行全体を測らないまま幅を超える。
    expect(fillLines(['a', ' ', ' ', ' ', 'b'], 30, byLength, isSpace)).toEqual([['a'], ['b']]);
    expect(breakLines('ab cd', 40, textWidth)).toEqual(['ab', 'cd']);
  });

  it('空の並びと空白だけの並びは、空の行1つ', () => {
    expect(fillLines([], 30, byLength, isSpace)).toEqual([[]]);
    expect(fillLines([' ', ' '], 30, byLength, isSpace)).toEqual([[]]);
  });

  it('幅が無限大なら1行にまとまる', () => {
    expect(fillLines(chars('あいう'), Infinity, byLength, isSpace)).toEqual([['あ', 'い', 'う']]);
  });

  it('単位の型を問わず、文と種類の組も詰められる', () => {
    // 区切りごとに切った単位に種類を添え、種類で幅と空白の扱いを変える使い方。枠で囲む単位は、
    // 左右の余白の分だけ広く、折り返さない。
    type Unit = readonly [text: string, kind: 'boxed' | 'plain'];
    const units: Unit[] = [['F1', 'boxed'], ...['で', '開', 'く。'].map((text): Unit => [text, 'plain'])];
    const measure = (line: readonly Unit[]): number => {
      let total = 0;
      for (const [text, kind] of line) total += textWidth(text) + (kind === 'boxed' ? 20 : 0);
      return total;
    };
    const lines = fillLines(units, 30, measure, ([text, kind]) => text === ' ' && kind !== 'boxed');
    expect(lines).toEqual([
      [['F1', 'boxed']],
      [
        ['で', 'plain'],
        ['開', 'plain'],
      ],
      [['く。', 'plain']],
    ]);
  });
});

describe('文から行へ', () => {
  it('単位で切ってから詰め、行の文字列にする', () => {
    // 閉じかっこと句点は前の字と同じ行に、開きかっこは後ろの字と同じ行に置く。
    expect(breakLines('これは（例）です。', 30, textWidth)).toEqual(['これは', '（例）', 'です。']);
  });

  it('測る関数は、単位をつないだ文字列を受け取る', () => {
    const seen: string[] = [];
    const measure = (text: string): number => {
      seen.push(text);
      return textWidth(text);
    };
    expect(breakLines('Wi-Fi あ', 50, measure)).toEqual(['Wi-Fi', 'あ']);
    expect(seen).toContain('Wi-Fi あ');
  });

  it('絵文字は1字として測る', () => {
    expect(breakLines('\u{1F600}\u{1F600}\u{1F600}', 20, textWidth)).toEqual(['\u{1F600}\u{1F600}', '\u{1F600}']);
  });

  it('空の文は、空の行1つ', () => {
    expect(breakLines('', 30, textWidth)).toEqual(['']);
  });

  it.each(['　ab', '\tab'])('全角の空白とタブは空白として扱わず、行の頭でも残す：%j', (text) => {
    // 空白として捨てるのは ASCII の空白（U+0020）だけ。ほかの空白は1字の単位。
    expect(breakLines(text, 30, textWidth)).toEqual([text]);
  });
});

describe('止める値', () => {
  it.each([0, -1, NaN])('幅 %s は止まる', (width) => {
    // NaN の幅は比べるとどれも偽になり、検査が無いと黙って1行にまとまる。
    expect(() => fillLines(chars('あいう'), width, byLength, isSpace)).toThrow(RangeError);
    expect(() => fillLines(chars('あいう'), width, byLength, isSpace)).toThrow('幅は 0 より大きい数');
  });

  it.each([-1, NaN])('測る関数が %s を返すと止まる', (value) => {
    // 負の幅や NaN は和を崩し、行の幅を超えて詰める。
    expect(() => fillLines(chars('あいう'), 30, () => value, isSpace)).toThrow(RangeError);
    expect(() => fillLines(chars('あいう'), 30, () => value, isSpace)).toThrow('測る関数は 0 以上の数を返す');
  });

  it('空白の幅を測った値も見る', () => {
    const measure = (line: readonly string[]): number => (line.length === 1 && line[0] === ' ' ? NaN : byLength(line));
    expect(() => fillLines(['a', ' ', 'b'], 30, measure, isSpace)).toThrow('測る関数は 0 以上の数を返す');
  });

  it('行全体を測った値も見る', () => {
    const measure = (line: readonly string[]): number => (line.length > 1 ? NaN : byLength(line));
    expect(() => fillLines(chars('あいう'), 15, measure, isSpace)).toThrow('測る関数は 0 以上の数を返す');
  });

  it('改行の字を含む文は止める', () => {
    expect(() => breakLines('あ\nい', 30, textWidth)).toThrow('改行の字');
  });
});
