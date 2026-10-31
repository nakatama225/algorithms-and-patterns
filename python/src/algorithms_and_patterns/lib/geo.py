"""大円距離 — 緯度と経度の2点から、地表に沿った距離を求める（地球を球とみなす近似）。

- ``LatLon``：緯度と経度の組。作るときに範囲（緯度は -90 以上 90 以下、経度は -180 以上
  180 以下）を検査する。4つの数を位置で渡すと順を取り違えても気づけないので、組にして
  名前で読む
- ``great_circle_km``：2点の間の、球の表面に沿った最短の道のり（大円の弧の長さ）を、
  ハーサイン公式（haversine formula）で求める。半径は既定値を置かず、呼ぶ側が渡す

ハーサイン公式は、2点の緯度 φ1・φ2 と経度の差 Δλ から、中心角 θ の半正矢
（haversine。hav θ = sin²(θ/2)）を

    h = sin²((φ2 − φ1) / 2) + cos φ1 · cos φ2 · sin²(Δλ / 2)

で求め、θ = 2 · atan2(√h, √(1 − h)) に戻す。h は半正矢の値で、弦の長さではない。

h は真の値では 0 以上 1 以下だが、対蹠点（地球の反対側の点）の近くでは、丸めで 1 を
わずかに超える（(-87.5, -180) と (87.5, 0) で 1.0000000000000002）。そのまま
√(1 − h) を取ると、Python は ``ValueError`` で止まり、TypeScript は NaN を返して黙って
進む。そこで 1 を超えた h を 1 に収めてから平方根を取る。h は 0 より小さくならない
（範囲の内の緯度では cos φ が 0 以上なので、どの項も 0 以上）。

固定値の表は持たない。三角関数（sin・cos・atan2）は最後の桁が環境と言語で違うことが
あるので、同じ環境なら起動のたびに同じ値だが、環境と言語をまたぐと最後の桁が違いうる
（README の「決定性を崩す書き方の検査」）。2乗は掛け算で書く。

地球を球とみなすので、楕円体の上の精密な距離には向かない。TypeScript 版
（``typescript/src/lib/geo.ts``）も同じ形。
"""

import math
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LatLon:
    """地表の1点。緯度と経度は度で、北と東を正にする。

    作るときに範囲を検査するので、範囲の外の値を持つ ``LatLon`` は作れない。経度の
    180 と -180 は同じ経線で、どちらも受ける。

    Attributes:
        lat: 緯度。-90 以上 90 以下。
        lon: 経度。-180 以上 180 以下。

    Raises:
        ValueError: 緯度か経度が範囲の外のとき（NaN と無限大も含む）。
    """

    lat: float
    lon: float

    def __post_init__(self) -> None:
        # NaN は比べるとどれも偽なので、範囲の比べで止まる。
        if not -90 <= self.lat <= 90:
            raise ValueError(f"緯度が範囲の外: {self.lat}（-90 以上 90 以下）")
        if not -180 <= self.lon <= 180:
            raise ValueError(f"経度が範囲の外: {self.lon}（-180 以上 180 以下）")


def great_circle_km(a: LatLon, b: LatLon, radius_km: float) -> float:
    """2点の間の、球の表面に沿った最短の道のり（大円距離）を返す。

    起点と終点を入れ替えても、同じ距離になる。半径は、地球の平均の半径なら 6371 km が
    よく使われる。

    Args:
        a: 起点。
        b: 終点。
        radius_km: 球の半径（km）。0 より大きい有限の数。

    Returns:
        2点の間の道のり（km）。同じ点なら 0。

    Raises:
        ValueError: ``radius_km`` が 0 以下か NaN か無限大のとき。
    """
    if not (math.isfinite(radius_km) and radius_km > 0):
        raise ValueError(f"半径は 0 より大きい有限の数にする: {radius_km}")
    phi_a = math.radians(a.lat)
    phi_b = math.radians(b.lat)
    sin_half_lat = math.sin((phi_b - phi_a) / 2)
    sin_half_lon = math.sin((math.radians(b.lon) - math.radians(a.lon)) / 2)
    hav = (
        sin_half_lat * sin_half_lat
        + math.cos(phi_a) * math.cos(phi_b) * sin_half_lon * sin_half_lon
    )
    # 対蹠点の近くで丸めて 1 を超えると、√(1 - hav) が ValueError になる。
    hav = min(hav, 1.0)
    return radius_km * 2 * math.atan2(math.sqrt(hav), math.sqrt(1 - hav))
