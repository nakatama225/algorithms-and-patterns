"""決定的な擬似乱数 — 種を1つ与えれば、言語と版をまたいで同じ並びが出る。

アルゴリズムは mulberry32。状態は 32 ビットの整数1つで、周期は 2**32。
TypeScript 版（``typescript/src/lib/rng.ts``）は、同じ種から同じ値を出す。そのことは
``tests/lib/test_cross_language.py`` が、TypeScript のテストの表を読んで検証している。

標準の ``random.Random`` を包まずに書いたのは、Python の版をまたいで同じ並びが
出ると約束されているのが ``random()`` だけで、``randrange``・``choice``・``shuffle`` は
版によって変わりうるため（公式文書の再現性の節）。

``random``・``below``・``between``・``chance``・``choice`` は、1回呼ぶと乱数を必ず
1回だけ生成する。``shuffled`` は要素の数 - 1 回で、0 個と 1 個なら生成しない。
``clone`` と ``derive_seed`` は生成しない。
生成する回数が引数や結果で変わると、同じ種でもそれ以降の並びが全部ずれる。そのため
``chance(0)`` と ``chance(1)`` も、答えが決まっていても1回生成する。範囲の外の引数で
止まるときは、生成する前に止まる。

暗号用途には使えない。ここで約束するのは「同じ種から同じ並びが出ること」で、
先を読まれないことではない。
"""

from collections.abc import Sequence
from typing import TypeVar

T = TypeVar("T")

# Python の整数は桁あふれしないので、足し算と掛け算のたびにこの値で下位 32 ビットへ
# 切り落とす。1か所でも忘れると並びがずれる。TypeScript 版は ``>>> 0`` と
# ``Math.imul`` が同じことをしている。XOR とシフトは、32 ビットに収まった値からは
# 32 ビットに収まった値しか作らないので、切り落とさない。
_MASK = 0xFFFFFFFF
# 状態を1回ごとに進める幅（mulberry32 の定数）。
_INCREMENT = 0x6D2B79F5
# 2 の 32 乗。32 ビットの整数を、0 以上 1 未満の小数に変換するときに割る数。
_SPAN = 2**32
# 種から種を導くときに、番号を散らす数。2**32 を黄金比で割った値に近い奇数。
_SPREAD = 0x9E3779B1
# ``derive_seed`` が受ける番号の数（0 以上この値未満）。
_STREAMS = _SPAN - 1
# ``below`` の上限と ``between`` の範囲の幅の最大。TypeScript 版が正確に表せる最大の整数
# （2**53 - 1）にそろえた。これより大きいと TypeScript 版では受けられず、2つの言語で
# 同じ答えを約束できない。float に変換できないほど大きいと、生成したあとで
# OverflowError にもなる。
_MAX_LIMIT = 2**53 - 1


