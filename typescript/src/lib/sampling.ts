/**
 * 毎回読む値の判定 — 揺れる値と、押している鍵の組を、決まった間隔で読んで判定する。
 *
 * 決まった間隔で読む値（読んだ瞬間の状態だけが分かり、変わったことの知らせは来ない値）から、
 * オンとオフや押し始めを取り出す部品を置く。
 *
 * - `Hysteresis`：揺れる値を、2つのしきい値でオンとオフに分ける。入るしきい値と切れるしきい値を
 *   分けるので、境目の近くで値が揺れても、オンとオフが入れ替わり続けない
 * - `dominantAxis`：縦と横の2つの値のうち、絶対値の大きいほうの軸の符号だけを残し、上下左右の
 *   どれか1つにする
 * - `EdgeDetector`：押している鍵の組を毎回受け取り、前回に無く今回にある鍵（押し始め）を返す。
 *   始まりの前から押していた鍵を、作るときに必ず受け取る
 * - `PressLatch`：押したことと離したことを1つずつ受け取り、読みと読みの間に押して離した鍵も、
 *   次に読み終えるまでは押していたことにする
 *
 * 押す・離すものは、それを見分ける値（鍵）で表す。鍵は文字列か数に限る。`Set` はオブジェクトの
 * 鍵を、中身でなく同じものかで比べるので、同じ中身でも別に作ったものは別の鍵になる。返す `Set` の
 * 順は約束しない（Python 版の `frozenset` は、文字列の鍵だと起動のたびに順が変わり、2つの言語で
 * 揃わない）。
 *
 * 鍵の組を受け取る所に文字列を1つ渡すと、文字ごとの鍵に分かれて黙って通るので、`TypeError` で
 * 止める。型検査は止めない（文字列も文字列の組として読める）。
 *
 * ES2022 の型には `Set` の差（`difference`。ES2025）が無いので、押し始めは繰り返しで求める。
 *
 * 固定値の表は持たず、約束は「同じ値から、起動のたびに同じ結果を出す」だけ。計算は大小の比べと
 * 集まりの差・和だけで書く。Python 版（`python/src/algorithms_and_patterns/lib/sampling.py`）も同じ形。
 */

/** 負・0・正の3つ。 */
export type Sign = -1 | 0 | 1;

/**
 * 揺れる値を、入るしきい値（`on`）と切れるしきい値（`off`）でオンとオフに分ける。
 *
 * 切れている間は `on` 以上で入り、入っている間は `off` 未満で切れる。`off` は `on` より小さいので、
 * `off` 以上 `on` 未満の値は、いまの状態を保つ。しきい値が1つだと、境目の近くで揺れる値は読むたびに
 * オンとオフが入れ替わる。
 *
 * 値はそのまま比べる。符号つきの値の大きさで判定したいときは、呼ぶ側が絶対値を渡す。
 */
export class Hysteresis {
  readonly #on: number;
  readonly #off: number;
  #active = false;

  /**
   * 2つのしきい値を受け取る。切れた状態で始まる。
   *
   * @param on 入るしきい値。有限の数
   * @param off 切れるしきい値。有限の数で、`on` より小さい
   * @throws RangeError しきい値が有限の数でないとき、`off` が `on` 以上のとき。`off` と `on` が
   *   等しいと、しきい値が1つと同じになる
   */
  constructor(on: number, off: number) {
    if (!(Number.isFinite(on) && Number.isFinite(off))) {
      throw new RangeError(`しきい値は有限の数にする: on=${on}, off=${off}`);
    }
    if (!(off < on)) {
      throw new RangeError(`切れるしきい値は入るしきい値より小さくする: on=${on}, off=${off}`);
    }
    this.#on = on;
    this.#off = off;
  }

  /** いま入っているか。 */
  get active(): boolean {
    return this.#active;
  }

  /**
   * 値を1つ読み、入っているかを返す。
   *
   * @throws RangeError 値が NaN のとき。NaN は比べるとどれも偽になり、いまの状態のまま止まって
   *   見える。止めたときは、状態を変えない
   */
  update(value: number): boolean {
    if (Number.isNaN(value)) throw new RangeError('値が NaN');
    if (this.#active) {
      if (value < this.#off) this.#active = false;
    } else if (value >= this.#on) {
      this.#active = true;
    }
    return this.#active;
  }

  /** 切れた状態に戻す。 */
  reset(): void {
    this.#active = false;
  }
}

/**
 * 縦と横の値のうち、絶対値の大きいほうの軸の符号だけを残す。
 *
 * 軸ごとにしきい値を当てると、片方の軸から少しずれた向きで、縦と横の両方がしきい値を超える
 * （縦横を合わせた長さが 1 の値をしきい値 0.5 で見ると、全周の3分の1の向き）。大きいほうの軸だけを
 * 残せば、いつも上下左右のどれか1つになる。
 *
 * - 絶対値が等しいときは横（`x`）を残す
 * - 0 と -0 の符号は 0（-0 は返さない）。両方 0 なら `[0, 0]`
 *
 * @param x 横の値
 * @param y 縦の値
 * @returns `[横の符号, 0]` か `[0, 縦の符号]`
 * @throws RangeError どちらかが NaN のとき。NaN は絶対値を比べると偽になり、黙って縦を残す
 */
export function dominantAxis(x: number, y: number): readonly [Sign, Sign] {
  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new RangeError(`軸の値が NaN: x=${x}, y=${y}`);
  }
  if (Math.abs(x) >= Math.abs(y)) return [sign(x), 0];
  return [0, sign(y)];
}

