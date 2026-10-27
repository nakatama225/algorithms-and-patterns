"""固定刻みの時間のうち、倍率を刻みを進める回数に換える部品（RateScaler）の検査。"""

import itertools
from fractions import Fraction

import pytest

from algorithms_and_patterns.lib.fixed_step import RateScaler


def takes(scaler: RateScaler, steps: list[int]) -> list[int]:
    """フレームごとの実時間の刻みの数を順に渡し、返った回数を並べる。"""
    return [scaler.take(n) for n in steps]


class Test進める回数:
    def test_等倍なら_渡した数だけ進める(self) -> None:
        assert takes(RateScaler(Fraction(1)), [0, 1, 2, 15]) == [0, 1, 2, 15]

    def test_2倍なら_1刻みのフレームに2回進める(self) -> None:
        assert takes(RateScaler(Fraction(2)), [1, 1, 1, 3]) == [2, 2, 2, 6]

    def test_0点5倍なら_2フレームに1回進める(self) -> None:
        assert takes(RateScaler(Fraction(1, 2)), [1] * 6) == [0, 1, 0, 1, 0, 1]

    def test_1点5倍なら_1回と2回を交互に進める(self) -> None:
        assert takes(RateScaler(Fraction(3, 2)), [1] * 4) == [1, 2, 1, 2]

    @pytest.mark.parametrize(
        ("rate", "frames", "total"),
        [(Fraction(5, 4), 400, 500), (Fraction(7, 10), 10_000, 7_000)],
    )
    def test_端数を持ち越すので_長く進めても合計は倍率どおり(
        self, rate: Fraction, frames: int, total: int
    ) -> None:
        """0.7 は2進数の小数で表せない。

        小数で積んで整数の部分を差し引いていく形では、0.7 倍の 10_000 フレームで
        6_999 回になる（最後の端数が 1 に届かず 0.9999… で残る）。
        """
        steps = takes(RateScaler(rate), [1] * frames)
        assert sum(steps) == total
        assert len(set(steps)) == 2

    def test_倍率を替えても_持ち越した端数は捨てない(self) -> None:
        scaler = RateScaler(Fraction(1, 2))
        assert scaler.take(1) == 0
        scaler.set(Fraction(3, 2))
        assert scaler.rate == Fraction(3, 2)
        # 持ち越した 0.5 回分に 1.5 回分を足して 2 回。
        assert scaler.take(1) == 2

    def test_分母の違う倍率に替えても_端数を捨てない(self) -> None:
        """端数を分数で持つので、1/2 単位の端数を 1/3 単位に換えずに足せる。"""
        scaler = RateScaler(Fraction(1, 2))
        assert scaler.take(1) == 0
        scaler.set(Fraction(1, 3))
        # 1/2 + 1/3 = 5/6、5/6 + 1/3 = 7/6。
        assert takes(scaler, [1, 1]) == [0, 1]
        assert scaler.progress == float(Fraction(1, 6))


