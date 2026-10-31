/**
 * 固定刻みの時間 — 揺れる実時間を、長さの決まった刻みを何回進めるかに換える。
 *
 * 1回進めるたびに経過時間を渡す形にすると、1回に進む量が機械の速さやフレームの揺れで変わり、
 * 同じ操作から違う結果が出る。ここでは、1回呼ぶと1刻み進む処理には経過時間を渡さず、
 * 実時間を「いま何刻み進めるか」に換える所を1か所にする。
 *
 * - `StepAccumulator`：経過時間を刻みの数に換える。1刻みに満たない端数は次へ持ち越し、
 *   遅れすぎた分は捨てる
 * - `RateScaler`：倍率を、刻みを進める回数に換える。刻みの長さは変えない
 *
 * Python 版（`python/src/algorithms_and_patterns/lib/fixed_step.py`）と同じ約束で、Python 版に
 * ある待つ部品（締め切りまで眠る関数と、フレームの輪）は置いていない。ブラウザでは描く時刻を
 * ブラウザが決め（requestAnimationFrame）、このリポジトリの型の設定（ES2022 だけ）には時計
 * （performance.now）も待つ関数（setTimeout）も無いため。
 *
 * 経過時間はナノ秒の整数で受ける。performance.now() はミリ秒の小数なので、呼ぶ側は時刻を
 * 先にナノ秒の整数に換えてから差を取る。差を取ってから換えると、換えるときの切り捨ての誤差が
 * フレームごとに積もる。
 *
 * 計算は、整数の足し算・掛け算と、余り（`%`）を使った切り捨て・切り上げの割り算で書く。
 * どの値も安全な整数（絶対値が 2**53 未満の整数）の中に収め、収まらない掛け算はしない。
 * `Math.round` は使わない。小数になるのは、整数どうしを割って返す `progress` と `blend` だけ。
 */

import { checkAtLeast } from './safe-integer.js';

/** 1秒のナノ秒の数。 */
export const NS_PER_SECOND = 1_000_000_000;

/**
 * 1回の `consume` で返す刻みの数の上限に置ける、最も大きな値。
 *
 * (上限 + 1) × NS_PER_SECOND が 2**53 - 1 以下に収まる最も大きな値。`consume` は、上限を
 * 超えるかの比べをこの範囲の整数で行う。
 */
const MAX_STEPS_LIMIT = 9_007_198;

/**
 * 経過時間を、進める刻みの数に換える。1刻みに満たない端数は次へ持ち越す。
 *
 * 端数は整数で持つ。経過時間をナノ秒の整数で受け取り、「ナノ秒 × 1秒あたりの刻みの数」の
 * 単位で積む。この単位では1刻みがちょうど 10 億（1秒のナノ秒の数）になり、割った余りが
 * 正確に残るので、何時間続けても1秒あたりの刻みの数はずれない。ミリ秒の小数で積むと、
 * 端数がちょうど刻みの境目に届いた回を、わずかに手前と数えることがある。
 */
export class StepAccumulator {
  readonly #stepsPerSecond: number;
  readonly #maxSteps: number;
  /** 持ち越した端数。「ナノ秒 × 1秒あたりの刻みの数」の単位で、0 以上 NS_PER_SECOND 未満。 */
  #carry = 0;

  /**
   * 1秒あたりの刻みの数と、1回に返す刻みの数の上限を決めて作る。
   *
   * @param stepsPerSecond 1秒あたりの刻みの数。1 以上の安全な整数
   * @param maxSteps 1回の `consume` で返す刻みの数の上限。1 以上 9_007_198 以下の整数。
   *   機械がスリープから戻ったときなど、前の呼び出しから数秒たつことがある。その分を全部
   *   まとめて進めると、進め終わらないうちに次の刻みの時刻が来て、遅れが積み上がる
   * @throws RangeError どちらかが範囲の外か、整数でないとき
   */
  constructor(stepsPerSecond: number, maxSteps: number) {
    checkAtLeast('1秒あたりの刻みの数', stepsPerSecond, 1);
    checkAtLeast('刻みの数の上限', maxSteps, 1);
    if (maxSteps > MAX_STEPS_LIMIT) {
      throw new RangeError(`刻みの数の上限は 9_007_198 以下にする: ${maxSteps}`);
    }
    this.#stepsPerSecond = stepsPerSecond;
    this.#maxSteps = maxSteps;
  }

