"""命令を値として渡す型（Command）のうち、届いた範囲を持つ記録（ArrivalLog）の検査。

記録と再生（CommandLog・RecordingSource・ReplaySource）は ``test_command.py`` が見る。
届いた範囲の約束（順に1つずつ受け取る・届いていない歩を読ませない）は、
記録の縮め方や再生の仕方とは別の理由で変わるので、ファイルを分けた。
"""

from typing import Literal

import pytest

from algorithms_and_patterns.patterns.command import (
    ArrivalLog,
    CommandLog,
    CommandLookup,
    CommandSource,
    ReplaySource,
)

Move = Literal[-1, 0, 1]

# 何度か変わり、同じ命令が続く所も含む並び。最後も同じ命令が続き、変わった最後の歩
# （8 歩目）より先まで届いている。
SCRIPT: list[Move] = [1, 1, 0, -1, -1, -1, 1, 1, 0, 0, 0]


def arrived(script: list[Move]) -> ArrivalLog[Move]:
    """``script`` を 0 歩目から順に受け取った記録。"""
    log: ArrivalLog[Move] = ArrivalLog(0)
    for step, move in enumerate(script):
        log.put(step, move)
    return log


def run(source: CommandSource[int, Move], steps: int) -> int:
    """数直線の上の位置を、出どころの命令のぶんだけ ``steps`` 歩ぶん動かす。"""
    position = 0
    for step in range(steps):
        position += source.command_at(step, position)
    return position


class TestArrivalLog:
    def test_何も届いていなければ_届いた範囲はマイナス1で_0歩目も読めない(
        self,
    ) -> None:
        """何もしない命令を返すと、届く前に動き出した側だけがずれる。"""
        log: ArrivalLog[Move] = ArrivalLog(0)
        assert log.arrived_through == -1
        assert not log.has(0)
        with pytest.raises(LookupError):
            log.at(0)
        assert log.entries() == ()

    def test_順に受け取れば_届いた範囲では_CommandLog_と同じ命令を返す(
        self,
    ) -> None:
        expected: CommandLog[Move] = CommandLog(0)
        for step, move in enumerate(SCRIPT):
            expected.record(step, move)
        log = arrived(SCRIPT)
        assert log.arrived_through == len(SCRIPT) - 1
        assert [log.at(step) for step in range(len(SCRIPT))] == SCRIPT
        assert log.entries() == expected.entries()

    def test_命令が変わらない歩でも_届いた範囲は進み_記録は増えない(self) -> None:
        """変わった歩だけで範囲を数えると、同じ命令が続く間は届いた歩も読めない。"""
        log: ArrivalLog[Move] = ArrivalLog(0)
        for step in range(5):
            log.put(step, 1)
        assert log.arrived_through == 4
        assert log.has(4)
        assert log.at(4) == 1
        assert log.entries() == ((0, 1),)

    def test_最初から何もしない命令が続いても_届いた範囲は進む(self) -> None:
        log: ArrivalLog[Move] = ArrivalLog(0)
        log.put(0, 0)
        log.put(1, 0)
        assert log.arrived_through == 1
        assert log.at(1) == 0
        assert log.entries() == ()

    def test_届いた範囲の外を読むと止まる_CommandLog_なら最後の命令が返る歩でも(
        self,
    ) -> None:
        """この記録の目的そのもの。

        対照の CommandLog は、同じ歩でそれらしい命令を返す。
        """
        log = arrived([1, 1, 1])
        with pytest.raises(LookupError):
            log.at(3)
        assert not log.has(3)
        assert log.has(2)

        plain: CommandLog[Move] = CommandLog(0)
        for step in range(3):
            plain.record(step, 1)
        assert plain.at(3) == 1

    def test_飛んだ歩は受け取らない(self) -> None:
        """飛んだ歩を受け付けると、抜けた歩に直前の命令が続いて見える。"""
        log: ArrivalLog[Move] = ArrivalLog(0)
        log.put(0, 1)
        with pytest.raises(ValueError):
            log.put(2, -1)

    def test_最初の命令は_0歩目でなければ受け取らない(self) -> None:
        log: ArrivalLog[Move] = ArrivalLog(0)
        with pytest.raises(ValueError):
            log.put(1, 1)
        assert log.arrived_through == -1

    def test_戻った歩と_同じ歩の2度目は_命令が同じでも受け取らない(self) -> None:
        log = arrived([1, 1, 0])
        with pytest.raises(ValueError):
            log.put(1, -1)
        with pytest.raises(ValueError):
            log.put(2, 0)
        with pytest.raises(ValueError):
            log.put(2, 1)
        assert log.arrived_through == 2
        assert log.entries() == ((0, 1), (2, 0))

    def test_断った命令は_届いた範囲も記録も動かさない(self) -> None:
        """断る前に範囲を進めると、抜けた歩の命令が届いても、もう受け取れない。"""
        log: ArrivalLog[Move] = ArrivalLog(0)
        log.put(0, 1)
        with pytest.raises(ValueError):
            log.put(2, -1)
        assert log.arrived_through == 0
        assert not log.has(2)
        assert log.entries() == ((0, 1),)

        # 抜けていた歩が届けば、そこから続けられる。
        log.put(1, 0)
        log.put(2, -1)
        assert [log.at(step) for step in range(3)] == [1, 0, -1]

    def test_負の歩は_受け取りにも_届いたかの問いにも_読み出しにも使えない(
        self,
    ) -> None:
        """負の歩は数え間違いの結果。届いた・届いていないのどちらでも答えない。

        読み出しは、まだ届いていない歩の ``LookupError`` と分けて、
        ``ValueError`` で止める。
        """
        log = arrived([1, 1])
        with pytest.raises(ValueError):
            log.put(-1, 1)
        with pytest.raises(ValueError):
            log.has(-1)
        with pytest.raises(ValueError):
            log.at(-1)
        assert log.arrived_through == 1


