"""連鎖の一括処理と最も早い時刻が止める値の検査。

たどり方は ``test_cascade.py`` が、時刻の扱いは ``test_cascade_earliest_times.py`` が
見る。受け取る値の約束は、たどり方とは別の理由で変わるので、ファイルを分けた。
"""

import math

import pytest

from algorithms_and_patterns.lib.cascade import cascade, earliest_times

from .fake_reaches import FakeReaches


class Test要素の数:
    def test_負の要素の数は止まる(self) -> None:
        """``[False] * -1`` は空の list になり、黙って何も発火しない。"""
        with pytest.raises(ValueError, match="要素の数は 0 以上"):
            cascade(-1, [], FakeReaches())


class Test起点:
    @pytest.mark.parametrize("start", [-1, 3, 4])
    def test_範囲の外の起点は_たどる前に止まる(self, start: int) -> None:
        """-1 は list の後ろから数えた要素（ここでは 2）を指し、別の要素に印を付ける。

        範囲の外の起点が後ろにあっても、前の起点からたどり始める前に止まる。
        """
        reaches = FakeReaches((0, 1))
        with pytest.raises(ValueError, match="起点が範囲の外"):
            cascade(3, [0, start], reaches)
        assert reaches.asked == []

    def test_要素の数が0なら_どの起点も範囲の外(self) -> None:
        with pytest.raises(ValueError, match="起点が範囲の外"):
            cascade(0, [0], FakeReaches())


class Test届く相手:
    @pytest.mark.parametrize("target", [-1, 3])
    def test_reachesが範囲の外の添字を返すと止まる(self, target: int) -> None:
        with pytest.raises(ValueError, match="0 から届く相手が範囲の外"):
            cascade(3, [0], FakeReaches((0, target)))

    @pytest.mark.parametrize("target", [-1, 2])
    def test_最も早い時刻でも_範囲の外の添字は止まる(self, target: int) -> None:
        with pytest.raises(ValueError, match="1 から届く相手が範囲の外"):
            earliest_times([5, 1], FakeReaches((1, target)))


class Test時刻:
    @pytest.mark.parametrize("nan", [math.nan, -math.nan])
    def test_NaNの時刻は_たどる前に止まる(self, nan: float) -> None:
        """NaN は大小を比べるとどれも偽になり、並べた順が決まらない。"""
        reaches = FakeReaches((0, 1))
        with pytest.raises(ValueError, match="時刻が NaN: 2 番目"):
            earliest_times([1, 2, nan], reaches)
        assert reaches.asked == []
