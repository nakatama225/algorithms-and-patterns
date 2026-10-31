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
  ['あ 。', ['あ 。']],
  ['あ ・', ['あ', ' ', '・']],
  [' 。', [' ', '。']],
  ['。あ', ['。', 'あ']],
  ['あ（', ['あ', '（']],
  ['あ（ い', ['あ', '（ い']],
  ['あ（ 。い', ['あ', '（ 。', 'い']],
  [HEART + HEART, [HEART, HEART]],
  ['a\ufe0fb', ['a\ufe0f', 'b']],
  ['あ（\ufe0fい', ['あ', '（\ufe0fい']],
  ['あ「\u200dい」', ['あ', '「\u200dい」']],
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
    // 前の単位に付けると、字の順が入れ替わる。控えを残したまま閉じかっこを前の単位に付けると、
    // 「あ（）い」が「あ）」「（い」になり、つなぐと「あ）（い」になる。
    expect(breakUnits('あ（）い')).toEqual(['あ', '（）', 'い']);
    expect(breakUnits('あ「」い')).toEqual(['あ', '「」', 'い']);
  });

  it('控えている開きかっこの直後の空白は、控えと一緒に後ろに付ける', () => {
    // 開きかっこのあとは、空白をはさんでも折り返さない（UAX #14 の LB14）。空白で切ると「（ 」が
    // 1つの単位になり、空白として捨てられず、開きかっこが行の終わりに残る。
    expect(breakUnits('（ あ')).toEqual(['（ あ']);
    expect(breakUnits('あ（  い） う')).toEqual(['あ', '（  い）', ' ', 'う']);
  });

  it('空白の直後の閉じかっこと句読点は、空白ごと前に付ける', () => {
    // 閉じかっこ・句読点・感嘆符と疑問符の前は、空白をはさんでも折り返さない（UAX #14 の LB13）。字だけを
    // 空白に付けると、「 。」が行の頭に来る。空白の前に単位が無ければ付けない。
    expect(breakUnits('あ 。い')).toEqual(['あ 。', 'い']);
    expect(breakUnits('あ  」！')).toEqual(['あ  」！']);
    expect(breakUnits('OK ？')).toEqual(['OK ？']);
    expect(breakUnits(' 。')).toEqual([' ', '。']);
  });

  it('空白の直後のコロンや中黒は、前に付けない', () => {
    // 空白のあとでは折り返してよい字（UAX #14 の LB18 が LB21 より先に当たる）。
    expect(breakUnits('あ ・い')).toEqual(['あ', ' ', '・', 'い']);
    expect(breakUnits('あ ：')).toEqual(['あ', ' ', '：']);
  });

  it('見え方の印とつなぐ印は、前の字に付ける', () => {
    // 印を1つの単位にすると、行の頭に印だけが出て、前の字と見え方が変わる。
    expect(breakUnits(HEART + 'あ')).toEqual([HEART, 'あ']);
    expect(breakUnits('あ\u200dい')).toEqual(['あ\u200d', 'い']);
  });

  it('印の付いた開きかっこも、後ろに付ける', () => {
    // 印は前の字に付くので、開きかっこの単位が「（」と印の2字になる。単位そのものを開きかっこの表と
    // 比べると当たらず、開きかっこが行の終わりに残る。単位の先頭の字で見る。
    expect(breakUnits('あ（\ufe0fい')).toEqual(['あ', '（\ufe0fい']);
    expect(breakUnits('あ「\u200dい」')).toEqual(['あ', '「\u200dい」']);
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
  // 行の頭に置かない字は全角の約物だけ。次の切り方は、行の境目で禁則に合わない並びを作りうるが、
  // 扱わない。animal-bomber の版も同じ切り方。

  it('日本語の直後の ASCII の記号は、別の単位になる', () => {
    // 表に無いので前の字に付かず、行の頭に来うる。
    expect(breakUnits('あ!')).toEqual(['あ', '!']);
    expect(breakUnits('あ)')).toEqual(['あ', ')']);
  });

  it('閉じかっこと空白のあとの中黒やコロンは、前に付けない', () => {
    // UAX #14 の LB16 では、閉じかっこと空白のあとの中黒・コロンの前で折り返さない。この部品は、空白のあとの
    // 中黒・コロンをいつも前に付けないので、閉じかっこのあとでも中黒が行の頭に来うる。
    expect(breakUnits('」 ・')).toEqual(['」', ' ', '・']);
  });
});

describe('止める値', () => {
  it.each(['あ\nい', 'a\rb', 'a\r\nb', '\n'])('改行の字を含む文 %j は止める', (text) => {
    // 改行の字は1字の単位になり、幅を測られて行の中に並ぶ。
    expect(() => breakUnits(text)).toThrow(RangeError);
    expect(() => breakUnits(text)).toThrow('改行の字');
  });
});
