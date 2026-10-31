/**
 * 決定的な擬似乱数 — 種を1つ与えれば、言語と版をまたいで同じ並びが出る。
 *
 * アルゴリズムは mulberry32。状態は 32 ビットの整数1つで、周期は 2**32。
 * Python 版（`python/src/algorithms_and_patterns/lib/rng.py`）は、同じ種から同じ値を出す。
 * そのことは Python のテスト（`tests/lib/test_cross_language.py`）が、このリポジトリの
 * TypeScript のテストの表を読んで検証している。
 *
 * 標準の `Math.random` を使わないのは、種を渡せず、同じ並びを2度出せないため。
 *
 * `random`・`below`・`between`・`chance`・`choice` は、1回呼ぶと乱数を必ず1回だけ生成する。
 * `shuffled` は要素の数 - 1 回で、0 個と 1 個なら生成しない。`clone` と `deriveSeed` は生成しない。
 * 生成する回数が引数や結果で変わると、同じ種でもそれ以降の並びが全部ずれる。そのため
 * `chance(0)` と `chance(1)` も、答えが決まっていても1回生成する。範囲の外の引数で
 * 止まるときは、生成する前に止まる。
 *
 * 暗号用途には使えない。ここで約束するのは「同じ種から同じ並びが出ること」で、
 * 先を読まれないことではない。
 */

import { checkInteger } from './safe-integer.js';

/** 状態を1回ごとに進める幅（mulberry32 の定数）。 */
const INCREMENT = 0x6d2b79f5;
/** 2 の 32 乗。32 ビットの整数を、0 以上 1 未満の小数に変換するときに割る数。 */
const SPAN = 4294967296;
/** 種から種を導くときに、番号を散らす数。2**32 を黄金比で割った値に近い奇数。 */
const SPREAD = 0x9e3779b1;
/** `deriveSeed` が受ける番号の数（0 以上この値未満）。 */
const STREAMS = SPAN - 1;

/** 決定的な擬似乱数（mulberry32）。生成した回数を数える。 */
export class Rng {
  /** 内部状態。0 以上 2**32 未満の整数。 */
  #state: number;
  /** 生成した回数。 */
  #calls = 0;

  /**
   * 種から乱数を作る。
   *
   * @param seed 種。負の数や 2**32 以上の数は、下位 32 ビットだけを使う（Python 版と同じ）
   * @throws RangeError `seed` が安全な整数（絶対値が 2**53 未満の整数）でないとき。
   *   小数・NaN・無限大は、`>>> 0` に通すと黙って別の整数になり、気づけない。
   *   2**53 以上の数は、受け取った時点ですでに丸められているかもしれない
   */
  constructor(seed: number) {
    checkInteger('種', seed);
    this.#state = seed >>> 0;
  }

  /**
   * この乱数が生成した回数。
   *
   * 2つの実行の結果がずれたとき、状態だけを比べても「どこかでずれた」までしか分からない。
   * 生成した回数も比べると、「どちらかが余計に生成した／生成しなかった」まで絞れる。
   */
  get calls(): number {
    return this.#calls;
  }

  /** 内部状態（0 以上 2**32 未満）。同じ状態からは同じ並びが出る。 */
  get state(): number {
    return this.#state;
  }

  /** 0 以上 1 未満の小数を返す。 */
  random(): number {
    this.#calls += 1;
    this.#state = (this.#state + INCREMENT) >>> 0;
    let t = this.#state;
    // Math.imul は掛け算の下位 32 ビットを返す。`*` で掛けると 2**53 を超えて丸められる。
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / SPAN;
  }

  /**
   * 0 以上 `limit` 未満の整数を返す。
   *
   * 生成した小数に `limit` を掛けて切り捨てる。`limit` が 2 の累乗でなければ、出やすさは
   * わずかに偏る（生成する小数は 2**32 通りしかない）。
   *
   * @throws RangeError `limit` が 1 以上の安全な整数（2**53 - 1 以下）でないとき。
   *   0 を渡して 0 が返ると、「選べるものが無い」ことに気づけない
   */
  below(limit: number): number {
    checkInteger('上限', limit);
    if (limit < 1) {
      throw new RangeError(`上限は 1 以上にする: ${limit}`);
    }
    return Math.floor(this.random() * limit);
  }

