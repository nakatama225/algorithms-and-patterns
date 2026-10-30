"""命令を値として渡す型（Command）のうち、出どころを合わせる部品（CombinedSource）の検査。

途中で替わる出どころ（Handover・HandoverSource）は ``test_command_handover.py`` が
見る。合わせ方の約束（全部に聞く・並びの順）と、替わる歩の約束は、別の理由で
変わるので、ファイルを分けた。
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar

import pytest

from algorithms_and_patterns.patterns.command import CommandLog, RecordingSource
from algorithms_and_patterns.patterns.command_sources import CombinedSource

C = TypeVar("C")


@dataclass(frozen=True)
class Sides:
    """左と右のそれぞれへ動くかの組。"""

    left: bool
    right: bool


IDLE = Sides(left=False, right=False)


def either(commands: Sequence[Sides]) -> Sides:
    """項目ごとの OR。どれかの出どころが真なら真にする。"""
    return Sides(
        left=any(command.left for command in commands),
        right=any(command.right for command in commands),
    )


class Fixed(Generic[C]):
    """いつも同じ命令を返し、聞かれた歩と状態を覚える出どころ。"""

    def __init__(self, command: C) -> None:
        self.command = command
        self.asked: list[tuple[int, object]] = []

    def command_at(self, step: int, view: object) -> C:
        self.asked.append((step, view))
        return self.command


class Scripted:
    """歩ごとに決めた命令を返す出どころ。決めていない歩は何もしない命令。"""

    def __init__(self, script: dict[int, Sides]) -> None:
        self._script = script

    def command_at(self, step: int, view: object) -> Sides:
        return self._script.get(step, IDLE)


class Idle:
    """何もしない命令を返す出どころ。"""

    def command_at(self, step: int, view: object) -> Sides:
        return IDLE


class TestCombinedSource:
    def test_先の出どころで答えが決まっても_毎歩_後ろの出どころまで全部に聞く(
        self,
    ) -> None:
        """打ち切ると、聞かれなかった出どころの覚えている内容が古くなる。

        先頭が両方とも真を返すので、OR の答えは先頭だけで決まる。それでも後ろの
        2つに聞いたことを、聞かれた歩の列で見る。
        """
        sources = (Fixed(Sides(True, True)), Fixed(IDLE), Fixed(Sides(False, True)))
        combined = CombinedSource(sources, either)
        for step in range(4):
            assert combined.command_at(step, None) == Sides(True, True)
        for source in sources:
            assert [step for step, _ in source.asked] == [0, 1, 2, 3]

    def test_並びの順に聞き_合わせ方には並びの順のまま渡す(self) -> None:
        """並べ替えると、順で結果が変わる合わせ方（先頭を優先する、など）が狂う。"""
        order: list[str] = []

        @dataclass(frozen=True)
        class Named:
            name: str

            def command_at(self, step: int, view: object) -> str:
                order.append(self.name)
                return self.name

        combined = CombinedSource((Named("c"), Named("a"), Named("b")), "".join)
        assert combined.command_at(0, None) == "cab"
        assert order == ["c", "a", "b"]

    def test_真偽の組は_項目ごとの_OR_で_どれかの出どころが真なら真にする(
        self,
    ) -> None:
        """2つの出どころのどちらで指示しても、同じように動けるようにする見本。"""
        first = Scripted({0: Sides(True, False), 2: Sides(True, False)})
        second = Scripted({1: Sides(False, True), 2: Sides(False, True)})
        combined = CombinedSource((first, second), either)
        assert [combined.command_at(step, None) for step in range(4)] == [
            Sides(True, False),
            Sides(False, True),
            Sides(True, True),
            IDLE,
        ]

    def test_何もしない出どころを合わせても_ほかの出どころの命令は消えない(
        self,
    ) -> None:
        """何もしない出どころを、足りない所の穴埋めでなく、並びに明示して置く見本。"""
        both = Sides(True, True)
        assert CombinedSource((Fixed(both), Idle()), either).command_at(0, None) == both
        assert CombinedSource((Idle(), Idle()), either).command_at(0, None) == IDLE

    def test_出どころが1つでも_そのまま返さずに合わせ方を通す(self) -> None:
        """1つなら合わせ方を飛ばす作りだと、合わせ方が命令を変える場合に結果が変わる。"""
        assert CombinedSource((Fixed(7),), len).command_at(0, None) == 1

    def test_どの出どころにも_同じ歩と状態を渡す(self) -> None:
        first, second = Fixed(IDLE), Fixed(IDLE)
        combined = CombinedSource((first, second), either)
        view = object()
        combined.command_at(5, view)
        combined.command_at(9, view)
        assert first.asked == second.asked == [(5, view), (9, view)]

    def test_同じ記録する出どころを2度並べると_1歩に2度記録しようとして止まる(
        self,
    ) -> None:
        """重なりを見分けず、並べたとおり1歩に2度聞く。

        前の歩を覚えている出どころを2度並べると、1歩で2歩ぶん進む。記録する出どころ
        なら、同じ歩の2度目の記録を ``CommandLog`` が断る。
        """
        log: CommandLog[Sides] = CommandLog(IDLE)
        recording = RecordingSource(Fixed(Sides(True, False)), log)
        combined = CombinedSource((recording, recording), either)
        with pytest.raises(ValueError, match="歩が進んでいない"):
            combined.command_at(0, None)
        assert log.last_step == 0

    def test_並びは_tuple_で受け_list_を渡すと型検査が止める(self) -> None:
        """作ったあとで並びを空にされて、空の検査をすり抜けないようにする。

        実行時は写さずにそのまま持つので、型検査を通さずに list を渡すと、渡した list を
        空にしたときに、合わせる出どころも空になる（TypeScript 版は配列を写して持つ）。
        下の行に付けた ``type: ignore`` は、mypy が型エラーを出すから要る。エラーが
        出なくなると、mypy --strict は使われていない ``type: ignore`` として止める。
        """
        sources = [Fixed(IDLE)]
        combined: CombinedSource[object, Sides]
        combined = CombinedSource(sources, either)  # type: ignore[arg-type]
        sources.clear()
        assert len(combined.sources) == 0

    def test_合わせる出どころが無ければ作れない(self) -> None:
        """繋ぎ忘れたまま、空の並びを合わせた命令（OR なら全部が偽）で進めない。"""
        with pytest.raises(ValueError, match="合わせる出どころが無い"):
            CombinedSource[object, Sides]((), either)
