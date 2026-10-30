"""命令を値として渡す型（Command）のうち、途中で替わる出どころの検査。

替わる歩を決めて持つ記録（Handover）と、それを読んで代わりに任せる出どころ
（HandoverSource）をここで見る。出どころを合わせる部品（CombinedSource）は
``test_command_sources.py`` が見る。届いた命令で進める側と、保存したものを再生する
側の比べ合わせは ``test_command_handover_replay.py`` に分けた。
"""

from typing import Literal

import pytest

from algorithms_and_patterns.patterns.command import (
    ArrivalLog,
    CommandSource,
    ReplaySource,
)
from algorithms_and_patterns.patterns.command_sources import Handover, HandoverSource

Move = Literal[-1, 0, 1]


class Fixed:
    """いつも同じ命令を返し、聞かれた歩と状態を覚える出どころ。"""

    def __init__(self, move: Move) -> None:
        self.move = move
        self.asked: list[tuple[int, int]] = []

    def command_at(self, step: int, view: int) -> Move:
        self.asked.append((step, view))
        return self.move


class Bounce:
    """状態を見て命令を決め、向きを覚えている出どころ。位置 0 と 2 の間を行き来する。

    位置 1 では、覚えている向きで答えが違う。作り直すと向きを忘れ、上へ向かう
    ところから始め直す。
    """

    def __init__(self) -> None:
        self.asked: list[tuple[int, int]] = []
        self._up = True

    def command_at(self, step: int, view: int) -> Move:
        self.asked.append((step, view))
        if view >= 2:
            self._up = False
        if view <= 0:
            self._up = True
        return 1 if self._up else -1


class Maker:
    """代わりの出どころ（Bounce）を作る関数。作ったものを覚える。"""

    def __init__(self) -> None:
        self.made: list[Bounce] = []

    def __call__(self) -> Bounce:
        source = Bounce()
        self.made.append(source)
        return source


def run(source: CommandSource[int, Move], steps: int) -> list[Move]:
    """位置 0 から、出どころの命令のぶんだけ ``steps`` 歩ぶん動かし、命令の列を返す。"""
    position = 0
    moves: list[Move] = []
    for step in range(steps):
        move = source.command_at(step, position)
        moves.append(move)
        position += move
    return moves


class TestHandover:
    def test_決めるまでは_どの歩でも替わっていない(self) -> None:
        handover = Handover()
        assert handover.after is None
        assert not handover.replaced_at(0)
        assert not handover.replaced_at(1000)

    def test_決めた歩までは替わらず_その次の歩から替わる(self) -> None:
        handover = Handover()
        handover.hand_over_after(3)
        assert handover.after == 3
        replaced = [handover.replaced_at(step) for step in range(6)]
        assert replaced == [False, False, False, False, True, True]

    def test_マイナス1に決めると_0歩目から替わる(self) -> None:
        """前の出どころを1度も使わずに替わる場合。"""
        handover = Handover()
        handover.hand_over_after(-1)
        assert handover.replaced_at(0)

    def test_替わる歩は1度だけ決める_同じ歩でも2度目は断り_先に決めた歩のまま(
        self,
    ) -> None:
        """上書きを受け付けると、先に読んだ側と後で読んだ側で替わる歩が食い違う。"""
        handover = Handover()
        handover.hand_over_after(3)
        with pytest.raises(ValueError, match="もう決めてある"):
            handover.hand_over_after(5)
        with pytest.raises(ValueError, match="もう決めてある"):
            handover.hand_over_after(3)
        assert handover.after == 3
        replaced = [handover.replaced_at(step) for step in range(3, 7)]
        assert replaced == [False, True, True, True]

    def test_マイナス1より前には決められず_断ったあとも決められる(self) -> None:
        handover = Handover()
        with pytest.raises(ValueError, match="-1 以上"):
            handover.hand_over_after(-2)
        assert handover.after is None
        handover.hand_over_after(-1)
        assert handover.after == -1

    def test_負の歩は_替わったかの問いに使えない_決める前も後も(self) -> None:
        """負の歩は数え間違いの結果。替わった・替わっていないのどちらでも答えない。"""
        handover = Handover()
        with pytest.raises(ValueError, match="0 以上"):
            handover.replaced_at(-1)
        handover.hand_over_after(-1)
        with pytest.raises(ValueError, match="0 以上"):
            handover.replaced_at(-1)


