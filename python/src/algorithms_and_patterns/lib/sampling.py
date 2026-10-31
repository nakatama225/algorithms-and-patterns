"""毎回読む値の判定 — 揺れる値と、押している鍵の組を、決まった間隔で読んで判定する。

決まった間隔で読む値（読んだ瞬間の状態だけが分かり、変わったことの知らせは来ない値）から、
オンとオフや押し始めを取り出す部品を置く。

- ``Hysteresis``：揺れる値を、2つのしきい値でオンとオフに分ける。入るしきい値と切れる
  しきい値を分けるので、境目の近くで値が揺れても、オンとオフが入れ替わり続けない
- ``dominant_axis``：縦と横の2つの値のうち、絶対値の大きいほうの軸の符号だけを残し、
  上下左右のどれか1つにする
- ``EdgeDetector``：押している鍵の組を毎回受け取り、前回に無く今回にある鍵（押し始め）を
  返す。始まりの前から押していた鍵を、作るときに必ず受け取る
- ``PressLatch``：押したことと離したことを1つずつ受け取り、読みと読みの間に押して離した
  鍵も、次に読み終えるまでは押していたことにする

押す・離すものは、それを見分ける値（鍵）で表す。鍵は hash できる値なら何でもよい
（文字列・数・Enum・tuple）。押し始めと押している鍵は ``frozenset`` で返し、部品の
中では順に取り出さない。文字列や Enum の ``frozenset`` を順に取り出すと、その順は起動の
たびに変わる（README の「決定性を崩す書き方の検査」）ので、順が要る呼ぶ側は
``sorted`` で順を決めてから取り出す。

鍵の組を受け取る所に文字列を1つ渡すと、文字ごとの鍵に分かれて黙って通るので、
``TypeError`` で止める。型検査は止めない（文字列も文字列の組として読める）。

固定値の表は持たず、約束は「同じ値から、起動のたびに同じ結果を出す」だけ。計算は大小の
比べと集まりの差・和だけで書く。TypeScript 版（``typescript/src/lib/sampling.ts``）も
同じ形。
"""

import math
from collections.abc import Hashable, Iterable
from typing import Generic, Literal, TypeVar

K = TypeVar("K", bound=Hashable)

Sign = Literal[-1, 0, 1]
"""負・0・正の3つ。"""


class Hysteresis:
    """揺れる値を、入るしきい値（``on``）と切れるしきい値（``off``）でオンとオフに分ける。

    切れている間は ``on`` 以上で入り、入っている間は ``off`` 未満で切れる。``off`` は
    ``on`` より小さいので、``off`` 以上 ``on`` 未満の値は、いまの状態を保つ。しきい値が
    1つだと、境目の近くで揺れる値は読むたびにオンとオフが入れ替わる。

    値はそのまま比べる。符号つきの値の大きさで判定したいときは、呼ぶ側が絶対値を渡す。
    """

    __slots__ = ("_active", "_off", "_on")

    def __init__(self, on: float, off: float) -> None:
        """2つのしきい値を受け取る。切れた状態で始まる。

        Args:
            on: 入るしきい値。有限の数。
            off: 切れるしきい値。有限の数で、``on`` より小さい。

        Raises:
            ValueError: しきい値が有限の数でないとき、``off`` が ``on`` 以上のとき。
                ``off`` と ``on`` が等しいと、しきい値が1つと同じになる。
            OverflowError: float の範囲を超える int を渡したとき（``math.isfinite``
                が float に変換する）。
        """
        if not (math.isfinite(on) and math.isfinite(off)):
            raise ValueError(f"しきい値は有限の数にする: on={on}, off={off}")
        if not off < on:
            raise ValueError(
                f"切れるしきい値は入るしきい値より小さくする: on={on}, off={off}"
            )
        self._on = on
        self._off = off
        self._active = False

    @property
    def active(self) -> bool:
        """いま入っているか。"""
        return self._active

    def update(self, value: float) -> bool:
        """値を1つ読み、入っているかを返す。

        Raises:
            ValueError: 値が NaN のとき。NaN は比べるとどれも偽になり、いまの状態のまま
                止まって見える。止めたときは、状態を変えない。
        """
        # 自分と等しくない値は NaN だけ。math.isnan は int を float に変換するので、
        # float の範囲を超える int を渡すと OverflowError で止まってしまう。
        if value != value:
            raise ValueError("値が NaN")
        if self._active:
            if value < self._off:
                self._active = False
        elif value >= self._on:
            self._active = True
        return self._active

    def reset(self) -> None:
        """切れた状態に戻す。"""
        self._active = False


def dominant_axis(x: float, y: float) -> tuple[Sign, Sign]:
    """縦と横の値のうち、絶対値の大きいほうの軸の符号だけを残す。

    軸ごとにしきい値を当てると、片方の軸から少しずれた向きで、縦と横の両方がしきい値を
    超える（縦横を合わせた長さが 1 の値をしきい値 0.5 で見ると、全周の3分の1の向き）。
    大きいほうの軸だけを残せば、いつも上下左右のどれか1つになる。

    - 絶対値が等しいときは横（``x``）を残す
    - 0 と -0.0 の符号は 0。両方 0 なら ``(0, 0)``

    Args:
        x: 横の値。
        y: 縦の値。

    Returns:
        ``(横の符号, 0)`` か ``(0, 縦の符号)``。

    Raises:
        ValueError: どちらかが NaN のとき。NaN は絶対値を比べると偽になり、黙って縦を
            残す。
    """
    if x != x or y != y:
        raise ValueError(f"軸の値が NaN: x={x}, y={y}")
    if abs(x) >= abs(y):
        return _sign(x), 0
    return 0, _sign(y)


