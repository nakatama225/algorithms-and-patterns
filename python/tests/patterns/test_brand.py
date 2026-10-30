"""実行時は同じ数でも、意味の違う値を別の型にする（単位を型で分ける）書き方の見本と検査。

``src/`` に対応するモジュールは無い。TypeScript 版が自分で書いている部品（数に
型の上だけの印を付ける ``Brand``）は、Python では標準ライブラリの ``typing.NewType``
がそのまま使える。置く部品が無いので、書き方と、それで何が守られるかを、ここに
検査として残す。

区間ごとに 0 へ戻る番号と、始めから通して数える番号は、どちらも ``int`` で、最初の区間の
間は値まで同じになる。取り違えても、最初の区間だけを使うテストは通る。別の型にしておくと、
区間の数によらず mypy が止める。

守られるのは片方向だけ。

1. ``NewType`` の値は、ただの ``int`` を受け取る所へそのまま渡せる
2. ただの ``int`` や別の ``NewType`` の値を渡すと、mypy が止める
3. 足すと、ただの ``int`` に戻る
4. ``NewType`` を呼べば、どの ``int`` にも印を付けられ、mypy を通る。
   印を付ける場所は少なくする
"""

from typing import NewType

import pytest

SectionIndex = NewType("SectionIndex", int)
"""区間の中で数えた番号。区間が替わるたびに 0 へ戻る。"""

OverallIndex = NewType("OverallIndex", int)
"""始めから通して数えた番号。戻らない。"""


def label(at: OverallIndex) -> str:
    """通しの番号だけを受け取る処理。区間の中の番号を渡すと、2つ目の区間から戻って見える。"""
    return f"{at} 番目"


def section_label(at: SectionIndex) -> str:
    """区間の中の番号だけを受け取る処理。"""
    return f"区間の {at} 番目"


def half(value: int) -> float:
    """ただの ``int`` を受け取る処理。"""
    return value / 2


def test_印の付いた値は_ただの数を受け取る所へそのまま渡せる() -> None:
    at = OverallIndex(4)
    assert half(at) == 2
    assert max(at, 1) == 4


def test_ただの数を渡すと_型検査が止める() -> None:
    """止めなくなると、mypy は使われていない ``type: ignore`` として失敗する。"""
    assert label(3) == "3 番目"  # type: ignore[arg-type]


def test_別の印の値は渡せない() -> None:
    """この型の目的そのもの。

    最初の区間では2つの番号が同じ値なので、値を比べるテストでは取り違えが見つからない。
    型が違えば、区間の数によらず mypy が止める。
    """
    in_section = SectionIndex(2)
    assert label(in_section) == "2 番目"  # type: ignore[arg-type]
    # 逆の向きも渡せない。
    overall = OverallIndex(5)
    assert section_label(overall) == "区間の 5 番目"  # type: ignore[arg-type]


def test_足すと_ただの数に戻る() -> None:
    """次の番号として使うなら、もう一度印を付ける。印を付ける所は1か所に集める。"""
    at = OverallIndex(4)
    following = at + 1
    assert label(following) == "5 番目"  # type: ignore[arg-type]
    assert label(OverallIndex(following)) == "5 番目"


def test_印を付ける呼び出しは_別の印の値にも使え_型検査を通る() -> None:
    """型では塞げない穴。

    区間の中の番号を ``OverallIndex`` で包むと、mypy は止めない。``NewType`` は
    ``int`` を受け取るので、``int`` を元にした別の ``NewType`` の値も受け取る。
    """
    in_section = SectionIndex(2)
    assert label(OverallIndex(in_section)) == "2 番目"


def test_同じ名前でも_定義ごとに別の型になる() -> None:
    """mypy は ``NewType`` を定義した場所で見分ける。

    同じ名前で別の所（ここでは関数の中。別のモジュールでも同じ）に定義すると、別の型に
    なり、取り違えれば止める。TypeScript の ``Brand`` は印の文字列で見分けるので、
    同じ文字列なら同じ型になる。
    """
    OverallIndex = NewType("OverallIndex", int)
    assert label(OverallIndex(6)) == "6 番目"  # type: ignore[arg-type]


def test_実行時には印が残らず_ただのintのまま() -> None:
    """変換の手間はかからない。その代わり、実行時に印で見分けることもできない。"""
    at = OverallIndex(7)
    assert type(at) is int
    assert at == 7
    with pytest.raises(TypeError):
        isinstance(at, OverallIndex)  # type: ignore[misc]
