"""フレームの輪（``fixed_step.frames``）を、実時間なしで動かすための偽の時計と偽の待ち方。

テストの補助で、``src`` のどのファイルにも対応しない。
"""

from collections.abc import Iterable

from algorithms_and_patterns.lib.fixed_step import Clock


class FakeTime:
    """偽の時計と、偽の待ち方。

    待つ関数（``wait``）が呼ばれると、時計を締め切りの時刻へ進め、さらに台本の遅れ
    （ナノ秒。1回ごとに1つずつ使い、尽きたら 0）を足す。待ち方の約束（返ったとき、時計は
    締め切り以上）を守る。締め切りを過ぎてから呼ばれたら、時計は戻さない。
    """

    def __init__(self, lateness_ns: Iterable[int] = ()) -> None:
        self.now_ns = 0
        self.deadlines: list[int] = []
        self._lateness = iter(lateness_ns)

    def clock(self) -> int:
        """いまの時刻（ナノ秒）。"""
        return self.now_ns

    def wait(self, deadline_ns: int, clock: Clock) -> None:
        """締め切りを控え、時計を締め切りへ進めてから、台本の遅れを足す。"""
        self.deadlines.append(deadline_ns)
        self.now_ns = max(self.now_ns, deadline_ns) + next(self._lateness, 0)
