/**
 * パーセンタイル — 測った値の列から p50・p99 などを、補間せずに列の中の値で返す。
 *
 * 最近順位法（nearest-rank method）。列を小さい順に並べ、百分率 `percent` と列の長さ `n` から、
 * `ceil(percent × n / 100)` 番目（1 から数える）の値を返す。100 個の列の 99 パーセンタイルは
 * 大きいほうから2番目、600 個なら7番目の値になる。2つの値の間を補間しないので、返すのはいつも
 * 渡した列の中の値。
 *
 * 百分率は 1 以上 100 以下の整数で受ける。小数の割合を掛けると誤る。`7 / 100 * 100` は
 * 7.000000000000001 で、切り上げると1つ上の位置になる（1〜100 の百分率のうち、列の長さ 1〜2000 で
 * 食い違うものが 12 個ある）。`percent * n` は整数のまま正確に求まり、それを 100 で割って切り上げる。
 * 配列の長さは 2 の 32 乗より小さいので、割った値の端数（0.01 以上）は丸めで消えない。
 *
 * 位置は切り上げる。160 個の列の 99 パーセンタイルは 158.4 番目で、`Math.round` で最も近い整数に
 * 丸めると 158 番目を返し、本来より小さい値になる（150 個の列の 148.5 番目は、`Math.round` が 149 に
 * するので切り上げと同じになるが、Python の `round` は偶数への丸めで 148 にする）。
 *
 * 固定値の表は持たず、約束は「同じ値から、起動のたびに同じ結果を出す」だけ。計算は整数の掛け算と
 * 割り算と切り上げと、大小の比べだけで書く。Python 版（`python/src/algorithms_and_patterns/lib/percentile.py`）も
 * 同じ形。
 */

/**
 * `values` の `percent` パーセンタイルを、列の中の値のまま返す。
 *
 * 写してから小さい順に並べるので、測った順のまま渡してよい。`values` は書き換えない。
 * `sort` は比べる関数を渡さないと、数を文字列にして並べる（`[10, 9, 1]` は `[1, 10, 9]`）ので、
 * 大小の比べを渡す。
 *
 * @param values 測った値の列。空でなく、NaN を含まない。無限大は含んでよい
 * @param percent 百分率。1 以上 100 以下の整数
 * @returns 小さい順に並べた列の `ceil(percent * values.length / 100)` 番目（1 から数える）の値
 * @throws RangeError `percent` が 1 以上 100 以下の整数でないとき、`values` が空のとき、NaN を含む
 *   とき。範囲の外を最小や最大に丸めると、呼び出しの誤りに気づけない（0 は位置が 0 番目になり、
 *   検査が無いと undefined を返す）。NaN はどの値と比べても偽なので、並べた順が崩れる
 */
export function percentile(values: readonly number[], percent: number): number {
  if (!(Number.isInteger(percent) && percent >= 1 && percent <= 100)) {
    throw new RangeError(`百分率は 1 以上 100 以下の整数にする: ${percent}`);
  }
  if (values.length === 0) {
    throw new RangeError('空の列のパーセンタイルは無い');
  }
  if (values.some((value) => Number.isNaN(value))) {
    throw new RangeError('NaN を含む列は、小さい順に並べられない');
  }
  const ordered = [...values].sort(ascending);
  const rank = Math.ceil((percent * ordered.length) / 100);
  // rank は 1 以上 ordered.length 以下なので、添字は範囲の内。
  return ordered[rank - 1] as number;
}

/** 小さい順に並べる比べ方。差（`a - b`）でなく大小で書き、NaN の扱いに頼らない。 */
function ascending(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
