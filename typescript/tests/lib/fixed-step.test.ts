import { describe, expect, it } from 'vitest';
import { NS_PER_SECOND, StepAccumulator } from '../../src/lib/fixed-step.js';

/*
 * src/lib/fixed-step.ts のうち、経過時間を刻みの数に換える部品（StepAccumulator）のテスト。
 * 倍率（RateScaler）は fixed-step-rate.test.ts が見る。変わる理由が違うので、ファイルを分けた。
 */

/** 1秒あたりの刻みの数と、1回に返す刻みの数の上限。 */
const SPS = 60;
const MAX = 15;
/** 1刻みの長さ（ナノ秒）を切り捨てたもの。本当の長さは 16_666_666.66… ナノ秒。 */
const STEP_NS = Math.floor(NS_PER_SECOND / SPS);
/** 1刻みの長さを切り上げたもの。この長さだけ経てば、必ず1刻み積み上がる。 */
const STEP_CEIL_NS = STEP_NS + 1;

/** 1秒に 60 刻み、1回の上限 15 刻みの StepAccumulator。 */
function accumulator(): StepAccumulator {
  return new StepAccumulator(SPS, MAX);
}

/** 経過時間を順に渡し、返った刻みの数を並べる。 */
function consumeAll(subject: StepAccumulator, elapsed: readonly number[]): number[] {
  return elapsed.map((ns) => subject.consume(ns));
}

