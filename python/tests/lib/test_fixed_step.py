"""固定刻みの時間のうち、経過時間を刻みの数に換える部品（StepAccumulator）の検査。

倍率（RateScaler）は ``test_fixed_step_rate.py``、締め切りまで眠る関数とフレームの輪は
``test_fixed_step_frames.py`` が見る。変わる理由が違うので、ファイルを分けた。
"""

import itertools

import pytest

from algorithms_and_patterns.lib.fixed_step import NS_PER_SECOND, StepAccumulator

# 1秒あたりの刻みの数と、1回に返す刻みの数の上限。
SPS = 60
MAX = 15
# 1刻みの長さ（ナノ秒）を切り捨てたもの。本当の長さは 16_666_666.66… ナノ秒。
STEP_NS = NS_PER_SECOND // SPS
# 1刻みの長さを切り上げたもの。この長さだけ経てば、必ず1刻み積み上がる。
STEP_CEIL_NS = STEP_NS + 1


def accumulator() -> StepAccumulator:
    """1秒に 60 刻み、1回の上限 15 刻みの StepAccumulator。"""
    return StepAccumulator(SPS, MAX)


def consume_all(accumulator: StepAccumulator, elapsed: list[int]) -> list[int]:
    """経過時間を順に渡し、返った刻みの数を並べる。"""
    return [accumulator.consume(ns) for ns in elapsed]


