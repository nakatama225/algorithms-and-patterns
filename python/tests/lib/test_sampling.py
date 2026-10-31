"""毎回読む値の判定（``sampling.py``）のうち、揺れる値を分ける2つのテスト。

2つのしきい値（``Hysteresis``）と大きいほうの軸（``dominant_axis``）と、その組み合わせを
見る。押し始めと短い押し（``EdgeDetector``・``PressLatch``）は
``test_sampling_press.py`` が見る。値の揺れの扱いと、押す・離すの扱いは、別の理由で
変わるので、ファイルを分けた。
"""

import math

import pytest

from algorithms_and_patterns.lib.sampling import Hysteresis, Sign, dominant_axis

ON = 0.5
OFF = 0.35


class Test2つのしきい値:
    def test_切れている間は_on未満で入らず_onちょうどで入る(self) -> None:
        gate = Hysteresis(ON, OFF)
        assert [gate.update(value) for value in (0.49, 0.4999999, ON)] == [
            False,
            False,
            True,
        ]

    def test_入っている間は_offちょうどまで保ち_off未満で切れる(self) -> None:
        """しきい値を1つにする（``off`` を ``on`` と同じに比べる）と、0.36 で切れる。"""
        gate = Hysteresis(ON, OFF)
        gate.update(0.9)
        assert [gate.update(value) for value in (0.49, 0.36, OFF, 0.3499)] == [
            True,
            True,
            True,
            False,
        ]

    def test_切れたあとは_off以上on未満の値で入らない(self) -> None:
        gate = Hysteresis(ON, OFF)
        values = (ON, 0.3, 0.4, 0.49, ON)
        assert [gate.update(value) for value in values] == [
            True,
            False,
            False,
            False,
            True,
        ]

    def test_値はそのまま比べ_負の大きな値では入らない(self) -> None:
        """大きさで判定したいときは、呼ぶ側が絶対値を渡す。"""
        gate = Hysteresis(ON, OFF)
        assert not gate.update(-0.9)
        assert gate.update(abs(-0.9))

    def test_無限大は_ほかの値と同じく比べる(self) -> None:
        gate = Hysteresis(ON, OFF)
        assert gate.update(math.inf)
        assert not gate.update(-math.inf)

    def test_activeは最後の状態で_resetで切れた状態に戻る(self) -> None:
        gate = Hysteresis(ON, OFF)
        assert not gate.active
        gate.update(0.9)
        assert gate.active
        gate.reset()
        assert not gate.active
        assert not gate.update(0.4)

    @pytest.mark.parametrize(("on", "off"), [(ON, ON), (OFF, ON)], ids=["等しい", "逆"])
    def test_offがon以上なら止まる(self, on: float, off: float) -> None:
        """等しいと、しきい値が1つと同じになる。"""
        with pytest.raises(ValueError, match="入るしきい値より小さくする"):
            Hysteresis(on, off)

    @pytest.mark.parametrize(
        ("on", "off"),
        [(math.nan, OFF), (ON, math.nan), (math.inf, OFF), (ON, -math.inf)],
        ids=["onがNaN", "offがNaN", "onが無限大", "offが負の無限大"],
    )
    def test_しきい値が有限でなければ止まる(self, on: float, off: float) -> None:
        """無限大の ``on`` では入らず、負の無限大の ``off`` では切れない。"""
        with pytest.raises(ValueError, match="しきい値は有限の数"):
            Hysteresis(on, off)

    @pytest.mark.parametrize("before", [0.0, 0.9], ids=["切れている", "入っている"])
    def test_NaNを読むと止まり_状態を変えない(self, before: float) -> None:
        """NaN は比べるとどれも偽なので、止めなければ、いまの状態のまま黙って続く。"""
        gate = Hysteresis(ON, OFF)
        state = gate.update(before)
        with pytest.raises(ValueError, match="値が NaN"):
            gate.update(math.nan)
        assert gate.active is state


class Test大きいほうの軸:
    @pytest.mark.parametrize(
        ("x", "y", "expected"),
        [
            (0.1, -0.9, (0, -1)),
            (0.55, -0.8, (0, -1)),
            (0.9, 0.1, (1, 0)),
            (-0.7, 0.2, (-1, 0)),
            (0.0, 0.3, (0, 1)),
            (math.inf, 1.0, (1, 0)),
        ],
    )
    def test_絶対値の大きいほうの符号だけを残す(
        self, x: float, y: float, expected: tuple[Sign, Sign]
    ) -> None:
        """軸ごとの符号を両方残すと、(0.55, -0.8) が斜めになる。"""
        assert dominant_axis(x, y) == expected

    @pytest.mark.parametrize(
        ("x", "y", "expected"),
        [(0.5, 0.5, (1, 0)), (-0.5, 0.5, (-1, 0)), (0.5, -0.5, (1, 0))],
    )
    def test_絶対値が等しいなら横を残す(
        self, x: float, y: float, expected: tuple[Sign, Sign]
    ) -> None:
        """``>=`` を ``>`` にすると、縦が残る。"""
        assert dominant_axis(x, y) == expected

    @pytest.mark.parametrize(("x", "y"), [(0.0, 0.0), (-0.0, 0.0), (0.0, -0.0)])
    def test_両方0なら_符号はどちらも0の整数(self, x: float, y: float) -> None:
        result = dominant_axis(x, y)
        assert result == (0, 0)
        assert [type(value) for value in result] == [int, int]

    def test_軸ごとにしきい値を当てると_縦横の両方が超える(self) -> None:
        """真上から少しずれた向きで、横もしきい値に届く。大きいほうの軸なら縦だけ。"""
        x, y = 0.55, -0.8
        assert [abs(value) >= ON for value in (x, y)] == [True, True]
        assert dominant_axis(x, y) == (0, -1)

    @pytest.mark.parametrize(("x", "y"), [(math.nan, 0.2), (0.2, math.nan)])
    def test_NaNは止まる(self, x: float, y: float) -> None:
        """NaN の絶対値を比べると偽になり、止めなければ黙って縦を残す。"""
        with pytest.raises(ValueError, match="軸の値が NaN"):
            dominant_axis(x, y)


def read_direction(gate: Hysteresis, x: float, y: float) -> tuple[Sign, Sign]:
    """大きさ（大きいほうの軸の絶対値）を2つのしきい値で分け、入っていれば向きを返す。"""
    if gate.update(max(abs(x), abs(y))):
        return dominant_axis(x, y)
    return 0, 0


# 縦の値が 0.5 の近くで揺れ、最後に 0.35 を下回る並び。
WOBBLE = [(0.0, -0.52), (0.0, -0.48), (0.05, -0.51), (0.0, -0.49), (0.0, -0.36)]


class Test組み合わせ:
    def test_大きさに2つのしきい値_向きに大きいほうの軸で_境目がちらつかない(
        self,
    ) -> None:
        gate = Hysteresis(ON, OFF)
        readings = [*WOBBLE, (0.0, -0.34)]
        directions = [read_direction(gate, x, y) for x, y in readings]
        assert directions == [(0, -1)] * 5 + [(0, 0)]

    def test_しきい値が1つだと_同じ並びで読むたびに入れ替わる(self) -> None:
        """``off`` と ``on`` が等しい部品は作れないので、比べる式をここに書く。"""
        assert [max(abs(x), abs(y)) >= ON for x, y in WOBBLE] == [
            True,
            False,
            True,
            False,
            False,
        ]
