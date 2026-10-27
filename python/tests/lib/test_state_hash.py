"""状態の要約（state_hash）の検査。

要約は、2つの実行や2つの環境の状態が同じかを比べる値になる。違う状態が同じ要約に
なると、ずれを見逃す。ここでは部品の約束（混ぜる順・区切り・小数のビット列・
受ける範囲・8桁の表記）を確認する。
"""

import math

import pytest

from algorithms_and_patterns.lib.state_hash import StateHasher

# 言語をまたぐ固定値。TypeScript のテスト（typescript/tests/lib/state-hash.test.ts）にも
# 同じ名前の表があり、2つが等しいことを test_cross_language.py が検証する。値は2つの
# 言語の実装で別々に出し、一致を確認してから貼った。
#
# 空の要約と、整数・小数・文字列・真偽値・整数をこの順で混ぜたもの（MIXED_HASHES の
# 1行目）は、animal-bomber の TypeScript 版が出した値（811c9dc5・2fbdec8f）とも同じ。

# 整数を左から順に混ぜた要約。空の並びは、何も混ぜていない要約。
INT_HASHES: list[tuple[tuple[int, ...], int]] = [
    ((), 0x811C9DC5),
    ((0,), 0x4B95F515),
    ((1,), 0xFB69B604),
    ((-1,), 0xE3160FB1),
    ((0xFFFFFFFF,), 0xE3160FB1),
    ((-(2**31),), 0xCB952B95),
    ((2**31 - 1,), 0x6316D931),
    ((2**31,), 0xCB952B95),
    ((1, 2), 0xDED89066),
    ((2, 1), 0x0677F096),
]

# 小数を左から順に混ぜた要約。
FLOAT_HASHES: list[tuple[tuple[float, ...], int]] = [
    ((0.5,), 0x0C927168),
    ((0.0,), 0x9BE17165),
    ((-0.0,), 0x1BE23AE5),
    ((0.1 + 0.2,), 0x075AD7F6),
    ((0.3,), 0xC5CC6029),
    ((-1.5,), 0x8C557DC0),
    ((5e-324,), 0x3E801244),
    ((1.7976931348623157e308,), 0xEC87C46D),
    ((0.1, 0.2), 0xBC918289),
    ((0.2, 0.1), 0x77344BA9),
]

# 文字列1つを混ぜた要約。UTF-8 で 1・2・3・4 バイトになる文字と、その境目の符号位置。
TEXT_HASHES: list[tuple[str, int]] = [
    ("", 0x4B95F515),
    ("abc", 0xFE7F7188),
    ("é", 0xD64871F3),
    ("日本語", 0x571BBDCE),
    ("𠮷", 0x6E7CD8FE),
    (
        "\x00\x7f\x80\u07ff\u0800\ud7ff\ue000\uffff\U00010000\U0010ffff",
        0xDC24FB3D,
    ),
]

# 整数・小数・文字列・真偽値・整数を、この順で混ぜた要約。
MIXED_HASHES: list[tuple[tuple[int, float, str, bool, int], int]] = [
    ((1, 0.5, "abc", True, -7), 0x2FBDEC8F),
    ((0xFFFFFFFF, -0.0, "", False, 0), 0x52067A81),
    ((-(2**31), 0.1, "日本語", False, 2**31), 0x254964F5),
]


def ints(*values: int) -> StateHasher:
    """整数を左から順に混ぜた要約。"""
    hasher = StateHasher()
    for value in values:
        hasher.add_int(value)
    return hasher


def floats(*values: float) -> StateHasher:
    """小数を左から順に混ぜた要約。"""
    hasher = StateHasher()
    for value in values:
        hasher.add_float(value)
    return hasher


def fnv1a(data: bytes) -> int:
    """バイト列を FNV-1a の 32 ビット版で混ぜた値。部品を通さずに期待値を作る。"""
    value = 0x811C9DC5
    for byte in data:
        value = ((value ^ byte) * 0x01000193) % 2**32
    return value


class Test固定値:
    @pytest.mark.parametrize(("values", "expected"), INT_HASHES)
    def test_整数を混ぜた要約が表のとおり(
        self, values: tuple[int, ...], expected: int
    ) -> None:
        """整数のバイトの順（下位から）と、2の補数への読み直しがずれると食い違う。"""
        assert ints(*values).value == expected

    @pytest.mark.parametrize(("values", "expected"), FLOAT_HASHES)
    def test_小数を混ぜた要約が表のとおり(
        self, values: tuple[float, ...], expected: int
    ) -> None:
        """ビット列のバイトの順を実行環境に任せると、環境によって食い違う。"""
        assert floats(*values).value == expected

    @pytest.mark.parametrize(("text", "expected"), TEXT_HASHES)
    def test_文字列を混ぜた要約が表のとおり(self, text: str, expected: int) -> None:
        """UTF-8 でなく UTF-16 の符号単位を混ぜると、ASCII の外で食い違う。"""
        assert StateHasher().add_text(text).value == expected

    @pytest.mark.parametrize(("values", "expected"), MIXED_HASHES)
    def test_種類の違う値を続けて混ぜた要約が表のとおり(
        self, values: tuple[int, float, str, bool, int], expected: int
    ) -> None:
        first, number, text, flag, last = values
        hasher = StateHasher().add_int(first).add_float(number).add_text(text)
        assert hasher.add_bool(flag).add_int(last).value == expected


