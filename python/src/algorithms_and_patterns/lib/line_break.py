"""禁則つきの行詰め — 文を折り返してよい単位に切り、渡された測る関数で幅に収める。

描かない。幅は呼ぶ側が測る関数で渡すので、描画のライブラリを読み込まずに使える。

- ``break_units``：文を、折り返してよい所で切った単位の並びにする
- ``fill_lines``：単位の並びを、幅に収まるように前から詰めて行に分ける。単位の型を
  問わず、並べた単位の幅を測る関数と、空白かを答える関数を受け取る
- ``break_lines``：上の2つをつなぎ、文から行の文字列の並びを作る。測る関数は、行に並べた
  単位をつないだ文字列を受け取る

単位の切り方：

- ASCII の空白でない字（``!`` から ``~`` まで。英数字と記号）の続きは1つにまとめる
- ASCII の空白（U+0020）は1つずつ、ほかの字（日本語・絵文字など）は1字ずつ切る
- 行の頭に置かない字（閉じかっこ・句読点など）は前の単位に付ける。前の単位が空白1つなら
  付けない
- 行の終わりに置かない字（開きかっこ）は控えておき、後ろの単位に付ける。控えている間に
  行の頭に置かない字が来たら、前の単位でなく控えに付ける（「あ（）い」は「あ」「（）」「い」）。
  控えている間の ASCII の空白も控えに足し、次の単位に付ける（「あ（ い」は「あ」
  「（ い」）。開きかっこのあとは、空白をはさんでも折り返さない（Unicode の行分けの
  規則 UAX #14 の LB14）
- 見え方を選ぶ印（U+FE0F）とつなぐ印（U+200D）は前の字に付ける

単位をつなぐと、元の文に戻る。字は符号位置（コードポイント）ごとに読み、書記素（人が
1字と見るまとまり）では区切らない。改行の字（``\\n``・``\\r``）を含む文は止める。段落の
区切りは、呼ぶ側が先に分ける。

測る関数は、並べた単位の幅を返す。続けて並べた単位の幅は、別々に測った幅の和より広く
ならないことを前提にする（字詰めで狭まり、幅を切り上げる測り方でも、1つずつ切り上げた
和のほうが広い）。この前提のもとで、和が幅に収まるうちは行全体を測らない。

固定値の表は持たず、約束は「同じ値から、起動のたびに同じ結果を出す」だけ。TypeScript 版
（``typescript/src/lib/line-break.ts``）も同じ形。
"""

from collections.abc import Callable, Sequence
from typing import TypeVar

U = TypeVar("U")

_NO_LINE_START = frozenset("、。，．）」』】〕〉》！？：；ー…‥・％")
"""行の頭に置かない字（直前の字と離さない）。"""

_NO_LINE_END = frozenset("（「『【〔〈《")
"""行の終わりに置かない字（直後の字と離さない）。"""

_ATTACHED = frozenset("\ufe0f\u200d")
"""前の字に付ける印（見え方を選ぶ印 U+FE0F と、つなぐ印 U+200D）。"""


def break_units(text: str) -> list[str]:
    """``text`` を、折り返してよい所で切った単位の並びにする。

    切り方はモジュールの説明のとおり。空の文は空の並び。

    Raises:
        ValueError: ``text`` が改行の字（``\\n``・``\\r``）を含むとき。改行の字は
            1字の単位になり、幅を測られて行の中に並ぶ。
    """
    if "\n" in text or "\r" in text:
        raise ValueError("改行の字を含む文は切らない。段落は先に分ける")
    units: list[str] = []
    opening = ""
    index = 0
    while index < len(text):
        end = _unit_end(text, index)
        unit = text[index:end]
        index = end
        joins = unit[0] in _NO_LINE_START and units[-1:] != [" "]
        # 控えがあるときに前の単位へ付けると、閉じかっこが控えの開きかっこより前に
        # 置かれ、字の順が逆になる。そのときは下の else で控えとつなぐ。
        if joins and units and not opening:
            units[-1] += unit
        elif unit in _NO_LINE_END or (opening and unit == " "):
            # 空白で切ると「（ 」が1つの単位になり、空白として捨てられず、開きかっこが
            # 行の終わりに残る。
            opening += unit
        else:
            units.append(opening + unit)
            opening = ""
    if opening:
        units.append(opening)
    return units