/** 数の並びの合計。 */
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('経過時間を刻みの数に換える', () => {
  it('1刻み分経てば1刻み進み、わずかでも足りなければ進まない', () => {
    expect(accumulator().consume(STEP_CEIL_NS)).toBe(1);
    // 切り捨てた長さは、1刻みに 0.66 ナノ秒足りない。
    expect(accumulator().consume(STEP_NS)).toBe(0);
  });

  it('経過が 0 なら進まず、端数も変わらない', () => {
    const subject = accumulator();
    expect(subject.consume(0)).toBe(0);
    expect(subject.nsToNextStep()).toBe(STEP_CEIL_NS);
  });

  it('端数を持ち越すので、揺れながらでも1秒でちょうど 60 刻み進む', () => {
    // 16 ms・17 ms・17 ms で、3回あたりちょうど3刻み（50 ms）。1回ごとの数は 0・1・2 と揺れる。
    // 端数を持ち越さずに捨てると、3回で2刻みになる。
    const elapsed = Array.from({ length: 20 }, () => [16_000_000, 17_000_000, 17_000_000]).flat();
    const steps = consumeAll(accumulator(), elapsed);
    expect(sum(elapsed)).toBe(NS_PER_SECOND);
    expect(sum(steps)).toBe(SPS);
    expect(new Set(steps)).toEqual(new Set([0, 1, 2]));
  });

  it('何時間続けても、合計は経過時間から割り算で出した値と同じ', () => {
    // 16_666_666・16_666_667・16_666_667 ナノ秒（3回で 50 ms）を3時間分渡す。積んだ端数が、刻みの
    // 境目にちょうど届く回が何度も来る。ミリ秒の小数で積む形では、境目に届いた回をわずかに手前と
    // 数えることがあり、合計が足りなくなる。
    const subject = accumulator();
    const calls = 3 * 60 * 60 * 60;
    let total = 0;
    let elapsedTotal = 0;
    for (let i = 0; i < calls; i += 1) {
      const elapsed = i % 3 === 0 ? 16_666_666 : 16_666_667;
      total += subject.consume(elapsed);
      elapsedTotal += elapsed;
    }
    // 経過の合計（約 1.08e13）× 60 は安全な整数に収まる。
    expect(total).toBe(Math.floor((elapsedTotal * SPS) / NS_PER_SECOND));
    expect(total).toBe(calls);
  });

  it.each([0, 1, 5_000_000, STEP_NS - 1, STEP_NS])(
    '端数が %s ナノ秒分のとき、次の刻みの時刻にちょうど目を覚ませば1刻み進む',
    (carried) => {
      // 待つ時刻を切り捨てていると、ちょうどに覚めても1刻みに届かない。
      const subject = accumulator();
      expect(subject.consume(carried)).toBe(0);
      expect(subject.consume(subject.nsToNextStep())).toBe(1);
    },
  );

  it('1刻みに足りずに覚めて0刻みになっても、次の刻みまでの時間は 0 にならない', () => {
    // 次の刻みまでの時間を切り上げる理由。切り捨てると、ここで 0 になり、呼ぶ側は待たずに回る
    // （時計が進まなければ、0刻みのフレームが続く）。
    const subject = accumulator();
    expect(subject.consume(STEP_NS)).toBe(0);
    expect(subject.nsToNextStep()).toBe(1);
    expect(subject.consume(1)).toBe(1);
  });

  it('始めからの境目の時刻を切り捨てて覚めると、0刻みと2刻みのフレームが混じる（別の決め方との対照）', () => {
    // 次に覚める時刻を、持ち越した端数からでなく、始めからの境目の時刻を切り捨てて決める形との対照。
    // 切り捨てた時刻（16_666_666・33_333_333・50_000_000 …）に覚めると、境目のわずかに手前で覚める
    // 回と、次の境目を越えて覚める回が出る。切り上げた時刻（遅れなく覚めたときの nsToNextStep の
    // 時刻と同じ）なら、どの回も1刻み。
    const floors = Array.from({ length: 7 }, (_, k) => Math.floor((k * NS_PER_SECOND) / SPS));
    const ceils = Array.from({ length: 7 }, (_, k) => Math.ceil((k * NS_PER_SECOND) / SPS));
    const gaps = (times: number[]): number[] => times.slice(1).map((time, i) => time - (times[i] as number));
    expect(consumeAll(accumulator(), gaps(floors))).toEqual([0, 1, 2, 0, 1, 2]);
    expect(consumeAll(accumulator(), gaps(ceils))).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('次の刻みの時刻は、持ち越した端数の分だけ近い', () => {
    const subject = accumulator();
    expect(subject.nsToNextStep()).toBe(STEP_CEIL_NS);
    subject.consume(5_000_000);
    expect(subject.nsToNextStep()).toBe(STEP_CEIL_NS - 5_000_000);
  });

  it('1秒あたりの刻みの数が 10 億より多くても、次の刻みまでは1ナノ秒', () => {
    // 1ナノ秒で2刻み進む。次の刻みまでの時間を 0 にすると、待たずに回り続ける。
    const subject = new StepAccumulator(2 * NS_PER_SECOND, MAX);
    expect(subject.nsToNextStep()).toBe(1);
    expect(subject.consume(1)).toBe(2);
    expect(subject.nsToNextStep()).toBe(1);
  });
});

describe('上限', () => {
  it('上限ちょうどまでは、端数を残して上限を返す', () => {
    const subject = accumulator();
    expect(subject.consume(MAX * STEP_CEIL_NS + Math.floor(STEP_NS / 2))).toBe(MAX);
    // 捨てていないので、端数（半刻み分）が残っている。
    expect(subject.nsToNextStep()).toBeLessThan(STEP_CEIL_NS);
  });

  it('上限より1刻み多い分にちょうど届いたら、上限を返し、端数も捨てる', () => {
    // 境目の両側。1秒に 1000 刻み（1刻みがちょうど 1 ms）、上限 3 刻みで見る。
    // 掛ける前に比べる所の、境目を含むか含まないか（>= と >）の取り違えもここで分かる。
    const kept = new StepAccumulator(1000, 3);
    expect(kept.consume(4_000_000 - 1)).toBe(3);
    expect(kept.nsToNextStep()).toBe(1);
    const dropped = new StepAccumulator(1000, 3);
    expect(dropped.consume(4_000_000)).toBe(3);
    expect(dropped.nsToNextStep()).toBe(1_000_000);
  });

  it('端数が残っているときも、上限より1刻み多い分の境目で捨てる', () => {
    // 1秒に 1000 刻み、上限 3。0.5 刻み分を持ち越してから、合わせて 4 刻みにちょうど届く経過時間。
    // 比べる所で、持ち越した端数を差し引き忘れると、上限より多い 4 を返す。
    const kept = new StepAccumulator(1000, 3);
    kept.consume(500_000);
    expect(kept.consume(3_500_000 - 1)).toBe(3);
    expect(kept.nsToNextStep()).toBe(1);
    const dropped = new StepAccumulator(1000, 3);
    dropped.consume(500_000);
    expect(dropped.consume(3_500_000)).toBe(3);
    expect(dropped.nsToNextStep()).toBe(1_000_000);
  });

  it('割り切れない刻みの数でも、上限の境目の両側を取り違えない', () => {
    // 1秒に 60 刻み、上限 15。16 × 10 億 ÷ 60 = 266_666_666.66… で、境目は切り上げた 266_666_667。
    // 比べる所で切り捨てると、上限ちょうどまでの 266_666_666 でも端数を捨てる。
    const kept = new StepAccumulator(60, 15);
    expect(kept.consume(266_666_666)).toBe(15);
    expect(kept.nsToNextStep()).toBe(1);
    const dropped = new StepAccumulator(60, 15);
    expect(dropped.consume(266_666_667)).toBe(15);
    expect(dropped.nsToNextStep()).toBe(STEP_CEIL_NS);
  });

  it('上限を超えた分は捨てて、次へ持ち越さない', () => {
    // 持ち越すと、次の呼び出しもまた上限まで進み、遅れが積み上がる。前から持ち越していた端数も捨てる。
    const subject = accumulator();
    subject.consume(5_000_000);
    expect(subject.consume(10 * NS_PER_SECOND)).toBe(MAX);
    expect(subject.nsToNextStep()).toBe(STEP_CEIL_NS);
    expect(subject.consume(0)).toBe(0);
  });

  it('掛けると 2**53 を超える経過時間でも、上限を返す', () => {
    // 2**53 - 1 ナノ秒 × 60 は安全な整数を超える。掛けてから割ると、丸められた数で数える。
    const subject = accumulator();
    expect(subject.consume(Number.MAX_SAFE_INTEGER)).toBe(MAX);
    expect(subject.nsToNextStep()).toBe(STEP_CEIL_NS);
  });

  it('上限が受ける最大（9_007_198）でも、割り算が正確', () => {
    // 端数との和は 9_007_198_999_999_000 で、2**53 に近い。
    const subject = new StepAccumulator(1000, 9_007_198);
    expect(subject.consume(9_007_198_999_999)).toBe(9_007_198);
    expect(subject.nsToNextStep()).toBe(1);
    expect(new StepAccumulator(1000, 9_007_198).consume(9_007_199_000_000)).toBe(9_007_198);
  });
});

describe('止める値', () => {
  it.each([-1, 1.5, NaN, Infinity, 2 ** 53])('経過時間 %s は止まり、端数は変えない', (elapsed) => {
    // 負なら呼ぶ側の誤り。小数と 2**53 以上は、ナノ秒の整数に換え損ねたか、すでに丸められている。
    const subject = accumulator();
    subject.consume(5_000_000);
    expect(() => subject.consume(elapsed)).toThrow(RangeError);
    expect(subject.nsToNextStep()).toBe(STEP_CEIL_NS - 5_000_000);
  });

  it.each([0, -1, 1.5, NaN])('1秒あたりの刻みの数が %s なら止まる', (stepsPerSecond) => {
    // 0 だと、次の刻みまでの時間を求める割り算で、0 で割る。
    expect(() => new StepAccumulator(stepsPerSecond, MAX)).toThrow('1秒あたりの刻みの数');
  });

  it.each([0, -1, 1.5, 9_007_199])('上限が %s なら止まる', (maxSteps) => {
    // 0 だと、どれだけ経っても1刻みも進まない。9_007_199 だと、(上限 + 1) × 10 億が 2**53 - 1 を超える。
    expect(() => new StepAccumulator(SPS, maxSteps)).toThrow('刻みの数の上限');
  });

  it('どちらも 1 なら作れる', () => {
    // 上の境目の内側。
    const subject = new StepAccumulator(1, 1);
    expect(subject.nsToNextStep()).toBe(NS_PER_SECOND);
    expect(subject.consume(NS_PER_SECOND)).toBe(1);
  });
});
