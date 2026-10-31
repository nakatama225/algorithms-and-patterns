"""輪の上の位置 — 端と端がつながった線の上の位置の巻き戻しと、2点の近いほうの差。

長さ ``length`` の線の両端をつないだ輪の上で、位置を 1 つの数で表す。

- ``wrap``：どんな位置も 0 以上 ``length`` 未満に巻き戻す。JavaScript の
  ``((position % length) + length) % length`` と、最後の桁まで同じ答えを出す
- ``signed_delta``：始点から終点へ輪を回る2つの道のうち、近いほうの道のりを、位置が
  増える向きを正にした符号つきで返す

Python の ``%`` は割る数と同じ符号の余りを返し、小数では ``-1e-20 % 72`` が 72.0 に
なって範囲を外れる。JavaScript の式を ``%`` のまま写すと、-1e-20 は 0.0 になるが、
負の位置の一部で最後の桁が違う（1回目の ``%`` で正になった値に、もう一度 ``length`` を
足して丸める）。``math.fmod`` は JavaScript の ``%`` と同じく割られる数と同じ符号の
余りを返し、真の値がそのまま float で表せるので丸めが入らない。そこで ``math.fmod`` を
2回使い、JavaScript の式と同じ順に計算する。

範囲の内の値も、``length`` を足すときに丸めて最後の桁が変わることがある
（3.091666666666667 は 3.0916666666666686 になる）。2回通すと、もう一度変わることも
ある。そのため ``signed_delta`` は中で巻き戻さず、範囲の外の位置を止める。

この部品は固定値の表を持ち、2つの言語で同じ値を出す（README の Design Choice 2）。
計算は足し算・引き算・2 で割ることと ``math.fmod`` だけで書く。float の範囲を超える
int は、長さと巻き戻す位置では、計算する前に ``OverflowError`` で止まる
（``math.isfinite`` が float に変換する）。差を取る点では、範囲の外として
``ValueError`` で止まる。TypeScript 版（``typescript/src/lib/ring.ts``）も同じ形。
"""

import math
import sys

_MAX_WRAP_LENGTH = sys.float_info.max / 2
"""巻き戻せる長さの上限。これより長いと、``length`` を足すときに無限大にあふれる。"""


def wrap(position: float, length: float) -> float:
    """位置を 0 以上 ``length`` 未満に巻き戻す。

    ``math.fmod(math.fmod(position, length) + length, length)``。1回目の ``fmod`` で
    ``-length`` より大きく ``length`` より小さい値にし、``length`` を足して正にし、
    2回目で ``length`` 未満に戻す。答えは -0.0 にならない。

    範囲の内の値は、そのまま返るとは限らない。``length`` を足すときに丸めるので、
    足した和が float でちょうど表せない値（3.091666666666667 など）は最後の桁が
    変わり、``length`` にごく近い値（長さ 72 で 71.99999999999999）は 0.0 になる。

    Args:
        position: 位置。有限の数。
        length: 輪の長さ。0 より大きく、float の最大値の半分以下の数。

    Returns:
        巻き戻した位置。0 以上 ``length`` 未満。

    Raises:
        ValueError: ``length`` が 0 以下か NaN か無限大か、float の最大値の半分より
            大きいとき、``position`` が NaN か無限大のとき。検査が無いと、負の長さでは
            答えが負になり（5 が -67.0）、NaN の長さと NaN の位置では NaN が返る。
            長さ 0・無限大と無限大の位置、長さの上限を超えて足し算があふれる位置では
            ``math.fmod`` が math domain error で止めるが、どの値が悪いのかが文から
            分からない。
    """
    _check_length(length)
    if length > _MAX_WRAP_LENGTH:
        raise ValueError(f"巻き戻す長さは、数の最大値の半分以下にする: {length}")
    if not math.isfinite(position):
        raise ValueError(f"位置が有限の数でない: {position}")
    return math.fmod(math.fmod(position, length) + length, length)


def signed_delta(start: float, end: float, length: float) -> float:
    """始点から終点へ輪を回るときの、近いほうの道のりを符号つきで返す。

    位置が増える向きに回るほうが近ければ正、減る向きなら負。``end - start`` を求め、
    半周より長ければ1周ぶんを減らすか増やす。

    - ちょうど半周は ``end - start`` の符号のまま（長さ 72 で 2 から 38 は +36、38 から
      2 は -36）。始点と終点を入れ替えると、符号だけが変わる
    - 同じ点は 0。``wrap`` を通した点なら正の 0.0 で、始点 0.0・終点 -0.0 を直に
      渡したときだけ -0.0 になる

    始点と終点は ``wrap`` で巻き戻したものを渡す。中で巻き戻すと、範囲の内の値でも
    最後の桁が変わり、渡した2点の差と食い違う。

    長さに ``wrap`` の上限は無い。差は ``-length`` より大きく ``length`` より小さい
    ので、1周ぶんを足し引きしても無限大にあふれない。

    Args:
        start: 始点。0 以上 ``length`` 未満。
        end: 終点。0 以上 ``length`` 未満。
        length: 輪の長さ。0 より大きい有限の数。

    Returns:
        近いほうの道のり。``-length / 2`` 以上 ``length / 2`` 以下。

    Raises:
        ValueError: ``length`` が 0 以下か NaN か無限大のとき、始点か終点が 0 以上
            ``length`` 未満でないとき（NaN と無限大も含む）。
    """
    _check_length(length)
    _check_on_ring("始点", start, length)
    _check_on_ring("終点", end, length)
    delta = end - start
    half = length / 2
    if delta > half:
        return delta - length
    if delta < -half:
        return delta + length
    return delta


def _check_length(length: float) -> None:
    """輪の長さが 0 より大きい有限の数かを確認する。"""
    if not (math.isfinite(length) and length > 0):
        raise ValueError(f"長さは 0 より大きい有限の数にする: {length}")


def _check_on_ring(name: str, position: float, length: float) -> None:
    """位置が 0 以上 ``length`` 未満かを確認する。

    NaN は比べるとどれも偽なので、ここで止まる。
    """
    if not 0 <= position < length:
        raise ValueError(f"{name}が範囲の外: {position}（0 以上 {length} 未満）")
