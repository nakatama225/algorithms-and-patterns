"""最小ベイズリスクによる選択（``mbr.py``）のテスト。

多くのテストは、候補を 0 から n - 1 の番号にし、似ている度合いを表 ``table[候補][相手]``
で与える。平均を手で計算でき、関数を呼ぶ向きも表の行と列で見分けられる。
"""

import math
from collections.abc import Callable

import pytest

from algorithms_and_patterns.lib.mbr import mbr_select


def by_table(table: list[list[float]]) -> Callable[[int, int], float]:
    """表から、似ている度合いを返す関数を作る。"""

    def similarity(candidate: int, other: int) -> float:
        return table[candidate][other]

    return similarity


def same(a: str, b: str) -> float:
    """同じなら 1、違えば 0。"""
    return 1.0 if a == b else 0.0


def char_bigrams(text: str) -> set[str]:
    return {text[i : i + 2] for i in range(len(text) - 1)}


def bigram_jaccard(a: str, b: str) -> float:
    """文字の 2-gram の集合の重なり。翻訳の候補を比べる物差しの小さな見本。"""
    sa, sb = char_bigrams(a), char_bigrams(b)
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / len(sa | sb)


class Test選び方:
    def test_1つの相手と最も似ている候補ではなく_平均が最も高い候補を選ぶ(self) -> None:
        """候補 1 の平均は (0.9 + 0.1) / 2 = 0.5、候補 2 は (0.3 + 0.6) / 2 = 0.45。

        候補 0 は (0.2 + 0.4) / 2 = 0.3。いちばん大きい 1 つの値（0.9）で選ぶ形とも、
        平均ではなく最大で比べる形とも、ここで結果が分かれる。
        """
        table = [[0.0, 0.2, 0.4], [0.9, 0.0, 0.1], [0.3, 0.6, 0.0]]
        assert mbr_select([0, 1, 2], by_table(table)) == 1

    def test_翻訳の候補では_ほかの候補と共通する訳を選ぶ(self) -> None:
        """銀の話が3つ、ロバの話が1つ。ロバの候補は、ほかのどれとも似ていない。

        文字の 2-gram の重なりの平均は、順に 0.0597・0.5495・0.4689・0.4675。
        「the silver was sent」は、ほかの銀の候補2つのどちらとも最もよく似ている。
        """
        candidates = [
            "a donkey ate the grain",
            "the silver was sent",
            "the silver is sent",
            "silver was sent",
        ]
        assert mbr_select(candidates, bigram_jaccard) == 1

    def test_関数を候補と相手の向きで_自分以外の相手と1回ずつ呼ぶ(self) -> None:
        """呼ぶ回数は n × (n - 1)。向きを逆にすると、向きのある物差しで結果が変わる。"""
        calls: list[tuple[int, int]] = []

        def recording(candidate: int, other: int) -> float:
            calls.append((candidate, other))
            return 0.0

        mbr_select([0, 1, 2], recording)
        assert calls == [(0, 1), (0, 2), (1, 0), (1, 2), (2, 0), (2, 1)]

    def test_向きのある関数では_候補の側の値で選ぶ(self) -> None:
        """候補の側の長さだけを返す関数なら、最も長い候補を選ぶ。

        向きを逆にして呼ぶと、相手の側の長さの平均になり、自分を除くので最も短い
        候補を選ぶ。
        """
        candidates = ["ab", "abcd", "a"]
        assert mbr_select(candidates, lambda candidate, other: len(candidate)) == 1
        assert mbr_select(candidates, lambda candidate, other: len(other)) == 2

    def test_平均が同じなら_前にある候補を選ぶ(self) -> None:
        assert mbr_select(["a", "b", "c"], lambda candidate, other: 0.5) == 0
        table = [[0.0, 0.1, 0.1], [0.5, 0.0, 0.5], [0.5, 0.5, 0.0]]
        assert mbr_select([0, 1, 2], by_table(table)) == 1

    def test_同じ値の候補は別々に数え_支持として数える(self) -> None:
        """「a」が2回出ると、互いに 1 を足し合う。

        重複を数えたくなければ、呼ぶ側が先に除く。
        """
        assert mbr_select(["b", "a", "c", "a"], same) == 1

    def test_候補が1つなら_関数を呼ばずに0を返す(self) -> None:
        def never(candidate: str, other: str) -> float:
            raise AssertionError("候補が1つなら比べる相手がいない")

        assert mbr_select(["only"], never) == 0

    def test_候補の列を書き換えず_タプルも受ける(self) -> None:
        candidates = ("b", "a", "a")
        assert mbr_select(candidates, same) == 1
        assert candidates == ("b", "a", "a")

    def test_負の値も受ける(self) -> None:
        """距離に負の符号を付けたものを渡すと、ほかの点との距離の和が最も小さい点を選ぶ。

        数直線の上の点なら、それは中央値の点（11.0）。離れた点（30.0）に引っ張られない。
        """
        positions = [0.0, 10.0, 11.0, 12.0, 30.0]
        assert mbr_select(positions, lambda a, b: -abs(a - b)) == 2


class Test止める値:
    def test_空の列は止まる(self) -> None:
        with pytest.raises(ValueError, match="候補が空"):
            mbr_select([], same)

    @pytest.mark.parametrize("bad", [math.nan, math.inf, -math.inf])
    def test_有限の数でない値が返ると止まる(self, bad: float) -> None:
        """どの候補・相手で発生したかを、止める文に書く。"""
        table = [[0.0, 0.5, 0.5], [0.5, 0.0, bad], [0.5, 0.5, 0.0]]
        with pytest.raises(ValueError, match="有限の数でない: 候補 1、相手 2"):
            mbr_select([0, 1, 2], by_table(table))

    def test_NaNがあると_組み込みのmaxは並び順で結果が変わる(self) -> None:
        """検査を外すと、NaN の平均の候補を選ぶかが、比べ方と並び順で変わる。"""
        assert math.isnan(max([math.nan, 1.0]))
        assert max([1.0, math.nan]) == 1.0
