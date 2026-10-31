"""大円距離（``geo.py``）のテスト。

期待値は、式と独立に分かっている値（半径 × 中心角）から出す。三角関数の最後の桁は
環境と言語で違うことがあるので、距離は許す差を付けて比べる（同じ点の 0 だけは等号）。
"""

import dataclasses
import math

import pytest

from algorithms_and_patterns.lib.geo import LatLon, great_circle_km

# 地球の平均の半径（km）。
R = 6371.0
# 許す差（相対）。同じ Mac の Python と Node.js で、北緯 60 度の経度1度の最後の桁が
# 違った。
REL = 1e-12

Pair = tuple[tuple[float, float], tuple[float, float]]
"""2点の（緯度, 経度）。``LatLon`` はテストの中で作る。

表を読み込むときに作ると、作る所の誤りでファイルごと読めなくなり、どのテストの失敗かが
分からない。
"""

# 中間の値（中心角の半正矢）が丸めで 1 を超える組。同じ Mac の Python 3.14・3.11 と
# Node.js 26 の3つとも超える組を選んだ。どの組で超えるかは、環境の数学の関数しだい。
OVER_ONE: list[Pair] = [
    ((-87.5, -180.0), (87.5, 0.0)),
    ((2.5, 0.0), (-2.5, 180.0)),
    ((38.5, 0.0), (-38.5, 180.0)),
]


class Test緯度と経度の組:
    @pytest.mark.parametrize(
        ("lat", "lon"), [(90.0, 180.0), (-90.0, -180.0), (0.0, 0.0), (-0.0, 179.9)]
    )
    def test_境界の90と180は受ける(self, lat: float, lon: float) -> None:
        point = LatLon(lat, lon)
        assert (point.lat, point.lon) == (lat, lon)

    @pytest.mark.parametrize(
        "lat", [90.000001, -90.5, 180.0, math.nan, math.inf, -math.inf]
    )
    def test_範囲の外の緯度は止める(self, lat: float) -> None:
        """NaN は比べるとどれも偽なので、範囲の比べで止まる。"""
        with pytest.raises(ValueError, match="緯度が範囲の外"):
            LatLon(lat, 0.0)

    @pytest.mark.parametrize("lon", [180.5, -180.000001, 360.0, math.nan, math.inf])
    def test_範囲の外の経度は止める(self, lon: float) -> None:
        with pytest.raises(ValueError, match="経度が範囲の外"):
            LatLon(0.0, lon)

    def test_作ったあとは書き換えられない(self) -> None:
        """書き換えられると、検査を通ったあとで範囲の外の値を持てる。"""
        point = LatLon(35.0, 139.0)
        with pytest.raises(dataclasses.FrozenInstanceError):
            point.lat = 91.0  # type: ignore[misc]
        assert point.lat == 35.0


