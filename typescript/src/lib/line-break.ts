/**
 * 禁則つきの行詰め — 文を折り返してよい単位に切り、渡された測る関数で幅に収める。
 *
 * 描かない。幅は呼ぶ側が測る関数で渡すので、描く仕組み（canvas など）を持たずに使える。
 *
 * - `breakUnits`：文を、折り返してよい所で切った単位の並びにする
 * - `fillLines`：単位の並びを、幅に収まるように前から詰めて行に分ける。単位の型を問わず、並べた
 *   単位の幅を測る関数と、空白かを答える関数を受け取る
 * - `breakLines`：上の2つをつなぎ、文から行の文字列の並びを作る。測る関数は、行に並べた単位を
 *   つないだ文字列を受け取る
 *
 * 単位の切り方：
 *
 * - ASCII の空白でない字（`!` から `~` まで。英数字と記号）の続きは1つにまとめる
 * - ASCII の空白（U+0020）は1つずつ、ほかの字（日本語・絵文字など）は1字ずつ切る
 * - 行の頭に置かない字（閉じかっこ・句読点など）は前の単位に付ける。前の単位が空白なら、閉じかっこ・句読点・
 *   感嘆符と疑問符だけを、空白ごと空白の前の単位に付ける（「あ 。い」は「あ 。」「い」）。閉じかっこ・感嘆符の
 *   前は、空白をはさんでも折り返さない（UAX #14 の LB13）。空白の前に単位が無ければ付けない
 * - 行の終わりに置かない字（開きかっこ）は控えておき、後ろの単位に付ける。控えている間に行の頭に
 *   置かない字が来たら、前の単位でなく控えに付ける（「あ（）い」は「あ」「（）」「い」）。控えている間の
 *   ASCII の空白も控えに足し、次の単位に付ける（「あ（ い」は「あ」「（ い」）。開きかっこのあとは、
 *   空白をはさんでも折り返さない（Unicode の行分けの規則 UAX #14 の LB14）
 * - 見え方を選ぶ印（U+FE0F）とつなぐ印（U+200D）は前の字に付ける。印の付いた開きかっこも、単位の先頭の字で
 *   見て控える
 *
 * 単位をつなぐと、元の文に戻る。文字列は UTF-16 の単位で持つので、添字で1つずつ進めると、絵文字
 * （😀 など）がサロゲートの片割れ2つに切れる。`Array.from` で符号位置（コードポイント）ごとに読み、
 * Python 版と同じ単位にする。書記素（人が1字と見るまとまり）では区切らない。改行の字（`\n`・`\r`）を
 * 含む文は止める。段落の区切りは、呼ぶ側が先に分ける。
 *
 * 測る関数は、並べた単位の幅を返す。続けて並べた単位の幅は、別々に測った幅の和より広くならない
 * ことを前提にする（字詰めで狭まり、幅を切り上げる測り方でも、1つずつ切り上げた和のほうが広い）。
 * この前提のもとで、和が幅に収まるうちは行全体を測らない。
 *
 * 固定値の表は持たず、約束は「同じ値から、起動のたびに同じ結果を出す」だけ。Python 版
 * （`python/src/algorithms_and_patterns/lib/line_break.py`）も同じ形。
 */

/**
 * 空白をはさんでも、直前の字と離さない字（閉じかっこ・句読点・感嘆符と疑問符）。
 *
 * UAX #14 の LB13 で、この字の前では空白のあとでも折り返さない（行分けの分類が CL と EX）。
 */
const NO_LINE_START_EVEN_AFTER_SPACE: ReadonlySet<string> = new Set('、。，．）」』】〕〉》！？');

/**
 * 行の頭に置かない字（直前の字と離さない）。
 *
 * 上の表にない字（コロン・長音・三点リーダー・中黒・％）は、空白のあとでは前に付けない（UAX #14 でも
 * 空白のあとは折り返せる。LB18）。閉じかっこ・句読点と空白のあとのコロン・セミコロン・中黒・長音の前では
 * 折り返さない規則（LB16）は扱わない。
 */
const NO_LINE_START: ReadonlySet<string> = new Set([...NO_LINE_START_EVEN_AFTER_SPACE, ...'：；ー…‥・％']);

/** 行の終わりに置かない字（直後の字と離さない）。 */
const NO_LINE_END: ReadonlySet<string> = new Set('（「『【〔〈《');

/** 前の字に付ける印（見え方を選ぶ印 U+FE0F と、つなぐ印 U+200D）。 */
const ATTACHED: ReadonlySet<string> = new Set(['\ufe0f', '\u200d']);

/**
 * `text` を、折り返してよい所で切った単位の並びにする。
 *
 * 切り方はモジュールの説明のとおり。空の文は空の並び。
 *
 * @throws RangeError `text` が改行の字（`\n`・`\r`）を含むとき。改行の字は1字の単位になり、幅を
 *   測られて行の中に並ぶ
 */
export function breakUnits(text: string): string[] {
  if (text.includes('\n') || text.includes('\r')) {
    throw new RangeError('改行の字を含む文は切らない。段落は先に分ける');
  }
  const chars = Array.from(text);
  const units: string[] = [];
  let opening = '';
  let index = 0;
  while (index < chars.length) {
    const end = unitEnd(chars, index);
    // 印の付いた開きかっこ（「（」と U+FE0F など）も控えるよう、単位でなく先頭の字で見る。
    const first = chars[index] ?? '';
    const unit = chars.slice(index, end).join('');
    index = end;
    // 控えがあるときに前の単位へ付けると、閉じかっこが控えの開きかっこより前に置かれ、字の順が
    // 逆になる。そのときは下の else で控えとつなぐ。
    if (opening === '' && attachToPrevious(units, unit, first)) continue;
    if (NO_LINE_END.has(first) || (opening !== '' && unit === ' ')) {
      // 空白で切ると「（ 」が1つの単位になり、空白として捨てられず、開きかっこが行の終わりに残る。
      opening += unit;
    } else {
      units.push(opening + unit);
      opening = '';
    }
  }
  if (opening !== '') units.push(opening);
  return units;
}

