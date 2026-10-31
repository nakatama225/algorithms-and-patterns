"""輪の上の位置（``ring.py``）のテスト。

固定値の表（``WRAPPED``・``SIGNED_DELTAS``）は、JavaScript の式を node で計算して
出した。TypeScript のテスト（``ring.test.ts``）にも同じ表があり、
``test_cross_language.py`` が2つの表を比べる。値は ``float.hex`` で比べ、最後の桁と
0.0・-0.0 の違いまで見る。
"""

import math
import sys

import pytest

from algorithms_and_patterns.lib.ring import signed_delta, wrap

# 巻き戻せる長さの上限（float の最大値の半分）。
MAX_WRAP = sys.float_info.max / 2

# 位置・長さ・巻き戻した位置。JavaScript の ((position % length) + length) % length。
WRAPPED: list[tuple[float, float, float]] = [
    (-1e-20, 72.0, 0.0),
    (3.091666666666667, 72.0, 3.0916666666666686),
    (0.09166666666666667, 72.0, 0.09166666666666856),
    (71.99999999999999, 72.0, 0.0),
    (71.95833333333333, 72.0, 71.95833333333331),
    (5.0, 72.0, 5.0),
    (8.881784197001252e-16, 72.0, 0.0),
    (72.0, 72.0, 0.0),
    (-72.5, 72.0, 71.5),
    (143.9, 72.0, 71.9),
    (-0.0, 72.0, 0.0),
    (-81.57093076673938, 72.0, 62.42906923326062),
    (62.42906923326062, 72.0, 62.429069233260634),
    (1e17, 72.0, 64.0),
    (-1e17, 72.0, 8.0),
    (123456789.123, 72.0, 45.122999995946884),
    (-0.1, 0.3, 0.19999999999999998),
    (10.0, 3.0, 1.0),
    (-1.0, 3.0, 2.0),
]

# 始点・終点・長さ・近いほうの道のり。
SIGNED_DELTAS: list[tuple[float, float, float, float]] = [
    (70.0, 2.0, 72.0, 4.0),
    (2.0, 70.0, 72.0, -4.0),
    (2.0, 38.0, 72.0, 36.0),
    (38.0, 2.0, 72.0, -36.0),
    (5.0, 5.0, 72.0, 0.0),
    (0.1, 71.9, 72.0, -0.19999999999998863),
    (71.9, 0.1, 72.0, 0.19999999999998863),
    (3.0916666666666686, 71.95833333333331, 72.0, -3.133333333333354),
    (0.0, 0.5, 1.0, 0.5),
    (0.5, 0.0, 1.0, -0.5),
    (0.2, 0.7, 1.0, 0.49999999999999994),
    (0.7, 0.2, 1.0, -0.49999999999999994),
]


class Test巻き戻し:
    @pytest.mark.parametrize(("position", "length", "expected"), WRAPPED)
    def test_JavaScriptの式と最後の桁まで同じ(
        self, position: float, length: float, expected: float
    ) -> None:
        """``%`` 1つで書くと -1e-20 が 72.0 になり、範囲の内の値は最後の桁が変わらない。

        JavaScript の式を ``%`` のまま写すと、-81.57093076673938 などで最後の桁が違う。
        ``fmod`` を1回だけにすると、負の位置が負のまま返る（-72.5 が -0.5）。
        """
        assert wrap(position, length).hex() == expected.hex()

    def test_Pythonの剰余1つでは_範囲の外の72が出る(self) -> None:
        """72 より 1e-20 小さい値は float で表せず、丸めて 72.0 になる。"""
        assert -1e-20 % 72 == 72.0
        assert wrap(-1e-20, 72) == 0.0

    def test_JavaScriptの式をPythonの剰余で写すと_負の位置の一部で最後の桁が違う(
        self,
    ) -> None:
        """1回目の ``%`` で正になった値に、もう一度 72 を足して丸めるため。"""
        position = -81.57093076673938
        assert (position % 72 + 72) % 72 == 62.429069233260634
        assert wrap(position, 72) == 62.42906923326062

    def test_範囲の内の値も_長さを足した和が丸まると最後の桁が変わる(self) -> None:
        """止まっている間も巻き戻しを通すかどうかで、2つの言語の値が分かれる。

        Python の ``%`` は範囲の内の値をそのまま返すので、JavaScript の式と食い違う。
        5 は 72 を足した 77 が float でちょうど表せるので変わらない。2 の -50 乗は
        2進数でちょうど表せる値だが、72 を足すと丸まり、0.0 になる。
        """
        assert wrap(3.091666666666667, 72) == 3.0916666666666686
        assert 3.091666666666667 % 72 == 3.091666666666667
        assert wrap(5.0, 72) == 5.0
        assert wrap(71.99999999999999, 72) == 0.0
        assert wrap(8.881784197001252e-16, 72) == 0.0

    def test_2回通すと_もう一度変わることがある(self) -> None:
        """巻き戻した値をもう一度巻き戻しても、同じ値に留まるとは限らない。"""
        once = wrap(-81.57093076673938, 72)
        assert wrap(once, 72) != once

    @pytest.mark.parametrize("position", [-0.0, -72.0, -1e-20, 72.0, -144.0, 0.0])
    def test_答えは正の0で_マイナス0にならない(self, position: float) -> None:
        assert wrap(position, 72).hex() == "0x0.0p+0"

    @pytest.mark.parametrize("position", [-1e-300, -71.99999999999999, -36.5, 1e-300])
    def test_答えは0以上_長さ未満(self, position: float) -> None:
        assert 0 <= wrap(position, 72) < 72