class Test大円距離:
    def test_同じ点は0(self) -> None:
        point = LatLon(35.681236, 139.767125)
        assert great_circle_km(point, point, R) == 0.0

    @pytest.mark.parametrize(
        "pair",
        [
            ((28.573255, -80.646895), (28.56405, -80.56807)),
            ((51.5, -0.12), (-33.87, 151.21)),
            ((0.0, 179.0), (0.0, -179.0)),
        ],
    )
    def test_起点と終点を入れ替えても同じ(self, pair: Pair) -> None:
        a, b = LatLon(*pair[0]), LatLon(*pair[1])
        forward = great_circle_km(a, b, R)
        assert great_circle_km(b, a, R) == pytest.approx(forward, rel=REL)

    def test_緯度1度は_半径に1度の弧度を掛けた長さ(self) -> None:
        """経線に沿った道のりは、中心角そのもの（緯度の差）に半径を掛けた長さ。

        半径 6371 km で約 111.19 km。式の誤り（度と弧度の取り違え、2で割り忘れなど）は、
        「約 111 km」のような粗い比べでは見逃しうる。
        """
        expected = R * math.pi / 180
        assert great_circle_km(LatLon(0.0, 0.0), LatLon(1.0, 0.0), R) == pytest.approx(
            expected, rel=REL
        )
        assert expected == pytest.approx(111.19492664455873, rel=REL)

    def test_赤道の経度1度も_緯度1度と同じ長さ(self) -> None:
        """赤道は大円なので、経度の差がそのまま中心角になる。"""
        assert great_circle_km(LatLon(0.0, 0.0), LatLon(0.0, 1.0), R) == pytest.approx(
            R * math.pi / 180, rel=REL
        )

    def test_赤道の上で経度を10度ずらしても_同じ10度の長さ(self) -> None:
        """経度の差でなく和を使う式の誤りは、起点の経度が 0 の組では見えない。"""
        assert great_circle_km(
            LatLon(0.0, 10.0), LatLon(0.0, 20.0), R
        ) == pytest.approx(R * 10 * math.pi / 180, rel=REL)

    def test_0_0と45_90の中心角はちょうど90度で_4分の1周(self) -> None:
        """2点の緯度が違う組。

        cos φ1 · cos φ2 の片方を取り違える式の誤りは、2点の緯度が等しいか符号違いの
        組では見えない。
        """
        assert great_circle_km(
            LatLon(0.0, 0.0), LatLon(45.0, 90.0), R
        ) == pytest.approx(math.pi * R / 2, rel=REL)

    def test_北緯60度の経度1度は_赤道の半分より少し短い(self) -> None:
        """緯線の長さは cos 60° = 0.5 倍だが、2点を結ぶ大円は緯線より短い。

        期待値は、同じ緯度の2点の中心角 2 · asin(cos φ · sin(Δλ / 2)) から出す。
        赤道の経度1度との比は 0.49999524 で、半分の 0.5 より少し小さく、「赤道の
        半分」と等号で比べると合わない。
        """
        at_equator = great_circle_km(LatLon(0.0, 0.0), LatLon(0.0, 1.0), R)
        at_60 = great_circle_km(LatLon(60.0, 0.0), LatLon(60.0, 1.0), R)
        expected = 2 * math.asin(0.5 * math.sin(math.radians(0.5))) * R
        assert at_60 == pytest.approx(expected, rel=REL)
        assert 0.49999 < at_60 / at_equator < 0.5

    def test_赤道の対蹠点は_半周(self) -> None:
        distance = great_circle_km(LatLon(0.0, 0.0), LatLon(0.0, 180.0), R)
        assert distance == pytest.approx(math.pi * R, rel=REL)

    @pytest.mark.parametrize("pair", OVER_ONE)
    def test_中間の値が丸めで1を超える組でも_止まらずに半周を返す(
        self, pair: Pair
    ) -> None:
        """1 に収めずに √(1 - h) を取ると、ValueError で止まる。

        TypeScript では NaN になり、距離も NaN のまま黙って返る。
        """
        distance = great_circle_km(LatLon(*pair[0]), LatLon(*pair[1]), R)
        assert distance == pytest.approx(math.pi * R, rel=REL)

    def test_距離は半径に比例する(self) -> None:
        a, b = LatLon(10.0, 20.0), LatLon(-30.0, 100.0)
        angle = great_circle_km(a, b, 1.0)
        assert great_circle_km(a, b, R) == pytest.approx(angle * R, rel=REL)

    @pytest.mark.parametrize("radius", [0.0, -6371.0, math.nan, math.inf])
    def test_半径が0以下か有限でないと止まる(self, radius: float) -> None:
        """検査が無いと、0 と負の半径は 0 か負の距離を返す。

        NaN と無限大の半径は、NaN か無限大を返す。
        """
        with pytest.raises(ValueError, match="半径は 0 より大きい有限の数"):
            great_circle_km(LatLon(0.0, 0.0), LatLon(1.0, 0.0), radius)
