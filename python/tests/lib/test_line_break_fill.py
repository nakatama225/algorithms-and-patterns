"""禁則つきの行詰め（``line_break.py``）の、行への詰め方と止める値のテスト。

幅は文字数を数える偽の測る関数で測る。単位の切り方は ``test_line_break.py`` が見る。
単位を詰める約束（測る回数・空白の扱い）は、切り方とは別の理由で変わるので、ファイルを
分けた。
"""

import math
from collections.abc import Sequence

import pytest

from algorithms_and_patterns.lib.line_break import break_lines, fill_lines


def by_length(line: Sequence[str]) -> float:
    """並べた単位の字の数 × 10。"""
    return len("".join(line)) * 10.0


def is_space(unit: str) -> bool:
    return unit == " "


class Test詰め方:
    def test_行の幅は_単位ごとの和でなく行のまま測って詰める(self) -> None:
        """1字ずつ測ると 12（丸めの分だけ広い）、行のまま測ると 1字 10 の測り方。

        幅 30 に3字まで収まる（和は 36 で超えるが、行は 30）。和で決めると2字になる。
        """

        def measure(line: Sequence[str]) -> float:
            text = "".join(line)
            return 12.0 if len(text) == 1 else len(text) * 10.0

        assert fill_lines(list("あいうえお"), 30, measure, is_space) == [
            ["あ", "い", "う"],
            ["え", "お"],
        ]

    def test_和が幅に収まるうちは_行全体を測らない(self) -> None:
        """長い文で、単位を足すたびに行全体を測ると、行の長さの2乗の手間になる。"""
        calls: list[list[str]] = []

        def measure(line: Sequence[str]) -> float:
            calls.append(list(line))
            return by_length(line)

        assert fill_lines(list("あいうえお"), 50, measure, is_space) == [
            list("あいうえお")
        ]
        assert [call for call in calls if len(call) > 1] == []

    def test_和が幅を超えたときだけ_行全体を測って決める(self) -> None:
        calls: list[list[str]] = []

        def measure(line: Sequence[str]) -> float:
            calls.append(list(line))
            return by_length(line)

        assert fill_lines(list("あいうえお"), 30, measure, is_space) == [
            ["あ", "い", "う"],
            ["え", "お"],
        ]
        assert [call for call in calls if len(call) > 1] == [list("あいうえ")]

    def test_行の頭と終わりの空白を捨て_幅を超える1つは1行にする(self) -> None:
        """空白を残すと、行の頭が空白で始まり、行の終わりの空白が幅を食う。"""
        units = ["ab", " ", "cdefgh", " ", " ", "i", " "]
        assert fill_lines(units, 30, by_length, is_space) == [
            ["ab"],
            ["cdefgh"],
            ["i"],
        ]

    def test_文の頭の空白も捨てる(self) -> None:
        """行の頭の空白を残すと、1行目だけが空白の分だけ右にずれる。"""
        assert fill_lines([" ", " ", "ab"], 30, by_length, is_space) == [["ab"]]
        assert break_lines("  ab", 30, lambda text: len(text) * 10.0) == ["ab"]

    def test_行の中の空白は残す(self) -> None:
        assert fill_lines(["ab", " ", "cd"], 50, by_length, is_space) == [
            ["ab", " ", "cd"]
        ]

    def test_空白の幅も行の和に数える(self) -> None:
        """空白の幅を和に足さないと、和が収まって見え、行全体を測らないまま幅を超える。"""
        assert fill_lines(["a", " ", " ", " ", "b"], 30, by_length, is_space) == [
            ["a"],
            ["b"],
        ]
        assert break_lines("ab cd", 40, lambda text: len(text) * 10.0) == ["ab", "cd"]

    def test_空の並びと空白だけの並びは_空の行1つ(self) -> None:
        assert fill_lines([], 30, by_length, is_space) == [[]]
        assert fill_lines([" ", " "], 30, by_length, is_space) == [[]]

    def test_幅が無限大なら1行にまとまる(self) -> None:
        assert fill_lines(list("あいう"), math.inf, by_length, is_space) == [
            ["あ", "い", "う"]
        ]

    def test_単位の型を問わず_文と種類の組も詰められる(self) -> None:
        """区切りごとに切った単位に種類を添え、種類で幅と空白の扱いを変える使い方。

        枠で囲む単位は、左右の余白の分だけ広く、折り返さない。
        """
        units = [("F1", "boxed")] + [(unit, "plain") for unit in ["で", "開", "く。"]]

        def measure(line: Sequence[tuple[str, str]]) -> float:
            total = 0.0
            for text, kind in line:
                total += len(text) * 10.0 + (20.0 if kind == "boxed" else 0.0)
            return total

        lines = fill_lines(
            units, 30, measure, lambda unit: unit[0] == " " and unit[1] != "boxed"
        )
        assert lines == [
            [("F1", "boxed")],
            [("で", "plain"), ("開", "plain")],
            [("く。", "plain")],
        ]


