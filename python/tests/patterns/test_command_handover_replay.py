"""命令を値として渡す型（Command）のうち、途中で替わる出どころの2つの側の比べ合わせ。

届いた命令で進める側と、保存したものを再生する側が、同じ歩に替わるかをここで見る。
部品そのもの（Handover・HandoverSource）の約束は ``test_command_handover.py`` が見る。
2つの側を揃える使い方（命令の記録と替わる歩を一緒に保存する）は、部品の約束とは
別の理由で変わるので、ファイルを分けた。
"""

from typing import Literal

import pytest

from algorithms_and_patterns.patterns.command import (
    ArrivalLog,
    CommandChange,
    CommandLog,
    CommandSource,
    ReplaySource,
)
from algorithms_and_patterns.patterns.command_sources import Handover, HandoverSource

Move = Literal[-1, 0, 1]


class Bounce:
    """状態を見て命令を決め、向きを覚えている出どころ。位置 0 と 2 の間を行き来する。"""

    def __init__(self) -> None:
        self._up = True

    def command_at(self, step: int, view: int) -> Move:
        if view >= 2:
            self._up = False
        if view <= 0:
            self._up = True
        return 1 if self._up else -1


def run(source: CommandSource[int, Move], steps: int) -> list[Move]:
    """位置 0 から、出どころの命令のぶんだけ ``steps`` 歩ぶん動かし、命令の列を返す。"""
    position = 0
    moves: list[Move] = []
    for step in range(steps):
        move = source.command_at(step, position)
        moves.append(move)
        position += move
    return moves


# 届いた命令。5 歩目からは届かず、4 歩目のあとで替わると決まる。
ARRIVED: list[Move] = [1, 1, 0, -1, -1]
STEPS = 12
Saved = tuple[CommandChange[Move], ...]


def run_arrived(*, decide: bool) -> tuple[list[Move], Saved, int | None]:
    """届いた命令で進める側。命令は1歩ずつ届き、届かなくなった所で替わる歩が決まる。

    進めた命令の列と、保存するもの（届いた命令の一覧と、前の出どころを最後に使う歩）
    を返す。代わりの出どころの命令は、保存するものに含まれない。
    """
    arrivals: ArrivalLog[Move] = ArrivalLog(0)
    handover = Handover()
    source: HandoverSource[int, Move] = HandoverSource(
        ReplaySource(arrivals), Bounce, handover
    )
    position = 0
    moves: list[Move] = []
    for step in range(STEPS):
        if step < len(ARRIVED):
            arrivals.put(step, ARRIVED[step])
        elif decide and handover.after is None:
            # 次の命令は届かないと知らされた。届いた最後の歩まで前の出どころを使う。
            handover.hand_over_after(arrivals.arrived_through)
        move = source.command_at(step, position)
        moves.append(move)
        position += move
    return moves, arrivals.entries(), handover.after


def run_replayed(entries: Saved, after: int | None) -> list[Move]:
    """保存したものを再生する側。記録を作り直し、代わりも同じ作り方で作り直す。"""
    log: CommandLog[Move] = CommandLog(0)
    for step, command in entries:
        log.record(step, command)
    handover = Handover()
    if after is not None:
        handover.hand_over_after(after)
    source: HandoverSource[int, Move] = HandoverSource(
        ReplaySource(log), Bounce, handover
    )
    return run(source, STEPS)


class TestArrivedAndReplayed:
    def test_届いた命令で進める側と_保存したものを再生する側は_同じ歩に替わる(
        self,
    ) -> None:
        """2つの側は同じ判定（``Handover.replaced_at``）を読む。

        再生する側の記録は、保存した歩から作り直す。同じ歩を決めた記録を渡せば、
        2つの側は同じ歩で替わる。代わりの出どころの命令は保存しない。再生する側は、
        同じ作り方で代わりを作り直す。代わりの命令まで記録して再生する形だと、
        替わる歩を渡さなくても一致するので、2つの側が同じ歩に替わることは示せない。
        """
        arrived, entries, after = run_arrived(decide=True)
        assert after == len(ARRIVED) - 1
        assert arrived == [*ARRIVED, 1, 1, -1, -1, 1, 1, -1]
        assert max(step for step, _ in entries) < len(ARRIVED)
        assert run_replayed(entries, after) == arrived

    def test_再生する側だけ替わる歩が1歩ずれると_例外も出ずに命令の列が違う(
        self,
    ) -> None:
        """保存した替わる歩が1歩ずれると起きること。

        部品の中では見つけられないので、命令の記録と替わる歩を一緒に残す。後へ
        ずれると、記録の最後の命令が1歩ぶん続く。前へずれると、まだ届いた命令を
        使う歩で代わりに任せる。
        """
        arrived, entries, after = run_arrived(decide=True)
        assert after is not None
        assert run_replayed(entries, after + 1) != arrived
        assert run_replayed(entries, after - 1) != arrived

    def test_替わる歩を決め忘れると_進める側は届いていない歩で止まり_再生は黙ってずれる(
        self,
    ) -> None:
        """再生する側の記録（CommandLog）は、記録より先の歩に最後の命令を返し続ける。

        替わる歩を保存し忘れると、再生する側は例外も出さずに別の結果になる。
        届いた命令で進める側は、まだ届いていない歩を読んだ所で止まる（ArrivalLog）。
        """
        with pytest.raises(LookupError):
            run_arrived(decide=False)
        arrived, entries, _ = run_arrived(decide=True)
        replayed = run_replayed(entries, None)
        assert replayed != arrived
        assert replayed[len(ARRIVED) :] == [-1] * (STEPS - len(ARRIVED))
