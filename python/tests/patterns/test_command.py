"""命令を値として渡す型（Command）のうち、記録と再生の検査。

記録と再生（CommandLog・RecordingSource・ReplaySource）をここで見る。届いた範囲を
持つ記録（ArrivalLog）は ``test_command_arrival.py`` が見る。変わる理由が違うので、
ファイルを分けた。
"""

from dataclasses import dataclass
from typing import Literal

import pytest

from algorithms_and_patterns.patterns.command import (
    CommandLog,
    CommandSource,
    RecordingSource,
    ReplaySource,
)

# 確かめるための小さな処理。数直線の上の位置を、命令のぶんだけ動かす。
Move = Literal[-1, 0, 1]


@dataclass(frozen=True)
class Point:
    position: int


def apply(state: Point, move: Move) -> Point:
    return Point(state.position + move)


def run(source: CommandSource[Point, Move], steps: int) -> Point:
    """出どころから命令を受け取りながら、``steps`` 歩ぶん進める。"""
    state = Point(0)
    for step in range(steps):
        state = apply(state, source.command_at(step, state))
    return state


class BackAndForth:
    """状態を見て命令を決める出どころ。3 まで進んだら 0 へ戻り、また進む。

    ``CommandSource`` を継承していない。同じ形のメソッドを持つので、そのまま渡せる。
    """

    def __init__(self) -> None:
        self._going_up = True

    def command_at(self, step: int, view: Point) -> Move:
        if view.position >= 3:
            self._going_up = False
        if view.position <= 0:
            self._going_up = True
        return 1 if self._going_up else -1


class TestCommandLog:
    def test_何も記録していなければ_どの歩でも何もしない命令を返す(self) -> None:
        log: CommandLog[Move] = CommandLog(0)
        assert log.at(0) == 0
        assert log.at(1000) == 0
        assert log.entries() == ()
        assert log.last_step == -1

    def test_変わった歩ちょうどから新しい命令になり_その手前は前の命令のまま(
        self,
    ) -> None:
        log: CommandLog[Move] = CommandLog(0)
        log.record(5, 1)
        assert log.at(4) == 0
        assert log.at(5) == 1
        assert log.at(99) == 1

    def test_同じ命令が続く間は_記録を増やさない(self) -> None:
        """押しっぱなしの操作を歩ごとに1件ずつ持つと、記録が歩の数だけ膨らむ。"""
        log: CommandLog[Move] = CommandLog(0)
        for step in range(10):
            log.record(step, 1)
        log.record(10, -1)
        log.record(11, -1)
        assert log.entries() == ((0, 1), (10, -1))

    def test_記録を増やさなかった歩も_最後に受け付けた歩として覚えている(
        self,
    ) -> None:
        """保存した記録から、何歩ぶん再生すればよいかを取り出せるようにする。"""
        log: CommandLog[Move] = CommandLog(0)
        log.record(0, 1)
        log.record(7, 1)
        assert len(log.entries()) == 1
        assert log.last_step == 7

    def test_最初に何もしない命令を記録しても_記録は増えない(self) -> None:
        log: CommandLog[Move] = CommandLog(0)
        log.record(0, 0)
        log.record(1, 0)
        assert log.entries() == ()

    def test_何度も変わった記録から_それぞれの歩の命令を引ける(self) -> None:
        log: CommandLog[Move] = CommandLog(0)
        script: list[Move] = [1, 1, 0, -1, -1, -1, 1, 0, 0, 1]
        for step, move in enumerate(script):
            log.record(step, move)
        assert [log.at(step) for step in range(len(script))] == script

    def test_歩が戻ると止まる(self) -> None:
        """歩の番号を数え直した記録（例：途中で 0 に戻した）を、黙って受け付けない。

        受け付けると、再生したときに後から記録した命令が前の命令を上書きして見える。
        """
        log: CommandLog[Move] = CommandLog(0)
        log.record(3, 1)
        with pytest.raises(ValueError):
            log.record(2, -1)

    def test_断った記録は_受け付けた最後の歩を動かさない(self) -> None:
        """断る前に最後の歩を書き換えると、戻った番号のあとで、一度受け付けた番号を
        もう一度受け付けてしまう。
        """
        log: CommandLog[Move] = CommandLog(0)
        log.record(3, 1)
        with pytest.raises(ValueError):
            log.record(2, -1)
        assert log.last_step == 3
        with pytest.raises(ValueError):
            log.record(3, -1)

    def test_同じ歩を2度記録すると止まる_命令が同じでも止まる(self) -> None:
        log: CommandLog[Move] = CommandLog(0)
        log.record(3, 1)
        with pytest.raises(ValueError):
            log.record(3, -1)
        with pytest.raises(ValueError):
            log.record(3, 1)

    def test_記録を増やさなかった歩も_2度目は受け付けない(self) -> None:
        log: CommandLog[Move] = CommandLog(0)
        log.record(3, 0)
        with pytest.raises(ValueError):
            log.record(3, 1)

    def test_負の歩は_記録にも読み出しにも使えない(self) -> None:
        """負の歩は数え間違いの結果。何もしない命令を返して黙って進めない。"""
        log: CommandLog[Move] = CommandLog(0)
        with pytest.raises(ValueError):
            log.record(-1, 1)
        with pytest.raises(ValueError):
            log.at(-1)

    def test_中身が同じ命令は_別に作ったものでも同じ命令として扱う(self) -> None:
        """dataclass の ``==`` は項目ごとに比べる。比べ方を渡さなくてよい。"""

        @dataclass(frozen=True)
        class Keys:
            left: bool
            right: bool

        log = CommandLog(Keys(left=False, right=False))
        for step in range(5):
            # 毎回、中身が同じ別のオブジェクトを作る。
            log.record(step, Keys(left=True, right=False))
        assert len(log.entries()) == 1

    def test_比べ方を持たないクラスの命令は_別に作るたびに変わったとみなす(
        self,
    ) -> None:
        """``__eq__`` を持たないクラスは「同じものか」で比べる。

        比べ方を渡す口は無いので、中身で比べたいなら命令を dataclass などで表す。
        この振る舞いを黙って決めないために書いておく。
        """

        class Keys:
            def __init__(self, left: bool) -> None:
                self.left = left

        log = CommandLog(Keys(left=False))
        for step in range(5):
            log.record(step, Keys(left=True))
        assert len(log.entries()) == 5