/**
 * 値の符号。0 と -0 は 0。
 *
 * `Math.sign` は使わない。-0 を渡すと -0 を返し、`Object.is` で比べる所では 0 と別の値になる。
 */
function sign(value: number): Sign {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

/**
 * 押している鍵の組を毎回受け取り、前回に無く今回にある鍵（押し始め）を返す。
 *
 * 前回の組は `update` だけが書き換える。読む場面が替わっても前回の組を消さない。消すと、押したままの
 * 鍵が新しい押し始めに見え、替わった先の場面でも押し始めとして読まれる。
 */
export class EdgeDetector<K extends string | number> {
  #previous: ReadonlySet<K>;

  /**
   * 始まりの前から押していた鍵を受け取る。省けない。
   *
   * 何も押していない組で始めると、押したまま始まった鍵が、最初の `update` で押し始めに見える。
   * 押しているかが分からないときは、押し始めだけを見たい鍵を全部渡す。押していなければ最初の
   * `update` で離した扱いになり、次からは押し始めを返す。
   *
   * @param heldAtStart 始まりの前から押していた鍵。写して持つ
   * @throws TypeError 鍵の組の代わりに文字列を1つ渡したとき
   */
  constructor(heldAtStart: Iterable<K>) {
    this.#previous = keySet(heldAtStart);
  }

  /**
   * いま押している鍵を受け取り、押し始めた鍵を返す。受け取った組を前回として控える。
   *
   * 1回の読みで1度だけ呼び、返した押し始めを、その回の処理の全部で使う。同じ回に2度呼ぶと、
   * 2度目は前回が今回と同じなので、押し始めを返さない。
   *
   * @throws TypeError 鍵の組の代わりに文字列を1つ渡したとき。止めたときは、前回の組を変えない
   */
  update(held: Iterable<K>): ReadonlySet<K> {
    const now = keySet(held);
    const started = new Set<K>();
    for (const key of now) if (!this.#previous.has(key)) started.add(key);
    this.#previous = now;
    return started;
  }

  /**
   * 全部を離したことにする。次の `update` では、押している鍵がすべて押し始めになる。
   *
   * 読む元が無くなったとき（つないでいた物が外れたとき）に呼ぶ。読む場面が替わっただけのときは
   * 呼ばない。
   */
  releaseAll(): void {
    this.#previous = new Set();
  }
}

/**
 * 鍵の組を `Set` にする。
 *
 * 文字列を1つ渡すと、文字ごとの鍵に分かれる（`'enter'` が `e`・`n`・`t`・`r` の4つの鍵になる）ので
 * 止める。
 */
function keySet<K extends string | number>(held: Iterable<K>): Set<K> {
  // Iterable<K> のまま typeof で比べると、型検査は文字列になりえないとみなして never に絞る。
  const given: unknown = held;
  if (typeof given === 'string') {
    throw new TypeError(`鍵の組の代わりに文字列が来た: '${given}'（組にして渡す）`);
  }
  return new Set(held);
}

/**
 * 押したことと離したことを1つずつ受け取り、短い押しも1回の読みぶん残す。
 *
 * 読む間隔より短く押して離すと、押していることだけを見る形では、押したこと自体が消える。そこで、
 * 前に読み終えてから押した鍵を印として別に覚え、離していても押していたことにする。印は `endStep` で
 * 忘れる。
 *
 * `endStep` は、読んだ値を使い終えた回だけに呼ぶ。読んだのに使わなかった回（進めなかった回）に呼ぶと、
 * その間の押しが使われないまま消える。止めている間は毎回呼ぶ。呼ばないと、止めている間に押して離した
 * 鍵が、再開した最初の回に押した鍵として読まれる。
 */
export class PressLatch<K extends string | number> {
  readonly #held = new Set<K>();
  readonly #marked = new Set<K>();

  /**
   * 鍵を押した。押したままの鍵にも印を付ける。
   *
   * 押したままの鍵を押したと受け取るのは、離したことが届かなかったあとに押し直したときなので、その
   * 押しも残す。押したままのときに届く繰り返し（押し続けると届く、押したことの知らせ）は渡さない。
   * 渡すと、`forgetAll` で忘れた鍵が、押し直さなくても押したことに戻る。
   */
  press(key: K): void {
    this.#held.add(key);
    this.#marked.add(key);
  }

  /** 鍵を離した。押していない鍵なら何もしない。印は残す。 */
  release(key: K): void {
    this.#held.delete(key);
  }

  /** 押している鍵と、前の `endStep` のあとに押した鍵。何度読んでも変わらない。 */
  read(): ReadonlySet<K> {
    return new Set([...this.#held, ...this.#marked]);
  }

  /** 読んだ値を使い終えた。印を忘れる。押したままの鍵は残す。 */
  endStep(): void {
    this.#marked.clear();
  }

  /**
   * 押している鍵も印も全部忘れる。
   *
   * 離したことが届かなくなるとき（読む元から切り離されたとき）に呼ぶ。忘れないと、押したまま
   * 切り離された鍵が、離したあとも押している鍵として読まれ続ける。
   */
  forgetAll(): void {
    this.#held.clear();
    this.#marked.clear();
  }
}