def _sign(value: float) -> Sign:
    """値の符号。0 と -0.0 は 0。"""
    if value > 0:
        return 1
    if value < 0:
        return -1
    return 0


class EdgeDetector(Generic[K]):
    """押している鍵の組を毎回受け取り、前回に無く今回にある鍵（押し始め）を返す。

    前回の組は ``update`` だけが書き換える。読む場面が替わっても前回の組を消さない。
    消すと、押したままの鍵が新しい押し始めに見え、替わった先の場面でも押し始めとして
    読まれる。
    """

    __slots__ = ("_previous",)

    def __init__(self, held_at_start: Iterable[K]) -> None:
        """始まりの前から押していた鍵を受け取る。省けない。

        何も押していない組で始めると、押したまま始まった鍵が、最初の ``update`` で押し
        始めに見える。押しているかが分からないときは、押し始めだけを見たい鍵を全部渡す。
        押していなければ最初の ``update`` で離した扱いになり、次からは押し始めを返す。

        Args:
            held_at_start: 始まりの前から押していた鍵。写して持つ。

        Raises:
            TypeError: 鍵の組の代わりに文字列を1つ渡したとき。
        """
        self._previous: frozenset[K] = _key_set(held_at_start)

    def update(self, held: Iterable[K]) -> frozenset[K]:
        """いま押している鍵を受け取り、押し始めた鍵を返す。受け取った組を前回として控える。

        1回の読みで1度だけ呼び、返した押し始めを、その回の処理の全部で使う。同じ回に
        2度呼ぶと、2度目は前回が今回と同じなので、押し始めを返さない。

        Raises:
            TypeError: 鍵の組の代わりに文字列を1つ渡したとき。止めたときは、前回の組を
                変えない。
        """
        now = _key_set(held)
        started = now - self._previous
        self._previous = now
        return started

    def release_all(self) -> None:
        """全部を離したことにする。

        次の ``update`` では、押している鍵がすべて押し始めになる。読む元が無くなった
        とき（つないでいた物が外れたとき）に呼ぶ。読む場面が替わっただけのときは
        呼ばない。
        """
        self._previous = frozenset()


def _key_set(held: Iterable[K]) -> frozenset[K]:
    """鍵の組を ``frozenset`` にする。

    文字列を1つ渡すと、文字ごとの鍵に分かれる（``'enter'`` が ``e``・``n``・``t``・
    ``r`` の4つの鍵になる）ので止める。
    """
    if isinstance(held, str):
        raise TypeError(f"鍵の組の代わりに文字列が来た: {held!r}（組にして渡す）")
    return frozenset(held)


class PressLatch(Generic[K]):
    """押したことと離したことを1つずつ受け取り、短い押しも1回の読みぶん残す。

    読む間隔より短く押して離すと、押していることだけを見る形では、押したこと自体が消える。
    そこで、前に読み終えてから押した鍵を印として別に覚え、離していても押していたことに
    する。印は ``end_step`` で忘れる。

    ``end_step`` は、読んだ値を使い終えた回だけに呼ぶ。読んだのに使わなかった回（進めな
    かった回）に呼ぶと、その間の押しが使われないまま消える。止めている間は毎回呼ぶ。呼ば
    ないと、止めている間に押して離した鍵が、再開した最初の回に押した鍵として読まれる。
    """

    __slots__ = ("_held", "_marked")

    def __init__(self) -> None:
        """何も押していない状態で作る。"""
        self._held: set[K] = set()
        self._marked: set[K] = set()

    def press(self, key: K) -> None:
        """鍵を押した。押したままの鍵にも印を付ける。

        押したままの鍵を押したと受け取るのは、離したことが届かなかったあとに押し直した
        ときなので、その押しも残す。押したままのときに届く繰り返し（押し続けると届く、
        押したことの知らせ）は渡さない。渡すと、``forget_all`` で忘れた鍵が、押し直さ
        なくても押したことに戻る。
        """
        self._held.add(key)
        self._marked.add(key)

    def release(self, key: K) -> None:
        """鍵を離した。押していない鍵なら何もしない。印は残す。"""
        self._held.discard(key)

    def read(self) -> frozenset[K]:
        """押している鍵と、前の ``end_step`` のあとに押した鍵。

        何度読んでも変わらない。
        """
        return frozenset(self._held | self._marked)

    def end_step(self) -> None:
        """読んだ値を使い終えた。印を忘れる。押したままの鍵は残す。"""
        self._marked.clear()

    def forget_all(self) -> None:
        """押している鍵も印も全部忘れる。

        離したことが届かなくなるとき（読む元から切り離されたとき）に呼ぶ。忘れないと、
        押したまま切り離された鍵が、離したあとも押している鍵として読まれ続ける。
        """
        self._held.clear()
        self._marked.clear()
