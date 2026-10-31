/**
 * Chain of Responsibility — 規則を優先順に並べ、先頭から「自分の出番か」を尋ねていく。
 *
 * 規則（`Handler`）は、自分の出番なら答えを返し、そうでなければ null を返して次に譲る。
 * 最初に答えた規則の答えを採る。どの規則も答えなければ、あらかじめ決めた答えを採る。
 *
 * 1つの長い関数に if を順に並べる書き方と比べて、並びの操作がそのまま振る舞いの操作になる。
 *
 * - 規則を試しに外す … 並びから1行消す
 * - 規則を試しに足す … 並びに1行足す
 * - 優先順を変える … 行を入れ替える
 *
 * どの規則も、ほかの規則の存在を知らない。長い関数のどこに差し込むとどの分岐が
 * 飛ばされるかを、読んで確認する必要がない。
 *
 * 並びの順が意味を持つ。前の規則が広い範囲で答えると、後ろの規則は一度も呼ばれない。
 *
 * 規則に次の規則への参照を持たせて、規則どうしを鎖のようにつなぐ形は採らない。
 * 並びを配列で持てば、順番は並びの側だけが知っていればよい。
 */

/** 規則1つ。 */
export interface Handler<C, R> {
  /**
   * 記録と説明のための名前。どの規則が答えたかを残すときに使う。
   *
   * 関数の名前（`.name`）では代わりにならない。並びの中にじかに書いた無名関数は、
   * 名前が空文字になる。
   */
  readonly name: string;
  /**
   * 自分の出番なら答えを返す。出番でなければ null を返して次に譲る。
   *
   * 状況は読むだけで、書き換えない。書き換えると、後ろの規則が別の状況を見て判断する。
   * メソッドではなく関数を持つ項目の形で書いているのは、状況の型の向きを
   * 型検査で確認するため（`command.ts` の `CommandSource` と同じ理由）。
   */
  readonly handle: (context: Readonly<C>) => R | null;
}

/** 答えと、それを返した規則。 */
export interface Resolution<C, R> {
  readonly result: R;
  /** 答えた規則。どれも答えず、あらかじめ決めた答えを採ったときは null。 */
  readonly handledBy: Handler<C, R> | null;
}

/**
 * 規則を先頭から試し、最初に返ってきた答えを採る。
 *
 * 答えの型 `R` には null と undefined を含められないようにしてある（`NonNullable<unknown>`）。
 * null は「次に譲る」の意味に使うので、答えそのものが null だと区別がつかない。
 * 含めようとすると、型エラーの文面には `R` が `{}` として出る。
 * 0 や空文字や false は答えとして扱う。
 *
 * 規則が投げた例外は、そのまま呼び出し側へ伝わる。後ろの規則は呼ばれない。
 *
 * @param chain 規則の並び。前にあるものほど優先される
 * @param context 規則が判断に使う状況
 * @param fallback どの規則も答えなかったときの答え
 */
export function resolve<C, R extends NonNullable<unknown>>(
  chain: readonly Handler<C, R>[],
  context: Readonly<C>,
  fallback: R,
): Resolution<C, R> {
  for (const handler of chain) {
    const result = handler.handle(context);
    if (result !== null) return { result, handledBy: handler };
  }
  return { result: fallback, handledBy: null };
}