/**
 * 行の頭に置かない字なら、前の単位に付けて true を返す。`first` は単位の先頭の字。
 *
 * 前の単位が空白なら、`NO_LINE_START_EVEN_AFTER_SPACE` の字だけを、続く空白ごと、空白の前の単位に付ける。
 * 字だけを空白に付けると、「 。」が行の頭に来る。
 */
function attachToPrevious(units: string[], unit: string, first: string): boolean {
  if (!NO_LINE_START.has(first)) return false;
  let spaces = 0;
  while (spaces < units.length && units[units.length - 1 - spaces] === ' ') spaces += 1;
  if (spaces === units.length) return false;
  if (spaces > 0 && !NO_LINE_START_EVEN_AFTER_SPACE.has(first)) return false;
  const head = units.length - spaces - 1;
  units.splice(head, spaces + 1, units.slice(head).join('') + unit);
  return true;
}

/** `start` から始まる単位の終わり（次の単位の始まり）。後ろに続く印も含める。 */
function unitEnd(chars: readonly string[], start: number): number {
  let end = start + 1;
  if (isAsciiWord(chars[start] ?? '')) {
    while (end < chars.length && isAsciiWord(chars[end] ?? '')) end += 1;
  }
  while (end < chars.length && ATTACHED.has(chars[end] ?? '')) end += 1;
  return end;
}

/** ASCII の空白でない字（`!` から `~` まで）か。 */
function isAsciiWord(char: string): boolean {
  return char >= '!' && char <= '~';
}

/**
 * `units` を、幅 `width` に収まるように前から詰めて行に分ける。
 *
 * 単位ごとの幅の和が幅に収まるうちは、行全体を測らずに足していく。和が幅を超えてから、行全体を
 * 測って決める。和は行全体の幅より狭くならない（測る関数の前提）ので、和が収まるなら行も収まる。
 * 長い文で、単位を足すたびに行全体を測る手間を減らす。
 *
 * 行の頭の空白は捨て、行の終わりの空白は除く。1つで幅を超える単位は、その1つだけで1行にする
 * （はみ出す）。空の並びは、空の行1つ。
 *
 * @param units 単位の並び
 * @param width 1行の幅。0 より大きい数（無限大なら1行にまとまる）
 * @param measure 並べた単位の幅を返す関数。1つの単位も、1つだけの並びで渡す
 * @param isSpace 単位が空白か（行の頭と終わりで捨てるか）を答える関数
 * @returns 行ごとの単位の並び
 * @throws RangeError `width` が 0 以下か NaN のとき、`measure` が 0 以上の数を返さなかったとき（負の数と
 *   NaN）。NaN の幅は比べるとどれも偽になり、黙って1行にまとまる
 */
export function fillLines<U>(
  units: readonly U[],
  width: number,
  measure: (line: readonly U[]) => number,
  isSpace: (unit: U) => boolean,
): U[][] {
  if (!(width > 0)) {
    throw new RangeError(`幅は 0 より大きい数にする: ${width}`);
  }
  let line: U[] = [];
  const lines: U[][] = [line];
  let total = 0;
  for (const unit of units) {
    if (isSpace(unit)) {
      if (line.length > 0) {
        line.push(unit);
        total += widthOf(measure([unit]));
      }
      continue;
    }
    const size = widthOf(measure([unit]));
    if (line.length > 0 && total + size > width && widthOf(measure([...line, unit])) > width) {
      dropTrailingSpaces(line, isSpace);
      line = [unit];
      lines.push(line);
      total = size;
    } else {
      line.push(unit);
      total += size;
    }
  }
  dropTrailingSpaces(line, isSpace);
  return lines;
}

/** 測る関数が返した幅。0 以上の数でなければ止める。 */
function widthOf(value: number): number {
  if (!(value >= 0)) {
    throw new RangeError(`測る関数は 0 以上の数を返す: ${value}`);
  }
  return value;
}

/** 行の終わりの空白を除く。 */
function dropTrailingSpaces<U>(line: U[], isSpace: (unit: U) => boolean): void {
  while (line.length > 0 && isSpace(line[line.length - 1] as U)) line.pop();
}

/**
 * `text` を折り返して、幅 `width` に収まる行の文字列の並びにする。
 *
 * `breakUnits` で切り、`fillLines` で詰める。空白は ASCII の空白（U+0020）だけ。空の文は、空の行1つ。
 *
 * @param text 改行の字を含まない文
 * @param width 1行の幅。0 より大きい数
 * @param measure 行に並べた単位をつないだ文字列の幅を返す関数
 * @returns 行の文字列の並び
 * @throws RangeError `breakUnits` と `fillLines` が止めるとき
 */
export function breakLines(text: string, width: number, measure: (line: string) => number): string[] {
  const lines = fillLines(
    breakUnits(text),
    width,
    (line) => measure(line.join('')),
    (unit) => unit === ' ',
  );
  return lines.map((line) => line.join(''));
}
