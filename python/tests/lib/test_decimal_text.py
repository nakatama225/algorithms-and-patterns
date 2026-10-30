"""10 進の整数を書いた文字列の読み取り（``parse_decimal``）のテスト。

止まったことに加えて、止めた文の頭（何の数か、なぜか）まで比べる。形の検査を外しても、
多くの文字列は ``int()`` が ValueError で止めるので、止まったことだけを見ると
通ってしまう。
"""

import pytest

from algorithms_and_patterns.lib.decimal_text import parse_decimal
from algorithms_and_patterns.lib.strict_read import ReadError

from .error_head import starts


@pytest.mark.parametrize(("text", "expected"), [("0", 0), ("7", 7), ("100", 100)])
def test_書く側が書く形を読み_最大そのものも読める(text: str, expected: int) -> None:
    assert parse_decimal(text, name="n", maximum=100) == expected


@pytest.mark.parametrize(
    "text",
    [
        "",
        # int() は前後の空白と末尾の改行を読み飛ばす。re.match と $ は改行の前で合う。
        " 1",
        "1 ",
        "1\n",
        "\t1",
        # 頭の 0 は、書く側が書かない形。
        "01",
        "00",
        # int() と \d は、全角とほかの文字の数字も読む。頭が ASCII でも、続きは見る。
        "１",
        "１２",
        "٣",
        "1１",
        "1٣",
        "-1",
        "+1",
        "1e3",
        "1_000",
        "1.0",
        "0x10",
        "a",
    ],
)
def test_書く側が書かない形は止まる(text: str) -> None:
    with pytest.raises(ReadError, match=starts("n が 10 進の整数の形でない")):
        parse_decimal(text, name="n", maximum=100)


@pytest.mark.parametrize("text", ["101", "999", "1000", "12345678901234567890"])
def test_最大より大きい数は止まる(text: str) -> None:
    with pytest.raises(ReadError, match=starts(f"n が 0 以上 100 以下でない: {text}")):
        parse_decimal(text, name="n", maximum=100)


def test_4300桁を超える数字の並びも_ReadErrorで止まる() -> None:
    """int() は桁の上限で ValueError を出す。桁の数を先に比べ、その手前で止める。"""
    with pytest.raises(ReadError, match=starts("n が 0 以上")):
        parse_decimal("1" * 4301, name="n", maximum=2**63)


def test_最大が0なら0だけを読む() -> None:
    assert parse_decimal("0", name="n", maximum=0) == 0
    with pytest.raises(ReadError, match=starts("n が 0 以上 0 以下でない: 1")):
        parse_decimal("1", name="n", maximum=0)


def test_負の最大は_ReadErrorでなくValueErrorで止まる() -> None:
    """呼ぶ側の誤り。ReadError も ValueError の子なので、型まで比べる。"""
    with pytest.raises(ValueError, match=starts("最大は 0 以上にする: -1")) as caught:
        parse_decimal("0", name="n", maximum=-1)
    assert type(caught.value) is ValueError
