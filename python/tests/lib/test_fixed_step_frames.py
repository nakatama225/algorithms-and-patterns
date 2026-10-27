"""固定刻みの時間のうち、締め切りまで眠る関数とフレームの輪の検査（Python だけ）。

実時間は使わず、偽の時計（``fake_time.py``）で動かす。
"""

import itertools
import math
from functools import partial

import pytest

from algorithms_and_patterns.lib.fixed_step import (
    NS_PER_SECOND,
    Wait,
    frames,
    sleep_until,
)

from .fake_time import FakeTime
from .test_fixed_step import MAX, SPS, STEP_CEIL_NS, STEP_NS, accumulator


def boundary(k: int) -> int:
    """始めから k 番目の刻みの境目の時刻（ナノ秒。切り上げ）。"""
    return -(-(k * NS_PER_SECOND) // SPS)


def run(fake: FakeTime, count: int) -> list[int]:
    """偽の時計で輪を動かし、最初の ``count`` フレームの刻みの数を並べる。"""
    return list(itertools.islice(frames(accumulator(), fake.clock, fake.wait), count))


class Testフレームの輪:
    def test_最初のフレームは待たずに0を返す(self) -> None:
        """始めの状態を1回描くため。"""
        fake = FakeTime()
        assert run(fake, 1) == [0]
        assert fake.deadlines == []

    def test_遅れなければ_毎回1刻み進み_締め切りは刻みの境目からずれない(
        self,
    ) -> None:
        """600 フレーム（10 秒）進めても、締め切りが境目にちょうど乗り続けること。

        前の締め切りに1刻みの長さを足していく形だと、16_666_666.66… ナノ秒が割り切れず、
        締め切りが少しずつずれていく。
        """
        fake = FakeTime()
        assert run(fake, 601) == [0] + [1] * 600
        assert fake.deadlines == [boundary(k) for k in range(1, 601)]

    def test_待ちが1刻みより短く遅れても_次の締め切りは刻みの境目に戻る(
        self,
    ) -> None:
        fake = FakeTime([0, 0, 5_000_000])
        assert run(fake, 6) == [0, 1, 1, 1, 1, 1]
        assert fake.deadlines == [boundary(k) for k in range(1, 6)]

    def test_1フレームの数が揺れても_返した数の合計は経過時間どおり(self) -> None:
        """待ちの遅れを台本で与え、1フレームの数を 1・2・7 と揺らす。

        1フレームの数が揺れても、端数を持ち越すので、返した数の合計は、そこまでの経過
        時間を刻みの数に換えた値と同じになる。台本は上限（15）を超えない遅れだけにする
        （超えた分は捨てるので、合計が経過時間より少なくなる。それは下の別のテストで見る）。
        """
        lateness = [0, STEP_NS * 3 // 2, 0, STEP_NS * 13 // 2, 0] * 40
        fake = FakeTime(lateness)
        counts = run(fake, 200)
        # 前提：1フレームの数が実際に揺れたこと。どのフレームも1だと、
        # 合計の確認が素通りする。
        assert counts[0] == 0
        assert {1, 2, 7} <= set(counts[1:])
        assert max(counts) < MAX
        assert sum(counts) == fake.now_ns * SPS // NS_PER_SECOND

    def test_呼ぶ側の処理が長いと_待たずに遅れた分を進める(self) -> None:
        fake = FakeTime()
        loop = frames(accumulator(), fake.clock, fake.wait)
        assert next(loop) == 0
        fake.now_ns += STEP_NS * 3 + STEP_NS // 5  # 描くのに 3.2 刻み分かかった
        assert next(loop) == 3
        # 締め切りを過ぎていたので、時計を進めていない。
        assert fake.now_ns == STEP_NS * 3 + STEP_NS // 5
        assert next(loop) == 1
        assert fake.now_ns == boundary(4)

    def test_上限を超えて遅れたら_捨てて_次のフレームから境目を引き直す(
        self,
    ) -> None:
        fake = FakeTime([0, 20 * STEP_NS])
        assert run(fake, 4) == [0, 1, MAX, 1]
        # 捨てたあとは、目を覚ました時刻から1刻み分先が、次の締め切りになる。
        woke = boundary(2) + 20 * STEP_NS
        assert fake.deadlines[2] == woke + STEP_CEIL_NS

    def test_breakで抜けると_そのあと待たない(self) -> None:
        # 1刻みのフレームが来ないまま輪が動き続けても終わるよう、
        # フレームの数に上限を置く。
        fake = FakeTime()
        for steps in itertools.islice(frames(accumulator(), fake.clock, fake.wait), 10):
            if steps == 1:
                break
        assert len(fake.deadlines) == 1


class Test締め切りまで眠る:
    def test_早く目を覚ましたら_締め切りまで眠り直す(self) -> None:
        fake = FakeTime()
        slept: list[float] = []

        def sleep(seconds: float) -> None:
            # 締め切りを過ぎても眠り続ける誤りで、テストが終わらなくならないようにする。
            assert len(slept) < 100, "締め切りを過ぎても眠り続けている"
            slept.append(seconds)
            # 頼んだ長さの 9 割で覚める。
            fake.now_ns += math.ceil(seconds * NS_PER_SECOND * 0.9)

        sleep_until(10_000_000, fake.clock, sleep)
        assert fake.now_ns >= 10_000_000
        assert len(slept) > 1
        # 眠る長さは、残りの時間を秒にしたもの。
        assert slept[0] == 0.01

    @pytest.mark.parametrize("now", [10_000_000, 10_000_001])
    def test_締め切りちょうどか_過ぎていれば_眠らない(self, now: int) -> None:
        fake = FakeTime()
        fake.now_ns = now

        def sleep(seconds: float) -> None:
            raise AssertionError(f"眠った: {seconds}")

        sleep_until(10_000_000, fake.clock, sleep)

    def test_partialで眠る関数を渡すと_輪の待ち方になる(self) -> None:
        """sleep_until の説明に書いた渡し方が、型検査と実際の動きの両方で通ること。

        型検査は、``Wait`` の型の変数に代入して見る。
        """
        now = [0]
        slept: list[float] = []

        def clock() -> int:
            return now[0]

        def sleep(seconds: float) -> None:
            # 締め切りを過ぎても眠り続ける誤りで、テストが終わらなくならないようにする。
            assert len(slept) < 100, "締め切りを過ぎても眠り続けている"
            slept.append(seconds)
            now[0] += math.ceil(seconds * NS_PER_SECOND)

        wait: Wait = partial(sleep_until, sleep=sleep)
        counts = list(itertools.islice(frames(accumulator(), clock, wait), 4))
        assert counts == [0, 1, 1, 1]
        assert now[0] == boundary(3)
