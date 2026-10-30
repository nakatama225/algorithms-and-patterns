"""10 進の整数を書いた文字列の読み取り — 保存した文字列の中の数を、書いた形のまま読む。

``12,8;30,0`` のように、自分で決めた形で保存した文字列から数を取り出すときに使う。
読むのは、書く側が書く形（頭に 0 を付けない、ASCII の数字だけの 0 以上の整数）だけ。

Python の ``int()`` は、書く側が書かない形も黙って読む。``' 1\\n'``（前後の空白）、
``'1_000'``（桁の区切り）、``'+1'``、全角の ``'１２'`` やほかの文字の数字。正規表現の
``\\d`` も全角の数字に合う。そこで、``[0-9]`` で書いた形を ``re.fullmatch`` で文字列の
全体に当ててから数にする。``re.match`` と ``$`` の組は、末尾の改行の前でも合う。

止めるときは、外から来た値の読み取り（``strict_read.py``）と同じ ``ReadError`` を
使う。固定値の表は持たず、約束は「同じ入力から、起動のたびに同じ結果を出す」だけ。
TypeScript 版（``typescript/src/lib/decimal-text.ts``）も同じ形。
"""

import re
from typing import Final

from .strict_read import ReadError

_DECIMAL: Final = re.compile(r"0|[1-9][0-9]*")


def parse_decimal(text: str, *, name: str, maximum: int) -> int:
    """10 進の整数を書いた文字列を、0 以上 ``maximum`` 以下の整数として読む。

    Args:
        text: 読む文字列。頭に 0 を付けない、ASCII の数字だけの文字列。
        name: 止めるときの文の頭に入れる、何の数か。
        maximum: 読める最大の数。

    Raises:
        ReadError: 空の文字列、空白・符号・全角の数字・頭の 0・指数（``1e3``）など、
            書く側が書かない形を含むとき、``maximum`` より大きいとき。
        ValueError: ``maximum`` が負のとき。呼ぶ側の誤りなので、``ReadError`` にしない。
    """
    if maximum < 0:
        raise ValueError(f"最大は 0 以上にする: {maximum}")
    if _DECIMAL.fullmatch(text) is None:
        raise ReadError(f"{name} が 10 進の整数の形でない: {text!r}")
    out_of_range = f"{name} が 0 以上 {maximum} 以下でない: {text}"
    # 桁の数を先に比べる。int() は 4300 桁を超える文字列を ValueError で断るので、
    # 比べずに数にすると、ReadError でない例外が外へ出る。
    if len(text) > len(str(maximum)):
        raise ReadError(out_of_range)
    value = int(text)
    if value > maximum:
        raise ReadError(out_of_range)
    return value
