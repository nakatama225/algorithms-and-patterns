import { describe, expect, it } from 'vitest';
import { LatLon, greatCircleKm } from '../../src/lib/geo.js';

/*
 * src/lib/geo.ts の、大円距離のテスト。
 * 期待値は、式と独立に分かっている値（半径 × 中心角）から出す。三角関数の最後の桁は環境と言語で
 * 違うことがあるので、距離は許す差を付けて比べる（同じ点の 0 だけは toBe）。
 */

/** 地球の平均の半径（km）。 */
const R = 6371;

/** 相対の差が 1e-12 以下か。同じ Mac の Python と Node.js で、北緯 60 度の経度1度の最後の桁が違った。 */
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * 1e-12);
}

/**
 * 2点の緯度と経度。LatLon はテストの中で作る。表を読み込むときに作ると、作る所の誤りでファイルごと
 * 読めなくなり、どのテストの失敗かが分からない。
 */
type Pair = readonly [latA: number, lonA: number, latB: number, lonB: number];

/**
 * 中間の値（中心角の半正矢）が丸めで 1 を超える組。同じ Mac の Python 3.14・3.11 と Node.js 26 の
 * 3つとも超える組を選んだ。どの組で超えるかは、環境の数学の関数しだい。
 */
const OVER_ONE: readonly Pair[] = [
  [-87.5, -180, 87.5, 0],
  [2.5, 0, -2.5, 180],
  [38.5, 0, -38.5, 180],
];

describe('緯度と経度の組', () => {
  it.each([
    [90, 180],
    [-90, -180],
    [0, 0],
    [-0, 179.9],
  ])('境界の 90 と 180 は受ける：(%s, %s)', (lat, lon) => {
    const point = new LatLon(lat, lon);
    expect([point.lat, point.lon]).toEqual([lat, lon]);
  });

  it.each([90.000001, -90.5, 180, NaN, Infinity, -Infinity])('範囲の外の緯度 %s は止める', (lat) => {
    // NaN は比べるとどれも偽なので、「下限より小さいか上限より大きい」だけで見ると通る。
    expect(() => new LatLon(lat, 0)).toThrow(RangeError);
    expect(() => new LatLon(lat, 0)).toThrow('緯度が範囲の外');
  });

  it.each([180.5, -180.000001, 360, NaN, Infinity])('範囲の外の経度 %s は止める', (lon) => {
    expect(() => new LatLon(0, lon)).toThrow(RangeError);
    expect(() => new LatLon(0, lon)).toThrow('経度が範囲の外');
  });

  it('作ったあとは書き換えられない', () => {
    // readonly は型検査だけの約束なので、凍らせないと、型を外した書き換えが通る。
    const point = new LatLon(35, 139);
    expect(() => {
      (point as { lat: number }).lat = 91;
    }).toThrow(TypeError);
    expect(point.lat).toBe(35);
  });

  it('同じ形のオブジェクトは、範囲を検査していないので LatLon として渡せない', () => {
    // private の項目を持つクラスの型には、そのクラスで作った値しか合わない。印の項目を外すと、
    // 下の注釈が使われなくなり、型検査が失敗する。
    // @ts-expect-error 範囲を検査していない値は渡せない
    const distance = greatCircleKm({ lat: 91, lon: 0 }, new LatLon(0, 0), R);
    expect(distance).toBeGreaterThan(0);
  });

  it('印は型の上だけの項目で、実行時の値には出ない', () => {
    // 実行時の項目にすると、JSON.stringify や toEqual の比べに印が出る。
    const point = new LatLon(1, 2);
    expect(Object.keys(point)).toEqual(['lat', 'lon']);
    expect(JSON.stringify(point)).toBe('{"lat":1,"lon":2}');
  });
});

