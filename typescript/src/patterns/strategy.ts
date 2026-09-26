/**
 * Strategy — 同じ問いへの答え方を差し替えられるようにし、名前で引けるように並べる。
 *
 * 答え方（戦略）を1つずつ値として作り、登録表（`Registry`）に名前をつけて登録する。
 * 使う側は名前で引くだけで、どんな答え方があるかを知らない。
 *
 * 答え方を1つ足すときに触るのは、その答え方の定義と、登録の1行だけ。
 * 使う側にも、既存の答え方にも手を入れない。
 *
 * ⚠️ 交換しているもの：どんな答え方があるかが、型の上に現れない。名前を書き間違えても
 * 型検査は通り、引いたときに初めて分かる。取りうる種類を型で閉じて（union）、書き忘れを
 * 型検査に見つけさせる形（`state.ts`）とは、ちょうど逆の性質になる。
 *
 * 登録は、登録を集める1か所で明示的に呼ぶ。答え方を定義したファイルを読み込んだときに
 * 自動で登録される作り（import の副作用）にすると、どのファイルが読み込まれたかで
 * 登録の有無が変わり、読み込み方によって動いたり動かなかったりする。
 */

/**
 * 名前から答え方を引く登録表。
 *
 * 登録表は値として作る。1つの大域の表にすると、表ごとの中身を分けられず、
 * テストの間でも登録が残る。
 */
export class Registry<T> {
  /** 登録するものの呼び名。見つからないときの知らせに使う（例：「整形の方法」）。 */
  readonly name: string;
  // Map は登録した順を保つ。名前の一覧をその順で返せる。
  readonly #entries = new Map<string, T>();

  constructor(name: string) {
    this.name = name;
  }

  /**
   * 答え方を登録する。
   *
   * @throws Error 同じ名前がすでに登録されているとき。上書きを許すと、
   *   後から登録したものが黙って前のものを消し、どちらが使われるかが登録の順で決まる
   */
  add(key: string, value: T): void {
    if (this.#entries.has(key)) {
      throw new Error(`${this.name}「${key}」はすでに登録されている`);
    }
    this.#entries.set(key, value);
  }

  /**
   * 名前で答え方を引く。
   *
   * @throws Error 登録されていない名前のとき。既定の答え方に丸めると、
   *   書き間違いや登録漏れに気づけないまま、違う答え方で動き続ける
   */
  get(key: string): T {
    // 値が undefined かどうかではなく、登録されているかどうかで決める。
    // 答え方そのものが undefined や 0 のような値でも、登録されていれば引ける。
    if (!this.#entries.has(key)) {
      throw new Error(`${this.name}「${key}」は登録されていない`);
    }
    return this.#entries.get(key) as T;
  }

  /** その名前が登録されているか。 */
  has(key: string): boolean {
    return this.#entries.has(key);
  }

  /** 登録されている名前の一覧。登録した順に並ぶ。 */
  keys(): string[] {
    return [...this.#entries.keys()];
  }
}