class Test符号つきの差:
    @pytest.mark.parametrize(("start", "end", "length", "expected"), SIGNED_DELTAS)
    def test_近いほうの道のりが表のとおり(
        self, start: float, end: float, length: float, expected: float
    ) -> None:
        assert signed_delta(start, end, length).hex() == expected.hex()

    def test_ちょうど半周は_差の符号のまま(self) -> None:
        """半周を ``>=`` で比べると、2 から 38 が -36 に、38 から 2 が +36 に変わる。"""
        assert signed_delta(2, 38, 72) == 36
        assert signed_delta(38, 2, 72) == -36

    @pytest.mark.parametrize(("start", "end", "length", "expected"), SIGNED_DELTAS)
    def test_始点と終点を入れ替えると_符号だけが変わる(
        self, start: float, end: float, length: float, expected: float
    ) -> None:
        assert signed_delta(end, start, length) == -expected

    @pytest.mark.parametrize(
        ("start", "end"), [(72.0, 2.0), (-1e-20, 2.0), (2.0, 74.0), (2.0, -0.5)]
    )
    def test_範囲の外の位置は_巻き戻さずに止める(
        self, start: float, end: float
    ) -> None:
        """中で巻き戻すと、範囲の内の値でも最後の桁が変わり、渡した2点の差と食い違う。"""
        with pytest.raises(ValueError, match="点が範囲の外"):
            signed_delta(start, end, 72)


class Test止める値:
    @pytest.mark.parametrize("length", [0.0, -72.0, math.nan, math.inf, -math.inf])
    def test_長さが0以下か有限でないと止まる(self, length: float) -> None:
        """検査が無いと、負の長さでは答えが負になり（5 が -67.0）、NaN では NaN が返る。

        長さ 0 と無限大では ``math.fmod`` が math domain error で止めるが、文が違う。
        """
        with pytest.raises(ValueError, match="長さは 0 より大きい有限の数"):
            wrap(5, length)
        with pytest.raises(ValueError, match="長さは 0 より大きい有限の数"):
            signed_delta(0, 0, length)

    @pytest.mark.parametrize("length", [1.5e308, math.nextafter(MAX_WRAP, math.inf)])
    def test_巻き戻す長さが数の最大値の半分より大きいと止まる(
        self, length: float
    ) -> None:
        """位置によっては、長さを足すときに無限大にあふれる。

        1e308 を長さ 1.5e308 で巻き戻すとき、検査が無いと ``math.fmod`` が math domain
        error で止め、TypeScript は NaN を返す。
        """
        with pytest.raises(ValueError, match="数の最大値の半分以下にする"):
            wrap(1e308, length)

    def test_巻き戻す長さがちょうど数の最大値の半分なら_あふれずに巻き戻す(
        self,
    ) -> None:
        position = math.nextafter(MAX_WRAP, 0)
        assert wrap(position, MAX_WRAP) == 8.988465674311577e307
        assert wrap(-1.0, MAX_WRAP) == 0.0

    def test_符号つきの差は_長さの上限を持たない(self) -> None:
        """差は1周より短いので、1周ぶんを足し引きしてもあふれない。"""
        assert signed_delta(0.0, 1e308, 1.5e308) == -5e307
        assert signed_delta(1e308, 0.0, 1.5e308) == 5e307

    @pytest.mark.parametrize("position", [math.nan, math.inf, -math.inf])
    def test_巻き戻す位置が有限でないと止まる(self, position: float) -> None:
        """NaN は ``math.fmod`` を通っても止まらず、NaN のまま返る。"""
        with pytest.raises(ValueError, match="位置が有限の数でない"):
            wrap(position, 72)

    @pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
    def test_差を取る点が有限でないと止まる(self, value: float) -> None:
        with pytest.raises(ValueError, match="始点が範囲の外"):
            signed_delta(value, 0, 72)
        with pytest.raises(ValueError, match="終点が範囲の外"):
            signed_delta(0, value, 72)