  /**
   * `start` 以上 `stop` 未満の整数を返す。
   *
   * @throws RangeError `start` か `stop` が安全な整数でないとき、`stop` が `start` 以下のとき、
   *   または範囲の幅（`stop - start`）が 2**53 - 1 を超えるとき
   */
  between(start: number, stop: number): number {
    checkInteger('start', start);
    checkInteger('stop', stop);
    if (stop <= start) {
      throw new RangeError(`stop は start より大きくする: start=${start}, stop=${stop}`);
    }
    // 幅は below の上限になる。below に任せると、渡していない「上限」の値を出して止まる。
    // 両端が安全な整数なら、幅が 2**53 - 1 以下のときは引き算が正確で、それを超えると
    // 2**53 以上に丸められるので、この比べ方で足りる。
    if (stop - start > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(
        `範囲の幅（stop - start）は 2**53 - 1 以下にする: start=${start}, stop=${stop}`,
      );
    }
    return start + this.below(stop - start);
  }

  /**
   * 確率 `probability`（0 以上 1 以下）で true を返す。0 と 1 でも乱数を1回生成する。
   *
   * @throws RangeError `probability` が 0 以上 1 以下でないとき（NaN を含む）。
   *   百分率（50 など）と取り違えると、黙って「必ず当たる」になる
   */
  chance(probability: number): boolean {
    // `probability < 0 || probability > 1` と書くと、NaN がどちらも偽になって通る。
    if (!(probability >= 0 && probability <= 1)) {
      throw new RangeError(`確率は 0 以上 1 以下にする: ${probability}`);
    }
    return this.random() < probability;
  }

  /**
   * 列から1つ選ぶ。
   *
   * @throws RangeError 空の列を渡したとき。「空なら undefined を返す」形にすると、
   *   それを扱う分岐が呼び出し側すべてに増えるので、空でないことを呼び出し側が確認してから渡す
   */
  choice<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('空の列からは選べない');
    }
    // 添字は below が length 未満を約束するので、列の中にある。
    return items[this.below(items.length)] as T;
  }

  /**
   * 順を入れ替えた新しい配列を返す（Fisher–Yates）。渡した列は書き換えない。
   *
   * 乱数を要素の数 - 1 回生成する（最後の1つは選ぶ余地が無い）。0 個と 1 個なら生成しない。
   *
   * `sort(() => rng.random() - 0.5)` で混ぜない。比べた結果が矛盾し、並びが
   * 並べ替えの実装に左右される。
   */
  shuffled<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = this.below(i + 1);
      // i も j も 0 以上 length 未満なので、どちらも列の中にある。
      const picked = result[j] as T;
      result[j] = result[i] as T;
      result[i] = picked;
    }
    return result;
  }

  /**
   * いまの状態を引き継いだ、別の乱数を作る。
   *
   * 「この先どうなるか」を試算するのに使う。元の乱数は進まない。生成した回数は 0 から数え直す。
   */
  clone(): Rng {
    return new Rng(this.#state);
  }
}

/**
 * 種と番号から、別の並びのための種を導く。
 *
 * 用途ごとに乱数を分けるのに使う。1つの乱数を用途の違う処理で共有すると、片方が生成する
 * 回数を変えただけで、もう片方の並びも変わる。種を1つ決めれば、どの用途の並びも再現できる。
 *
 * 番号に 1 を足してから散らすので、どの番号でも元の種と違う種になる。散らす数は奇数で、
 * 奇数を掛けて下位 32 ビットを取ると、違う値は必ず違う値に移る。そのため番号が違えば
 * 違う種になる。導いた種どうしの並びに相関が無いかは測っていない。
 *
 * @param seed 元の種。下位 32 ビットだけを使う
 * @param stream 番号。0 以上 2**32 - 1 未満の整数
 * @throws RangeError `seed` が安全な整数でないとき、または `stream` が範囲の外のとき。
 *   2**32 - 1 は、1 を足すと下位 32 ビットが 0 になり、元の種がそのまま返る
 */
export function deriveSeed(seed: number, stream: number): number {
  checkInteger('種', seed);
  checkInteger('番号', stream);
  if (stream < 0 || stream >= STREAMS) {
    throw new RangeError(`番号は 0 以上 2**32 - 1 未満にする: ${stream}`);
  }
  return (seed ^ Math.imul(stream + 1, SPREAD)) >>> 0;
}