class TestRecordingAndReplay:
    def test_記録しながら流した命令を再生すると_同じ結果になる(self) -> None:
        """この型の目的そのもの。状態を見て命令を決める出どころでも、再生で同じになる。"""
        log: CommandLog[Move] = CommandLog(0)
        recorded = run(RecordingSource(BackAndForth(), log), 50)
        replayed = run(ReplaySource(log), 50)
        assert replayed == recorded

    def test_再生は_記録した命令の列を歩ごとにそのまま返す(self) -> None:
        log: CommandLog[Move] = CommandLog(0)
        seen: list[Move] = []
        inner = BackAndForth()

        class Spy:
            def command_at(self, step: int, view: Point) -> Move:
                move = inner.command_at(step, view)
                seen.append(move)
                return move

        run(RecordingSource(Spy(), log), 20)
        replay = ReplaySource(log)
        assert [replay.command_at(step, None) for step in range(len(seen))] == seen

    def test_再生は歩の番号で命令を引く_呼ばれた順番には頼らない(self) -> None:
        """呼ばれた回数を自分で数えて引く作りだと、途中から再生したり、
        同じ歩を読み直したりしたときに別の命令を返す。
        """
        log: CommandLog[Move] = CommandLog(0)
        log.record(3, 1)
        log.record(7, -1)
        replay = ReplaySource(log)
        steps = [7, 3, 7, 0, 5]
        assert [replay.command_at(step, None) for step in steps] == [-1, 1, -1, 0, 1]

    def test_記録は_渡された歩の番号のまま残る(self) -> None:
        """包む側が自分で番号を数える作りだと、歩 5 から始めた記録が 0 から始まる。"""
        moves: dict[int, Move] = {5: 1, 10: -1, 20: 1}

        class Scripted:
            def command_at(self, step: int, view: Point) -> Move:
                return moves.get(step, 0)

        log: CommandLog[Move] = CommandLog(0)
        recording = RecordingSource(Scripted(), log)
        for step in (5, 10, 20):
            recording.command_at(step, Point(0))
        assert log.entries() == ((5, 1), (10, -1), (20, 1))

    def test_包まれた出どころには_同じ歩の番号と状態がそのまま渡る(self) -> None:
        calls: list[tuple[int, int]] = []

        class Recorder:
            def command_at(self, step: int, view: Point) -> Move:
                calls.append((step, view.position))
                return 1

        log: CommandLog[Move] = CommandLog(0)
        run(RecordingSource(Recorder(), log), 3)
        assert calls == [(0, 0), (1, 1), (2, 2)]

    def test_記録した歩数より長く再生すると_最後の命令が続く(self) -> None:
        """再生を記録より長く回したときの振る舞いを、黙って決めないために書いておく。"""
        log: CommandLog[Move] = CommandLog(0)
        recorded = run(RecordingSource(BackAndForth(), log), 10)
        last = log.at(9)
        replayed = run(ReplaySource(log), 20)
        assert replayed.position == recorded.position + last * 10

    def test_より多くを知っている状態を前提にした出どころは_型検査で渡せない(
        self,
    ) -> None:
        """状態の型の向きを型検査が見ていることを確かめる。

        下の代入に付けた ``type: ignore`` は、mypy が型エラーを出すから要る。
        エラーが出なくなると、mypy --strict は使われていない ``type: ignore`` として
        落とす。
        """

        @dataclass(frozen=True)
        class Labeled(Point):
            label: str

        class NeedsLabel:
            def command_at(self, step: int, view: Labeled) -> Move:
                return 1 if view.label.startswith("+") else 0

        source: CommandSource[Point, Move] = NeedsLabel()  # type: ignore[assignment]
        assert isinstance(source, NeedsLabel)
