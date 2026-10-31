import { describe, expect, it } from 'vitest';
import { dominantAxis, Hysteresis, type Sign } from '../../src/lib/sampling.js';

/*
 * src/lib/sampling.ts のうち、揺れる値を分ける2つのテスト。
 * 2つのしきい値（Hysteresis）と大きいほうの軸（dominantAxis）と、その組み合わせを見る。
 * 押し始めと短い押し（EdgeDetector・PressLatch）は sampling-press.test.ts が見る。
 * 値の揺れの扱いと、押す・離すの扱いは、別の理由で変わるので、ファイルを分けた。
 */

const ON = 0.5;
const OFF = 0.35;

describe('2つのしきい値', () => {
  it('切れている間は on 未満で入らず、on ちょうどで入る', () => {
    const gate = new Hysteresis(ON, OFF);
    expect([0.49, 0.4999999, ON].map((value) => gate.update(value))).toEqual([false, false, true]);
  });

  it('入っている間は off ちょうどまで保ち、off 未満で切れる', () => {
    // しきい値を1つにする（off を on と同じに比べる）と、0.36 で切れる。
    const gate = new Hysteresis(ON, OFF);
    gate.update(0.9);
    expect([0.49, 0.36, OFF, 0.3499].map((value) => gate.update(value))).toEqual([true, true, true, false]);
  });

  it('切れたあとは、off 以上 on 未満の値で入らない', () => {
    const gate = new Hysteresis(ON, OFF);
    expect([ON, 0.3, 0.4, 0.49, ON].map((value) => gate.update(value))).toEqual([true, false, false, false, true]);
  });

  it('値はそのまま比べ、負の大きな値では入らない', () => {
    // 大きさで判定したいときは、呼ぶ側が絶対値を渡す。
    const gate = new Hysteresis(ON, OFF);
    expect(gate.update(-0.9)).toBe(false);
    expect(gate.update(Math.abs(-0.9))).toBe(true);
  });

  it('無限大は、ほかの値と同じく比べる', () => {
    const gate = new Hysteresis(ON, OFF);
    expect(gate.update(Infinity)).toBe(true);
    expect(gate.update(-Infinity)).toBe(false);
  });

  it('active は最後の状態で、reset で切れた状態に戻る', () => {
    const gate = new Hysteresis(ON, OFF);
    expect(gate.active).toBe(false);
    gate.update(0.9);
    expect(gate.active).toBe(true);
    gate.reset();
    expect(gate.active).toBe(false);
    expect(gate.update(0.4)).toBe(false);
  });

  it.each([
    ['等しい', ON, ON],
    ['逆', OFF, ON],
  ])('off が on 以上なら止まる：%s', (_kind, on, off) => {
    // 等しいと、しきい値が1つと同じになる。
    expect(() => new Hysteresis(on, off)).toThrow(RangeError);
    expect(() => new Hysteresis(on, off)).toThrow('入るしきい値より小さくする');
  });

  it.each([
    ['on が NaN', NaN, OFF],
    ['off が NaN', ON, NaN],
    ['on が無限大', Infinity, OFF],
    ['off が負の無限大', ON, -Infinity],
  ])('しきい値が有限でなければ止まる：%s', (_kind, on, off) => {
    // 無限大の on では入らず、負の無限大の off では切れない。
    expect(() => new Hysteresis(on, off)).toThrow('しきい値は有限の数');
  });

  it.each([
    ['切れている', 0],
    ['入っている', 0.9],
  ])('NaN を読むと止まり、状態を変えない：%s', (_kind, before) => {
    // NaN は比べるとどれも偽なので、止めなければ、いまの状態のまま黙って続く。
    // しきい値を1つ選んで Math.abs(value) < しきい値 で切る比べ方では、NaN で黙って入る。
    const gate = new Hysteresis(ON, OFF);
    const state = gate.update(before);
    expect(() => gate.update(NaN)).toThrow(RangeError);
    expect(() => gate.update(NaN)).toThrow('値が NaN');
    expect(gate.active).toBe(state);
  });
});

describe('大きいほうの軸', () => {
  it.each([
    [0.1, -0.9, [0, -1]],
    [0.55, -0.8, [0, -1]],
    [0.9, 0.1, [1, 0]],
    [-0.7, 0.2, [-1, 0]],
    [0, 0.3, [0, 1]],
    [Infinity, 1, [1, 0]],
  ] as const)('(%s, %s) は絶対値の大きいほうの符号だけを残して %j', (x, y, expected) => {
    // 軸ごとの符号を両方残すと、(0.55, -0.8) が斜めになる。
    expect(dominantAxis(x, y)).toEqual(expected);
  });

  it.each([
    [0.5, 0.5, [1, 0]],
    [-0.5, 0.5, [-1, 0]],
    [0.5, -0.5, [1, 0]],
  ] as const)('絶対値が等しい (%s, %s) は横を残して %j', (x, y, expected) => {
    // >= を > にすると、縦が残る。
    expect(dominantAxis(x, y)).toEqual(expected);
  });

  it.each([
    [0, 0],
    [-0, 0],
    [0, -0],
  ])('両方 0 の (%s, %s) は、符号がどちらも 0 で、-0 を返さない', (x, y) => {
    // toEqual は数を Object.is で比べるので、-0 が混ざると失敗する（Math.sign(-0) は -0）。
    expect(dominantAxis(x, y)).toEqual([0, 0]);
  });

  it('軸ごとにしきい値を当てると、縦横の両方が超える', () => {
    // 真上から少しずれた向きで、横もしきい値に届く。大きいほうの軸なら縦だけ。
    const [x, y] = [0.55, -0.8];
    expect([x, y].map((value) => Math.abs(value) >= ON)).toEqual([true, true]);
    expect(dominantAxis(x, y)).toEqual([0, -1]);
  });

  it.each([
    [NaN, 0.2],
    [0.2, NaN],
  ])('NaN を含む (%s, %s) は止まる', (x, y) => {
    // NaN の絶対値を比べると偽になり、止めなければ黙って縦を残す。
    expect(() => dominantAxis(x, y)).toThrow(RangeError);
    expect(() => dominantAxis(x, y)).toThrow('軸の値が NaN');
  });
});

/** 大きさ（大きいほうの軸の絶対値）を2つのしきい値で分け、入っていれば向きを返す。 */
function readDirection(gate: Hysteresis, x: number, y: number): readonly [Sign, Sign] {
  return gate.update(Math.max(Math.abs(x), Math.abs(y))) ? dominantAxis(x, y) : [0, 0];
}

/** 縦の値が 0.5 の近くで揺れ、最後に 0.35 を下回る並び。 */
const WOBBLE: readonly (readonly [number, number])[] = [
  [0, -0.52],
  [0, -0.48],
  [0.05, -0.51],
  [0, -0.49],
  [0, -0.36],
];

describe('組み合わせ', () => {
  it('大きさに2つのしきい値、向きに大きいほうの軸で、境目がちらつかない', () => {
    const gate = new Hysteresis(ON, OFF);
    const readings = [...WOBBLE, [0, -0.34] as const];
    const directions = readings.map(([x, y]) => readDirection(gate, x, y));
    expect(directions).toEqual([[0, -1], [0, -1], [0, -1], [0, -1], [0, -1], [0, 0]]);
  });

  it('しきい値が1つだと、同じ並びで読むたびに入れ替わる', () => {
    // off と on が等しい部品は作れないので、比べる式をここに書く。
    expect(WOBBLE.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)) >= ON)).toEqual([true, false, true, false, false]);
  });
});
