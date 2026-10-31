import { describe, expect, it } from 'vitest';
import { breakUnits } from '../../src/lib/line-break.js';

/*
 * src/lib/line-break.ts の、単位の切り方（breakUnits）のテスト。
 * 行への詰め方（fillLines・breakLines）と、それらが止める値は line-break-fill.test.ts にある。
 */

/** 家族の絵文字。3人の絵文字を、つなぐ印（U+200D）でつないだもの。 */
const FAMILY = '\u{1F468}\u200d\u{1F469}\u200d\u{1F467}';

/** ハートに、絵文字の見え方を選ぶ印（U+FE0F）を付けたもの。 */
const HEART = '❤\ufe0f';

/** 文と、切った単位。 */
const UNITS: readonly (readonly [text: string, units: readonly string[]])[] = [
  ['PDF形式 Wi-Fi', ['PDF', '形', '式', ' ', 'Wi-Fi']],
  ['Hello, world!', ['Hello,', ' ', 'world!']],
  ['（例）。あ「い」', ['（例）。', 'あ', '「い」']],
  ['あ（）い', ['あ', '（）', 'い']],
  ['あ「」。い', ['あ', '「」。', 'い']],
  ['（。', ['（。']],
  ['あ 。', ['あ', ' ', '。']],
  ['。あ', ['。', 'あ']],
  ['あ（', ['あ', '（']],
  [HEART + HEART, [HEART, HEART]],
  ['a\ufe0fb', ['a\ufe0f', 'b']],
  ['あ\u{1F600}い', ['あ', '\u{1F600}', 'い']],
  ['', []],
  ['  ', [' ', ' ']],
];

describe('単位の切り方', () => {
  it.each(UNITS)('%j を表のとおりに切る', (text, expected) => {
    expect(breakUnits(text)).toEqual(expected);
  });

  it.each([...UNITS.map(([text]) => text), 'あ「」い', '（（）', ' （）あ', FAMILY + 'あ', '「' + HEART + '」'])(
    '%j の単位をつなぐと、元の文に戻る',
    (text) => {
      // 字を捨てる・増やす・入れ替える切り方は、折り返した文の中身を変える。
      expect(breakUnits(text).join('')).toBe(text);
    },
  );

  it('ASCII の空白でない字の続きは、記号も含めて1つにまとめる', () => {
    // 英数字だけでまとめると、「Wi-Fi」が「Wi」「-」「Fi」に切れ、行の境目で割れる。
    expect(breakUnits('Wi-Fi(5GHz)')).toEqual(['Wi-Fi(5GHz)']);
    expect(breakUnits('a+b=c')).toEqual(['a+b=c']);
  });

  it('日本語は1字ずつ切る', () => {
    expect(breakUnits('あいう')).toEqual(['あ', 'い', 'う']);
  });

  it('閉じかっこと句点は前に、開きかっこは後ろに付ける', () => {
    expect(breakUnits('あ」。い（う')).toEqual(['あ」。', 'い', '（う']);
  });

  it('控えている開きかっこの次の閉じかっこは、控えとつなぐ', () => {
    // 前の単位に付けると、字の順が入れ替わる。animal-bomber の版は、控えを残したまま閉じかっこを
    // 前の単位に付けるので、「あ（）い」が「あ）」「（い」になり、つなぐと「あ）（い」になる。
    expect(breakUnits('あ（）い')).toEqual(['あ', '（）', 'い']);
    expect(breakUnits('あ「」い')).toEqual(['あ', '「」', 'い']);
  });

  it('空白の直後の行頭禁則の字は、前に付けない', () => {
    // 前に付けると、空白を挟んだ2つが1つの単位になり、空白で折り返せなくなる。
    expect(breakUnits('あ 。')).toEqual(['あ', ' ', '。']);
  });

  it('見え方の印とつなぐ印は、前の字に付ける', () => {
    // 印を1つの単位にすると、行の頭に印だけが出て、前の字と見え方が変わる。
    expect(breakUnits(HEART + 'あ')).toEqual([HEART, 'あ']);
    expect(breakUnits('あ\u200dい')).toEqual(['あ\u200d', 'い']);
  });

  it('絵文字をサロゲートの片割れに切らない', () => {
    // 文字列は UTF-16 の単位で持つので、添字で1つずつ進めると 😀 が2つの片割れに切れる。
    expect('\u{1F600}'.length).toBe(2);
    expect(breakUnits('\u{1F600}\u{1F600}')).toEqual(['\u{1F600}', '\u{1F600}']);
  });
});

describe('書記素では区切らない', () => {
  // 人が1字と見るまとまりでも、2つの印のほかは別の単位になり、行の境目で割れうる。TypeScript には
  // 書記素で区切る Intl.Segmenter があるが、Python の標準ライブラリに同じものが無い。2つの言語で同じ
  // 単位にするため、どちらも2つの印だけを前の字に付ける。

  it('つなぐ印の次の字は、新しい単位になる', () => {
    expect(breakUnits(FAMILY)).toEqual(['\u{1F468}\u200d', '\u{1F469}\u200d', '\u{1F467}']);
    // Intl.Segmenter なら、家族の絵文字は1つのまとまりになる。
    const segments = [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(FAMILY)];
    expect(segments.map((segment) => segment.segment)).toEqual([FAMILY]);
  });

  it.each([
    ['1\ufe0f\u20e3', ['1\ufe0f', '\u20e3']],
    ['\u{1F44B}\u{1F3FD}', ['\u{1F44B}', '\u{1F3FD}']],
    ['\u{1F1EF}\u{1F1F5}', ['\u{1F1EF}', '\u{1F1F5}']],
    ['か\u3099', ['か', '\u3099']],
  ])('囲みの数字・肌の色・国旗・結合する濁点は割れる：%j', (text, expected) => {
    expect(breakUnits(text)).toEqual(expected);
  });
});

describe('禁則で扱わないもの', () => {
  // 行の頭に置かない字は全角の約物だけで、空白かは直前の単位が空白1つかで見る。次の切り方は、行の境目で
  // 禁則に合わない並びを作りうるが、扱わない。animal-bomber の版も同じ切り方。

  it('日本語の直後の ASCII の記号は、別の単位になる', () => {
    // 表に無いので前の字に付かず、行の頭に来うる。
    expect(breakUnits('あ!')).toEqual(['あ', '!']);
    expect(breakUnits('あ)')).toEqual(['あ', ')']);
  });

  it('開きかっこの直後の空白は、かっこと1つの単位になる', () => {
    // 空白として捨てられず、開きかっこが行の終わりに残りうる。その単位は空白1つではないので、続く句点は
    // 空白の後ろでも前に付く。
    expect(breakUnits('（ あ')).toEqual(['（ ', 'あ']);
    expect(breakUnits('あ（ 。い')).toEqual(['あ', '（ 。', 'い']);
  });
});

describe('止める値', () => {
  it.each(['あ\nい', 'a\rb', 'a\r\nb', '\n'])('改行の字を含む文 %j は止める', (text) => {
    // 改行の字は1字の単位になり、幅を測られて行の中に並ぶ。
    expect(() => breakUnits(text)).toThrow(RangeError);
    expect(() => breakUnits(text)).toThrow('改行の字');
  });
});