class Test順と区切り:
    def test_混ぜる順が違えば別の値になる(self) -> None:
        """順を問わない混ぜ方（足し算など）にすると、入れ替わりを見逃す。"""
        assert ints(1, 2).value != ints(2, 1).value
        assert floats(0.1, 0.2).value != floats(0.2, 0.1).value

    def test_文字列の区切りが違えば別の値になる(self) -> None:
        """バイトの数を混ぜないと、"ab" と "c" が "a" と "bc" と同じ値になる。"""
        a = StateHasher().add_text("ab").add_text("c")
        b = StateHasher().add_text("a").add_text("bc")
        assert a.value != b.value

    def test_値の種類は混ぜない(self) -> None:
        """種類は、呼ぶ側が決めた混ぜる順で決まる前提にしている。

        真偽値は 1 と 0 の整数と、空の文字列はバイトの数 0 と同じ要約になる。
        """
        assert StateHasher().add_bool(True).value == ints(1).value
        assert StateHasher().add_bool(False).value == ints(0).value
        assert StateHasher().add_text("").value == ints(0).value


class Test混ぜるバイトの並び:
    """2つの言語で同じ要約を出すために決めた並び。期待するバイトは手で書いた。"""

    def test_整数は_2の補数で下位のバイトから4バイト(self) -> None:
        assert ints(0x01020304).value == fnv1a(bytes([4, 3, 2, 1]))
        assert ints(-2).value == fnv1a(bytes([0xFE, 0xFF, 0xFF, 0xFF]))

    def test_小数は_IEEE754の64ビットを下位のバイトから8バイト(self) -> None:
        # 1.0 のビット列は 0x3FF0000000000000。
        assert floats(1.0).value == fnv1a(bytes([0, 0, 0, 0, 0, 0, 0xF0, 0x3F]))

    def test_文字列は_UTF8のバイト列と_文字の数でなくバイトの数(self) -> None:
        """文字の数は言語で数え方が違う（"𠮷" を Python の len は 1、TypeScript は 2）。

        "é" は1文字で2バイト。
        """
        expected = fnv1a(bytes([0xC3, 0xA9, 2, 0, 0, 0]))
        assert StateHasher().add_text("é").value == expected


class Test小数のビット列:
    def test_わずかに違う小数を見分ける(self) -> None:
        """丸めてから混ぜると、ずれの始まりの小さな差を見逃す。"""
        assert 0.1 + 0.2 != 0.3
        assert floats(0.1 + 0.2).value != floats(0.3).value

    def test_0と_マイナス0は_等しくても別の値になる(self) -> None:
        """``==`` では等しいが、ビット列が違う。"""
        assert 0.0 == -0.0
        assert floats(0.0).value != floats(-0.0).value

    def test_無限大は混ぜられる(self) -> None:
        """止めるのは NaN だけ。無限大のビット列は1通りに決まっている。"""
        values = {floats(math.inf).value, floats(-math.inf).value}
        assert len(values | {floats(1.7976931348623157e308).value}) == 3


class Test範囲:
    @pytest.mark.parametrize("value", [-(2**31), 2**32 - 1])
    def test_32ビットの端の整数は混ぜられる(self, value: int) -> None:
        assert 0 <= ints(value).value < 2**32

    def test_符号つきと符号なしで同じビットの並びになる整数は_同じ値になる(
        self,
    ) -> None:
        """符号つきの差と、符号なしの 32 ビットの値の両方を受けるための約束。"""
        assert ints(-1).value == ints(0xFFFFFFFF).value
        assert ints(-(2**31)).value == ints(2**31).value

    @pytest.mark.parametrize("value", [-(2**31) - 1, 2**32, 10**12])
    def test_32ビットに収まらない整数は_要約を変えずに止まる(self, value: int) -> None:
        """下位 32 ビットだけを黙って混ぜると、違う値が同じ要約になる。"""
        hasher = ints(7)
        with pytest.raises(ValueError, match="2\\*\\*32 未満の整数"):
            hasher.add_int(value)
        assert hasher.value == ints(7).value

    @pytest.mark.parametrize("value", [math.nan, -math.nan, math.inf - math.inf])
    def test_NaNは_要約を変えずに止まる(self, value: float) -> None:
        """NaN のビット列は作り方で変わりうるので、同じ要約になる保証が無い。"""
        hasher = ints(7)
        with pytest.raises(ValueError, match="NaN"):
            hasher.add_float(value)
        assert hasher.value == ints(7).value

    @pytest.mark.parametrize("text", ["\ud800", "a\udfffb", "\udc00\ud800"])
    def test_対になっていないサロゲートは_要約を変えずに止まる(self, text: str) -> None:
        """UTF-8 にできない。TypeScript 版も止める。

        U+FFFD などに置き換えて混ぜると、違う文字列が同じ要約になる。3つ目は、後ろ半分が
        前に来ていて、対になっていない。
        """
        hasher = ints(7)
        with pytest.raises(UnicodeEncodeError):
            hasher.add_text(text)
        assert hasher.value == ints(7).value


class Test表記:
    def test_十六進表記は_0で埋めた8桁の小文字(self) -> None:
        """先頭の 0 を落とすと、桁で揃えて見比べられない。"""
        assert ints(2, 1).hex == "0677f096"
        assert ints(-1).hex == "e3160fb1"

    @pytest.mark.parametrize("values", [values for values, _ in INT_HASHES])
    def test_十六進表記は_値と同じ数を表す(self, values: tuple[int, ...]) -> None:
        hasher = ints(*values)
        assert len(hasher.hex) == 8
        assert int(hasher.hex, 16) == hasher.value

    def test_混ぜるメソッドは自分を返し_続けて書ける(self) -> None:
        hasher = StateHasher()
        assert hasher.add_int(1) is hasher
        assert hasher.add_float(0.5) is hasher
        assert hasher.add_bool(True) is hasher
        assert hasher.add_text("a") is hasher
