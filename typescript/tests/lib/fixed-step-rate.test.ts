import { describe, expect, it } from 'vitest';
import { RateScaler } from '../../src/lib/fixed-step.js';

/*
 * src/lib/fixed-step.ts のうち、倍率を刻みを進める回数に換える部品（RateScaler）のテスト。
 * 倍率は分数で、分母を作るときに決め、分子を整数で持つ（new RateScaler(4, 6) なら 1.5 倍）。
 */

/** フレームごとの実時間の刻みの数を順に渡し、返った回数を並べる。 */
function takes(scaler: RateScaler, steps: readonly number[]): number[] {
  return steps.map((n) => scaler.take(n));
}

/** 隣どうしの差。 */
function gaps(values: readonly number[]): number[] {
  return values.slice(1).map((value, i) => value - (values[i] as number));
}

describe('進める回数', () => {
  it('等倍なら、渡した数だけ進める', () => {
    expect(takes(new RateScaler(1, 1), [0, 1, 2, 15])).toEqual([0, 1, 2, 15]);
  });

  it('2倍なら、1刻みのフレームに2回進める', () => {
    expect(takes(new RateScaler(1, 2), [1, 1, 1, 3])).toEqual([2, 2, 2, 6]);
  });

  it('0.5 倍なら、2フレームに1回進める', () => {
    expect(takes(new RateScaler(2, 1), [1, 1, 1, 1, 1, 1])).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('1.5 倍なら、1回と2回を交互に進める', () => {
    expect(takes(new RateScaler(2, 3), [1, 1, 1, 1])).toEqual([1, 2, 1, 2]);
  });

  it.each([
    [4, 5, 400, 500],
    [10, 7, 10_000, 7_000],
  ])('倍率 %s 分の %s を %s フレーム進めると、合計はちょうど %s 回', (parts, rateParts, frames, total) => {
    // 端数を整数で持ち越すので、長く進めても倍率どおり。0.7 は2進数の小数で表せず、小数で積んで
    // 整数の部分を差し引いていく形では、10_000 フレームで 6_999 回になる。
    const steps = takes(new RateScaler(parts, rateParts), Array.from({ length: frames }, () => 1));
    expect(steps.reduce((sum, value) => sum + value, 0)).toBe(total);
    expect(new Set(steps).size).toBe(2);
  });

  it('倍率を替えても、持ち越した端数は捨てない', () => {
    const scaler = new RateScaler(2, 1);
    expect(scaler.take(1)).toBe(0);
    scaler.set(3);
    expect(scaler.rateParts).toBe(3);
    // 持ち越した 0.5 回分に 1.5 回分を足して 2 回。
    expect(scaler.take(1)).toBe(2);
  });

  it('分母を 6 にすれば、0.5 倍から 1/3 倍へ替えても端数を捨てない', () => {
    // 分母は作るときに決めるので、使う倍率がどれも整数の分子で表せる分母を選ぶ。
    // 3/6 + 2/6 = 5/6、5/6 + 2/6 = 7/6。
    const scaler = new RateScaler(6, 3);
    expect(scaler.take(1)).toBe(0);
    scaler.set(2);
    expect(takes(scaler, [1, 1])).toEqual([0, 1]);
    expect(scaler.progress).toBe(1 / 6);
  });
});

describe('描く値を混ぜる割合', () => {
  it.each([
    [2, 1, [0.5, 0, 0.5, 0]],
    [4, 3, [0.75, 0.5, 0.25, 0]],
    [2, 3, [0.5, 0, 0.5, 0]],
    [2, 5, [0.5, 0, 0.5, 0]],
  ])(
    '倍率 %s 分の %s では、持ち越した端数を割合にし、どのフレームも倍率分進む',
    (parts, rateParts, blends) => {
      // 描く位置は「進めた回数の合計 - 1 + 割合」。0.75 倍なら進める回数は 0・1・1・1 で、
      // 描く位置は -0.25・0.5・1.25・2 と、どのフレームも 0.75 ずつ進む。
      const scaler = new RateScaler(parts, rateParts);
      const got: number[] = [];
      const drawn: number[] = [];
      let taken = 0;
      for (let i = 0; i < 4; i += 1) {
        taken += scaler.take(1);
        got.push(scaler.blend);
        drawn.push(taken - 1 + scaler.blend);
        expect(scaler.blend).toBe(scaler.progress);
      }
      expect(got).toEqual(blends);
      expect(gaps(drawn)).toEqual([rateParts / parts, rateParts / parts, rateParts / parts]);
    },
  );

  it.each([1, 2, 3])('%s 倍（整数）では、混ぜずに最後に進めた刻みの値で描く', (rate) => {
    // 持ち越した端数が残っていても、割合は 1。
    const scaler = new RateScaler(2, 1);
    scaler.take(1);
    scaler.set(2 * rate);
    for (let i = 0; i < 3; i += 1) {
      scaler.take(1);
      expect(scaler.blend).toBe(1);
    }
    // 持ち越した端数は残っている（倍率を替えても時間を捨てない）。
    expect(scaler.progress).toBe(0.5);
  });

  it('take を呼ぶ前は、混ぜず、端数も 0', () => {
    const scaler = new RateScaler(2, 1);
    expect([scaler.blend, scaler.progress]).toEqual([1, 0]);
  });

  it('倍率を替えても、混ぜる割合は次の take まで変わらない', () => {
    // 止めている間に倍率を替えると、止まった絵が動いた不具合の再現。止めている間は take を呼ばない。
    // 割合をその場の倍率から決めると、等倍で止めたまま 1.25 倍へ替えた瞬間に、割合が 1 から 0 へ
    // 替わり、止まっている絵が1刻み分戻って見える。
    const scaler = new RateScaler(4, 4);
    scaler.take(1);
    scaler.set(5);
    expect(scaler.blend).toBe(1);
    scaler.set(2);
    expect(scaler.blend).toBe(1);
    scaler.take(1);
    expect(scaler.blend).toBe(0.5);
    scaler.set(8);
    expect(scaler.blend).toBe(0.5);
    scaler.take(1);
    expect(scaler.blend).toBe(1);
  });

  it('整数から整数でない倍率へ替えたフレームだけは、倍率分より少なく進む', () => {
    // クラスの説明に書いた、既知の外れ。等倍から 1.25 倍へ替えたフレームは 0.25 だけ進む。
    // 次のフレームからは 1.25 ずつに戻る。
    const scaler = new RateScaler(4, 4);
    let taken = scaler.take(1);
    const drawn = [taken - 1 + scaler.blend];
    scaler.set(5);
    for (let i = 0; i < 3; i += 1) {
      taken += scaler.take(1);
      drawn.push(taken - 1 + scaler.blend);
    }
    expect(gaps(drawn)).toEqual([0.25, 1.25, 1.25]);
  });
});

describe('止める値', () => {
  it.each([0, -1, 1.5, NaN])('倍率の分子 %s は受けず、前の倍率のまま', (rateParts) => {
    // 止めるときは take を呼ばない。0 を受けると、止めたつもりで take を呼ぶたびに、割合が 1 に戻る。
    expect(() => new RateScaler(2, rateParts)).toThrow('倍率の分子');
    const scaler = new RateScaler(2, 3);
    expect(() => scaler.set(rateParts)).toThrow('倍率の分子');
    expect(scaler.rateParts).toBe(3);
  });

  it.each([0, -1, 1.5, NaN])('倍率の分母 %s は受けない', (parts) => {
    expect(() => new RateScaler(parts, 1)).toThrow('倍率の分母');
  });

  it.each([-1, 1.5, NaN, Infinity])('刻みの数 %s は止まり、端数と割合は変えない', (steps) => {
    const scaler = new RateScaler(2, 1);
    scaler.take(1);
    expect(() => scaler.take(steps)).toThrow('刻みの数');
    expect([scaler.progress, scaler.blend]).toEqual([0.5, 0.5]);
  });

  it('端数と、刻みの数 × 分子の和が 2**53 - 1 を超えるなら、掛ける前に止まる', () => {
    // 境目の両側。0.75 倍で1回進めると、端数は 3（4 分の 3）。(2**53 - 1 - 3) を 3 で割った商
    // （切り捨て）までは、端数との和が安全な整数に収まる。端数の 3 は、2**53 - 1 を 3 で割った
    // 余り（1）より大きいので、比べる所で端数を差し引き忘れると、境目が1つ先にずれて止まらない。
    const limit = Math.floor((Number.MAX_SAFE_INTEGER - 3) / 3);
    const fits = new RateScaler(4, 3);
    fits.take(1);
    expect(() => fits.take(limit)).not.toThrow();
    const overflows = new RateScaler(4, 3);
    overflows.take(1);
    expect(() => overflows.take(limit + 1)).toThrow('持ち越した端数と、刻みの数 × 倍率の分子の和が、2**53 - 1 を超える');
    expect([overflows.progress, overflows.blend]).toEqual([0.75, 0.75]);
  });
});
