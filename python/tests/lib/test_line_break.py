"""禁則つきの行詰め（``line_break.py``）の、単位の切り方（``break_units``）のテスト。

行への詰め方（``fill_lines``・``break_lines``）と、それらが止める値は
``test_line_break_fill.py`` にある。
"""

import pytest

from algorithms_and_patterns.lib.line_break import break_units

FAMILY = "\U0001f468\u200d\U0001f469\u200d\U0001f467"
"""家族の絵文字。3人の絵文字を、つなぐ印（U+200D）でつないだもの。"""

HEART = "❤\ufe0f"
"""ハートに、絵文字の見え方を選ぶ印（U+FE0F）を付けたもの。"""

# 文と、切った単位。
UNITS: list[tuple[str, list[str]]] = [
    ("PDF形式 Wi-Fi", ["PDF", "形", "式", " ", "Wi-Fi"]),
    ("Hello, world!", ["Hello,", " ", "world!"]),
    ("（例）。あ「い」", ["（例）。", "あ", "「い」"]),
    ("あ（）い", ["あ", "（）", "い"]),
    ("あ「」。い", ["あ", "「」。", "い"]),
    ("（。", ["（。"]),
    ("あ 。", ["あ", " ", "。"]),
    ("。あ", ["。", "あ"]),
    ("あ（", ["あ", "（"]),
    (HEART + HEART, [HEART, HEART]),
    ("a\ufe0fb", ["a\ufe0f", "b"]),
    ("あ\U0001f600い", ["あ", "\U0001f600", "い"]),
    ("", []),
    ("  ", [" ", " "]),
]


class Test単位の切り方:
    @pytest.mark.parametrize(("text", "expected"), UNITS)
    def test_表のとおりに切る(self, text: str, expected: list[str]) -> None:
        assert break_units(text) == expected

    @pytest.mark.parametrize(
        "text",
        [
            *(text for text, _ in UNITS),
            "あ「」い",
            "（（）",
            " （）あ",
            FAMILY + "あ",
            "「" + HEART + "」",
        ],
    )
    def test_単位をつなぐと元の文に戻る(self, text: str) -> None:
        """字を捨てる・増やす・入れ替える切り方は、折り返した文の中身を変える。"""
        assert "".join(break_units(text)) == text

    def test_ASCIIの空白でない字の続きは_記号も含めて1つにまとめる(self) -> None:
        """英数字だけでまとめると、「Wi-Fi」が「Wi」「-」「Fi」に切れ、行の境目で割れる。"""
        assert break_units("Wi-Fi(5GHz)") == ["Wi-Fi(5GHz)"]
        assert break_units("a+b=c") == ["a+b=c"]

    def test_日本語は1字ずつ切る(self) -> None:
        assert break_units("あいう") == ["あ", "い", "う"]

    def test_閉じかっこと句点は前に_開きかっこは後ろに付ける(self) -> None:
        assert break_units("あ」。い（う") == ["あ」。", "い", "（う"]

    def test_控えている開きかっこの次の閉じかっこは_控えとつなぐ(self) -> None:
        """前の単位に付けると、字の順が入れ替わる。

        animal-bomber の版は、控えを残したまま閉じかっこを前の単位に付けるので、
        「あ（）い」が「あ）」「（い」になり、つなぐと「あ）（い」になる。
        """
        assert break_units("あ（）い") == ["あ", "（）", "い"]
        assert break_units("あ「」い") == ["あ", "「」", "い"]

    def test_空白の直後の行頭禁則の字は_前に付けない(self) -> None:
        """前に付けると、空白を挟んだ2つが1つの単位になり、空白で折り返せなくなる。"""
        assert break_units("あ 。") == ["あ", " ", "。"]

    def test_見え方の印とつなぐ印は_前の字に付ける(self) -> None:
        """印を1つの単位にすると、行の頭に印だけが出て、前の字と見え方が変わる。"""
        assert break_units(HEART + "あ") == [HEART, "あ"]
        assert break_units("あ\u200dい") == ["あ\u200d", "い"]


class Test書記素では区切らない:
    """人が1字と見るまとまりでも、2つの印のほかは別の単位になり、行の境目で割れうる。

    TypeScript には書記素で区切る ``Intl.Segmenter`` があるが、Python の標準ライブラリに
    同じものが無い。2つの言語で同じ単位にするため、どちらも2つの印だけを前の字に付ける。
    """

    def test_つなぐ印の次の字は_新しい単位になる(self) -> None:
        assert break_units(FAMILY) == [
            "\U0001f468\u200d",
            "\U0001f469\u200d",
            "\U0001f467",
        ]

    @pytest.mark.parametrize(
        ("text", "expected"),
        [
            ("1\ufe0f\u20e3", ["1\ufe0f", "\u20e3"]),
            ("\U0001f44b\U0001f3fd", ["\U0001f44b", "\U0001f3fd"]),
            ("\U0001f1ef\U0001f1f5", ["\U0001f1ef", "\U0001f1f5"]),
            ("か\u3099", ["か", "\u3099"]),
        ],
    )
    def test_囲みの数字_肌の色_国旗_結合する濁点は割れる(
        self, text: str, expected: list[str]
    ) -> None:
        assert break_units(text) == expected


class Test禁則で扱わないもの:
    """行の頭に置かない字は全角の約物だけで、空白かは直前の単位が空白1つかで見る。

    次の切り方は、行の境目で禁則に合わない並びを作りうるが、扱わない。animal-bomber の
    版も同じ切り方。
    """

    def test_日本語の直後のASCIIの記号は_別の単位になる(self) -> None:
        """表に無いので前の字に付かず、行の頭に来うる。"""
        assert break_units("あ!") == ["あ", "!"]
        assert break_units("あ)") == ["あ", ")"]

    def test_開きかっこの直後の空白は_かっこと1つの単位になる(self) -> None:
        """空白として捨てられず、開きかっこが行の終わりに残りうる。

        その単位は空白1つではないので、続く句点は空白の後ろでも前に付く。
        """
        assert break_units("（ あ") == ["（ ", "あ"]
        assert break_units("あ（ 。い") == ["あ", "（ 。", "い"]


class Test止める値:
    @pytest.mark.parametrize("text", ["あ\nい", "a\rb", "a\r\nb", "\n"])
    def test_改行の字を含む文は止める(self, text: str) -> None:
        """改行の字は1字の単位になり、幅を測られて行の中に並ぶ。"""
        with pytest.raises(ValueError, match="改行の字"):
            break_units(text)
