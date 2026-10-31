/**
 * 安全な整数の確認 — `lib/` の部品が、整数で受ける引数を実行時に確認する。
 *
 * TypeScript の number は整数と小数を区別しない。小数・NaN・無限大や、絶対値が 2**53 以上の数を
 * 整数のつもりで受けると、部品ごとに別の形で誤る（`>>> 0` で別の整数になる、添字が小数になって
 * 配列が `undefined` を返す、大小の比べがどれも偽になって範囲の確認を素通りする、など）。そこで
 * 受け取った所で、安全な整数（絶対値が 2**53 未満の整数）でなければ止める。
 *
 * 乱数・格子・連鎖・固定刻みの時間が、それぞれ同じ関数を持ち、外から来た値の読み取りも、同じ文を
 * 出す確認を行の中に書いていた。それをここへまとめた。止める文はまとめる前と同じ。
 *
 * Python 版には、この部品が無い。`int` の型で受けるので、整数かどうかは型検査が受け持つ。
 * 下限の確認は、各部品が `if` の1行で書く。
 */

/**
 * 値が安全な整数（絶対値が 2**53 未満の整数）かを確認する。
 *
 * @param name 止めるときの文に入れる、何の値か
 * @throws RangeError 安全な整数でないとき
 */
export function checkInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`安全な整数でない（${name}）: ${value}`);
  }
}

/**
 * 値が `min` 以上の安全な整数かを確認する。
 *
 * 安全な整数かを先に見るので、下限より小さい小数も、安全な整数でないとして止める。下限だけを見ると、
 * NaN は大小の比べがどれも偽になり、通ってしまう。
 *
 * @param name 止めるときの文の頭に入れる、何の値か
 * @throws RangeError 安全な整数でないとき、`min` より小さいとき
 */
export function checkAtLeast(name: string, value: number, min: number): void {
  checkInteger(name, value);
  if (value < min) {
    throw new RangeError(`${name}は ${min} 以上にする: ${value}`);
  }
}
