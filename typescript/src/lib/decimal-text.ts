/**
 * 10 進の整数を書いた文字列の読み取り — 保存した文字列の中の数を、書いた形のまま読む。
 *
 * `12,8;30,0` のように、自分で決めた形で保存した文字列から数を取り出すときに使う。読むのは、書く側が
 * 書く形（頭に 0 を付けない、ASCII の数字だけの 0 以上の整数）だけ。
 *
 * `Number` は、書く側が書かない形も黙って読む。空の文字列（0 になる）、前後の空白と改行（' 1\n' は
 * 1）、`'0x10'`（16）、`'1e3'`（1000）、`'+1'`。そこで、正規表現で形を見てから数にする。
 *
 * 止めるときは、外から来た値の読み取り（`strict-read.ts`）と同じ `ReadError` を使う。固定値の表は
 * 持たず、約束は「同じ入力から、起動のたびに同じ結果を出す」だけ。Python 版
 * （`python/src/algorithms_and_patterns/lib/decimal_text.py`）も同じ形。
 */

import { ReadError } from './strict-read.js';

/** 書く側が書く形。m を付けないので、`$` は文字列の終わりにだけ合う（末尾の改行の前では合わない）。 */
const DECIMAL = /^(?:0|[1-9][0-9]*)$/;

/** `parseDecimal` の、何の数かと、読める最大の数。 */
export interface DecimalOptions {
  /** 止めるときの文の頭に入れる、何の数か。 */
  readonly name: string;
  /** 読める最大の数。0 以上の安全な整数。 */
  readonly maximum: number;
}

/**
 * 10 進の整数を書いた文字列を、0 以上 `maximum` 以下の整数として読む。
 *
 * @param text 読む文字列。頭に 0 を付けない、ASCII の数字だけの文字列
 * @throws ReadError 空の文字列、空白・符号・頭の 0・指数（`1e3`）など、書く側が書かない形を含むとき、
 *   安全な整数（絶対値が 2**53 未満の整数）でないとき、`maximum` より大きいとき
 * @throws RangeError `maximum` が 0 以上の安全な整数でないとき。呼ぶ側の誤りなので、ReadError にしない
 */
export function parseDecimal(text: string, options: DecimalOptions): number {
  const { name, maximum } = options;
  // NaN を渡すと大小の比べが偽になり、どの数も最大以下に見える。
  if (!Number.isSafeInteger(maximum)) throw new RangeError(`安全な整数でない（最大）: ${maximum}`);
  if (maximum < 0) throw new RangeError(`最大は 0 以上にする: ${maximum}`);
  if (!DECIMAL.test(text)) {
    throw new ReadError(`${name} が 10 進の整数の形でない: ${JSON.stringify(text)}`);
  }
  const value = Number(text);
  // 安全な整数より大きい数は、隣の整数と区別できない（9007199254740993 は 2**53 に丸まる）。
  // 最大も安全な整数なので範囲の外でもあるが、なぜ読めないのかを文に書くため、別に断る。
  if (!Number.isSafeInteger(value)) throw new ReadError(`${name} が安全な整数でない: ${text}`);
  if (value > maximum) throw new ReadError(`${name} が 0 以上 ${maximum} 以下でない: ${text}`);
  return value;
}
