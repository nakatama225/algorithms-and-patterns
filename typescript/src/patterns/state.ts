/**
 * State — 取りうる状態を閉じた union で表し、状態ごとに持つ値を分ける。
 *
 * 状態を文字列の印（`'idle'` `'connecting'` …）と、その状態でだけ意味を持つ値
 * （試行の回数、切れた理由 …）に分けて別々に持つと、どの状態のときにどの値を
 * 読んでよいかが型に現れない。待機中なのに試行の回数が残っている、という値が作れてしまう。
 *
 * ここでは状態ごとに型を1つ作り、その状態でだけ意味を持つ値をその型にだけ持たせる。
 * 印の項目（`kind`）で見分けると、型検査はその分岐の中でだけ、その状態の値を読ませる。
 *
 * ```ts
 * type Connection =
 *   | { readonly kind: 'idle' }
 *   | { readonly kind: 'connecting'; readonly attempt: number }
 *   | { readonly kind: 'closed'; readonly reason: string };
 * ```
 *
 * 約束は3つ。
 *
 * 1. **状態を足したら、分岐の書き忘れを型検査に見つけさせる。** `switch` のすべての分岐を
 *    書いたあとの `default` で `assertNever` を呼ぶ。扱っていない状態が残っていれば、
 *    その状態は `never` にならず、型エラーになる
 * 2. **値は書き換えず、丸ごと差し替える。** すべての項目を `readonly` にする。
 *    中身を持たない状態（上の `idle`）は1つの値を使い回してよいが、そのときは
 *    `Object.freeze` しておく。`readonly` は型検査だけの約束で、実行時には止まらない
 * 3. **状態を見分けるのは `kind` だけにする。** 項目があるかどうか（`'attempt' in state`）で
 *    見分けると、同じ名前の項目を別の状態に足したときに黙って壊れる
 *
 * 交換しているもの：状態を1つ足すたびに、その状態を扱うすべての分岐に手を入れる。
 * 答え方を後から足せる形（`strategy.ts`）とは逆で、足す手間と引き換えに、
 * 扱い忘れを実行する前に見つけられる。
 */

/**
 * `switch` で union のすべての場合を扱ったことを、型検査で確認する。
 *
 * すべての分岐を書いたあとの `default` で呼ぶ。扱い忘れた場合が残っていると、
 * 引数の型が `never` にならず、呼んだ行が型エラーになる。
 *
 * 型をすり抜けた値（外から読み込んだ、知らない印を持つ値など）が実行時に届いたら、
 * 例外を投げて止まる。黙って何もしないと、知らない状態のまま処理が進む。
 *
 * @throws Error いつでも。ここに届くこと自体が想定外
 */
export function assertNever(value: never): never {
  throw new Error(`扱っていない状態: ${describe(value)}`);
}

/**
 * 知らせに載せるための文字列にする。
 *
 * JSON にできない値（循環する参照、BigInt）でも、ここで別の例外を投げないようにする。
 * 投げると、本当に知らせたい「扱っていない状態」が隠れる。文字列にもできない値
 * （プロトタイプを持たないオブジェクトなど）は、型の名前だけを載せる。
 */
function describe(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
}