class TestHandoverSource:
    def test_決めるまでは前の出どころに任せ_代わりは作らない(self) -> None:
        maker = Maker()
        assert run(HandoverSource(Fixed(-1), maker, Handover()), 10) == [-1] * 10
        assert maker.made == []

    def test_決めた歩までは前の出どころ_次の歩から代わりで_代わりはその歩で初めて作る(
        self,
    ) -> None:
        """替わる歩が1つずれる作りも、代わりを先に作る作りも、ここで止まる。"""
        handover = Handover()
        handover.hand_over_after(2)
        maker = Maker()
        source = HandoverSource(Fixed(0), maker, handover)
        for step in range(3):
            assert source.command_at(step, 0) == 0
            assert maker.made == []
        assert source.command_at(3, 0) == 1
        assert len(maker.made) == 1
        assert maker.made[0].asked == [(3, 0)]

    def test_代わりは1度だけ作り_作り直さずに覚えた向きのまま使い続ける(
        self,
    ) -> None:
        """作り直すと、位置 1 で向きを忘れて上へ戻り、0 まで下りなくなる。"""
        handover = Handover()
        handover.hand_over_after(-1)
        maker = Maker()
        moves = run(HandoverSource(Fixed(0), maker, handover), 8)
        assert moves == [1, 1, -1, -1, 1, 1, -1, -1]
        assert len(maker.made) == 1
        assert [step for step, _ in maker.made[0].asked] == list(range(8))

    def test_前の出どころにも代わりにも_同じ歩と状態を渡す(self) -> None:
        handover = Handover()
        handover.hand_over_after(0)
        first, maker = Fixed(0), Maker()
        source = HandoverSource(first, maker, handover)
        source.command_at(0, 5)
        source.command_at(1, 7)
        assert first.asked == [(0, 5)]
        assert maker.made[0].asked == [(1, 7)]

    def test_負の歩は_前の出どころにも代わりにも渡さない(self) -> None:
        first = Fixed(0)
        source = HandoverSource(first, Maker(), Handover())
        with pytest.raises(ValueError, match="0 以上"):
            source.command_at(-1, 0)
        assert first.asked == []

    def test_前の出どころで答えた歩より前を替わる歩に決めると_次に聞いたときに止まる(
        self,
    ) -> None:
        """3 歩目を前の出どころで答えたあとで、2 歩目のあとで替わると決めた場合。

        同じ記録を再生する側は、3 歩目を代わりに任せる。黙って進めると、2つの側が
        3 歩目からずれる。
        """
        handover = Handover()
        maker = Maker()
        source = HandoverSource(Fixed(0), maker, handover)
        for step in range(4):
            source.command_at(step, 0)
        handover.hand_over_after(2)
        with pytest.raises(RuntimeError, match="3 歩目まで答えたあと"):
            source.command_at(4, 0)
        assert maker.made == []

    def test_前の出どころで答えた最後の歩を_最後に使う歩に決めるのはよい(
        self,
    ) -> None:
        handover = Handover()
        maker = Maker()
        source = HandoverSource(Fixed(0), maker, handover)
        for step in range(4):
            source.command_at(step, 0)
        handover.hand_over_after(3)
        assert source.command_at(4, 0) == 1
        assert len(maker.made) == 1

    def test_順不同に聞いたあとでも_答えた歩のうち最も後の歩より前に決めると止まる(
        self,
    ) -> None:
        """最後に聞いた歩で覚え直す作りだと、3 歩目を答えたことを忘れて止まらない。"""
        handover = Handover()
        maker = Maker()
        source = HandoverSource(Fixed(0), maker, handover)
        source.command_at(3, 0)
        source.command_at(1, 0)
        handover.hand_over_after(2)
        with pytest.raises(RuntimeError, match="3 歩目まで答えたあと"):
            source.command_at(4, 0)
        assert maker.made == []

    def test_前の出どころが届いていない歩で止まったあとで決めても_次は代わりに任せる(
        self,
    ) -> None:
        """前の出どころが例外を出した歩は、答えた歩に数えない。

        届いた最後の歩（4 歩目）まで前の出どころを使うと決めるのは正しい決め方で、
        5 歩目を読もうとして止まったことは、その妨げにならない。
        """
        arrivals: ArrivalLog[Move] = ArrivalLog(0)
        handover = Handover()
        maker = Maker()
        source: HandoverSource[int, Move] = HandoverSource(
            ReplaySource(arrivals), maker, handover
        )
        for step in range(5):
            arrivals.put(step, -1)
            assert source.command_at(step, 0) == -1
        with pytest.raises(LookupError):
            source.command_at(5, 0)
        handover.hand_over_after(arrivals.arrived_through)
        assert source.command_at(5, 0) == 1
        assert len(maker.made) == 1
