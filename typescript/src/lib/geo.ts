/**
 * 大円距離 — 緯度と経度の2点から、地表に沿った距離を求める（地球を球とみなす近似）。
 *
 * - `LatLon`：緯度と経度の組。作るときに範囲（緯度は -90 以上 90 以下、経度は -180 以上 180 以下）を
 *   検査する。4つの数を位置で渡すと順を取り違えても気づけないので、組にして名前で読む
 * - `greatCircleKm`：2点の間の、球の表面に沿った最短の道のり（大円の弧の長さ）を、ハーサイン公式
 *   （haversine formula）で求める。半径は既定値を置かず、呼ぶ側が渡す
 *
 * ハーサイン公式は、2点の緯度 φ1・φ2 と経度の差 Δλ から、中心角 θ の半正矢（haversine。
 * hav θ = sin²(θ/2)）を `h = sin²((φ2 − φ1) / 2) + cos φ1 · cos φ2 · sin²(Δλ / 2)` で求め、
 * θ = 2 · atan2(√h, √(1 − h)) に戻す。h は半正矢の値で、弦の長さではない。
 *
 * h は真の値では 0 以上 1 以下だが、対蹠点（地球の反対側の点）の近くでは、丸めで 1 をわずかに超える
 * （(-87.5, -180) と (87.5, 0) で 1.0000000000000002）。そのまま √(1 − h) を取ると NaN になり、
 * `Math.atan2` も NaN を返して、例外を出さずに進む。Python 版の `math.sqrt` は `ValueError` で止まる。
 * そこで 1 を超えた h を 1 に収めてから平方根を取る。h は 0 より小さくならない（範囲の内の緯度では
 * cos φ が 0 以上なので、どの項も 0 以上）。
 *
 * 固定値の表は持たない。三角関数（sin・cos・atan2）は最後の桁が環境と言語で違うことがあるので、
 * 同じ環境なら起動のたびに同じ値だが、環境と言語をまたぐと最後の桁が違いうる（README の
 * 「決定性を崩す書き方の検査」）。2乗は掛け算で書く。
 *
 * 地球を球とみなすので、楕円体の上の精密な距離には向かない。Python 版
 * （`python/src/algorithms_and_patterns/lib/geo.py`）も同じ形。
 */

/** 1度あたりの弧度。Python の `math.radians` と同じく、度にこの値を掛ける。 */
const RADIANS_PER_DEGREE = Math.PI / 180;

/**
 * 地表の1点。緯度と経度は度で、北と東を正にする。
 *
 * 作るときに範囲を検査して凍らせるので、範囲の外の値を持つ `LatLon` は作れず、作ったあとも
 * 書き換わらない。経度の 180 と -180 は同じ経線で、どちらも受ける。
 */
export class LatLon {
  /** 緯度。-90 以上 90 以下。 */
  readonly lat: number;
  /** 経度。-180 以上 180 以下。 */
  readonly lon: number;
  /**
   * コンストラクタを通って作った値の印。TypeScript は型を形で比べるので、この項目が無いと、
   * 同じ形のオブジェクト（`{ lat: 91, lon: 0 }`）を、範囲の検査を通さずに `LatLon` として渡せる。
   * private の項目を持つクラスの型には、そのクラスで作った値しか合わない。`declare` なので型の上
   * だけの項目で、実行時には作らない（`JSON.stringify` や `Object.keys` に出ない）。
   */
  declare private readonly checked: true;

  /**
   * @param lat 緯度。-90 以上 90 以下
   * @param lon 経度。-180 以上 180 以下
   * @throws RangeError 緯度か経度が範囲の外のとき（NaN と無限大も含む）
   */
  constructor(lat: number, lon: number) {
    // NaN は比べるとどれも偽なので、範囲の外を「下限より小さいか上限より大きい」で見ると通る。
    // 明示して止める。
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      throw new RangeError(`緯度が範囲の外: ${lat}（-90 以上 90 以下）`);
    }
    if (Number.isNaN(lon) || lon < -180 || lon > 180) {
      throw new RangeError(`経度が範囲の外: ${lon}（-180 以上 180 以下）`);
    }
    this.lat = lat;
    this.lon = lon;
    Object.freeze(this);
  }
}

/**
 * 2点の間の、球の表面に沿った最短の道のり（大円距離）を返す。
 *
 * 起点と終点を入れ替えても、同じ距離になる。半径は、地球の平均の半径なら 6371 km がよく使われる。
 *
 * @param a 起点
 * @param b 終点
 * @param radiusKm 球の半径（km）。0 より大きい有限の数
 * @returns 2点の間の道のり（km）。同じ点なら 0
 * @throws RangeError `radiusKm` が 0 以下か NaN か無限大のとき
 */
export function greatCircleKm(a: LatLon, b: LatLon, radiusKm: number): number {
  if (!(Number.isFinite(radiusKm) && radiusKm > 0)) {
    throw new RangeError(`半径は 0 より大きい有限の数にする: ${radiusKm}`);
  }
  const phiA = a.lat * RADIANS_PER_DEGREE;
  const phiB = b.lat * RADIANS_PER_DEGREE;
  const sinHalfLat = Math.sin((phiB - phiA) / 2);
  const sinHalfLon = Math.sin((b.lon * RADIANS_PER_DEGREE - a.lon * RADIANS_PER_DEGREE) / 2);
  const raw = sinHalfLat * sinHalfLat + Math.cos(phiA) * Math.cos(phiB) * sinHalfLon * sinHalfLon;
  // 対蹠点の近くで丸めて 1 を超えると、√(1 - hav) が NaN になり、距離も NaN になる。
  const hav = Math.min(raw, 1);
  return radiusKm * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}