  /**
   * 経過時間（ナノ秒）を渡し、進める刻みの数を受け取る。
   *
   * 上限ちょうどまでは、端数を残して返す。上限を超えたら上限を返し、端数も捨てる。
   * 持ち越すと、次の呼び出しもまた上限まで進み、遅れが積み上がる。
   *
   * @throws RangeError `elapsedNs` が 0 以上の安全な整数でないとき。負なら呼ぶ側の誤り
   *   （測る順の取り違えなど）で、0 に丸めると気づけない。小数や 2**53 以上の数は、
   *   ナノ秒の整数に換え損ねたか、受け取った時点ですでに丸められているかもしれない
   */
  consume(elapsedNs: number): number {
    checkAtLeast('経過時間', elapsedNs, 0);
    // 上限を超える経過時間のうち、最も短いもの（切り上げ）。これ以上なら、掛け算をせずに捨てる。
    // 経過時間 × 1秒あたりの刻みの数は、2**53 を超えて丸められることがある。
    const room = (this.#maxSteps + 1) * NS_PER_SECOND - this.#carry;
    if (elapsedNs >= ceilDiv(room, this.#stepsPerSecond)) {
      this.#carry = 0;
      return this.#maxSteps;
    }
    // ここでは 経過時間 × 1秒あたりの刻みの数 < room なので、和は
    // (上限 + 1) × NS_PER_SECOND 未満で、丸められない。
    const total = this.#carry + elapsedNs * this.#stepsPerSecond;
    this.#carry = total % NS_PER_SECOND;
    return (total - this.#carry) / NS_PER_SECOND;
  }

  /**
   * 次の刻みの時刻まで、あと何ナノ秒か（1 以上）。
   *
   * 端数は切り上げる。この時刻に目を覚ませば、必ず1刻み分が積み上がっている。切り捨てると、
   * ちょうどに目を覚ましても1刻みにわずかに足りず、0刻みのフレームになる。そのあと次の刻みまでの
   * 時間が 0 になり、待たずに回る（時計が進まなければ、0刻みのフレームが続く）。
   */
  nsToNextStep(): number {
    return ceilDiv(NS_PER_SECOND - this.#carry, this.#stepsPerSecond);
  }
}

/**
 * 倍率を、そのフレームで刻みを進める回数に換える。端数は次へ持ち越す。
 *
 * 実時間で `steps` 刻み分が経ったフレームに `take(steps)` を呼ぶと、倍率を掛けた回数の
 * 整数の部分を返す。1刻みの長さは変えない。倍速を「1刻みに渡す経過時間を伸ばす」形で書くと、
 * 倍率で1刻みの中身が変わり、同じ操作から違う結果が出る。
 *
 * 倍率は分数で、分母（`parts`）を作るときに決め、分子（`rateParts`）を整数で持つ。0.5 倍なら
 * 2フレームに1回、1.5 倍なら1回と2回を交互に返す。端数も 1 / parts を単位にした整数で持つので、
 * 何時間続けても倍率どおりの回数からずれない。止めるときは `take` を呼ばない（倍率 0 は受けない）。
 *
 * `blend` は、描く値を1つ前の刻みの値と混ぜる割合。整数でない倍率では、1フレームに進む刻みの
 * 数が揃わない（0.5 倍は 0 と 1）ので、進めた刻みの値をそのまま描くとコマ送りに見える。
 * 1つ前の刻みの値に、持ち越した端数の割合だけ寄せて描くと、どのフレームも倍率分ずつ進む
 * （そのかわり、描く位置はいつも1刻み遅れる）。割合は `take` のときに決めて控え、`set` では
 * 替えない。止めている間（`take` を呼ばない間）に倍率を替えても、止まっている絵が動かない。
 *
 * ただし、整数と整数でない倍率の間で替えたフレームだけは、1フレームの進みが倍率分から外れる
 * （最大1刻み）。混ぜる割合が、混ぜない（1）と端数の割合の間で替わるため。整数でない倍率
 * どうしなら外れない。
 */
export class RateScaler {
  readonly #parts: number;
  #rateParts: number;
  /** 持ち越した端数。1 / parts を単位にした整数で、0 以上 parts 未満。 */
  #carry = 0;
  #blend = 1;

  /**
   * 倍率を決めて作る。倍率は `rateParts / parts`（`new RateScaler(4, 6)` なら 1.5 倍）。
   *
   * @param parts 倍率の分母。1 以上の安全な整数。作ったあとは替えられないので、使う倍率が
   *   どれも整数の分子で表せる値にする（0.5 倍と 1/3 倍を使うなら 6）
   * @param rateParts 倍率の分子。1 以上の安全な整数
   * @throws RangeError どちらかが 1 以上の安全な整数でないとき
   */
  constructor(parts: number, rateParts: number) {
    checkAtLeast('倍率の分母', parts, 1);
    checkAtLeast('倍率の分子', rateParts, 1);
    this.#parts = parts;
    this.#rateParts = rateParts;
  }

  /** いまの倍率の分子。倍率は、これを作るときに決めた分母で割った値。 */
  get rateParts(): number {
    return this.#rateParts;
  }

  /**
   * 倍率の分子を替える。持ち越した端数は残す（替えても、時間を捨てない）。
   *
   * 混ぜる割合（`blend`）は、次の `take` まで替えない。
   *
   * @throws RangeError `rateParts` が 1 以上の安全な整数でないとき。倍率は前のまま残る
   */
  set(rateParts: number): void {
    checkAtLeast('倍率の分子', rateParts, 1);
    this.#rateParts = rateParts;
  }

  /**
   * 実時間で `steps` 刻み分が経ったフレームに、刻みを進める回数を返す。
   *
   * 描く値を混ぜる割合（`blend`）も、ここでいまの倍率と端数から決めて控える。
   *
   * @throws RangeError `steps` が 0 以上の安全な整数でないとき、または、持ち越した端数と
   *   `steps` × 分子の和が 2**53 - 1 を超えるとき。どちらも端数と割合を変えない
   */
  take(steps: number): number {
    checkAtLeast('刻みの数', steps, 0);
    // 掛ける前に、和が安全な整数に収まるかを比べる。掛けてから比べると、丸められた値で比べる。
    if (steps > floorDiv(Number.MAX_SAFE_INTEGER - this.#carry, this.#rateParts)) {
      throw new RangeError(`持ち越した端数と、刻みの数 × 倍率の分子の和が、2**53 - 1 を超える: ${steps}`);
    }
    const total = this.#carry + steps * this.#rateParts;
    this.#carry = total % this.#parts;
    this.#blend = this.#rateParts % this.#parts === 0 ? 1 : this.progress;
    return (total - this.#carry) / this.#parts;
  }

  /** 持ち越した端数（0 以上 1 未満）。最後に進めた刻みから、次の刻みまでの進み具合。 */
  get progress(): number {
    return this.#carry / this.#parts;
  }

  /**
   * 描く値を、1つ前の刻みの値と混ぜる割合（0 以上 1 以下）。
   *
   * 0 なら1つ前の刻みの値、1 なら最後に進めた刻みの値で描く。最後に `take` を呼んだときの
   * 倍率が整数なら 1（混ぜない）。整数でなければ、そのときの `progress`。まだ `take` を
   * 呼んでいなければ 1。
   */
  get blend(): number {
    return this.#blend;
  }
}

/** 0 以上の安全な整数 `a` を、1 以上の安全な整数 `b` で割った商の切り捨て。余りで求める。 */
function floorDiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

/** 0 以上の安全な整数 `a` を、1 以上の安全な整数 `b` で割った商の切り上げ。余りで求める。 */
function ceilDiv(a: number, b: number): number {
  return a % b === 0 ? floorDiv(a, b) : floorDiv(a, b) + 1;
}