class Test経過時間を刻みの数に換える:
    def test_1刻み分経てば1刻み進み_わずかでも足りなければ進まない(self) -> None:
        assert accumulator().consume(STEP_CEIL_NS) == 1
        # 切り捨てた長さは、1刻みに 0.66 ナノ秒足りない。
        assert accumulator().consume(STEP_NS) == 0

    def test_経過が0なら進まず_端数も変わらない(self) -> None:
        subject = accumulator()
        assert subject.consume(0) == 0
        assert subject.ns_to_next_step() == STEP_CEIL_NS

    def test_端数を持ち越すので_揺れながらでも1秒でちょうど60刻み進む(self) -> None:
        """16 ms・17 ms・17 ms で、3回あたりちょうど3刻み（50 ms）。

        1回ごとの数は 0・1・2 と揺れる。端数を持ち越さずに捨てると、3回で2刻みになる。
        """
        elapsed = [16_000_000, 17_000_000, 17_000_000] * 20
        steps = consume_all(accumulator(), elapsed)
        assert sum(elapsed) == NS_PER_SECOND
        assert sum(steps) == SPS
        assert set(steps) == {0, 1, 2}

    def test_何時間続けても_合計は経過時間から割り算で出した値と同じ(self) -> None:
        """16_666_666・16_666_667・16_666_667 ナノ秒（3回で 50 ms）を3時間分渡す。

        積んだ端数が、刻みの境目にちょうど届く回が何度も来る。ミリ秒の小数で積む形では、
        境目に届いた回をわずかに手前と数えることがあり、合計が足りなくなる。
        """
        elapsed = [16_666_666, 16_666_667, 16_666_667] * (3 * 60 * 60 * 20)
        total = sum(consume_all(accumulator(), elapsed))
        assert total == sum(elapsed) * SPS // NS_PER_SECOND
        assert total == len(elapsed)

    @pytest.mark.parametrize("carried", [0, 1, 5_000_000, STEP_NS - 1, STEP_NS])
    def test_次の刻みの時刻にちょうど目を覚ませば_1刻み進む(self, carried: int) -> None:
        """待つ時刻を切り捨てていると、ちょうどに覚めても1刻みに届かない。"""
        subject = accumulator()
        assert subject.consume(carried) == 0
        assert subject.consume(subject.ns_to_next_step()) == 1

    def test_1刻みに足りずに覚めて0刻みになっても_次の刻みまでの時間は0にならない(
        self,
    ) -> None:
        """次の刻みまでの時間を切り上げる理由。

        切り捨てると、ここで 0 になり、輪が待たずに回る（時計が進まなければ、0刻みの
        フレームが続く）。
        """
        subject = accumulator()
        assert subject.consume(STEP_NS) == 0
        assert subject.ns_to_next_step() == 1
        assert subject.consume(1) == 1

    def test_始めからの境目の時刻を切り捨てて覚めると_0刻みと2刻みが混じる(
        self,
    ) -> None:
        """別の決め方との対照。

        次に覚める時刻を、持ち越した端数からでなく、始めからの境目の時刻を切り捨てて
        決める形。切り捨てた時刻（16_666_666・33_333_333・50_000_000 …）に覚めると、
        1刻みの境目のわずかに手前で覚める回と、次の境目を越えて覚める回が出る。
        切り上げた時刻（16_666_667・33_333_334・50_000_000 …。遅れなく覚めたときの
        ``ns_to_next_step`` の時刻と同じ）なら、どの回も1刻み。
        """
        floors = [k * NS_PER_SECOND // SPS for k in range(7)]
        ceils = [-(-k * NS_PER_SECOND // SPS) for k in range(7)]
        late = [b - a for a, b in itertools.pairwise(floors)]
        on_time = [b - a for a, b in itertools.pairwise(ceils)]
        assert consume_all(accumulator(), late) == [0, 1, 2, 0, 1, 2]
        assert consume_all(accumulator(), on_time) == [1] * 6

    def test_次の刻みの時刻は_持ち越した端数の分だけ近い(self) -> None:
        subject = accumulator()
        assert subject.ns_to_next_step() == STEP_CEIL_NS
        subject.consume(5_000_000)
        assert subject.ns_to_next_step() == STEP_CEIL_NS - 5_000_000

    def test_1秒あたりの刻みの数が10億より多くても_次の刻みまでは1ナノ秒(
        self,
    ) -> None:
        """1ナノ秒で2刻み進む。

        次の刻みまでの時間を 0 にすると、輪が待たずに回り続ける。
        """
        subject = StepAccumulator(2 * NS_PER_SECOND, MAX)
        assert subject.ns_to_next_step() == 1
        assert subject.consume(1) == 2
        assert subject.ns_to_next_step() == 1


class Test上限:
    def test_上限ちょうどまでは_端数を残して上限を返す(self) -> None:
        subject = accumulator()
        assert subject.consume(MAX * STEP_CEIL_NS + STEP_NS // 2) == MAX
        # 捨てていないので、端数（半刻み分）が残っている。
        assert subject.ns_to_next_step() < STEP_CEIL_NS

    def test_上限より1刻み多い分にちょうど届いたら_上限を返し_端数も捨てる(
        self,
    ) -> None:
        """境目の両側。1秒に 1000 刻み（1刻みがちょうど 1 ms）、上限 3 刻みで見る。"""
        kept = StepAccumulator(1000, 3)
        assert kept.consume(4_000_000 - 1) == 3
        assert kept.ns_to_next_step() == 1
        dropped = StepAccumulator(1000, 3)
        assert dropped.consume(4_000_000) == 3
        assert dropped.ns_to_next_step() == 1_000_000

    def test_端数が残っているときも_上限より1刻み多い分の境目で捨てる(self) -> None:
        """0.5 刻み分を持ち越してから、合わせて 4 刻みにちょうど届く経過時間で見る。

        1秒に 1000 刻み、上限 3。TypeScript 版と同じ値。
        """
        kept = StepAccumulator(1000, 3)
        kept.consume(500_000)
        assert kept.consume(3_500_000 - 1) == 3
        assert kept.ns_to_next_step() == 1
        dropped = StepAccumulator(1000, 3)
        dropped.consume(500_000)
        assert dropped.consume(3_500_000) == 3
        assert dropped.ns_to_next_step() == 1_000_000

    def test_割り切れない刻みの数でも_上限の境目の両側を取り違えない(self) -> None:
        """1秒に 60 刻み、上限 15。16 × 10 億 ÷ 60 = 266_666_666.66…

        TypeScript 版と同じ値。
        """
        kept = StepAccumulator(60, 15)
        assert kept.consume(266_666_666) == 15
        assert kept.ns_to_next_step() == 1
        dropped = StepAccumulator(60, 15)
        assert dropped.consume(266_666_667) == 15
        assert dropped.ns_to_next_step() == STEP_CEIL_NS

    def test_上限を超えた分は捨てて_次へ持ち越さない(self) -> None:
        """持ち越すと、次の呼び出しもまた上限まで進み、遅れが積み上がる。

        前から持ち越していた端数も捨てる。
        """
        subject = accumulator()
        subject.consume(5_000_000)
        assert subject.consume(10 * NS_PER_SECOND) == MAX
        assert subject.ns_to_next_step() == STEP_CEIL_NS
        assert subject.consume(0) == 0

    def test_とても長い経過時間でも_上限を返す(self) -> None:
        """Python の整数は桁あふれしないので、2**64 ナノ秒（約 585 年）も受ける。"""
        subject = accumulator()
        assert subject.consume(2**64) == MAX
        assert subject.ns_to_next_step() == STEP_CEIL_NS

    def test_上限が大きくても_割り算が正確(self) -> None:
        """TypeScript 版が受ける上限の最大（9_007_198）。積は 2**53 に近い。"""
        subject = StepAccumulator(1000, 9_007_198)
        assert subject.consume(9_007_198_999_999) == 9_007_198
        assert subject.ns_to_next_step() == 1


class Test止める値:
    def test_経過時間が負なら止まり_端数は変えない(self) -> None:
        """時刻は戻らない時計で測るので、負なら呼ぶ側の誤り。0 に丸めると気づけない。"""
        subject = accumulator()
        subject.consume(5_000_000)
        with pytest.raises(ValueError, match="経過時間が負"):
            subject.consume(-1)
        assert subject.ns_to_next_step() == STEP_CEIL_NS - 5_000_000

    @pytest.mark.parametrize("steps_per_second", [0, -1])
    def test_1秒あたりの刻みの数が1未満なら止まる(self, steps_per_second: int) -> None:
        """0 だと、次の刻みまでの時間を求める割り算で、0 で割る。"""
        with pytest.raises(ValueError, match="1秒あたりの刻みの数"):
            StepAccumulator(steps_per_second, MAX)

    @pytest.mark.parametrize("max_steps", [0, -1])
    def test_上限が1未満なら止まる(self, max_steps: int) -> None:
        """0 だと、どれだけ経っても1刻みも進まない。"""
        with pytest.raises(ValueError, match="刻みの数の上限"):
            StepAccumulator(SPS, max_steps)

    def test_どちらも1なら作れる(self) -> None:
        """上の2つの境目の内側。"""
        subject = StepAccumulator(1, 1)
        assert subject.ns_to_next_step() == NS_PER_SECOND
        assert subject.consume(NS_PER_SECOND) == 1
