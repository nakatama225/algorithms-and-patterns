"""状態の要約 — 状態を、比べられる 32 ビットの数1つにまとめる。

同じ処理を2回走らせた結果や、2つの環境で走らせた結果が同じかを、状態の全体を
比べずに要約どうしで比べる。ずれは起きた直後には見えず、しばらくたってから原因と
離れた所で見えることが多い。決めた間隔で要約を比べておくと、ずれた直後に気づける。

アルゴリズムは FNV-1a の 32 ビット版。値を1バイトずつ混ぜていく。混ぜる順がそのまま
結果を決めるので、何をどの順で混ぜるかは呼ぶ側が決めて固定する。順が変わると、
同じ状態でも別の値になる。

TypeScript 版（``typescript/src/lib/state-hash.ts``）は、同じ値を同じ順で混ぜれば
同じ要約を出す。混ぜるバイトの並びを、2つの言語で次のとおりに決めている。

- 整数：32 ビットの2の補数で、下位のバイトから4バイト
- 小数：IEEE 754 の 64 ビットのビット列で、下位のバイトから8バイト
- 文字列：UTF-8 のバイト列のあとに、そのバイトの数を整数として

衝突しない保証は無く、改竄を防ぐ用途には使えない。ここで約束するのは、同じ値を
同じ順で混ぜれば同じ要約になることだけ。

組み込みの ``hash()`` は使わない。文字列の ``hash()`` は起動のたびに変わるので、
同じ状態でも起動ごとに違う要約になる。
"""

import math
import struct
from typing import Self

# FNV-1a の 32 ビット版の初期値と、1バイトごとに掛ける素数。
_OFFSET_BASIS = 0x811C9DC5
_PRIME = 0x01000193
# 下位 32 ビットへ切り落とす。Python の整数は桁あふれしない。
_MASK = 0xFFFFFFFF
# 混ぜてよい整数の範囲。32 ビットの符号つきと符号なしの、どちらで表した値も受ける。
_INT_MIN = -(2**31)
_INT_STOP = 2**32


class StateHasher:
    """要約を組み立てる。

    ``add_`` で始まるメソッドは自分を返すので、
    ``StateHasher().add_int(a).add_float(b).hex`` のように続けて書ける。
    範囲の外の値で止まるときは、混ぜる前に止まり、それまでの要約を変えない。
    """

    __slots__ = ("_value",)

    def __init__(self) -> None:
        self._value = _OFFSET_BASIS

    def _mix(self, data: bytes) -> None:
        value = self._value
        for byte in data:
            value = ((value ^ byte) * _PRIME) & _MASK
        self._value = value

    def add_int(self, value: int) -> Self:
        """-2**31 以上 2**32 未満の整数を混ぜる。

        符号つきと符号なしで同じビットの並びになる値（-1 と 0xFFFFFFFF）は、同じ値として
        混ぜる。符号つきの差と、符号なしの 32 ビットの値の両方を受けるため。

        Raises:
            ValueError: 範囲の外のとき。黙って下位 32 ビットだけを混ぜると、違う値が
                同じ要約になり、ずれを見逃す。
        """
        self._mix(_int_bytes(value))
        return self

    def add_float(self, value: float) -> Self:
        """小数を、IEEE 754 の 64 ビットのビット列のまま混ぜる。

        丸めたり文字列にしたりしてから混ぜると、わずかなずれを見逃す。0.0 と -0.0 は
        ``==`` では等しいが、ビット列が違うので別の要約になる。

        Raises:
            ValueError: NaN のとき。NaN のビット列は1通りでなく、作り方で変わりうる
                （TypeScript 版では、仕様が実装に選ばせている）。
        """
        if math.isnan(value):
            raise ValueError("NaN は混ぜられない")
        self._mix(struct.pack("<d", value))
        return self

    def add_bool(self, value: bool) -> Self:
        """真偽値を、1 か 0 の整数として混ぜる。"""
        return self.add_int(1 if value else 0)

    def add_text(self, value: str) -> Self:
        """文字列を、UTF-8 のバイト列と、そのバイトの数として混ぜる。

        数も混ぜるのは、区切りを残すため。混ぜないと ``"ab"`` と ``"c"`` を続けて
        混ぜた要約と、``"a"`` と ``"bc"`` を続けて混ぜた要約が同じになる。

        Raises:
            UnicodeEncodeError: 対になっていないサロゲート（``"\\ud800"`` など）を
                含むとき（``ValueError`` の仲間）。UTF-8 にできない。
        """
        data = value.encode("utf-8")
        self._mix(data + _int_bytes(len(data)))
        return self

    @property
    def value(self) -> int:
        """組み立てた要約（0 以上 2**32 未満）。"""
        return self._value

    @property
    def hex(self) -> str:
        """要約の、0 で埋めた8桁の16進表記（小文字）。見比べやすい。"""
        return f"{self._value:08x}"


def _int_bytes(value: int) -> bytes:
    """整数を、32 ビットの2の補数で下位のバイトから並べた4バイトにする。

    Raises:
        ValueError: -2**31 以上 2**32 未満でないとき。
    """
    if not _INT_MIN <= value < _INT_STOP:
        raise ValueError(f"-2**31 以上 2**32 未満の整数だけを混ぜられる: {value}")
    return (value & _MASK).to_bytes(4, "little")
