/**
 * 輪の上の位置 — 端と端がつながった線の上の位置の巻き戻しと、2点の近いほうの差。
 *
 * 長さ `length` の線の両端をつないだ輪の上で、位置を 1 つの数で表す。
 *
 * - `wrap`：どんな位置も 0 以上 `length` 未満に巻き戻す。式は `((position % length) + length) % length`
 * - `signedDelta`：始点から終点へ輪を回る2つの道のうち、近いほうの道のりを、位置が増える向きを
 *   正にした符号つきで返す
 *
 * JavaScript の `%` は割られる数と同じ符号の余りを返す（C の `fmod` と同じ）。負の位置は1回目の
 * `%` で負の余りになるので、`length` を足して正にし、もう一度 `%` を取る。余りは真の値がそのまま
 * 数で表せるので丸めが入らないが、`length` を足すときに丸めるので、範囲の内の値も最後の桁が変わる
 * ことがある（3.091666666666667 は 3.0916666666666686 になる）。2回通すと、もう一度変わることも
 * ある。そのため `signedDelta` は中で巻き戻さず、範囲の外の位置を止める。
 *
 * この部品は固定値の表を持ち、2つの言語で同じ値を出す（README の Design Choice 2）。計算は
 * 足し算・引き算・2 で割ることと `%` だけで書く。Python 版（`python/src/algorithms_and_patterns/lib/ring.py`）は
 * `math.fmod` を2回使い、同じ順に計算する。
 *
 * TypeScript の number は NaN と無限大を黙って計算に通し、`%` は NaN を返すので、範囲を明示して
 * 止める。
 */

/** 巻き戻せる長さの上限。これより長いと、`length` を足すときに無限大にあふれる。 */
const MAX_WRAP_LENGTH = Number.MAX_VALUE / 2;

/**
 * 位置を 0 以上 `length` 未満に巻き戻す。
 *
 * 1回目の `%` で `-length` より大きく `length` より小さい値にし、`length` を足して正にし、2回目で
 * `length` 未満に戻す。答えは -0 にならない。
 *
 * 範囲の内の値は、そのまま返るとは限らない。`length` を足すときに丸めるので、足した和が数で
 * ちょうど表せない値（3.091666666666667 など）は最後の桁が変わり、`length` にごく近い値（長さ 72 で
 * 71.99999999999999）は 0 になる。
 *
 * @param position 位置。有限の数
 * @param length 輪の長さ。0 より大きく、`Number.MAX_VALUE` の半分以下の数
 * @returns 巻き戻した位置。0 以上 `length` 未満
 * @throws RangeError `length` が 0 以下か NaN か無限大か、`Number.MAX_VALUE` の半分より大きいとき、
 *   `position` が NaN か無限大のとき。検査が無いと、負の長さでは答えが負になり、ほかは NaN になる
 *   （長さの上限を超えたときは、足し算があふれる位置だけ）
 */
export function wrap(position: number, length: number): number {
  checkLength(length);
  if (length > MAX_WRAP_LENGTH) {
    throw new RangeError(`巻き戻す長さは、数の最大値の半分以下にする: ${length}`);
  }
  if (!Number.isFinite(position)) {
    throw new RangeError(`位置が有限の数でない: ${position}`);
  }
  return ((position % length) + length) % length;
}

/**
 * 始点から終点へ輪を回るときの、近いほうの道のりを符号つきで返す。
 *
 * 位置が増える向きに回るほうが近ければ正、減る向きなら負。`end - start` を求め、半周より長ければ
 * 1周ぶんを減らすか増やす。
 *
 * - ちょうど半周は `end - start` の符号のまま（長さ 72 で 2 から 38 は +36、38 から 2 は -36）。
 *   始点と終点を入れ替えると、符号だけが変わる
 * - 同じ点は 0。`wrap` を通した点なら正の 0 で、始点 0・終点 -0 を直に渡したときだけ -0 になる
 *
 * 始点と終点は `wrap` で巻き戻したものを渡す。中で巻き戻すと、範囲の内の値でも最後の桁が変わり、
 * 渡した2点の差と食い違う。
 *
 * 長さに `wrap` の上限は無い。差は `-length` より大きく `length` より小さいので、1周ぶんを足し引き
 * しても無限大にあふれない。
 *
 * @param start 始点。0 以上 `length` 未満
 * @param end 終点。0 以上 `length` 未満
 * @param length 輪の長さ。0 より大きい有限の数
 * @returns 近いほうの道のり。`-length / 2` 以上 `length / 2` 以下
 * @throws RangeError `length` が 0 以下か NaN か無限大のとき、始点か終点が 0 以上 `length` 未満で
 *   ないとき（NaN と無限大も含む）
 */
export function signedDelta(start: number, end: number, length: number): number {
  checkLength(length);
  checkOnRing('始点', start, length);
  checkOnRing('終点', end, length);
  const delta = end - start;
  const half = length / 2;
  if (delta > half) return delta - length;
  if (delta < -half) return delta + length;
  return delta;
}

/** 輪の長さが 0 より大きい有限の数かを確認する。 */
function checkLength(length: number): void {
  if (!(Number.isFinite(length) && length > 0)) {
    throw new RangeError(`長さは 0 より大きい有限の数にする: ${length}`);
  }
}

/** 位置が 0 以上 `length` 未満かを確認する。NaN は比べるとどれも偽なので止まる。 */
function checkOnRing(name: string, position: number, length: number): void {
  if (!(position >= 0 && position < length)) {
    throw new RangeError(`${name}が範囲の外: ${position}（0 以上 ${length} 未満）`);
  }
}