describe('大円距離', () => {
  it('同じ点は 0', () => {
    const point = new LatLon(35.681236, 139.767125);
    expect(greatCircleKm(point, point, R)).toBe(0);
  });

  it.each<Pair>([
    [28.573255, -80.646895, 28.56405, -80.56807],
    [51.5, -0.12, -33.87, 151.21],
    [0, 179, 0, -179],
  ])('(%s, %s) と (%s, %s) の起点と終点を入れ替えても同じ', (latA, lonA, latB, lonB) => {
    const a = new LatLon(latA, lonA);
    const b = new LatLon(latB, lonB);
    expectClose(greatCircleKm(b, a, R), greatCircleKm(a, b, R));
  });

  it('緯度1度は、半径に1度の弧度を掛けた長さ', () => {
    // 経線に沿った道のりは、中心角そのもの（緯度の差）に半径を掛けた長さ。半径 6371 km で約 111.19 km。
    // 式の誤り（度と弧度の取り違え、2で割り忘れなど）は、「約 111 km」のような粗い比べでは見逃しうる。
    const expected = (R * Math.PI) / 180;
    expectClose(greatCircleKm(new LatLon(0, 0), new LatLon(1, 0), R), expected);
    expectClose(expected, 111.19492664455873);
  });

  it('赤道の経度1度も、緯度1度と同じ長さ', () => {
    // 赤道は大円なので、経度の差がそのまま中心角になる。
    expectClose(greatCircleKm(new LatLon(0, 0), new LatLon(0, 1), R), (R * Math.PI) / 180);
  });

  it('赤道の上で経度を 10 度ずらしても、同じ 10 度の長さ', () => {
    // 経度の差でなく和を使う式の誤りは、起点の経度が 0 の組では見えない。
    expectClose(greatCircleKm(new LatLon(0, 10), new LatLon(0, 20), R), (R * 10 * Math.PI) / 180);
  });

  it('(0, 0) と (45, 90) の中心角はちょうど 90 度で、4分の1周', () => {
    // 2点の緯度が違う組。cos φ1 · cos φ2 の片方を取り違える式の誤りは、2点の緯度が等しいか符号違いの
    // 組では見えない。
    expectClose(greatCircleKm(new LatLon(0, 0), new LatLon(45, 90), R), (Math.PI * R) / 2);
  });

  it('北緯 60 度の経度1度は、赤道の半分より少し短い', () => {
    // 緯線の長さは cos 60° = 0.5 倍だが、2点を結ぶ大円は緯線より短い。期待値は、同じ緯度の2点の
    // 中心角 2 · asin(cos φ · sin(Δλ / 2)) から出す。赤道の経度1度との比は 0.49999524 で、半分の 0.5 より
    // 少し小さい。
    const atEquator = greatCircleKm(new LatLon(0, 0), new LatLon(0, 1), R);
    const at60 = greatCircleKm(new LatLon(60, 0), new LatLon(60, 1), R);
    expectClose(at60, 2 * Math.asin(0.5 * Math.sin((0.5 * Math.PI) / 180)) * R);
    expect(at60 / atEquator).toBeGreaterThan(0.49999);
    expect(at60 / atEquator).toBeLessThan(0.5);
  });

  it('赤道の対蹠点は半周', () => {
    expectClose(greatCircleKm(new LatLon(0, 0), new LatLon(0, 180), R), Math.PI * R);
  });

  it.each(OVER_ONE)('(%s, %s) と (%s, %s) は、中間の値が丸めで 1 を超えても、NaN にならずに半周を返す', (latA, lonA, latB, lonB) => {
    // 1 に収めずに √(1 - h) を取ると NaN になり、Math.atan2 も NaN を返して、例外を出さずに進む。
    const distance = greatCircleKm(new LatLon(latA, lonA), new LatLon(latB, lonB), R);
    expect(Number.isNaN(distance)).toBe(false);
    expectClose(distance, Math.PI * R);
  });

  it('距離は半径に比例する', () => {
    const a = new LatLon(10, 20);
    const b = new LatLon(-30, 100);
    expectClose(greatCircleKm(a, b, R), greatCircleKm(a, b, 1) * R);
  });

  it.each([0, -6371, NaN, Infinity])('半径 %s は止まる', (radius) => {
    // 検査が無いと、0 と負の半径は 0 か負の距離を、NaN と無限大は NaN か無限大を返す。
    expect(() => greatCircleKm(new LatLon(0, 0), new LatLon(1, 0), radius)).toThrow(RangeError);
    expect(() => greatCircleKm(new LatLon(0, 0), new LatLon(1, 0), radius)).toThrow(
      '半径は 0 より大きい有限の数',
    );
  });
});
