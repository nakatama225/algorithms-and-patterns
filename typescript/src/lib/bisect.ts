/**
 * 二分探索 — 昇順に並んだ列で、値が入る位置を求める。
 *
 * Python の標準ライブラリ `bisect` の `bisect_left`・`bisect_right` と同じ答えを返す
 * （Python 3.10 から使える `key=` は、ここでは `keyOf` で受ける）。
 * 違うのは、探す値が NaN のときに止まることだけ。
 *
 * - `bisectLeft` … 同じ値が続くなら、その最初の位置。値より小さい項目の数と等しい
 * - `bisectRight` … 同じ値が続くなら、その最後の次の位置。値以下の項目の数と等しい
 *
 * `keyOf` を省けるのは、列が number の列のときだけ。多重定義（overload）の宣言でそう限っている。
 * そのときは項目そのものを値として使う（既定の `Number` は、数をそのまま返す）。
 *
 * 「`value` 以下で最後の項目」の位置は `bisectRight(sorted, value) - 1` で求められる
 * （-1 なら、そういう項目は無い）。
 *
 * 列が昇順に並んでいるかは検査しない。検査するには全部を読む必要があり、
 * 二分探索で読む量を減らす意味がなくなる。並んでいない列には、意味の無い位置を返す。
 * 項目の値（`keyOf` の返り値）が NaN の場合も検査しない。そのときも Python の bisect と
 * 同じ位置を返すが、並びの中での意味は無い。
 */

/**
 * `value` より小さい項目の数を返す。同じ値が続くなら、その最初の位置になる。
 *
 * @throws RangeError `value` が NaN のとき
 */
export function bisectLeft(sorted: readonly number[], value: number): number;
/**
 * `keyOf` で取り出した値が `value` より小さい項目の数を返す。
 *
 * @throws RangeError `value` が NaN のとき
 */
export function bisectLeft<T>(
  sorted: readonly T[],
  value: number,
  keyOf: (item: T) => number,
): number;
export function bisectLeft(
  sorted: readonly unknown[],
  value: number,
  keyOf: (item: unknown) => number = Number,
): number {
  checkValue(value);
  // Python の bisect_left と同じ比べ方。項目が値より小さければ、右の半分へ進む。
  return search(sorted, (item) => keyOf(item) < value);
}

/**
 * `value` 以下の項目の数を返す。同じ値が続くなら、その最後の次の位置になる。
 *
 * @throws RangeError `value` が NaN のとき
 */
export function bisectRight(sorted: readonly number[], value: number): number;
/**
 * `keyOf` で取り出した値が `value` 以下の項目の数を返す。
 *
 * @throws RangeError `value` が NaN のとき
 */
export function bisectRight<T>(
  sorted: readonly T[],
  value: number,
  keyOf: (item: T) => number,
): number;
export function bisectRight(
  sorted: readonly unknown[],
  value: number,
  keyOf: (item: unknown) => number = Number,
): number {
  checkValue(value);
  // Python の bisect_right と同じ比べ方。値が項目より小さくなければ、右の半分へ進む。
  // `keyOf(item) <= value` と書くと、取り出した値が NaN のときに Python と答えが変わる。
  return search(sorted, (item) => !(value < keyOf(item)));
}

/**
 * 先頭から続く「`goesRight` が真になる項目」の数を、二分探索で数える。
 *
 * 真になる項目が先頭にまとまり、偽になる項目がそのあとに続く列を前提にする。
 */
function search(sorted: readonly unknown[], goesRight: (item: unknown) => boolean): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    // 中点は割り算で求める。`(low + high) >> 1` と書くと、和が 2**31 以上のときに
    // 32 ビットの整数として読まれて負になり、列の外を読む。
    const mid = Math.floor((low + high) / 2);
    if (goesRight(sorted[mid])) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/**
 * 値が NaN でないかを確認する。
 *
 * NaN はどの数と比べても偽になる。そのまま探すと、`bisectLeft` は 0 を、`bisectRight` は
 * 列の長さを返し、どちらも黙って誤った位置になる（Python の bisect もそう返す）。
 */
function checkValue(value: number): void {
  if (Number.isNaN(value)) {
    throw new RangeError(`探す値が NaN: ${value}`);
  }
}