class Test文から行へ:
    def test_単位で切ってから詰め_行の文字列にする(self) -> None:
        """閉じかっこと句点は前の字と同じ行に、開きかっこは後ろの字と同じ行に置く。"""

        def measure(text: str) -> float:
            return len(text) * 10.0

        assert break_lines("これは（例）です。", 30, measure) == [
            "これは",
            "（例）",
            "です。",
        ]

    def test_開きかっこの直後に空白があっても_開きかっこを行の終わりに残さない(
        self,
    ) -> None:
        """「あい（ 」は幅 40 にちょうど収まるが、開きかっこと空白は次の字と同じ行。"""
        lines = break_lines("あい（ え", 40, lambda text: len(text) * 10.0)
        assert lines == ["あい", "（ え"]

    def test_句点の直前に空白があっても_句点を行の頭に置かない(self) -> None:
        """「あい 」は幅 30 にちょうど収まるが、空白で折り返すと句点が行の頭に来る。"""
        lines = break_lines("あい 。", 30, lambda text: len(text) * 10.0)
        assert lines == ["あ", "い 。"]

    def test_空白の直後に印があっても_行の頭に空白を残さない(self) -> None:
        """「あい 」は幅 30 に収まり、印から次の行になる。空白は行の終わりで除く。"""
        lines = break_lines("あい \ufe0fう", 30, lambda text: len(text) * 10.0)
        assert lines == ["あい", "\ufe0fう"]

    def test_文の終わりの開きかっこの直後の空白は_最後の行に残さない(self) -> None:
        """控えに残すと「（ 」が1つの単位になり、幅を超えて次の行に送られる。"""
        lines = break_lines("あい（ ", 30, lambda text: len(text) * 10.0)
        assert lines == ["あい（"]

    def test_測る関数は_単位をつないだ文字列を受け取る(self) -> None:
        seen: list[str] = []

        def measure(text: str) -> float:
            seen.append(text)
            return len(text) * 10.0

        assert break_lines("Wi-Fi あ", 50, measure) == ["Wi-Fi", "あ"]
        assert "Wi-Fi あ" in seen

    def test_空の文は_空の行1つ(self) -> None:
        assert break_lines("", 30, lambda text: len(text) * 10.0) == [""]

    @pytest.mark.parametrize("text", ["　ab", "\tab"])
    def test_全角の空白とタブは空白として扱わず_行の頭でも残す(self, text: str) -> None:
        """空白として捨てるのは ASCII の空白（U+0020）だけ。ほかの空白は1字の単位。"""
        assert break_lines(text, 30, lambda line: len(line) * 10.0) == [text]


class Test止める値:
    @pytest.mark.parametrize("width", [0.0, -1.0, math.nan])
    def test_幅が0以下かNaNなら止まる(self, width: float) -> None:
        """NaN の幅は比べるとどれも偽になり、検査が無いと黙って1行にまとまる。"""
        with pytest.raises(ValueError, match="幅は 0 より大きい数"):
            fill_lines(list("あいう"), width, by_length, is_space)

    @pytest.mark.parametrize("value", [-1.0, math.nan])
    def test_測る関数が0以上の数を返さないと止まる(self, value: float) -> None:
        """負の幅や NaN は和を崩し、行の幅を超えて詰める。"""
        with pytest.raises(ValueError, match="測る関数は 0 以上の数を返す"):
            fill_lines(list("あいう"), 30, lambda line: value, is_space)

    def test_空白の幅を測った値も見る(self) -> None:
        def measure(line: Sequence[str]) -> float:
            return math.nan if line == [" "] else by_length(line)

        with pytest.raises(ValueError, match="測る関数は 0 以上の数を返す"):
            fill_lines(["a", " ", "b"], 30, measure, is_space)

    def test_行全体を測った値も見る(self) -> None:
        def measure(line: Sequence[str]) -> float:
            return math.nan if len(line) > 1 else by_length(line)

        with pytest.raises(ValueError, match="測る関数は 0 以上の数を返す"):
            fill_lines(list("あいう"), 15, measure, is_space)

    def test_改行の字を含む文は止める(self) -> None:
        with pytest.raises(ValueError, match="改行の字"):
            break_lines("あ\nい", 30, lambda text: len(text) * 10.0)
