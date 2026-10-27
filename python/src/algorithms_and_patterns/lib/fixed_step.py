"""固定刻みの時間 — 揺れる実時間を、長さの決まった刻みを何回進めるかに換える。

1回進めるたびに経過時間を渡す形にすると、1回に進む量が機械の速さやフレームの揺れで
変わり、同じ操作から違う結果が出る。ここでは、1回呼ぶと1刻み進む処理には経過時間を
渡さず、実時間を「いま何刻み進めるか」に換える所を1か所にする。

- ``StepAccumulator``：経過時間を刻みの数に換える。1刻みに満たない端数は次へ持ち越し、
  遅れすぎた分は捨てる
- ``RateScaler``：倍率を、刻みを進める回数に換える。刻みの長さは変えない
- ``sleep_until`` と ``frames``：締め切りまで眠る関数と、次の刻みの時刻まで待っては
  進める刻みの数を返し続けるフレームの輪

時刻はナノ秒の整数で扱う。このモジュールは ``time`` を読み込まない（README の
「決定性を崩す書き方の検査」）。時計と眠る関数は、呼ぶ側が渡す。

計算は、整数の足し算・掛け算と、切り捨て・切り上げの割り算で書く。``round`` は使わない。
例外は3つで、倍率は分数（``Fraction``）で計算し、``progress`` と ``blend`` は
小数を返し、``sleep_until`` は眠る秒を小数で渡す。
TypeScript 版（``typescript/src/lib/fixed-step.ts``）は、待つ部品（``sleep_until`` と
``frames``）を置いていない。
"""

import math
from collections.abc import Callable, Iterator
from fractions import Fraction

# 1秒のナノ秒の数。
NS_PER_SECOND = 1_000_000_000

# いまの時刻をナノ秒の整数で返す関数（標準の ``time.perf_counter_ns`` など）。
# 時刻は戻らないものとする。
Clock = Callable[[], int]

# 締め切りの時刻（ナノ秒）まで待つ関数。返ったとき、``clock()`` は締め切り以上。
Wait = Callable[[int, Clock], None]