class TestArrivalReplay:
    def test_ReplaySource_に渡すと_届いた歩までは命令を返し_その先で止まる(
        self,
    ) -> None:
        log = arrived(SCRIPT)
        replay = ReplaySource(log)
        steps = range(len(SCRIPT))
        assert [replay.command_at(step, None) for step in steps] == SCRIPT
        with pytest.raises(LookupError):
            replay.command_at(len(SCRIPT), None)

    def test_届いた歩までは_CommandLog_を再生したときと同じ結果になる(self) -> None:
        """届いた命令で進めた結果が、同じ命令を記録して再生した結果と一致する。

        対照の CommandLog は、記録より先の歩まで進めても、最後の命令を返し続ける。
        """
        plain: CommandLog[Move] = CommandLog(0)
        for step, move in enumerate(SCRIPT):
            plain.record(step, move)
        log = arrived(SCRIPT)
        assert run(ReplaySource(log), len(SCRIPT)) == run(
            ReplaySource(plain), len(SCRIPT)
        )
        run(ReplaySource(plain), len(SCRIPT) + 1)
        with pytest.raises(LookupError):
            run(ReplaySource(log), len(SCRIPT) + 1)

    def test_保存した一覧から作り直した記録は_届いた歩まで同じ命令を返す(
        self,
    ) -> None:
        """``entries()`` と ``arrived_through`` を残せば、届いた範囲を再生できる。

        一覧だけでは、最後に変わった歩より先のどこまで届いていたかが分からない。
        """
        log = arrived(SCRIPT)
        rebuilt: CommandLog[Move] = CommandLog(0)
        for step, command in log.entries():
            rebuilt.record(step, command)
        assert rebuilt.last_step < log.arrived_through
        steps = range(log.arrived_through + 1)
        assert [ReplaySource(rebuilt).command_at(step, None) for step in steps] == [
            ReplaySource(log).command_at(step, None) for step in steps
        ]

    def test_at_を持つものなら_継承せずにそのまま記録として渡せる(self) -> None:
        """``ReplaySource`` が受けるのは ``CommandLookup`` で、記録に限らない。"""

        class Alternating:
            def at(self, step: int) -> Move:
                return 1 if step % 2 == 0 else -1

        replay = ReplaySource(Alternating())
        assert [replay.command_at(step, None) for step in range(3)] == [1, -1, 1]

    def test_歩の型を狭めた_at_は_型検査で渡せない(self) -> None:
        """歩の型の向きを型検査が見ていることを示す。

        下の代入に付けた ``type: ignore`` は、mypy が型エラーを出すから要る。
        エラーが出なくなると、mypy --strict は使われていない ``type: ignore`` を
        エラーにする。
        """

        class FirstTwo:
            def at(self, step: Literal[0, 1]) -> Move:
                return 1 if step == 0 else -1

        lookup: CommandLookup[Move] = FirstTwo()  # type: ignore[assignment]
        assert lookup.at(0) == 1