def _unit_end(text: str, start: int) -> int:
    """``start`` から始まる単位の終わり（次の単位の始まり）。後ろに続く印も含める。"""
    end = start + 1
    if _is_ascii_word(text[start]):
        while end < len(text) and _is_ascii_word(text[end]):
            end += 1
    while end < len(text) and text[end] in _ATTACHED:
        end += 1
    return end


def _is_ascii_word(char: str) -> bool:
    """ASCII の空白でない字（``!`` から ``~`` まで）か。"""
    return "!" <= char <= "~"


def fill_lines(
    units: Sequence[U],
    width: float,
    measure: Callable[[Sequence[U]], float],
    is_space: Callable[[U], bool],
) -> list[list[U]]:
    """``units`` を、幅 ``width`` に収まるように前から詰めて行に分ける。

    単位ごとの幅の和が幅に収まるうちは、行全体を測らずに足していく。和が幅を超えてから、
    行全体を測って決める。和は行全体の幅より狭くならない（測る関数の前提）ので、和が
    収まるなら行も収まる。長い文で、単位を足すたびに行全体を測る手間を減らす。

    行の頭の空白は捨て、行の終わりの空白は除く。1つで幅を超える単位は、その1つだけで
    1行にする（はみ出す）。空の並びは、空の行1つ。

    Args:
        units: 単位の並び。
        width: 1行の幅。0 より大きい数（無限大なら1行にまとまる）。
        measure: 並べた単位の幅を返す関数。1つの単位も、1つだけの並びで渡す。
        is_space: 単位が空白か（行の頭と終わりで捨てるか）を答える関数。

    Returns:
        行ごとの単位の並び。

    Raises:
        ValueError: ``width`` が 0 以下か NaN のとき、``measure`` が 0 以上の数を
            返さなかったとき（負の数と NaN）。NaN の幅は比べるとどれも偽になり、
            黙って1行にまとまる。
    """
    if not width > 0:
        raise ValueError(f"幅は 0 より大きい数にする: {width}")
    lines: list[list[U]] = [[]]
    total = 0.0
    for unit in units:
        line = lines[-1]
        if is_space(unit):
            if line:
                line.append(unit)
                total += _width_of(measure([unit]))
            continue
        size = _width_of(measure([unit]))
        if line and total + size > width and _width_of(measure([*line, unit])) > width:
            _drop_trailing_spaces(line, is_space)
            lines.append([unit])
            total = size
        else:
            line.append(unit)
            total += size
    _drop_trailing_spaces(lines[-1], is_space)
    return lines


def _width_of(value: float) -> float:
    """測る関数が返した幅。0 以上の数でなければ止める。"""
    if not value >= 0:
        raise ValueError(f"測る関数は 0 以上の数を返す: {value}")
    return value


def _drop_trailing_spaces(line: list[U], is_space: Callable[[U], bool]) -> None:
    """行の終わりの空白を除く。"""
    while line and is_space(line[-1]):
        line.pop()


def break_lines(text: str, width: float, measure: Callable[[str], float]) -> list[str]:
    """``text`` を折り返して、幅 ``width`` に収まる行の文字列の並びにする。

    ``break_units`` で切り、``fill_lines`` で詰める。空白は ASCII の空白（U+0020）だけ。
    空の文は、空の行1つ。

    Args:
        text: 改行の字を含まない文。
        width: 1行の幅。0 より大きい数。
        measure: 行に並べた単位をつないだ文字列の幅を返す関数。

    Returns:
        行の文字列の並び。

    Raises:
        ValueError: ``break_units`` と ``fill_lines`` が止めるとき。
    """
    lines = fill_lines(
        break_units(text),
        width,
        lambda line: measure("".join(line)),
        lambda unit: unit == " ",
    )
    return ["".join(line) for line in lines]