class StepAccumulator:
    """経過時間を、進める刻みの数に換える。1刻みに満たない端数は次へ持ち越す。

    端数は整数で持つ。経過時間をナノ秒の整数で受け取り、「ナノ秒 × 1秒あたりの刻みの
    数」の単位で積む。この単位では1刻みがちょうど 10 億（1秒のナノ秒の数）になり、割った
    余りが正確に残るので、何時間続けても1秒あたりの刻みの数はずれない。ミリ秒の小数で
    積むと、端数がちょうど刻みの境目に届いた回を、わずかに手前と数えることがある。
    """

    __slots__ = ("_carry", "_max_steps", "_steps_per_second")

    def __init__(self, steps_per_second: int, max_steps: int) -> None:
        """1秒あたりの刻みの数と、1回に返す刻みの数の上限を決めて作る。

        Args:
            steps_per_second: 1秒あたりの刻みの数。1 以上。
            max_steps: 1回の ``consume`` で返す刻みの数の上限。1 以上。機械が
                スリープから戻ったときなど、前の呼び出しから数秒たつことがある。その分を
                全部まとめて進めると、進め終わらないうちに次の刻みの時刻が来て、遅れが
                積み上がる。

        Raises:
            ValueError: どちらかが 1 未満のとき。
        """
        if steps_per_second < 1:
            raise ValueError(f"1秒あたりの刻みの数は 1 以上にする: {steps_per_second}")
        if max_steps < 1:
            raise ValueError(f"刻みの数の上限は 1 以上にする: {max_steps}")
        self._steps_per_second = steps_per_second
        self._max_steps = max_steps
        # 0 以上 NS_PER_SECOND 未満。
        self._carry = 0

    def consume(self, elapsed_ns: int) -> int:
        """経過時間（ナノ秒）を渡し、進める刻みの数を受け取る。

        上限（``max_steps``）ちょうどまでは、端数を残して返す。上限を超えたら上限を返し、
        端数も捨てる。持ち越すと、次の呼び出しもまた上限まで進み、遅れが積み上がる。

        Raises:
            ValueError: ``elapsed_ns`` が負のとき。時刻は戻らない時計で測るので、負なら
                呼ぶ側の誤り（測る順の取り違えなど）。0 に丸めると気づけない。
        """
        if elapsed_ns < 0:
            raise ValueError(f"経過時間が負: {elapsed_ns}")
        total = self._carry + elapsed_ns * self._steps_per_second
        steps = total // NS_PER_SECOND
        if steps > self._max_steps:
            self._carry = 0
            return self._max_steps
        self._carry = total - steps * NS_PER_SECOND
        return steps

    def ns_to_next_step(self) -> int:
        """次の刻みの時刻まで、あと何ナノ秒か（1 以上）。

        端数は切り上げる。この時刻に目を覚ませば、必ず1刻み分が積み上がっている。
        切り捨てると、ちょうどに目を覚ましても1刻みにわずかに足りず、0刻みのフレームに
        なる。そのあと次の刻みまでの時間が 0 になり、輪が待たずに回る
        （時計が進まなければ、0刻みのフレームが続く）。
        """
        return -(-(NS_PER_SECOND - self._carry) // self._steps_per_second)


class RateScaler:
    """倍率を、そのフレームで刻みを進める回数に換える。端数は次へ持ち越す。

    実時間で ``steps`` 刻み分が経ったフレームに ``take(steps)`` を呼ぶと、倍率を掛けた
    回数の整数の部分を返す。1刻みの長さは変えない。倍速を「1刻みに渡す経過時間を伸ばす」
    形で書くと、倍率で1刻みの中身が変わり、同じ操作から違う結果が出る。

    0.5 倍なら2フレームに1回、1.5 倍なら1回と2回を交互に返す。端数は分数で持つので、
    何時間続けても倍率どおりの回数からずれず、``set`` で分母の違う倍率に替えても
    端数を捨てない。止めるときは ``take`` を呼ばない（倍率 0 は受けない）。

    ``blend`` は、描く値を1つ前の刻みの値と混ぜる割合。整数でない倍率では、1フレームに
    進む刻みの数が揃わない（0.5 倍は 0 と 1）ので、進めた刻みの値をそのまま描くと
    コマ送りに見える。1つ前の刻みの値に、持ち越した端数の割合だけ寄せて描くと、どの
    フレームも倍率分ずつ進む（そのかわり、描く位置はいつも1刻み遅れる）。割合は
    ``take`` のときに決めて控え、``set`` では替えない。止めている間（``take`` を
    呼ばない間）に倍率を替えても、止まっている絵が動かない。

    ただし、整数と整数でない倍率の間で替えたフレームだけは、1フレームの進みが倍率分から
    外れる（最大1刻み）。混ぜる割合が、混ぜない（1）と端数の割合の間で替わるため。
    整数でない倍率どうしなら外れない。
    """

    __slots__ = ("_blend", "_carry", "_rate")

    def __init__(self, rate: Fraction) -> None:
        """倍率を決めて作る。``Fraction(3, 2)`` なら 1.5 倍。

        Raises:
            ValueError: ``rate`` が 0 以下のとき。
        """
        self._rate = _checked_rate(rate)
        # 0 以上 1 未満。
        self._carry = Fraction(0)
        self._blend = 1.0

    @property
    def rate(self) -> Fraction:
        """いまの倍率。"""
        return self._rate

    def set(self, rate: Fraction) -> None:
        """倍率を替える。持ち越した端数は残す（替えても、時間を捨てない）。

        混ぜる割合（``blend``）は、次の ``take`` まで替えない。

        Raises:
            ValueError: ``rate`` が 0 以下のとき。倍率は前のまま残る。
        """
        self._rate = _checked_rate(rate)

    def take(self, steps: int) -> int:
        """実時間で ``steps`` 刻み分が経ったフレームに、刻みを進める回数を返す。

        描く値を混ぜる割合（``blend``）も、ここでいまの倍率と端数から決めて控える。

        Raises:
            ValueError: ``steps`` が負のとき。端数も割合も変えない。
        """
        if steps < 0:
            raise ValueError(f"刻みの数が負: {steps}")
        carry = self._carry + steps * self._rate
        count = math.floor(carry)
        self._carry = carry - count
        self._blend = 1.0 if self._rate.denominator == 1 else self.progress
        return count

    @property
    def progress(self) -> float:
        """持ち越した端数（0 以上 1 未満）。

        最後に進めた刻みから、次の刻みまでの進み具合。
        """
        return float(self._carry)

    @property
    def blend(self) -> float:
        """描く値を、1つ前の刻みの値と混ぜる割合（0 以上 1 以下）。

        0 なら1つ前の刻みの値、1 なら最後に進めた刻みの値で描く。最後に ``take`` を
        呼んだときの倍率が整数なら 1（混ぜない）。整数でなければ、そのときの
        ``progress``。まだ ``take`` を呼んでいなければ 1。
        """
        return self._blend


def _checked_rate(rate: Fraction) -> Fraction:
    """倍率が 0 より大きいかを確認して、そのまま返す。

    Raises:
        ValueError: 0 以下のとき。0 を受けると、止めるのに ``take`` を呼び続ける形を
            許し、呼ぶたびに混ぜる割合が 1 に戻って、止まっている絵が動く。
    """
    if rate <= 0:
        raise ValueError(
            f"倍率は 0 より大きくする（止めるなら take を呼ばない）: {rate}"
        )
    return rate


def sleep_until(deadline_ns: int, clock: Clock, sleep: Callable[[float], None]) -> None:
    """締め切りの時刻まで眠る。早く目を覚ましたら、残りをもう一度眠る。

    締め切りちょうどか、過ぎていれば眠らない。``sleep`` は秒を受け取る関数（標準の
    ``time.sleep`` など）。``frames`` に渡すときは、
    ``functools.partial(sleep_until, sleep=time.sleep)`` の形にする。

    眠らずに時計を読み続けて待つ形（空回り）は置いていない。目を覚ますのは遅れないが、
    待つ間もプロセッサのコアを1つ使い続ける（README の「固定刻みの時間」）。
    """
    while (remaining := deadline_ns - clock()) > 0:
        sleep(remaining / NS_PER_SECOND)


def frames(accumulator: StepAccumulator, clock: Clock, wait: Wait) -> Iterator[int]:
    """フレームごとに、そのフレームで進める刻みの数を返し続ける。

    呼ぶ側は、受け取った数だけ刻みを進めてから描き、次を求める。次を求められたら、
    次の刻みの時刻まで待ち、前のフレームからの経過時間を刻みの数に換えて返す。
    次の刻みの時刻は持ち越した端数から毎回計算し直すので、待ちが遅れても、次の
    フレームでは刻みの境目に戻り、遅れが積み上がらない。

    最初のフレームは待たずに 0 を返す（始めの状態を1回描くため）。終わりは無いので、
    抜けるときは ``break`` する。抜けたあとは待たない。

    輪は、進めた刻みを通算で数えない。止めている間も輪は動き続け、進めるかどうかは
    呼ぶ側が決める。輪が数えると、実際に進めた回数とずれる。

    Args:
        accumulator: 経過時間を刻みの数に換えるもの。1秒あたりの刻みの数と上限は、
            これを作るときに決める。
        clock: いまの時刻を返す関数。
        wait: 締め切りまで待つ関数（``sleep_until`` を ``functools.partial`` で
            包んだものなど）。
    """
    started = clock()
    steps = 0
    while True:
        yield steps
        wait(started + accumulator.ns_to_next_step(), clock)
        now = clock()
        steps = accumulator.consume(now - started)
        started = now
