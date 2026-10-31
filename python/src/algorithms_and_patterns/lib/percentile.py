"""パーセンタイル — 測った値の列から p50・p99 などを、補間せずに列の中の値で返す。

最近順位法（nearest-rank method）。列を小さい順に並べ、百分率 ``percent`` と列の長さ
``n`` から、``ceil(percent × n / 100)`` 番目（1 から数える）の値を返す。100 個の列の
99 パーセンタイルは大きいほうから2番目、600 個なら7番目の値になる。2つの値の間を
補間しないので、返すのはいつも渡した列の中の値。

百分率は 1 以上 100 以下の整数で受け、位置は整数の割り算で求める。小数の割合を掛けると
誤る。``7 / 100 * 100`` は 7.000000000000001 で、切り上げると1つ上の位置になる
（1〜100 の百分率のうち、列の長さ 1〜2000 で食い違うものが 12 個ある）。

位置は切り上げる。150 個の列の 99 パーセンタイルは 148.5 番目で、``round``（偶数への
丸め）だと 148 番目を返し、本来より小さい値になる。

固定値の表は持たず、約束は「同じ値から、起動のたびに同じ結果を出す」だけ。計算は整数の
掛け算と割り算と、大小の比べだけで書く。TypeScript 版
（``typescript/src/lib/percentile.ts``）も同じ形。
"""

import math
from collections.abc import Sequence


def percentile(values: Sequence[float], percent: int) -> float:
    """``values`` の ``percent`` パーセンタイルを、列の中の値のまま返す。

    写してから小さい順に並べるので、測った順のまま渡してよい。``values`` は書き換え
    ない。

    Args:
        values: 測った値の列。空でなく、NaN を含まない。無限大は含んでよい。
        percent: 百分率。1 以上 100 以下の int。

    Returns:
        小さい順に並べた列の ``ceil(percent * len(values) / 100)`` 番目（1 から数える）
        の値。

    Raises:
        TypeError: ``percent`` が int でないとき（50.0 や True）。bool は int の子
            なので、型検査は True を止めない。
        ValueError: ``percent`` が 1 以上 100 以下でないとき、``values`` が空のとき、
            NaN を含むとき。範囲の外を最小や最大に丸めると、呼び出しの誤りに気づけない
            （0 は位置が 0 番目になり、検査が無いと添字 -1 で最大を返す）。NaN は
            どの値と比べても偽なので、並べた順が崩れる。
    """
    if isinstance(percent, bool) or not isinstance(percent, int):
        raise TypeError(f"百分率は int で渡す: {percent!r}")
    if not 1 <= percent <= 100:
        raise ValueError(f"百分率は 1 以上 100 以下にする: {percent}")
    if not values:
        raise ValueError("空の列のパーセンタイルは無い")
    for value in values:
        if math.isnan(value):
            raise ValueError("NaN を含む列は、小さい順に並べられない")
    ordered = sorted(values)
    # 整数だけで切り上げる（-(-a // b) は a / b を切り上げた整数）。
    rank = -(-percent * len(ordered) // 100)
    return ordered[rank - 1]