class Rng:
    """決定的な擬似乱数（mulberry32）。生成した回数を数える。"""

    __slots__ = ("_calls", "_state")

    def __init__(self, seed: int) -> None:
        """種から乱数を作る。

        Args:
            seed: 種。負の数や 2**32 以上の数は、下位 32 ビットだけを使う
                （TypeScript 版の ``seed >>> 0`` と同じ）。
        """
        self._state = seed & _MASK
        self._calls = 0

    @property
    def calls(self) -> int:
        """この乱数が生成した回数。

        2つの実行の結果がずれたとき、状態だけを比べても「どこかでずれた」までしか
        分からない。生成した回数も比べると、「どちらかが余計に生成した／生成しなかった」
        まで絞れる。
        """
        return self._calls

    @property
    def state(self) -> int:
        """内部状態（0 以上 2**32 未満）。同じ状態からは同じ並びが出る。"""
        return self._state

    def random(self) -> float:
        """0 以上 1 未満の小数を返す。"""
        self._calls += 1
        self._state = (self._state + _INCREMENT) & _MASK
        t = self._state
        t = ((t ^ (t >> 15)) * (t | 1)) & _MASK
        t ^= (t + (t ^ (t >> 7)) * (t | 61)) & _MASK
        return (t ^ (t >> 14)) / _SPAN

    def below(self, limit: int) -> int:
        """0 以上 ``limit`` 未満の整数を返す。

        生成した小数に ``limit`` を掛けて切り捨てる。``limit`` が 2 の累乗でなければ、
        出やすさはわずかに偏る（生成する小数は 2**32 通りしかない）。

        Raises:
            ValueError: ``limit`` が 1 以上 2**53 - 1 以下でないとき。0 を渡して 0 が
                返ると、「選べるものが無い」ことに気づけない。
        """
        if not 1 <= limit <= _MAX_LIMIT:
            raise ValueError(f"上限は 1 以上 2**53 - 1 以下にする: {limit}")
        # 値は 0 以上なので、0 へ向けて切り捨てる int() は math.floor と同じになる。
        return int(self.random() * limit)

    def between(self, start: int, stop: int) -> int:
        """``start`` 以上 ``stop`` 未満の整数を返す。

        Raises:
            ValueError: ``stop`` が ``start`` 以下のとき、または範囲の幅
                （``stop - start``）が 2**53 - 1 を超えるとき。
        """
        if stop <= start:
            raise ValueError(
                f"stop は start より大きくする: start={start}, stop={stop}"
            )
        # 幅は below の上限になる。below に任せると、渡していない「上限」の値を
        # 出して止まる。
        if stop - start > _MAX_LIMIT:
            raise ValueError(
                "範囲の幅（stop - start）は 2**53 - 1 以下にする: "
                f"start={start}, stop={stop}"
            )
        return start + self.below(stop - start)

    def chance(self, probability: float) -> bool:
        """確率 ``probability``（0 以上 1 以下）で True を返す。

        0 と 1 でも乱数を1回生成する。

        Raises:
            ValueError: ``probability`` が 0 以上 1 以下でないとき（NaN を含む）。
                百分率（50 など）と取り違えると、黙って「必ず当たる」になる。
        """
        # NaN はどの比べ方でも偽になるので、「0 以上 1 以下」の否定で止まる。
        if not 0 <= probability <= 1:
            raise ValueError(f"確率は 0 以上 1 以下にする: {probability}")
        return self.random() < probability

    def choice(self, items: Sequence[T]) -> T:
        """列から1つ選ぶ。

        Raises:
            ValueError: 空の列を渡したとき。「空なら None を返す」形にすると、
                それを扱う分岐が呼び出し側すべてに増えるので、空でないことを
                呼び出し側が確認してから渡す。
        """
        if not items:
            raise ValueError("空の列からは選べない")
        return items[self.below(len(items))]

    def shuffled(self, items: Sequence[T]) -> list[T]:
        """順を入れ替えた新しい list を返す（Fisher–Yates）。渡した列は書き換えない。

        乱数を要素の数 - 1 回生成する（最後の1つは選ぶ余地が無い）。0 個と 1 個なら
        生成しない。名前は ``sorted`` に合わせた（標準の ``random.shuffle`` は、
        渡した列を書き換える）。

        ``sorted(items, key=lambda _: rng.random())`` で混ぜない。並びは決まるが、
        生成する回数が要素の数になり、TypeScript 版と並びがそろわない。
        """
        result = list(items)
        for i in range(len(result) - 1, 0, -1):
            j = self.below(i + 1)
            result[i], result[j] = result[j], result[i]
        return result

    def clone(self) -> "Rng":
        """いまの状態を引き継いだ、別の乱数を作る。

        「この先どうなるか」を試算するのに使う。元の乱数は進まない。
        生成した回数は 0 から数え直す。
        """
        return Rng(self._state)


def derive_seed(seed: int, stream: int) -> int:
    """種と番号から、別の並びのための種を導く。

    用途ごとに乱数を分けるのに使う。1つの乱数を用途の違う処理で共有すると、片方が
    生成する回数を変えただけで、もう片方の並びも変わる。種を1つ決めれば、どの用途の
    並びも再現できる。

    番号に 1 を足してから散らすので、どの番号でも元の種と違う種になる。散らす数は
    奇数で、奇数を掛けて下位 32 ビットを取ると、違う値は必ず違う値に移る。そのため
    番号が違えば違う種になる。導いた種どうしの並びに相関が無いかは測っていない。

    Args:
        seed: 元の種。下位 32 ビットだけを使う。
        stream: 番号。0 以上 2**32 - 1 未満。

    Raises:
        ValueError: ``stream`` が範囲の外のとき。2**32 - 1 は、1 を足すと下位
            32 ビットが 0 になり、元の種がそのまま返る。
    """
    if not 0 <= stream < _STREAMS:
        raise ValueError(f"番号は 0 以上 2**32 - 1 未満にする: {stream}")
    return (seed ^ ((stream + 1) * _SPREAD)) & _MASK