class Test描く値を混ぜる割合:
    @pytest.mark.parametrize(
        ("rate", "blends"),
        [
            (Fraction(1, 2), [0.5, 0.0, 0.5, 0.0]),
            (Fraction(3, 4), [0.75, 0.5, 0.25, 0.0]),
            (Fraction(3, 2), [0.5, 0.0, 0.5, 0.0]),
            (Fraction(5, 2), [0.5, 0.0, 0.5, 0.0]),
        ],
    )
    def test_整数でない倍率では_持ち越した端数を割合にし_どのフレームも倍率分進む(
        self, rate: Fraction, blends: list[float]
    ) -> None:
        """1つ前の刻みの値に端数の割合だけ寄せて描くと、1フレームの進みが揃う。

        描く位置は「進めた回数の合計 - 1 + 割合」。0.75 倍なら進める回数は
        0・1・1・1 で、描く位置は -0.25・0.5・1.25・2 と、どのフレームも 0.75 ずつ進む。
        """
        scaler = RateScaler(rate)
        got: list[float] = []
        drawn: list[float] = []
        taken = 0
        for _ in range(4):
            taken += scaler.take(1)
            got.append(scaler.blend)
            drawn.append(taken - 1 + scaler.blend)
            assert scaler.blend == scaler.progress
        assert got == blends
        assert [b - a for a, b in itertools.pairwise(drawn)] == [float(rate)] * 3

    @pytest.mark.parametrize("rate", [Fraction(1), Fraction(2), Fraction(3)])
    def test_整数の倍率では_混ぜずに最後に進めた刻みの値で描く(
        self, rate: Fraction
    ) -> None:
        """持ち越した端数が残っていても、割合は 1。"""
        scaler = RateScaler(Fraction(1, 2))
        scaler.take(1)
        scaler.set(rate)
        for _ in range(3):
            scaler.take(1)
            assert scaler.blend == 1.0
        # 持ち越した端数は残っている（倍率を替えても時間を捨てない）。
        assert scaler.progress == 0.5

    def test_takeを呼ぶ前は_混ぜず_端数も0(self) -> None:
        scaler = RateScaler(Fraction(1, 2))
        assert (scaler.blend, scaler.progress) == (1.0, 0.0)

    def test_倍率を替えても_混ぜる割合は次のtakeまで変わらない(self) -> None:
        """止めている間に倍率を替えると、止まった絵が動いた不具合の再現。

        止めている間は take を呼ばない。割合をその場の倍率から決めると、等倍で止めたまま
        1.25 倍へ替えた瞬間に、割合が
        1 から 0 へ替わり、止まっている絵が1刻み分戻って見える。
        """
        scaler = RateScaler(Fraction(1))
        scaler.take(1)
        scaler.set(Fraction(5, 4))
        assert scaler.blend == 1.0
        scaler.set(Fraction(1, 2))
        assert scaler.blend == 1.0
        scaler.take(1)
        assert scaler.blend == 0.5
        scaler.set(Fraction(2))
        assert scaler.blend == 0.5
        scaler.take(1)
        assert scaler.blend == 1.0

    def test_整数から整数でない倍率へ替えたフレームだけは_倍率分より少なく進む(
        self,
    ) -> None:
        """クラスの説明に書いた、既知の外れ。

        等倍から 1.25 倍へ替えたフレームは 0.25 だけ進む。次のフレームからは 1.25 ずつに
        戻る。
        """
        scaler = RateScaler(Fraction(1))
        taken = scaler.take(1)
        drawn = [taken - 1 + scaler.blend]
        scaler.set(Fraction(5, 4))
        for _ in range(3):
            taken += scaler.take(1)
            drawn.append(taken - 1 + scaler.blend)
        assert [b - a for a, b in itertools.pairwise(drawn)] == [0.25, 1.25, 1.25]


class Test止める値:
    @pytest.mark.parametrize("rate", [Fraction(0), Fraction(-1, 2)])
    def test_0以下の倍率は受けず_前の倍率のまま(self, rate: Fraction) -> None:
        """止めるときは take を呼ばない。

        0 を受けると、止めたつもりで take を呼ぶたびに、割合が 1 に戻る。
        """
        with pytest.raises(ValueError, match="倍率は 0 より大きく"):
            RateScaler(rate)
        scaler = RateScaler(Fraction(3, 2))
        with pytest.raises(ValueError, match="倍率は 0 より大きく"):
            scaler.set(rate)
        assert scaler.rate == Fraction(3, 2)

    def test_刻みの数が負なら止まり_端数と割合は変えない(self) -> None:
        scaler = RateScaler(Fraction(1, 2))
        scaler.take(1)
        with pytest.raises(ValueError, match="刻みの数が負"):
            scaler.take(-1)
        assert (scaler.progress, scaler.blend) == (0.5, 0.5)
